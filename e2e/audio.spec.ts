import { expect, test } from '@playwright/test';
import { adminClient, istDate } from '../scripts/dev-seed.mjs';

/** Audio is served through /api/clip (CDN-cacheable) without weakening the clue locks. */
test('clue audio is served via /api/clip with CDN caching, and locked clues stay locked', async ({ page, isMobile }) => {
  test.skip(isMobile, 'same server behaviour on mobile');

  // Today's clue paths, looked up with the service key on the test runner only.
  const db = adminClient();
  const { data } = await db.from('daily_challenges')
    .select('hard:clips!daily_challenges_hard_clip_id_movie_id_fkey(storage_path), medium:clips!daily_challenges_medium_clip_id_movie_id_fkey(storage_path)')
    .eq('challenge_date', istDate(0)).single();
  const { hard, medium } = data as unknown as Record<'hard' | 'medium', { storage_path: string }>;

  const clipResponse = page.waitForResponse(r => r.url().includes(`/api/clip/${hard.storage_path}`));
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  const res = await clipResponse;
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/^audio\//);
  expect(res.headers()['cache-control']).toContain('public');
  // Vercel's CDN consumes s-maxage and strips it from what the browser sees, but says it cached the file.
  if (res.headers()['x-vercel-cache']) expect(res.headers()['x-vercel-cache']).toMatch(/HIT|MISS|STALE|PRERENDER/);
  else expect(res.headers()['cache-control']).toContain('s-maxage');
  expect(res.headers()['set-cookie']).toBeUndefined(); // cookies would block CDN caching

  // A unique query string skips any CDN copy left by earlier tests, so the server really decides.
  const fresh = (path: string) => `/api/clip/${path}?check=${Date.now()}-${Math.random()}`;

  // Clue 2 is locked for this new player — even knowing the exact file name.
  const locked = await page.request.get(fresh(medium.storage_path));
  expect(locked.status()).toBe(404);
  expect(locked.headers()['cache-control']).toBe('no-store');

  // Malformed names are rejected outright.
  expect((await page.request.get('/api/clip/..%2F..%2Fetc%2Fpasswd')).status()).toBe(404);

  // After skipping clue 1, clue 2 becomes available to this player.
  await page.getByRole('button', { name: /Skip this clue/ }).click();
  await expect(page.locator('.clue-badge')).toContainText('Medium');
  const unlocked = await page.request.get(fresh(medium.storage_path));
  expect(unlocked.status()).toBe(200);
});
