import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cineraagam — A daily Telugu cinema music challenge',
  description: 'Three music clues. One Telugu movie. Can you name it?',
  manifest: '/manifest.webmanifest',
  themeColor: '#050506'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
