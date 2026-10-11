/**
 * Terms of use template. The directory form does not ask for a terms URL, but
 * a public connector with no terms leaves its operator exposed. Keep these
 * short, true and consistent with the privacy policy. Have counsel review
 * your version before you publish a connector that handles anything sensitive.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site.ts';
import { SERVER_NAME } from '@/lib/holidays/tools.ts';
import { PolicyHeader, Section } from '../_components/policy.tsx';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: `The terms for using ${SERVER_NAME}.`,
  alternates: { canonical: '/terms' },
};

export default function Terms() {
  return (
    <article className="prose-block py-12 sm:py-16">
      <PolicyHeader label="Terms of use" updated={SITE.policyUpdated}>
        The terms, in <em className="accent">plain</em> words.
      </PolicyHeader>

      <Section title="Who we are">
        <p>{SERVER_NAME} is a remote MCP connector run by {SITE.company}, {SITE.location} (&ldquo;we&rdquo;). By connecting it to Claude or any other MCP client, you accept these terms.</p>
      </Section>

      <Section title="What it does">
        <p>It returns U.S. federal holiday dates and business-day arithmetic computed from 5 U.S.C. 6103. It is a reference tool. It does not give legal, tax or financial advice, and it does not know the holiday calendar of any particular state, bank, court or employer.</p>
      </Section>

      <Section title="No charge, no account">
        <p>The connector is free to use and needs no account. We may change, limit or stop it at any time, and we apply usage limits so it stays available to everyone.</p>
      </Section>

      <Section title="Fair use">
        <ul className="list-disc space-y-2 pl-6">
          <li>Do not try to get around the usage limits, overload the service, or probe it for weaknesses outside the security reporting process below.</li>
          <li>Do not use it for anything unlawful.</li>
        </ul>
      </Section>

      <Section title="Accuracy">
        <p>We test every answer against the published federal holiday schedule and fix errors when we find them. Even so, the service is provided as is, without warranties of any kind. Check a deadline that matters with the authority that sets it. To the extent the law allows, we are not liable for losses that come from relying on an answer.</p>
      </Section>

      <Section title="Your data">
        <p>What the connector receives and keeps is described in the <Link href="/privacy">privacy policy</Link>.</p>
      </Section>

      <Section title="Security reports">
        <p>Report a vulnerability to <a href={`mailto:${SITE.securityEmail}`}>{SITE.securityEmail}</a>. A machine-readable contact is at <a href="/.well-known/security.txt">/.well-known/security.txt</a>. We will acknowledge a report and work with you on a fix before anything is disclosed.</p>
      </Section>

      <Section title="Changes and contact">
        <p>If these terms change, the date at the top changes with them. Questions go to <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.</p>
      </Section>
    </article>
  );
}
