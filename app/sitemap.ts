import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** Public pages for search engines. Personal pages (stats) and the admin area are left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/how-to-play`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/leaderboard`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/time-travel`, changeFrequency: 'daily', priority: 0.5 },
  ];
}
