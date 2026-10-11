/**
 * Tool conventions that pass the Claude directory review.
 *
 * Every tool in this kit is declared as a ToolSpec and registered through
 * registerTools, which enforces the rules reviewers check:
 *
 *   - A snake_case name of 64 characters or fewer (Policy 5C).
 *   - A title and the applicable readOnlyHint or destructiveHint
 *     (Policy 5E, https://claude.com/docs/connectors/building/review-criteria).
 *   - A description that says what the tool does and when to use it, with no
 *     instructions that steer Claude toward other tools, sources or products
 *     (Policy 2A to 2G, 4C).
 *   - Specific error messages, never "Internal Server Error" (Policy 5A).
 *   - Results capped well under Claude's limits (about 150,000 characters on
 *     claude.ai and Desktop, 25,000 tokens by default in Claude Code), because
 *     Policy 5B asks servers to be frugal with tokens.
 *   - One log line per call holding the tool name, latency, status, size and
 *     only the fields you choose, never the conversation (Policy 1D).
 *
 * A spec that breaks a rule throws when the route module loads, so the
 * mistake shows up in `pnpm test` and `pnpm build`, not in review.
 */

import type { z } from 'zod';
import { allowCall, allowGlobal, type Rule } from './limits.ts';

export type Outcome<T = unknown> = { ok: true; data: T } | { ok: false; code: string; message: string };

export function ok<T>(data: T): Outcome<T> {
  return { ok: true, data };
}

export function fail(code: string, message: string): Outcome<never> {
  return { ok: false, code, message };
}

export type Annotations = {
  /** True when the tool changes nothing anywhere. Read-only tools run without a confirmation prompt. */
  readOnlyHint: boolean;
  /** Required when readOnlyHint is false: true when the tool can delete or overwrite data. */
  destructiveHint?: boolean;
  /** True when the same arguments always produce the same effect. */
  idempotentHint?: boolean;
  /** True when the tool reaches systems outside your server (the web, a third-party API). */
  openWorldHint?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolSpec<S extends z.ZodObject<any> = z.ZodObject<any>> = {
  name: string;
  title: string;
  description: string;
  inputSchema: S;
  annotations: Annotations;
  /** Calls per minute per server instance before the tool answers "try again after". */
  perMinute: number;
  /** Optional limits shared by every instance, checked before the handler runs. */
  global?: { what: string; rules: Rule[] };
  /** Fields safe to log. Return only what you need to operate the server. */
  logFields?: (args: z.infer<S>) => Record<string, string | number | boolean | null>;
  run: (args: z.infer<S>) => Outcome | Promise<Outcome>;
};

/** Hard cap on one result. Well under claude.ai's ~150,000 characters and Claude Code's 25,000-token default. */
export const MAX_RESULT_CHARS = 60_000;

export const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Phrases that read as instructions to Claude rather than a description of
 * the tool. Reviewers reject descriptions that steer Claude toward other
 * tools or sources, override instructions, or promote a product.
 */
export const STEERING_PATTERNS: [RegExp, string][] = [
  [/\b(always|first|then|next|afterwards?)\s+(call|use|run|invoke)\b/i, 'tells Claude which tool to call'],
  [/\b(before|after)\s+(calling|using)\s+(this|any|another|other)\b/i, 'tells Claude how to sequence tools'],
  [/\b(instead of|rather than)\s+(other|another|any)\s+tools?\b/i, 'interferes with other tools'],
  [/\b(do not|don't|never)\s+(call|use)\s+(other|another|any)\b/i, 'interferes with other tools'],
  [/\bignore\s+(all|any|previous|prior|the)\b/i, 'tries to override instructions'],
  [/\b(system prompt|you are an?|act as)\b/i, 'tries to set Claude\'s behavior'],
  [/\b(fetch|load|read)\s+(your\s+)?instructions\b/i, 'pulls instructions from an external source'],
  [/\b(book a call|sign up|buy now|subscribe|upgrade to|free trial|contact (us|sales))\b/i, 'promotes a product or service'],
  [/\b(tell|remind) the user to\b/i, 'tells Claude what to say to the user'],
];

export type ConventionProblem = { tool: string; problem: string };

export function conventionProblems(spec: Pick<ToolSpec, 'name' | 'title' | 'description' | 'annotations' | 'perMinute'>): ConventionProblem[] {
  const out: ConventionProblem[] = [];
  const p = (problem: string) => out.push({ tool: spec.name, problem });
  if (spec.name.length > 64) p(`name is ${spec.name.length} characters; the limit is 64 (Policy 5C)`);
  if (!NAME_PATTERN.test(spec.name)) p('name must be snake_case: lowercase letters, digits and underscores, starting with a letter');
  if (!spec.title.trim()) p('title is empty; every tool needs a title (Policy 5E)');
  if (spec.title.length > 60) p(`title is ${spec.title.length} characters; keep it under 60 so it reads as a label`);
  if (typeof spec.annotations.readOnlyHint !== 'boolean') p('readOnlyHint must be declared true or false');
  if (spec.annotations.readOnlyHint === false && typeof spec.annotations.destructiveHint !== 'boolean') p('a tool that is not read-only must declare destructiveHint');
  if (spec.annotations.readOnlyHint === true && spec.annotations.destructiveHint === true) p('a read-only tool cannot be destructive');
  if (spec.description.trim().length < 40) p('description is under 40 characters; say what the tool does and when to use it (Policy 2A)');
  if (spec.description.length > 2_000) p(`description is ${spec.description.length} characters; keep it under 2,000 (Policy 5B)`);
  for (const [re, why] of STEERING_PATTERNS) {
    const m = re.exec(spec.description);
    if (m) p(`description ${why}: "${m[0]}" (Policy 2D to 2G, 4C)`);
  }
  if (/[\u2014\u2013]/.test(spec.description + spec.title)) p('title or description contains an em or en dash');
  if (!(spec.perMinute > 0)) p('perMinute must be a positive number');
  return out;
}

export function assertConventions(specs: Pick<ToolSpec, 'name' | 'title' | 'description' | 'annotations' | 'perMinute'>[]): void {
  const names = new Set<string>();
  const problems: ConventionProblem[] = [];
  for (const s of specs) {
    if (names.has(s.name)) problems.push({ tool: s.name, problem: 'name is registered twice' });
    names.add(s.name);
    problems.push(...conventionProblems(s));
  }
  if (problems.length) {
    throw new Error(`Tool conventions failed:\n${problems.map((x) => `  ${x.tool}: ${x.problem}`).join('\n')}`);
  }
}

/* Results */

export type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

export function textResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 1) }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** Turn an Outcome into a tool result, enforcing the size cap. */
export function toResult(outcome: Outcome, tool: string, maxChars = MAX_RESULT_CHARS): { result: ToolResult; status: string; chars: number } {
  if (!outcome.ok) return { result: errorResult(outcome.message), status: outcome.code, chars: outcome.message.length };
  const r = textResult(outcome.data);
  const chars = r.content[0].text.length;
  if (chars > maxChars) {
    const msg = `${tool} produced ${chars.toLocaleString('en-US')} characters, over this server's cap of ${maxChars.toLocaleString('en-US')}. Ask for a smaller range or a lower limit.`;
    return { result: errorResult(msg), status: 'too_large', chars: msg.length };
  }
  return { result: r, status: 'ok', chars };
}

/* Running a call */

export type Logger = (line: Record<string, unknown>) => void;
const defaultLogger: Logger = (line) => console.log(JSON.stringify(line));

/**
 * Run one tool call with every guard: per-instance limit, global limits,
 * exception capture with a specific message, size cap, one log line.
 */
export async function runTool<S extends ToolSpec>(server: string, spec: S, args: z.infer<S['inputSchema']>, log: Logger = defaultLogger): Promise<ToolResult> {
  const started = Date.now();
  const fields = safeFields(spec, args);
  const line = (status: string, chars: number) => log({ evt: 'tool', server, tool: spec.name, ...fields, ms: Date.now() - started, status, chars });

  const local = allowCall(spec.name, spec.perMinute);
  if (!local.ok) {
    line('limited', local.message.length);
    return errorResult(local.message);
  }
  if (spec.global) {
    const g = await allowGlobal(spec.global.what, spec.global.rules);
    if (!g.ok) {
      line('limited', g.message.length);
      return errorResult(g.message);
    }
  }
  try {
    const outcome = await spec.run(args);
    const { result, status, chars } = toResult(outcome, spec.name);
    line(status, chars);
    return result;
  } catch (e) {
    line('exception', 0);
    log({ evt: 'tool_exception', server, tool: spec.name, message: e instanceof Error ? e.message.slice(0, 300) : 'unknown' });
    return errorResult(`${spec.name} hit an unexpected problem on the server and did not finish. Nothing was changed. Trying again in a minute usually works.`);
  }
}

/** The part of the MCP server object this kit uses. */
export type ToolRegistrar = {
  registerTool: (
    name: string,
    config: { title: string; description: string; inputSchema: ToolSpec['inputSchema']; annotations: Annotations & { title: string } },
    handler: (args: never) => Promise<ToolResult>,
  ) => unknown;
};

/** Check every spec, then register each one with the guards from runTool. */
export function registerTools(server: ToolRegistrar, serverName: string, specs: readonly ToolSpec[]): void {
  assertConventions([...specs]);
  for (const spec of specs) {
    server.registerTool(
      spec.name,
      { title: spec.title, description: spec.description, inputSchema: spec.inputSchema, annotations: { ...spec.annotations, title: spec.title } },
      (args: never) => runTool(serverName, spec, args),
    );
  }
}

function safeFields(spec: ToolSpec, args: unknown): Record<string, unknown> {
  if (!spec.logFields) return {};
  try {
    return spec.logFields(args as never);
  } catch {
    return {};
  }
}
