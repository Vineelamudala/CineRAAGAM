import type { Metadata, Viewport } from 'next';
import { ServiceWorker } from '@/components/pwa/ServiceWorker';
import { SITE_DESCRIPTION as description, SITE_NAME, SITE_URL } from '@/lib/site';
import { dmMono, dmSans, playfair } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Cineraagam — Daily Telugu movie music guessing game', template: '%s · Cineraagam' },
  description,
  keywords: ['Cineraagam', 'CineRaagam', 'Cine Raagam', 'Telugu movie quiz', 'Telugu BGM quiz', 'guess the Telugu movie', 'Tollywood music game'],
  manifest: '/manifest.webmanifest',
  applicationName: 'Cineraagam',
  appleWebApp: { capable: true, title: 'Cineraagam', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: '/',
    title: 'Cineraagam — Telugu music, daily',
    description,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Cineraagam' }],
  },
  twitter: { card: 'summary', title: 'Cineraagam — Telugu music, daily', description },
};

const SITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: ['CineRaagam', 'Cine Raagam', 'Cineraagam Telugu music game'],
  url: `${SITE_URL}/`,
  description,
  inLanguage: 'en',
};

export const viewport: Viewport = {
  themeColor: '#050505',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable}`}>
      <body>
        {/* Tells search engines the site's name (and its spellings) so a search for "Cineraagam" finds it. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD).replace(/</g, '\\u003c') }} />
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
