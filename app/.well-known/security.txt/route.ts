/**
 * RFC 9116 security contact. The directory terms require a way to receive
 * vulnerability reports; this file is where security researchers look first.
 */

import { SITE } from '@/lib/site.ts';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const expires = new Date(Date.now() + 365 * 86_400_000);
  expires.setUTCHours(0, 0, 0, 0);
  const body = [
    `Contact: mailto:${SITE.securityEmail}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en',
    `Canonical: ${SITE.url}/.well-known/security.txt`,
    `Policy: ${SITE.url}/support`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
}
