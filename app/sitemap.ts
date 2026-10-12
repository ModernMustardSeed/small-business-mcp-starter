import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site.ts';

/** Every public page. The MCP endpoint (/holidays) is a server, not a page, so it stays out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-10-12');
  return [
    { url: SITE.url, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE.url}/docs/holidays`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE.url}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE.url}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE.url}/support`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
