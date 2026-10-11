import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { BlockedTargetError, assertPublicHost, checkUrl, guardedLookup, isBlockedAddress, nextHop, safeFetch } from '../lib/mcp/safe-fetch.ts';

function reason(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof BlockedTargetError ? e.reason : `other:${(e as Error).message}`;
  }
}

test('blocks every private, loopback, link-local and reserved IPv4 range', () => {
  for (const ip of ['0.0.0.0', '10.0.0.1', '10.255.255.255', '100.64.0.1', '100.127.255.254', '127.0.0.1', '127.255.255.255', '169.254.169.254', '169.254.0.1', '172.16.0.1', '172.31.255.255', '192.0.0.8', '192.0.2.1', '192.168.1.1', '198.18.0.1', '198.51.100.7', '203.0.113.9', '224.0.0.1', '239.255.255.250', '240.0.0.1', '255.255.255.255']) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
});

test('allows ordinary public IPv4 addresses, including neighbours of blocked ranges', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '76.76.21.21', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1', '169.253.255.255', '11.0.0.1', '160.79.104.1']) {
    assert.equal(isBlockedAddress(ip), false, ip);
  }
});

test('blocks private and special IPv6, including IPv4-mapped private addresses', () => {
  for (const ip of ['::', '::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '::ffff:a9fe:a9fe', '::ffff:10.0.0.1', '64:ff9b::a9fe:a9fe', '2002:7f00:1::', '2001:db8::1', 'fec0::1', '[::1]']) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
  for (const ip of ['2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8']) {
    assert.equal(isBlockedAddress(ip), false, ip);
  }
});

test('anything that is not an address is refused, never guessed', () => {
  assert.equal(isBlockedAddress('not-an-ip'), true);
  assert.equal(isBlockedAddress(''), true);
});

test('checkUrl refuses the classic SSRF targets with a specific reason', () => {
  assert.equal(reason(() => checkUrl('http://169.254.169.254/latest/meta-data/')), 'private_address');
  assert.equal(reason(() => checkUrl('http://localhost/')), 'private_name');
  assert.equal(reason(() => checkUrl('http://foo.localhost/')), 'private_name');
  assert.equal(reason(() => checkUrl('http://metadata.google.internal/')), 'private_name');
  assert.equal(reason(() => checkUrl('http://printer.local/')), 'private_name');
  assert.equal(reason(() => checkUrl('http://intranet/')), 'private_name');
  assert.equal(reason(() => checkUrl('http://[::1]/')), 'private_address');
  assert.equal(reason(() => checkUrl('http://[fd00::1]/')), 'private_address');
  assert.equal(reason(() => checkUrl('http://10.0.0.1/')), 'private_address');
  assert.equal(reason(() => checkUrl('http://192.168.0.1:443/')), 'private_address');
});

test('checkUrl sees through alternate IPv4 spellings', () => {
  // The URL parser normalizes these to dotted quads before we check them.
  assert.equal(reason(() => checkUrl('http://2130706433/')), 'private_address');
  assert.equal(reason(() => checkUrl('http://0x7f000001/')), 'private_address');
  assert.equal(reason(() => checkUrl('http://0177.0.0.1/')), 'private_address');
  assert.equal(reason(() => checkUrl('http://127.1/')), 'private_address');
  assert.equal(reason(() => checkUrl('http://0/')), 'private_address');
  assert.equal(reason(() => checkUrl('http://[::ffff:169.254.169.254]/')), 'private_address');
});

test('checkUrl refuses other schemes, ports and credentials', () => {
  assert.equal(reason(() => checkUrl('file:///etc/passwd')), 'bad_scheme');
  assert.equal(reason(() => checkUrl('ftp://example.com/')), 'bad_scheme');
  assert.equal(reason(() => checkUrl('gopher://example.com/')), 'bad_scheme');
  assert.equal(reason(() => checkUrl('http://example.com:8080/')), 'bad_port');
  assert.equal(reason(() => checkUrl('https://example.com:22/')), 'bad_port');
  assert.equal(reason(() => checkUrl('http://user:pass@example.com/')), 'credentials');
  assert.equal(reason(() => checkUrl('not a url')), 'bad_url');
});

test('checkUrl accepts public sites on standard ports', () => {
  assert.equal(checkUrl('https://example.com/').hostname, 'example.com');
  assert.equal(checkUrl('http://example.com:80/a').pathname, '/a');
  assert.equal(checkUrl('https://example.com:443/').hostname, 'example.com');
  assert.equal(checkUrl('http://8.8.8.8/').hostname, '8.8.8.8');
});

test('a redirect hop into a private network is refused', () => {
  assert.equal(reason(() => nextHop('http://10.0.0.1/admin')), 'private_address');
  assert.equal(reason(() => nextHop('http://169.254.169.254/')), 'private_address');
  assert.equal(reason(() => nextHop('http://localhost:80/')), 'private_name');
  assert.equal(reason(() => nextHop('file:///etc/passwd')), 'bad_scheme');
  assert.equal(nextHop('https://www.example.com/').hostname, 'www.example.com');
});

test('the socket lookup guard refuses a name that resolves to loopback', async () => {
  // "localhost" never reaches DNS through checkUrl, but the socket guard is
  // the last line: it must refuse a private answer for any name.
  const err = await new Promise<unknown>((resolve) => guardedLookup('localhost', { all: true }, (e) => resolve(e)));
  assert.ok(err instanceof BlockedTargetError, 'expected BlockedTargetError');
  assert.equal((err as BlockedTargetError).reason, 'private_address');
  await assert.rejects(assertPublicHost('localhost'), BlockedTargetError);
  await assert.rejects(assertPublicHost('127.0.0.1'), BlockedTargetError);
});

test('safeFetch never connects to a loopback server, even one that is listening', async () => {
  let hits = 0;
  const server = http.createServer((_req, res) => {
    hits += 1;
    res.end('secret');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  try {
    // Port is non-standard too, so try both a standard-port loopback URL and this one.
    await assert.rejects(safeFetch(`http://127.0.0.1:${port}/`, { timeoutMs: 2000, maxBytes: 1000 }), BlockedTargetError);
    await assert.rejects(safeFetch('http://127.0.0.1/', { timeoutMs: 2000, maxBytes: 1000 }), BlockedTargetError);
    await assert.rejects(safeFetch('http://localhost/', { timeoutMs: 2000, maxBytes: 1000 }), BlockedTargetError);
    assert.equal(hits, 0);
  } finally {
    server.close();
  }
});
