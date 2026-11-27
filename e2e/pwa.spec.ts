import { expect, test } from '@playwright/test';

test.describe('installable app (PWA)', () => {
  test('manifest and icons are valid', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest).toMatchObject({ id: '/', start_url: '/', display: 'standalone', short_name: 'Cineraagam' });
    const sizes = manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}/${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192/any', '512x512/any', '512x512/maskable']));
    for (const icon of manifest.icons) {
      const r = await request.get(icon.src);
      expect(r.ok(), icon.src).toBe(true);
    }
    expect((await request.get('/apple-icon.png')).ok()).toBe(true);
  });

  test('service worker installs, and an uncached page shows the offline screen', async ({ page, context }) => {
    await page.goto('/how-to-play');
    await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // now controlled by the service worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.goto('/stats').catch(() => {}); // never visited → not cached
    await expect(page.getByRole('heading', { name: 'The projector is off' })).toBeVisible();
    await context.setOffline(false);
  });

  test('the service worker never caches the admin area or the game API', async ({ request }) => {
    const sw = await (await request.get('/sw.js')).text();
    expect(sw).toContain("url.origin !== self.location.origin) return");
    expect(sw).toContain("startsWith('/admin')) return");
    expect((await request.get('/sw.js')).headers()['cache-control']).toContain('no-cache');
  });

  test('robots.txt keeps the admin area out of search engines', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /admin');
  });
});

test('the waveform visualiser follows the real audio', async ({ page, isMobile }) => {
  test.skip(isMobile, 'same code path on mobile');
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  const play = page.getByRole('button', { name: 'Play clue', exact: true });
  await expect(play).toBeEnabled();
  await play.click();
  await expect(page.locator('.audio-panel.is-live')).toBeVisible();
  // Bars are scaled from the live frequency data: they vary and change over time.
  const sample = () => page.locator('.waveform i').evaluateAll(els => els.map(e => (e as HTMLElement).style.transform));
  await page.waitForTimeout(600);
  const a = await sample();
  await page.waitForTimeout(500);
  const b = await sample();
  expect(new Set(a).size).toBeGreaterThan(3);
  expect(a).not.toEqual(b);
  // Pausing resets the bars.
  await page.getByRole('button', { name: 'Pause clue' }).click();
  await expect(page.locator('.audio-panel.is-live')).toHaveCount(0);
});

/** Playback can start a moment after Play (and opens with a short silent fade): wait for real audio. */
async function waitUntilPlaying(page: import('@playwright/test').Page) {
  await expect.poll(() => page.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0.4);
}

test('on phones with "reduce motion" (e.g. battery saver) the bars still follow the audio', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone setting');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  await page.getByRole('button', { name: 'Play clue', exact: true }).click();
  await expect(page.locator('.audio-panel.is-live')).toBeVisible();
  await waitUntilPlaying(page);
  const heights = await page.locator('.waveform i').evaluateAll(els => new Set(els.map(e => (e as HTMLElement).style.transform)).size);
  expect(heights).toBeGreaterThan(3);
  // …but the background glow does not pulse.
  expect(await page.locator('.cp-glow').evaluate(e => getComputedStyle(e).scale)).toBe('none');
});

test('the bars follow the clip even where live audio analysis is unavailable (many phones)', async ({ page }) => {
  // Live Web Audio analysis of an <audio> element gets no data on many phones.
  // The visualiser must not depend on it: remove it completely.
  await page.addInitScript(() => {
    // @ts-expect-error removing the API on purpose
    delete window.AudioContext;
    // @ts-expect-error removing the API on purpose
    delete window.webkitAudioContext;
  });
  await page.goto('/?debug=viz');
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  await page.getByRole('button', { name: 'Play clue', exact: true }).click();
  await expect(page.locator('.audio-panel.is-live')).toBeVisible();
  const sample = () => page.locator('.waveform i').evaluateAll(els => els.map(e => (e as HTMLElement).style.transform));
  await waitUntilPlaying(page);
  const a = await sample();
  await page.waitForTimeout(500);
  const b = await sample();
  expect(new Set(a).size).toBeGreaterThan(3);
  expect(a).not.toEqual(b);
  await expect(page.locator('.viz-debug')).toContainText('following the clip');
});

test('the catalogue endpoint serves the public movie list with caching', async ({ request }) => {
  const res = await request.get('/api/catalog');
  expect(res.ok()).toBe(true);
  expect(res.headers()['cache-control']).toContain('max-age=600');
  const rows = await res.json();
  expect(rows.length).toBeGreaterThan(10);
  const [id, title, year] = rows[0];
  expect(typeof id).toBe('string');
  expect(typeof title).toBe('string');
  expect(year === null || typeof year === 'number').toBe(true);
  const again = await request.get('/api/catalog', { headers: { 'if-none-match': res.headers()['etag'] } });
  expect(again.status()).toBe(304);
});
