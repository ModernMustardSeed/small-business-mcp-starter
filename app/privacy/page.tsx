/**
 * Privacy policy template (Policy 3A). The directory requires a privacy policy
 * URL for any connector that talks to a remote service, and the submission
 * docs name five things it must cover: data collection, usage and storage,
 * third-party sharing, retention, and contact. Each has a section below.
 * Rewrite every sentence to match what YOUR tools receive, log and keep.
 */

import type { Metadata } from 'next';
import { SITE } from '@/lib/site.ts';
import { SERVER_NAME } from '@/lib/holidays/tools.ts';
import { PolicyHeader, Section } from '../_components/policy.tsx';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `What ${SERVER_NAME} receives, what it keeps, for how long, and who else touches it.`,
  alternates: { canonical: '/privacy' },
};

export default function Privacy() {
  return (
    <article className="prose-block py-12 sm:py-16">
      <PolicyHeader label="Privacy policy" updated={SITE.policyUpdated}>
        What this connector <em className="accent">keeps</em>, and what it does not.
      </PolicyHeader>
      <p className="mt-4 text-ink-2">Applies to {SERVER_NAME} at {SITE.url}/holidays, run by {SITE.company}, {SITE.location}.</p>

      <Section title="What we receive">
        <p>When Claude calls one of the tools, the server receives only the tool arguments Claude sends: a year, one or two calendar dates, a number of business days, or how many holidays to list. It does not receive your conversation, your name, your email, your Claude account, or anything else from the chat.</p>
        <p>There are no accounts, no sign-in and no cookies on the connector.</p>
      </Section>

      <Section title="What the tools read">
        <p>Nothing outside the server. The holidays are computed from the rules in 5 U.S.C. 6103, a public-domain U.S. statute, and every answer is arithmetic on the dates sent. The tools make no network requests.</p>
      </Section>

      <Section title="What we keep, and for how long">
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>One log line per tool call</strong> with the tool name, how long it took, whether it succeeded, the size of the answer, and for some tools the year or number of days asked for. Never a date range you sent or anything from the conversation. Logs are kept for no more than 30 days.</li>
          <li><strong>Usage counters</strong> (how many calls ran this minute and today) are kept only for the length of each window, at most one day.</li>
          <li>Our hosting provider keeps standard request records (time, path, status and the calling network address, which for Claude is Anthropic&apos;s) under its own retention.</li>
          <li>Nothing else is stored. The dates and numbers sent are used to compute the answer and then discarded.</li>
        </ul>
      </Section>

      <Section title="How we use it">
        <p>Only to answer the request, to enforce the usage limits, and to keep the service working. We do not use it for marketing, we do not build profiles, and we do not train models on it.</p>
      </Section>

      <Section title="Who else touches it">
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Vercel</strong> hosts the connector and its logs.</li>
          <li><strong>Upstash</strong> stores the usage counters, when the operator has configured it.</li>
        </ul>
        <p>We do not sell or share data with anyone else.</p>
      </Section>

      <Section title="Your choices">
        <p>You can stop using the connector at any time by removing it in Claude. To ask what we hold, or to have log lines about your use deleted early, write to us and we will do it.</p>
      </Section>

      <Section title="Contact">
        <p>{SITE.company}, {SITE.location}. <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. Security reports go to <a href={`mailto:${SITE.securityEmail}`}>{SITE.securityEmail}</a>.</p>
        <p>If this policy changes, the date at the top changes with it.</p>
      </Section>
    </article>
  );
}
