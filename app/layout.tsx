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
            <p>Built and run by {SITE.company}, {SITE.location}.</p>
            <p>
              Support: <a className="underline underline-offset-2" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
