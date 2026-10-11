/**
 * Support page template (Policy 3B: verified contact and support channels for
 * product and security concerns). The directory form asks for a support
 * contact; point it here or at the inbox below, and make sure someone reads it.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site.ts';
import { SERVER_NAME } from '@/lib/holidays/tools.ts';
import { PolicyHeader, Section } from '../_components/policy.tsx';

export const metadata: Metadata = {
  title: 'Support',
  description: `How to get help with ${SERVER_NAME} and how to report a security issue.`,
  alternates: { canonical: '/support' },
};

export default function Support() {
  return (
    <article className="prose-block py-12 sm:py-16">
      <PolicyHeader label="Support">
        Something not <em className="accent">right</em>? Tell us.
      </PolicyHeader>

      <Section title="Get help">
        <p>Write to <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. A person reads every message.</p>
        <p>To help us fix it fast, include:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>The tool name, if Claude showed one, and the time it happened, in UTC if you can.</li>
          <li>What you asked and what came back. Leave out anything private.</li>
          <li>Where you used it: claude.ai, the desktop or mobile app, or Claude Code.</li>
        </ul>
      </Section>

      <Section title="Before you write">
        <ul className="list-disc space-y-2 pl-6">
          <li>The <Link href="/docs/holidays#troubleshooting">troubleshooting notes</Link> cover the common questions: date formats, observed holidays, and state or bank calendars.</li>
          <li>If Claude says it couldn&apos;t reach the server, remove the connector and add it again with the exact URL from the docs, no trailing slash.</li>
        </ul>
      </Section>

      <Section title="Security">
        <p>Report a vulnerability to <a href={`mailto:${SITE.securityEmail}`}>{SITE.securityEmail}</a>, or see <a href="/.well-known/security.txt">/.well-known/security.txt</a>. Please do not test against the live service in ways that degrade it for other people.</p>
      </Section>
    </article>
  );
}
