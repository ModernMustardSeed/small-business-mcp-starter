import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowCall, allowGlobal, hhmm, limiterBackend, memoryLimit } from '../lib/mcp/limits.ts';

test('fixed windows align to the clock and reset on the boundary', () => {
  const t0 = Date.UTC(2026, 9, 11, 14, 0, 5);
  assert.equal(memoryLimit('w', 2, 60_000, t0).ok, true);
  assert.equal(memoryLimit('w', 2, 60_000, t0 + 1).ok, true);
  const third = memoryLimit('w', 2, 60_000, t0 + 2);
  assert.equal(third.ok, false);
  assert.equal(hhmm(third.resetAt), '14:01 UTC');
  assert.equal(memoryLimit('w', 2, 60_000, t0 + 60_000).ok, true);
});

test('allowCall is per tool, never per caller address', () => {
  const t0 = Date.UTC(2026, 9, 11, 15, 0, 0);
  assert.equal(allowCall('tool_a', 1, t0).ok, true);
  assert.equal(allowCall('tool_a', 1, t0).ok, false);
  assert.equal(allowCall('tool_b', 1, t0).ok, true);
});

test('without Redis, global rules fall back to memory at a tenth of the limit', async () => {
  assert.equal(limiterBackend(), 'memory');
  const rules = [{ name: 'tenth-test', limit: 20, window: '1 h' as const, label: 'this hour' }];
  assert.equal((await allowGlobal('The test', rules)).ok, true);
  assert.equal((await allowGlobal('The test', rules)).ok, true);
  const third = await allowGlobal('The test', rules);
  assert.equal(third.ok, false);
  assert.match(third.ok ? '' : third.message, /^The test has reached this hour's limit\. Try again after \d\d:\d\d UTC\.$/);
});

test('per-target rules keep their exact limit in memory', async () => {
  const rules = [{ name: 'target-test', limit: 1, window: '10 m' as const, label: 'the 10-minute window', exactInMemory: true }];
  assert.equal((await allowGlobal('Fresh reads of example.com', rules, 'example.com')).ok, true);
  assert.equal((await allowGlobal('Fresh reads of example.com', rules, 'example.com')).ok, false);
  assert.equal((await allowGlobal('Fresh reads of example.org', rules, 'example.org')).ok, true);
});
