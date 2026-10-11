/**
 * Public documentation page (Policy 3C): purpose, setup, tools, examples,
 * limits, troubleshooting and reviewer steps. Reviewers read this page and
 * the directory form links to it. Copy it per connector.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site.ts';
import { FIRST_YEAR, LAST_YEAR } from '@/lib/holidays/engine.ts';
import { EXAMPLE_PROMPTS, HOLIDAY_TOOLS, MAX_BUSINESS_DAYS, MAX_COUNT_SPAN_DAYS, SERVER_NAME, TODAY_ZONE } from '@/lib/holidays/tools.ts';

export const metadata: Metadata = {
  title: 'Documentation',
  description: `${SERVER_NAME} is a remote MCP connector for Claude: U.S. federal holidays with observed dates, and business-day math that skips weekends and holidays.`,
  alternates: { canonical: '/docs/holidays' },
};

export const dynamic = 'force-dynamic';

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-14 border-t border-ink pt-6 text-2xl font-bold leading-none tracking-[-0.045em] sm:text-3xl">
      {children}
    </h2>
  );
}

export default function HolidayDocs() {
  const endpoint = `${SITE.url}/holidays`;
  return (
    <article className="prose-block">
      <section className="py-12 sm:py-16">
        <p className="label text-teal">MCP connector for Claude</p>
        <h1 className="mt-4 text-4xl font-bold leading-none tracking-[-0.045em] sm:text-6xl">
          Every federal holiday, and the <em className="accent">business days</em> between them.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-2">
          {SERVER_NAME} answers the date questions a small business asks every week: when is the next federal holiday, is this a business day, what date is 10 business days from the invoice, how many working days are left this quarter. It computes the eleven U.S. federal holidays from the statute that sets them, 5 U.S.C. 6103, with the weekend shifts federal offices observe. No model guesses anything and nothing leaves the server.
        </p>
        <div className="mt-8 border border-ink bg-pale p-4">
          <p className="label">Connector URL</p>
          <p className="mt-2 break-all font-mono text-base">{endpoint}</p>
          <p className="mt-2 text-sm text-ink-2">Streamable HTTP. No sign-in. Every tool is read-only and makes no network calls.</p>
        </div>
      </section>

      <H2 id="connect">Connect it</H2>
      <ol className="mt-4 list-decimal space-y-2 pl-6">
        <li>In Claude, open Customize, then Connectors.</li>
        <li>Choose Add custom connector, paste <code className="break-all font-mono">{endpoint}</code>, and save. No account or key is needed.</li>
        <li>In a chat, turn the connector on from the + menu and ask a date question. Claude calls the tools when the question needs them.</li>
      </ol>
      <p className="mt-4">In Claude Code: <code className="break-all font-mono">claude mcp add --transport http holidays {endpoint}</code></p>

      <H2 id="examples">Try these</H2>
      <ul className="mt-4 space-y-3">
        {EXAMPLE_PROMPTS.map((p) => (
          <li key={p} className="border border-ink p-4">&ldquo;{p}&rdquo;</li>
        ))}
      </ul>

      <H2 id="tools">The tools</H2>
      <div className="mt-6 grid border-l border-t border-ink sm:grid-cols-2">
        {HOLIDAY_TOOLS.map((t, i) => (
          <div key={t.name} className={`border-b border-r border-ink p-5 ${i === 0 ? 'bg-mustard' : ''}`}>
            <p className="label break-all">{t.name}</p>
            <h3 className="mt-2 text-xl font-bold tracking-[-0.03em]">{t.title}</h3>
            <p className="mt-2 text-sm">{t.description}</p>
            <p className="mt-3 text-sm text-ink-2">
              <span className="font-semibold text-ink">Inputs:</span> {Object.keys(t.inputSchema.shape).join(', ') || 'none'}
            </p>
          </div>
        ))}
      </div>

      <H2 id="rules">The rules it follows</H2>
      <ul className="mt-4 list-disc space-y-2 pl-6">
        <li>The holidays are the eleven in 5 U.S.C. 6103(a): New Year&apos;s Day, the Birthday of Martin Luther King, Jr., Washington&apos;s Birthday, Memorial Day, Juneteenth National Independence Day, Independence Day, Labor Day, Columbus Day, Veterans Day, Thanksgiving Day and Christmas Day.</li>
        <li>A holiday on a Saturday is observed the Friday before; on a Sunday, the Monday after. New Year&apos;s Day on a Saturday is therefore observed on December 31 of the year before.</li>
        <li>A business day is a Monday through Friday that is not an observed federal holiday.</li>
        <li>Adding business days never counts the start date. Counting business days includes both ends.</li>
        <li>States, banks, schools and private employers can observe other days. The Federal Reserve stays open on the Friday before a Saturday holiday, and Inauguration Day is a holiday only for federal workers around Washington, D.C. Every answer says so.</li>
      </ul>

      <H2 id="limits">Limits</H2>
      <ul className="mt-4 list-disc space-y-2 pl-6">
        <li>Dates from {FIRST_YEAR} through {LAST_YEAR}. Juneteenth became a federal holiday in 2021, so earlier years follow a different list.</li>
        <li>add_business_days moves up to {MAX_BUSINESS_DAYS.toLocaleString('en-US')} business days either way. count_business_days spans up to {MAX_COUNT_SPAN_DAYS.toLocaleString('en-US')} calendar days.</li>
        <li>Without a start date, next_federal_holidays uses today&apos;s date in {TODAY_ZONE} and says so in its answer.</li>
        <li>Each tool answers at most 300 calls a minute on each server instance, and the service at most 3,000 a minute in total. Over a limit, the tool says so and gives the time to try again.</li>
      </ul>

      <H2 id="troubleshooting">Troubleshooting</H2>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="font-semibold">&ldquo;must be a date written YYYY-MM-DD&rdquo;</dt>
          <dd className="text-ink-2">Dates are calendar dates in ISO form, such as 2026-11-26. Ask Claude to use that form, or give the date in words and Claude converts it.</dd>
        </div>
        <div>
          <dt className="font-semibold">A holiday seems to be missing</dt>
          <dd className="text-ink-2">Check the observed date, not the actual one. Independence Day 2026 falls on a Saturday, so it is observed on Friday, July 3.</dd>
        </div>
        <div>
          <dt className="font-semibold">My bank or state closes on a different day</dt>
          <dd className="text-ink-2">This connector covers federal holidays only. Banks, states and employers publish their own calendars.</dd>
        </div>
        <div>
          <dt className="font-semibold">Claude says it couldn&apos;t reach the server</dt>
          <dd className="text-ink-2">Remove the connector and add it again with the exact URL above, no trailing slash. If it still fails, write to support with the time it happened.</dd>
        </div>
      </dl>

      <H2 id="reviewers">For reviewers</H2>
      <p className="mt-4">No account, key or setup is needed. Add the connector URL above, then:</p>
      <ol className="mt-4 list-decimal space-y-2 pl-6">
        <li><code className="font-mono">list_federal_holidays</code> with <code className="font-mono">{'{"year": 2027}'}</code> returns eleven holidays; Juneteenth and Independence Day show Friday and Monday observed dates.</li>
        <li><code className="font-mono">add_business_days</code> with <code className="font-mono">{'{"start_date": "2026-11-20", "business_days": 10}'}</code> returns 2026-12-07 and lists Thanksgiving as skipped.</li>
        <li><code className="font-mono">count_business_days</code> with <code className="font-mono">{'{"start_date": "2026-12-01", "end_date": "2027-01-15"}'}</code> returns 32 business days.</li>
        <li><code className="font-mono">check_business_day</code> with <code className="font-mono">{'{"date": "2021-12-31"}'}</code> returns New Year&apos;s Day 2022, observed.</li>
        <li><code className="font-mono">next_federal_holidays</code> with <code className="font-mono">{'{"from_date": "2026-10-11", "count": 3}'}</code> returns Columbus Day, Veterans Day and Thanksgiving.</li>
        <li>Errors: <code className="font-mono">{'{"date": "2026-02-30"}'}</code> and <code className="font-mono">{'{"year": 2019}'}</code> each return a specific message.</li>
      </ol>

      <H2 id="security">Support and security</H2>
      <p className="mt-4">
        Questions, problems and security reports go to <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. A machine-readable contact is at <a href="/.well-known/security.txt">/.well-known/security.txt</a>. How data is handled is in the <Link href="/privacy">privacy policy</Link>, and the rules of use are in the <Link href="/terms">terms</Link>.
      </p>
    </article>
  );
}
