/**
 * Rate limits and a small cache, designed for Claude's shared egress range.
 *
 * Every claude.ai user reaches your server from the same Anthropic range,
 * 160.79.104.0/21 (https://platform.claude.com/docs/en/api/ip-addresses).
 * A per-IP limit therefore throttles every Claude user as one client, and a
 * WAF or limiter that answers that range with 403 or 429 breaks the connector
 * outright (https://claude.com/docs/connectors/building/troubleshooting).
 * So nothing here is keyed by IP:
 *
 *   - allowCall: every call to a tool, per server instance, in memory. Cheap
 *     insurance against a runaway loop, and it costs no Redis command.
 *   - allowGlobal: limits shared by every instance (per hour, per day, per
 *     target), stored in Redis. Use it for anything that costs money or load
 *     on someone else's server.
 *
 * A refusal is a normal tool result with isError and a sentence that says
 * when to try again, never an HTTP 429. When Redis is not configured or does
 * not answer, each instance falls back to memory at one tenth of the global
 * numbers, so an outage tightens limits rather than lifting them.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/** Namespaces every Redis key, so one database can serve several projects. */
export const KEY_PREFIX = 'mcp-starter';

const REDIS_TIMEOUT_MS = 1_500;

function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token, retry: { retries: 1, backoff: () => 100 } });
}

const redis = redisFromEnv();

export function limiterBackend(): 'redis' | 'memory' {
  return redis ? 'redis' : 'memory';
}

/* In-memory fixed windows */

type Window = { count: number; resetAt: number };
const memory = new Map<string, Window>();

/** Fixed window aligned to the clock, so "try again after" is a clean time. */
export function memoryLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; resetAt: number } {
  const start = Math.floor(now / windowMs) * windowMs;
  const resetAt = start + windowMs;
  const id = `${key}:${start}`;
  const w = memory.get(id) ?? { count: 0, resetAt };
  if (w.count >= limit) return { ok: false, resetAt };
  w.count += 1;
  memory.set(id, w);
  if (memory.size > 5_000) {
    for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
  }
  return { ok: true, resetAt };
}

export function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

export type LimitResult = { ok: true } | { ok: false; message: string };

/** Every call to a tool, cached or not, on this server instance. */
export function allowCall(tool: string, perMinute: number, now = Date.now()): LimitResult {
  const res = memoryLimit(`calls:${tool}`, perMinute, 60_000, now);
  return res.ok ? { ok: true } : { ok: false, message: `${tool} is answering more than ${perMinute} calls a minute right now. Try again after ${hhmm(res.resetAt)}.` };
}

/* Global limits */

export type Rule = {
  /** Stable id, used in the Redis key. */
  name: string;
  limit: number;
  window: '1 m' | '10 m' | '1 h' | '1 d';
  /** How the window reads in a sentence: "this minute", "this hour", "today". */
  label: string;
  /** Keep the full limit in memory fallback, for per-target rules where a tenth would round to zero. */
  exactInMemory?: boolean;
};

const WINDOW_MS: Record<Rule['window'], number> = { '1 m': 60_000, '10 m': 600_000, '1 h': 3_600_000, '1 d': 86_400_000 };

const upstash = new Map<string, Ratelimit>();
function rl(rule: Rule): Ratelimit | null {
  if (!redis) return null;
  let r = upstash.get(rule.name);
  if (!r) {
    r = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(rule.limit, rule.window), prefix: `${KEY_PREFIX}:rl:${rule.name}`, analytics: false, timeout: REDIS_TIMEOUT_MS });
    upstash.set(rule.name, r);
  }
  return r;
}

async function take(rule: Rule, key: string): Promise<{ ok: boolean; resetAt: number }> {
  const r = rl(rule);
  if (r) {
    try {
      const res = await r.limit(key);
      if (res.reason !== 'timeout') return { ok: res.success, resetAt: res.reset };
    } catch {
      // fall through to memory
    }
  }
  const scaled = rule.exactInMemory ? rule.limit : Math.max(1, Math.floor(rule.limit / 10));
  return memoryLimit(`${rule.name}:${key}`, scaled, WINDOW_MS[rule.window]);
}

/**
 * Check rules in order and stop at the first refusal. `what` names the thing
 * being limited in the sentence the user reads, for example "The holiday
 * calendar" or "Fresh scans of example.com".
 */
export async function allowGlobal(what: string, rules: Rule[], key = 'global'): Promise<LimitResult> {
  for (const rule of rules) {
    const t = await take(rule, key);
    if (!t.ok) return { ok: false, message: `${what} has reached ${rule.label}'s limit. Try again after ${hhmm(t.resetAt)}.` };
  }
  return { ok: true };
}

/* Cache */

type Entry<T> = { value: T; expiresAt: number };
const memCache = new Map<string, Entry<unknown>>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      const v = await Promise.race([redis.get<T>(`${KEY_PREFIX}:cache:${key}`), new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), REDIS_TIMEOUT_MS))]);
      if (v !== 'timeout') return (v as T | null) ?? null;
    } catch {
      // fall through to memory
    }
  }
  const e = memCache.get(key);
  if (!e) return null;
  if (e.expiresAt <= Date.now()) {
    memCache.delete(key);
    return null;
  }
  return e.value as T;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (memCache.size > 300) {
    const oldest = memCache.keys().next().value;
    if (oldest !== undefined) memCache.delete(oldest);
  }
  if (redis) {
    try {
      await Promise.race([redis.set(`${KEY_PREFIX}:cache:${key}`, value, { ex: ttlSeconds }), new Promise((r) => setTimeout(r, REDIS_TIMEOUT_MS))]);
    } catch {
      // the in-memory copy still serves this instance
    }
  }
}
