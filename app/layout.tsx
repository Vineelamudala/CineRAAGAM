import type { Metadata, Viewport } from 'next';
import { dmMono, dmSans, playfair } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Cineraagam — A daily Telugu cinema music challenge', template: '%s · Cineraagam' },
  description: 'Three music clues. One Telugu movie. Can you name it?',
  manifest: '/manifest.webmanifest',
  applicationName: 'Cineraagam',
};

export const viewport: Viewport = {
  themeColor: '#050505',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
