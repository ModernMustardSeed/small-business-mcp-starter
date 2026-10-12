import type { Metadata } from 'next';
import Link from 'next/link';
import { DM_Sans, JetBrains_Mono, Shrikhand } from 'next/font/google';
import { SITE } from '@/lib/site.ts';
import { SERVER_NAME } from '@/lib/holidays/tools.ts';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
const shrikhand = Shrikhand({ subsets: ['latin'], weight: '400', variable: '--font-shrikhand', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SERVER_NAME, template: `%s | ${SERVER_NAME}` },
  description: 'A remote MCP connector for Claude built from the Small Business MCP Starter Kit by Modern Mustard Seed: U.S. federal holidays and business-day math.',
};

/** The studio that wrote the kit. Keep it as author when you fork; change publisher to your company. */
const MMS_ORG = { '@type': 'Organization', '@id': 'https://modernmustardseed.com/#organization', name: 'Modern Mustard Seed', url: 'https://modernmustardseed.com', sameAs: ['https://www.google.com/maps?cid=8255098141806810627', 'https://www.linkedin.com/company/modernmustardseed', 'https://github.com/ModernMustardSeed', 'https://www.youtube.com/@modernmustardseed', 'https://www.facebook.com/modernmustardseed'] };

function softwareJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE.url}/#app`,
    name: SERVER_NAME,
    description: 'A remote MCP connector for Claude: U.S. federal holidays with observed dates, and business-day math that skips weekends and holidays.',
    url: SITE.url,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    isAccessibleForFree: true,
    author: MMS_ORG,
    publisher: MMS_ORG,
    isBasedOn: 'https://github.com/ModernMustardSeed/small-business-mcp-starter',
    sameAs: ['https://registry.modelcontextprotocol.io/v0.1/servers/com.modernmustardseed%2Fholiday-calendar/versions/latest'],
  };
}

const NAV = [
  { href: '/docs/holidays', label: 'Docs' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/support', label: 'Support' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${shrikhand.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd()) }} />
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-paper focus:p-2">Skip to content</a>
        <header className="border-b border-ink">
          <nav aria-label="Main" className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
            <Link href="/" className="font-bold tracking-tight">{SERVER_NAME}</Link>
            <ul className="label flex flex-wrap gap-x-5 gap-y-2">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="hover:underline">{n.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-4xl px-5 pb-20">
          {children}
        </main>
        <footer className="border-t border-ink">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 px-5 py-8 text-sm text-ink-2 sm:flex-row sm:justify-between">
            <div className="flex flex-col gap-1">
              <p>Built and run by {SITE.company}, {SITE.location}.</p>
              <p>
                Built by <a className="mms-credit bg-mustard px-1 font-semibold text-ink hover:bg-[#ffd23f]" href="https://modernmustardseed.com/how-we-build">Modern Mustard Seed</a>. <a className="underline underline-offset-2" href="https://mcp.modernmustardseed.com/">More tools for Claude</a>
              </p>
            </div>
            <p>
              Support: <a className="underline underline-offset-2" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
