/**
 * Pre-submission preflight against a deployed URL. Checks what the directory
 * form and reviewers will touch before you open claude.ai/directory/manage.
 *
 *   node scripts/preflight.mjs https://your-host.example.com [/holidays]
 *
 * Exits non-zero on any failure.
 */

import { client, toolListProblems } from '../eval/mcp-client.mjs';

const base = (process.argv[2] ?? process.env.EVAL_URL ?? '').replace(/\/$/, '');
const path = process.argv[3] ?? '/holidays';
if (!base) {
  console.error('Usage: node scripts/preflight.mjs https://your-host.example.com [/connector-path]');
  process.exit(2);
}

let failed = 0;
const check = (ok, label, note = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${note ? `  ${note}` : ''}`);
};

const endpoint = `${base}${path}`;
const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);

check(local || endpoint.startsWith('https://'), 'endpoint is https', local ? '(localhost run: https is checked on deploy)' : '');
check(!endpoint.endsWith('/'), 'endpoint has no trailing slash');

for (const method of ['GET', 'POST']) {
  const res = await fetch(endpoint, { method, redirect: 'manual', headers: method === 'POST' ? { 'content-type': 'application/json', accept: 'application/json, text/event-stream' } : {}, body: method === 'POST' ? '{}' : undefined });
  check(!(res.status >= 300 && res.status < 400), `${method} ${path} does not redirect`, `HTTP ${res.status}${res.headers.get('location') ? ` to ${res.headers.get('location')}` : ''}`);
  check(res.status !== 403 && res.status !== 429, `${method} ${path} is not blocked by a WAF or rate limiter`, `HTTP ${res.status}`);
}

const pages = ['/docs/holidays', '/privacy', '/terms', '/support', '/.well-known/security.txt'];
for (const p of pages) {
  const res = await fetch(`${base}${p}`, { redirect: 'manual' });
  check(res.status === 200, `${p} returns 200`, `HTTP ${res.status}`);
}

try {
  const c = client(endpoint);
  const info = await c.init();
  check(Boolean(info.serverInfo?.name), 'initialize returns serverInfo', `${info.serverInfo?.name} ${info.serverInfo?.version}, protocol ${info.protocolVersion}`);
  const { tools } = await c.listTools();
  const problems = toolListProblems(tools);
  check(problems.length === 0, `tools/list: ${tools.length} tools pass the annotation rules`, problems.join('; '));
  const dashes = tools.filter((t) => /[\u2014\u2013]/.test(`${t.title ?? ''} ${t.description ?? ''}`));
  check(dashes.length === 0, 'no em or en dashes in tool titles or descriptions', dashes.map((t) => t.name).join(', '));
} catch (e) {
  check(false, 'MCP handshake', e instanceof Error ? e.message : String(e));
}

console.log(failed ? `\n${failed} check(s) failed.` : '\nPreflight passed. Next: add the URL as a custom connector in Claude and call every tool from a chat.');
if (failed) process.exitCode = 1;
