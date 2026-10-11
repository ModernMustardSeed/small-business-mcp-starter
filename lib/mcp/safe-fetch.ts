/**
 * SSRF-safe fetch for any tool that requests a URL a user (or Claude) supplied.
 *
 * Your server runs inside a cloud network that can reach things the public
 * internet cannot: metadata endpoints, databases, internal dashboards. A tool
 * that fetches "any URL" without a guard is a door into all of it. Route every
 * outbound request built from user input through safeFetch, which refuses
 * anything that is not a public web server:
 *
 *   - http and https only, ports 80 and 443 only, no user:password@ in the URL.
 *   - No names that only mean something on a private network (localhost,
 *     .local, .internal, .home.arpa, single-label names).
 *   - Every address a name resolves to is checked against the private,
 *     loopback, link-local (169.254.0.0/16, where cloud metadata lives), CGNAT,
 *     multicast, reserved and documentation ranges, IPv4 and IPv6. The check
 *     runs inside the socket's own DNS lookup, so the address that is checked
 *     is the address that is dialed, and a rebinding DNS answer cannot slip
 *     between the two.
 *   - Redirects are followed by hand, at most five, and every hop is checked
 *     again from the top.
 *   - Every response is capped in bytes (after decompression, so a gzip bomb
 *     stops at the cap) and every request has a hard deadline.
 *
 * Error messages are sentences a person can act on, because the directory
 * review fails generic errors (Policy 5A).
 */

import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import type { Readable } from 'node:stream';

export type BlockReason =
  | 'bad_url'
  | 'bad_scheme'
  | 'bad_port'
  | 'credentials'
  | 'private_name'
  | 'private_address'
  | 'too_many_redirects';

export class BlockedTargetError extends Error {
  readonly reason: BlockReason;
  readonly target: string;
  constructor(reason: BlockReason, target: string, message: string) {
    super(message);
    this.name = 'BlockedTargetError';
    this.reason = reason;
    this.target = target;
  }
}

/* Address ranges */

const BLOCKED = new net.BlockList();
const V4: [string, number][] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata (169.254.169.254)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
];
const V6: [string, number][] = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64, embeds an IPv4 address we cannot vouch for
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard
  ['2001::', 32], // Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4, embeds an IPv4 address
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local, deprecated
  ['ff00::', 8], // multicast
];
for (const [a, p] of V4) BLOCKED.addSubnet(a, p, 'ipv4');
for (const [a, p] of V6) BLOCKED.addSubnet(a, p, 'ipv6');

/** True when an IP literal is anything other than a public unicast address. */
export function isBlockedAddress(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const family = net.isIP(bare);
  if (family === 4) return BLOCKED.check(bare, 'ipv4');
  if (family === 6) {
    // IPv4-mapped (::ffff:a.b.c.d) is judged by the IPv4 address inside it.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(bare);
    if (mapped) return BLOCKED.check(mapped[1], 'ipv4');
    const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(bare);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return BLOCKED.check(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`, 'ipv4');
    }
    return BLOCKED.check(bare, 'ipv6');
  }
  // Not an address at all: refuse rather than guess.
  return true;
}

const PRIVATE_SUFFIX = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|home\.arpa|localdomain)$/i;
const PUBLIC_ONLY = 'Only public web addresses can be fetched.';

/**
 * Parse and check a URL without touching the network. Throws
 * BlockedTargetError with a sentence a person can act on.
 */
export function checkUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BlockedTargetError('bad_url', input, `"${input.slice(0, 200)}" is not a valid web address. Include the scheme, for example https://example.com.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedTargetError('bad_scheme', input, `Only http and https addresses can be fetched, not ${url.protocol.replace(':', '')}.`);
  }
  if (url.username || url.password) {
    throw new BlockedTargetError('credentials', input, 'Addresses with a username or password in them cannot be fetched. Remove the user:password@ part.');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new BlockedTargetError('bad_port', input, `Only the standard web ports 80 and 443 can be fetched, not port ${url.port}.`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host) throw new BlockedTargetError('bad_url', input, 'That address has no host name.');
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new BlockedTargetError('private_address', input, `${host} is a private, loopback, link-local or reserved address. ${PUBLIC_ONLY}`);
    }
    return url;
  }
  if (!host.includes('.') || PRIVATE_SUFFIX.test(host)) {
    throw new BlockedTargetError('private_name', input, `${host} is a private network name. ${PUBLIC_ONLY}`);
  }
  return url;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void;

/**
 * A drop-in for the socket's DNS lookup that refuses private answers. Pass it
 * to every http, https and tls connection a tool opens.
 */
export function guardedLookup(hostname: string, options: dns.LookupOptions | number | LookupCb, cb?: LookupCb): void {
  const callback = (typeof options === 'function' ? options : cb) as LookupCb;
  const opts: dns.LookupOptions = typeof options === 'object' && options !== null ? options : {};
  dns.lookup(hostname, { all: true, family: opts.family ?? 0, hints: opts.hints }, (err, addresses) => {
    if (err) return callback(err);
    const list = (addresses as dns.LookupAddress[]).filter((a) => a && typeof a.address === 'string');
    if (!list.length) {
      const e = new Error(`${hostname} did not resolve to any address.`) as NodeJS.ErrnoException;
      e.code = 'ENOTFOUND';
      return callback(e);
    }
    const bad = list.find((a) => isBlockedAddress(a.address));
    if (bad) {
      return callback(new BlockedTargetError('private_address', hostname, `${hostname} resolves to ${bad.address}, a private, loopback, link-local or reserved address. ${PUBLIC_ONLY}`) as unknown as NodeJS.ErrnoException);
    }
    if (opts.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

/** Resolve a host and throw when any answer is private. Useful for a clear early error. */
export async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new BlockedTargetError('private_address', host, `${host} is a private, loopback, link-local or reserved address. ${PUBLIC_ONLY}`);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    guardedLookup(host, { all: true }, (err) => (err ? reject(err) : resolve()));
  });
}

/* Fetching */

export type SafeResponse = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  /** True when the body was cut at maxBytes. */
  truncated: boolean;
  /** The URL of the last hop. */
  finalUrl: string;
  /** Every URL visited before the last one. */
  redirects: string[];
  /** Milliseconds from the start of the last hop to its response headers. */
  ttfbMs: number;
};

export type SafeFetchOptions = {
  /** Hard deadline for the whole call, every hop included. */
  timeoutMs: number;
  /** Cap on the decompressed body. */
  maxBytes: number;
  /** 0 returns the first 3xx as is. Never more than 5. */
  maxRedirects?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'HEAD';
};

export const MAX_REDIRECTS = 5;

function decoderFor(encoding: string | undefined): zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress | null {
  const e = (encoding ?? '').toLowerCase().trim();
  if (e === 'gzip' || e === 'x-gzip') return zlib.createGunzip();
  if (e === 'deflate') return zlib.createInflate();
  if (e === 'br') return zlib.createBrotliDecompress();
  return null;
}

function oneHop(url: URL, opts: SafeFetchOptions, deadline: number): Promise<Omit<SafeResponse, 'finalUrl' | 'redirects'>> {
  return new Promise((resolve, reject) => {
    const left = deadline - Date.now();
    if (left <= 0) return reject(new Error('timeout'));
    const mod = url.protocol === 'https:' ? https : http;
    const started = Date.now();
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const req = mod.request(
      url,
      {
        method: opts.method ?? 'GET',
        headers: { 'accept-encoding': 'gzip, deflate, br', ...opts.headers },
        lookup: guardedLookup as unknown as net.LookupFunction,
        // A fresh socket per request, so the guarded lookup always runs.
        agent: false,
      },
      (res) => {
        const ttfbMs = Date.now() - started;
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (v === undefined) continue;
          headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
        }
        const status = res.statusCode ?? 0;
        const isRedirect = status >= 300 && status < 400 && Boolean(headers.location);
        if (isRedirect || opts.method === 'HEAD') {
          res.resume();
          return finish(() => resolve({ status, headers, body: Buffer.alloc(0), truncated: false, ttfbMs }));
        }
        const dec = decoderFor(headers['content-encoding']);
        const stream: Readable = dec ? res.pipe(dec) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        const done = () =>
          finish(() => {
            req.destroy();
            resolve({ status, headers, body: Buffer.concat(chunks), truncated, ttfbMs });
          });
        stream.on('data', (c: Buffer) => {
          if (truncated) return;
          const room = opts.maxBytes - size;
          if (c.length >= room) {
            chunks.push(c.subarray(0, room));
            size += room;
            truncated = true;
            done();
            return;
          }
          chunks.push(c);
          size += c.length;
        });
        stream.on('end', done);
        stream.on('error', (e) => (chunks.length ? done() : finish(() => reject(e))));
        res.on('error', (e) => (chunks.length ? done() : finish(() => reject(e))));
      },
    );
    const timer = setTimeout(() => {
      req.destroy();
      finish(() => reject(new Error('timeout')));
    }, left);
    req.on('error', (e) => finish(() => reject(e)));
    req.end();
  });
}

/** A redirect target gets the same checks as the first URL. */
export function nextHop(absoluteLocation: string): URL {
  return checkUrl(absoluteLocation);
}

/**
 * GET a public URL with every guard on. Throws BlockedTargetError when any hop
 * is refused, and a plain Error on network failure or timeout.
 */
export async function safeFetch(input: string, opts: SafeFetchOptions): Promise<SafeResponse> {
  const deadline = Date.now() + opts.timeoutMs;
  const maxRedirects = Math.min(MAX_REDIRECTS, Math.max(0, opts.maxRedirects ?? MAX_REDIRECTS));
  const redirects: string[] = [];
  let url = checkUrl(input);
  for (;;) {
    const res = await oneHop(url, opts, deadline);
    const location = res.headers.location;
    if (res.status >= 300 && res.status < 400 && location && maxRedirects > 0) {
      if (redirects.length >= maxRedirects) {
        throw new BlockedTargetError('too_many_redirects', input, `${input} redirected more than ${maxRedirects} times, so the request stopped following it.`);
      }
      let next: string;
      try {
        next = new URL(location, url).toString();
      } catch {
        return { ...res, finalUrl: url.toString(), redirects };
      }
      redirects.push(url.toString());
      url = nextHop(next);
      continue;
    }
    return { ...res, finalUrl: url.toString(), redirects };
  }
}
