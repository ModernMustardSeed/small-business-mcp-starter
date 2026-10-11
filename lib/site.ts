/**
 * Everything a reviewer reads about who runs this connector lives here.
 * Change these values first when you fork the kit: the docs, privacy, terms
 * and support pages, security.txt and the server's own info all read them.
 */

function origin(): string {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

export const SITE = {
  /** Legal name of the company that operates the server. */
  company: 'Modern Mustard Seed LLC',
  /** Where the company is based, shown on the privacy and terms pages. */
  location: 'Kalispell, Montana',
  /** Company website, shown in the footer and the directory form. */
  website: 'https://modernmustardseed.com',
  /** A monitored inbox. The directory requires a verified support contact (Policy 3B). */
  supportEmail: 'sarah@modernmustardseed.com',
  /** Where security reports go. Can be the same inbox. */
  securityEmail: 'sarah@modernmustardseed.com',
  /** The date the privacy policy and terms last changed. */
  policyUpdated: 'October 11, 2026',
  /** Public origin of this deployment, no trailing slash. */
  get url(): string {
    return origin();
  },
} as const;
