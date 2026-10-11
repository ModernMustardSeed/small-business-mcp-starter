/**
 * The example connector's endpoint: https://YOUR-HOST/holidays
 *
 * Copy this file to app/<your-connector>/route.ts for each connector you add.
 * One URL per connector, no trailing slash, and never a redirect: Claude drops
 * the Authorization header when a registered URL redirects to another host.
 */

import { createMcpHandler } from 'mcp-handler';
import { registerTools, type ToolRegistrar } from '@/lib/mcp/tool.ts';
import { HOLIDAY_TOOLS, INSTRUCTIONS, SERVER_NAME, SERVER_VERSION } from '@/lib/holidays/tools.ts';
import { SITE } from '@/lib/site.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Claude waits up to 240 seconds for a tool call on claude.ai and Desktop.
// Pure arithmetic needs a fraction of a second; keep this well under 240.
export const maxDuration = 30;

const PATH = '/holidays';

const handler = createMcpHandler(
  (server) => {
    registerTools(server as unknown as ToolRegistrar, 'holidays', HOLIDAY_TOOLS);
  },
  {
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    instructions: INSTRUCTIONS,
  },
);

/** A browser opening the endpoint gets a pointer to the docs instead of a protocol error. */
async function GET(request: Request): Promise<Response> {
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html') && !accept.includes('text/event-stream')) {
    const url = `${SITE.url}${PATH}`;
    const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${SERVER_NAME}: MCP endpoint</title></head><body style="font-family:system-ui,sans-serif;background:#fcfaf3;color:#141210;max-width:40rem;margin:4rem auto;padding:0 1.25rem;line-height:1.5"><p style="font-family:monospace;text-transform:uppercase;letter-spacing:.14em;font-size:.75rem">MCP endpoint</p><h1>${SERVER_NAME}</h1><p>This address is a remote MCP server (Streamable HTTP). Add it to Claude as a custom connector: <code>${url}</code></p><p><a href="/docs/holidays">Documentation</a>, <a href="/privacy">privacy policy</a>, <a href="/terms">terms</a>, <a href="/support">support</a>.</p></body></html>`;
    return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  return handler(request);
}

export { GET, handler as POST, handler as DELETE };
