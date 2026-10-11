import Link from 'next/link';
import { SITE } from '@/lib/site.ts';
import { EXAMPLE_PROMPTS, SERVER_NAME } from '@/lib/holidays/tools.ts';

export const dynamic = 'force-dynamic';

export default function Home() {
  const endpoint = `${SITE.url}/holidays`;
  return (
    <article className="prose-block py-12 sm:py-16">
      <p className="label text-teal">Remote MCP connector</p>
      <h1 className="mt-4 text-4xl font-bold leading-none tracking-[-0.045em] sm:text-6xl">
        {SERVER_NAME}
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-2">
        U.S. federal holidays with their observed dates, and business-day math that skips weekends and holidays. Add it to Claude as a custom connector and ask a date question.
      </p>
      <div className="mt-8 border border-ink bg-pale p-4">
        <p className="label">Connector URL</p>
        <p className="mt-2 break-all font-mono text-base">{endpoint}</p>
      </div>
      <h2 className="mt-12 text-2xl font-bold tracking-[-0.045em]">Ask Claude</h2>
      <ul className="mt-4 space-y-3">
        {EXAMPLE_PROMPTS.map((p) => (
          <li key={p} className="border border-ink p-4">&ldquo;{p}&rdquo;</li>
        ))}
      </ul>
      <p className="mt-10">
        <Link href="/docs/holidays">Read the documentation</Link>. This connector is the worked example in the open-source{' '}
        <a href="https://github.com/ModernMustardSeed/small-business-mcp-starter">Small Business MCP Starter Kit by Modern Mustard Seed</a>.
      </p>
    </article>
  );
}
