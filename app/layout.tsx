import type { Metadata, Viewport } from 'next';
import { ServiceWorker } from '@/components/pwa/ServiceWorker';
import { dmMono, dmSans, playfair } from './fonts';
import './globals.css';

const description = 'Three music clues. One Telugu movie. Can you name it? A new challenge every midnight IST.';

export const metadata: Metadata = {
  title: { default: 'Cineraagam — A daily Telugu cinema music challenge', template: '%s · Cineraagam' },
  description,
  manifest: '/manifest.webmanifest',
  applicationName: 'Cineraagam',
  appleWebApp: { capable: true, title: 'Cineraagam', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'Cineraagam',
    title: 'Cineraagam — Telugu music, daily',
    description,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Cineraagam' }],
  },
  twitter: { card: 'summary', title: 'Cineraagam — Telugu music, daily', description },
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
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
