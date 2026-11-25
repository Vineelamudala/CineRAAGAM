'use client';

import { useEffect } from 'react';

/** Registers the service worker in production builds only (dev reloads would fight the cache). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* not critical: the site works without it */
    });
  }, []);
  return null;
}
