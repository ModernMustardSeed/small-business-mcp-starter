/**
 * A minimal MCP Streamable HTTP client and eval runner. No dependencies.
 *
 * It talks to a live URL exactly as Claude does: initialize, list tools, call
 * tools. Each eval case is a real prompt plus the tool call Claude makes for
 * it and a check on what comes back. Nothing calls a model, so a run costs
 * nothing and needs no API key, and it is safe to run in CI.
 */

const PROTOCOL = '2025-06-18';

export function client(endpoint) {
  let id = 0;
  let session = null;
  const headers = () => {
    const h = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': PROTOCOL };
    if (session) h['mcp-session-id'] = session;
    return h;
  };

  async function rpc(method, params) {
    const res = await fetch(endpoint, { method: 'POST', headers: headers(), body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) throw new Error(`${method}: HTTP ${res.status} redirect to ${res.headers.get('location')}. Register the final URL; Claude drops Authorization on cross-host redirects.`);
    const sid = res.headers.get('mcp-session-id');
    if (sid) session = sid;
    const type = res.headers.get('content-type') ?? '';
    const text = await res.text();
    if (!res.ok) throw new Error(`${method}: HTTP ${res.status} ${text.slice(0, 300)}`);
    let msg;
    if (type.includes('text/event-stream')) {
      const lines = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter(Boolean);
      msg = lines.map((l) => JSON.parse(l)).find((m) => m.id === id);
    } else msg = JSON.parse(text);
    if (!msg) throw new Error(`${method}: no response message`);
    if (msg.error) throw new Error(`${method}: ${JSON.stringify(msg.error)}`);
    return msg.result;
  }

  return {
    async init() {
      const r = await rpc('initialize', { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'mcp-starter-eval', version: '1.0.0' } });
      await fetch(endpoint, { method: 'POST', headers: headers(), body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
      return r;
    },
    listTools: () => rpc('tools/list', {}),
    async call(name, args) {
      const started = Date.now();
      const r = await rpc('tools/call', { name, arguments: args });
      const text = (r.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      return { isError: !!r.isError, text, data, ms: Date.now() - started, chars: text.length };
    },
  };
}

/** The directory's tool rules, checked on what the live server advertises. */
export function toolListProblems(tools) {
  const out = [];
  for (const t of tools) {
    const a = t.annotations ?? {};
    if (t.name.length > 64) out.push(`${t.name}: name over 64 characters`);
    if (!t.title && !a.title) out.push(`${t.name}: no title`);
    if (typeof a.readOnlyHint !== 'boolean' && typeof a.destructiveHint !== 'boolean') out.push(`${t.name}: no readOnlyHint or destructiveHint`);
    if (a.readOnlyHint === false && typeof a.destructiveHint !== 'boolean') out.push(`${t.name}: write tool without destructiveHint`);
    if (!t.description || t.description.length < 40) out.push(`${t.name}: description missing or under 40 characters`);
    if (!t.inputSchema || t.inputSchema.type !== 'object') out.push(`${t.name}: inputSchema is not an object schema`);
  }
  return out;
}

/** Compose checks; the first one that does not return true is the verdict. */
export const all =
  (...checks) =>
  (r) => {
    for (const c of checks) {
      const v = c(r);
      if (v !== true) return v;
    }
    return true;
  };
export const succeeded = (r) => (r.isError ? `unexpected error: ${r.text.slice(0, 200)}` : r.data ? true : 'no JSON body');
export const under = (max) => (r) => (r.chars <= max ? true : `${r.chars} chars, over ${max}`);
export const errorMatching = (re) => (r) => (r.isError && re.test(r.text) ? true : `expected an error matching ${re}, got ${r.isError ? 'error' : 'success'}: ${r.text.slice(0, 160)}`);
export const specificError = (r) => (r.isError && r.text.length >= 30 && !/^(internal server error|bad request|error)\.?$/i.test(r.text.trim()) ? true : `error message is generic: "${r.text.slice(0, 80)}"`);

/**
 * Run the cases and print one line each. Exits non-zero on any failure.
 * Options: expectTools (names that must be listed), maxMs (latency budget per call).
 */
export async function runCases(endpoint, cases, { expectTools = [], maxMs = 10_000 } = {}) {
  const c = client(endpoint);
  const info = await c.init();
  console.log(`endpoint: ${endpoint}`);
  console.log(`server:   ${info.serverInfo?.name} ${info.serverInfo?.version} (protocol ${info.protocolVersion})\n`);
  const tools = (await c.listTools()).tools;
  let failed = 0;
  let total = 0;
  const line = (ok, label, extra = '') => {
    total++;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra}`);
  };

  const problems = toolListProblems(tools);
  line(problems.length === 0, `tools/list: ${tools.length} tools, every one titled, annotated, named in 64 characters or fewer`, problems.length ? `  ${problems.join('; ')}` : '');
  for (const name of expectTools) line(tools.some((t) => t.name === name), `tools/list includes ${name}`);

  const covered = new Set();
  for (const k of cases) {
    let ok = false;
    let note = '';
    let r = null;
    try {
      r = await c.call(k.tool, typeof k.args === 'function' ? k.args() : k.args);
      covered.add(k.tool);
      const verdict = k.check(r);
      ok = verdict === true && r.ms <= maxMs;
      note = verdict === true ? (r.ms > maxMs ? `slow: ${r.ms} ms` : '') : String(verdict);
    } catch (e) {
      note = e instanceof Error ? e.message : String(e);
    }
    line(ok, k.prompt ? `"${k.prompt}"` : k.name, `\n      [${k.tool}${r ? `, ${r.ms} ms, ${r.chars} chars${r.isError ? ', isError' : ''}` : ''}]${note ? `  ${note}` : ''}`);
  }
  const untested = tools.map((t) => t.name).filter((n) => !covered.has(n));
  line(untested.length === 0, 'every advertised tool was called at least once', untested.length ? `  untested: ${untested.join(', ')}` : '');

  console.log(`\n${total - failed} of ${total} passed`);
  if (failed) process.exitCode = 1;
  return { total, failed };
}
