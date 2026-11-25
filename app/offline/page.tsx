import type { Metadata } from 'next';
import { AudioLines } from 'lucide-react';
import { RetryButton } from './RetryButton';

export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

/** Shown by the service worker when a page is requested without a connection. */
export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6 text-center text-text">
      <div className="max-w-[380px]">
        <div className="brand-mark mx-auto mb-6" aria-hidden="true"><AudioLines size={22} /></div>
        <h1 className="font-display m-0 mb-3 text-[30px]">The projector is off</h1>
        <p className="m-0 mb-6 text-[14px] leading-relaxed text-muted">
          You’re offline. Cineraagam needs a connection to load today’s clues and save your progress.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}
