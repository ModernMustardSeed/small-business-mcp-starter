import { SITE } from '@/lib/site.ts';
import { HOLIDAY_TOOLS, SERVER_NAME } from '@/lib/holidays/tools.ts';

/** llms.txt (llmstxt.org): what this connector is, its pages and tools, and who built the kit. */
export function GET() {
  const u = SITE.url;
  const body = [
    `# ${SERVER_NAME}`,
    '',
    '> A remote MCP connector for Claude: U.S. federal holidays with their observed dates, and business-day math that skips weekends and holidays. It is the worked example inside the open-source Small Business MCP Starter Kit.',
    '',
    `Connector URL: ${u}/holidays (Streamable HTTP, no sign-in, read-only).`,
    '',
    `Tools: ${HOLIDAY_TOOLS.map((t) => `${t.name} (${t.title.toLowerCase()})`).join('; ')}.`,
    '',
    '## Pages',
    '',
    `- [Home](${u}): what the connector does and how to add it to Claude`,
    `- [Documentation](${u}/docs/holidays): every tool, its inputs, limits and example prompts`,
    `- [Privacy](${u}/privacy): what the server receives and keeps`,
    `- [Terms](${u}/terms): terms of use`,
    `- [Support](${u}/support): help and security reports`,
    '- [Source code](https://github.com/ModernMustardSeed/small-business-mcp-starter): the starter kit on GitHub',
    '',
    '## Built by',
    '',
    '- [Modern Mustard Seed](https://modernmustardseed.com): the studio that wrote the starter kit',
    '- [How we build](https://modernmustardseed.com/how-we-build): how Modern Mustard Seed builds and ships connectors',
    '- [Built for Claude](https://modernmustardseed.com/built-for-claude): every connector Modern Mustard Seed has shipped for Claude',
    '- [More tools for Claude](https://mcp.modernmustardseed.com/): the Modern Mustard Seed connector docs',
    '- [Modern Mustard Seed llms.txt](https://modernmustardseed.com/llms.txt)',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
