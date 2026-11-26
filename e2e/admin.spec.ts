import { expect, test, type Page } from '@playwright/test';
import { totp } from '../tests/helpers/totp';
import { adminClient } from '../scripts/dev-seed.mjs';
import { E2E_ADMIN, E2E_MFA_ADMIN } from './global-setup';

// The admin dashboard is a desktop tool; run these once (desktop project).
test.beforeEach(({ isMobile }) => test.skip(isMobile, 'admin flows run on desktop only'));

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto('/admin/login');
  await page.getByLabel('E-mail').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('players are sent to the admin login, which warns them', async ({ page }) => {
  await page.goto('/'); // become an anonymous player first
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  await page.goto('/admin/movies');
  await expect(page).toHaveURL('/admin/login');
  await expect(page.getByText(/This browser is currently a/)).toBeVisible();
});

test('a wrong password is rejected', async ({ page }) => {
  await login(page, { email: E2E_ADMIN.email, password: 'wrong-password-123' });
  await expect(page.getByText('Incorrect e-mail or password.')).toBeVisible();
});

test('admin adds a movie, cast and clips, schedules it, then cleans up', async ({ page }) => {
  test.setTimeout(120_000);
  page.on('dialog', d => d.accept()); // confirm() prompts for deletes
  const title = `E2E Movie ${Date.now()}`;
  const date = `2033-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`;

  await login(page, E2E_ADMIN);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Next 14 days')).toBeVisible();

  // Movie
  await page.getByRole('link', { name: /Movies & clips/ }).click();

  // Another spelling of a film already in the catalogue is caught before it is added.
  await page.getByLabel('Title').fill('Magadhira');
  await page.getByRole('button', { name: 'Add movie' }).click();
  const warning = page.getByRole('alert').filter({ hasText: 'Already in the catalogue' });
  await expect(warning).toBeVisible();
  await expect(warning.getByRole('link', { name: 'Magadheera' })).toBeVisible();
  await expect(page.getByRole('button', { name: /add anyway/ })).toBeVisible();

  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Release year').fill('2024');
  await page.getByRole('button', { name: 'Add movie' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  // Cast (with reordering)
  for (const name of ['Second Lead', 'First Lead']) {
    await page.getByLabel('Actor name').fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText(name)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Move First Lead up' }).click();
  await expect(page.locator('ol li').first()).toContainText('First Lead');

  // Three clips: decode → choose section → re-encode in the browser → upload
  for (const n of [1, 2, 3]) {
    await page.getByLabel('Audio file').setInputFiles(`e2e/fixtures/clue-${n}.webm`);
    await expect(page.getByLabel('Waveform with the selected section highlighted')).toBeVisible();
    await page.getByRole('button', { name: 'Save clip' }).click();
    await expect(page.getByRole('button', { name: `Play clip ${n}` })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Clip saved.')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Play clip 1' }).click(); // admin preview works
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  // Whatever the source format, clips are stored as MP3 (plays on every phone).
  const movieId = new URL(page.url()).pathname.split('/').pop()!;
  const { data: stored } = await adminClient().from('clips').select('storage_path').eq('movie_id', movieId);
  expect(stored).toHaveLength(3);
  for (const c of stored!) expect(c.storage_path).toMatch(/\.mp3$/);

  // Schedule it
  await page.goto(`/admin/challenges/new?date=${date}`);
  await page.getByLabel('Search movies').fill(title);
  await page.getByRole('button', { name: new RegExp(title) }).click();
  const slots = ['Clue 1 · Hard (3 points)', 'Clue 2 · Medium (2 points)', 'Clue 3 · Easy (1 point)'];
  for (const [i, label] of slots.entries()) {
    await page.getByLabel(label).selectOption({ index: i + 1 });
  }
  await page.getByLabel('Status').selectOption('published');
  await page.getByRole('button', { name: 'Create challenge' }).click();
  await expect(page).toHaveURL(/\/admin\/challenges\/[0-9a-f-]{36}\?created=1$/);
  await expect(page.getByText('Saved and published.')).toBeVisible();

  // It shows in the schedule
  await page.goto('/admin/challenges');
  await page.getByRole('button', { name: 'Show past too' }).click();
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();

  // Cleanup through the UI: challenge → clips → movie
  await page.getByRole('link', { name: new RegExp(title) }).click();
  await page.getByRole('button', { name: 'Delete challenge' }).click();
  await expect(page).toHaveURL('/admin/challenges');
  await page.goto('/admin/movies');
  await page.getByLabel('Search movies').fill(title);
  await page.getByRole('link', { name: new RegExp(title) }).click();
  for (let n = 3; n >= 1; n--) {
    await page.getByRole('button', { name: `Delete clip ${n}` }).click();
    await expect(page.getByRole('button', { name: `Play clip ${n}` })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Delete movie' }).click();
  await expect(page).toHaveURL('/admin/movies');
});

test('admin merges a duplicate spelling into the right movie', async ({ page }) => {
  page.on('dialog', d => d.accept()); // confirm() prompts
  const stamp = Date.now();
  const right = `Zz Merge Probe ${stamp}`;
  const duplicate = `Zz Mergge Probe ${stamp}`; // same film, doubled letter

  await login(page, E2E_ADMIN);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.goto('/admin/movies');
  await page.getByLabel('Title').fill(right);
  await page.getByRole('button', { name: 'Add movie' }).click();
  await expect(page.getByRole('heading', { name: right })).toBeVisible();

  // Adding the other spelling warns first; the admin adds it anyway.
  await page.goto('/admin/movies');
  await page.getByLabel('Title').fill(duplicate);
  await page.getByRole('button', { name: 'Add movie' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Already in the catalogue' }).getByRole('link', { name: right })).toBeVisible();
  await page.getByRole('button', { name: /add anyway/ }).click();
  await expect(page.getByRole('heading', { name: duplicate })).toBeVisible();

  // From the duplicate's page, open the right movie via the Duplicates card and merge the duplicate into it.
  await page.getByRole('list', { name: 'Possible duplicates' }).getByRole('link', { name: right }).click();
  await expect(page.getByRole('heading', { name: right })).toBeVisible();
  await page.getByRole('button', { name: `Merge ${duplicate} into this movie` }).click();
  await expect(page.getByText(`Merged "${duplicate}" into this movie.`)).toBeVisible();
  await expect(page.getByLabel('Other names (comma separated)')).toHaveValue(duplicate);
  await expect(page.getByText('No other spellings of this title found.')).toBeVisible();

  // Cleanup
  await page.getByRole('button', { name: 'Delete movie' }).click();
  await expect(page).toHaveURL('/admin/movies');
});

test('2-step verification: set up, required at sign-in, then turned off', async ({ page, browser }) => {
  test.setTimeout(90_000);
  page.on('dialog', d => d.accept());
  await login(page, E2E_MFA_ADMIN);
  await page.getByRole('link', { name: /Security/ }).click();
  await page.getByRole('button', { name: 'Set up 2-step verification' }).click();
  await expect(page.getByAltText('QR code for your authenticator app')).toBeVisible();
  const secret = (await page.locator('code.break-all').textContent())!.trim();
  const enrolWindow = Math.floor(Date.now() / 30_000);
  await page.getByLabel('6-digit code').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on' }).click();
  await expect(page.getByText('2-step verification is on.')).toBeVisible();

  // A new browser session needs the code after the password.
  const ctx = await browser.newContext();
  const fresh = await ctx.newPage();
  await login(fresh, E2E_MFA_ADMIN);
  await expect(fresh.getByLabel('Authenticator code')).toBeVisible();
  await fresh.getByLabel('Authenticator code').fill('000000');
  await fresh.getByRole('button', { name: 'Verify' }).click();
  await expect(fresh.getByText(/That code didn’t work/)).toBeVisible();
  // Use a fresh code (a code may not be accepted twice within its 30 s window).
  while (Math.floor(Date.now() / 30_000) === enrolWindow) await fresh.waitForTimeout(1000);
  await fresh.getByLabel('Authenticator code').fill(totp(secret));
  await fresh.getByRole('button', { name: 'Verify' }).click();
  await expect(fresh.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await ctx.close();

  // Turn it off again (keeps the test admin reusable).
  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByText('2-step verification is off.')).toBeVisible();
});

test('admin can hide a player name', async ({ page, browser }) => {
  const name = `Hide Me ${Date.now().toString(36)}`;
  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  await player.goto('/');
  await player.getByLabel('Display name', { exact: true }).fill(name);
  await player.getByRole('button', { name: /LET’S PLAY/ }).click();
  await expect(player.getByRole('dialog')).toBeHidden();
  await playerCtx.close();

  await login(page, E2E_ADMIN);
  await page.getByRole('link', { name: /Players/ }).click();
  await page.getByLabel('Search display names').fill(name);
  const row = page.getByRole('listitem').filter({ hasText: name });
  await row.getByRole('button', { name: 'Hide' }).click();
  await expect(row.getByText('hidden')).toBeVisible();
  await row.getByRole('button', { name: 'Unhide' }).click();
  await expect(row.getByText('hidden')).toHaveCount(0);
});
