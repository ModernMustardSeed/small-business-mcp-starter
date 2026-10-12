import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site.ts';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/holidays'] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
