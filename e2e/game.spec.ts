import { expect, test, type Page } from '@playwright/test';

// Set by e2e/global-setup.ts from the seeded challenge for today (IST).
const ANSWER = process.env.E2E_ANSWER_TITLE!;
const ANSWER_YEAR = process.env.E2E_ANSWER_YEAR ?? '';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Dismiss the first-visit name dialog. */
async function skipName(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

const guessBox = (page: Page) => page.getByRole('combobox', { name: 'WHICH MOVIE IS THIS?' });

async function pick(page: Page, typed: string, title: string, year = '') {
  await guessBox(page).fill(typed);
  await page.getByRole('option', { name: new RegExp(`^${esc(title)}\\s*${esc(year)}`) }).first().click();
  await expect(guessBox(page)).toHaveValue(title);
}

async function submit(page: Page) {
  await page.getByRole('button', { name: /SUBMIT GUESS/ }).click();
}

test.describe('daily game (server-validated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipName(page);
    await expect(page.locator('.clue-badge')).toContainText('Hard · 3 pts');
  });

  test('shows clue 1 as Hard · 3 pts and no difficulty dropdown', async ({ page }) => {
    await expect(page.getByRole('combobox', { name: 'Difficulty' })).toHaveCount(0);
    await expect(page.getByText(/TODAY’S CHALLENGE/)).toBeVisible();
  });

  test('clue audio loads and plays; replay does not use up a clue', async ({ page }) => {
    const play = page.getByRole('button', { name: 'Play clue', exact: true });
    await expect(play).toBeEnabled();
    await play.click();
    await expect(page.getByText(/Playing clue|Buffering/)).toBeVisible();
    await page.getByRole('button', { name: 'Replay clue from the start' }).click();
    await expect(page.locator('.clue-badge')).toContainText('Hard · 3 pts');
  });

  test('correct guess on clue 1 earns 3 points and reveals the cast', async ({ page }) => {
    await pick(page, ANSWER.slice(0, 4), ANSWER, ANSWER_YEAR);
    await submit(page);
    await expect(page.getByText('YOU GOT IT!')).toBeVisible();
    await expect(page.locator('.result-score')).toContainText('3POINTS');
    await expect(page.getByRole('heading', { name: ANSWER })).toBeVisible();
    await expect(page.locator('.reveal-cast')).toContainText('Starring');
  });

  test('wrong guess unlocks clue 2 (Medium); solving there earns 2 points', async ({ page }) => {
    await pick(page, 'mahanati', 'Mahanati');
    await submit(page);
    await expect(page.locator('.clue-badge')).toContainText('Medium · 2 pts');
    await expect(page.getByText(/Not quite/)).toBeVisible();
    await pick(page, ANSWER.slice(0, 4), ANSWER, ANSWER_YEAR);
    await submit(page);
    await expect(page.locator('.result-score')).toContainText('2POINTS');
  });

  test('three skips reveal the movie with 0 points', async ({ page }) => {
    for (const difficulty of ['Hard', 'Medium', 'Easy']) {
      await expect(page.locator('.clue-badge')).toContainText(`${difficulty} ·`);
      await page.getByRole('button', { name: /Skip this clue/ }).click();
    }
    await expect(page.getByText('TODAY’S MOVIE REVEAL')).toBeVisible();
    await expect(page.getByRole('heading', { name: ANSWER })).toBeVisible();
    await expect(page.locator('.result-score')).toContainText('0POINTS');
  });

  test('progress survives a page refresh', async ({ page }) => {
    await page.getByRole('button', { name: /Skip this clue/ }).click();
    await expect(page.locator('.clue-badge')).toContainText('Medium · 2 pts');
    await page.reload();
    await expect(page.locator('.clue-badge')).toContainText('Medium · 2 pts');
    await expect(page.getByRole('button', { name: /Listen to clue 1/ })).toBeVisible();
  });

  test('free text that was not picked from the list is not submitted', async ({ page }) => {
    await guessBox(page).fill(ANSWER);
    await guessBox(page).press('Escape'); // close the suggestions without picking one
    await submit(page);
    await expect(page.getByText('Pick a movie from the suggestions list.')).toBeVisible();
    await expect(page.locator('.clue-badge')).toContainText('Hard · 3 pts');
  });

  test('autocomplete works with the keyboard', async ({ page }) => {
    const input = guessBox(page);
    await input.fill('arya');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    const second = await page.getByRole('option').nth(1).locator('span').textContent();
    await input.press('ArrowDown');
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(input).toHaveValue(second!);
  });

  test('alternate names match (AVPL)', async ({ page }) => {
    await guessBox(page).fill('avpl');
    await expect(page.getByRole('option', { name: /Ala Vaikunthapurram/ }).first()).toBeVisible();
  });

  test('countdown shows a time until the next IST midnight', async ({ page }) => {
    await expect(page.getByRole('timer')).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  });
});

test.describe('time travel', () => {
  test('lists past days and lets you play one (for fun)', async ({ page }) => {
    await page.goto('/time-travel');
    await skipName(page);
    const firstDay = page.getByRole('link', { name: /#\d+/ }).first();
    await expect(firstDay).toBeVisible();
    await firstDay.click();
    await expect(page).toHaveURL(/\/time-travel\/\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByText(/TIME TRAVEL/).first()).toBeVisible();
    await expect(page.getByText(/just for fun/)).toBeVisible();
    await expect(page.locator('.clue-badge')).toHaveText(/CLUE 1\s*Hard$/); // no points on the badge
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /Skip this clue/ }).click();
    await expect(page.getByText('Time Travel · just for fun, no points')).toBeVisible();
    await expect(page.locator('.result-score')).not.toContainText('POINT'); // no points shown at all
    await expect(page.locator('.clue-badge')).toHaveCount(0);
  });

  test('calendar, filters, list view and "surprise me"', async ({ page }) => {
    await page.goto('/time-travel');
    await skipName(page);
    await expect(page.getByRole('region', { name: 'Calendar' })).toBeVisible();
    const days = page.getByRole('region', { name: 'Calendar' }).getByRole('link');
    await expect(days.first()).toBeVisible();
    expect(await days.count()).toBeGreaterThanOrEqual(3);

    await page.getByRole('button', { name: 'List view' }).click();
    await page.getByRole('button', { name: 'Solved' }).click();
    await expect(page.getByText('No days match this filter.')).toBeVisible(); // a fresh player has solved nothing
    await page.getByRole('button', { name: 'Not played' }).click();
    await expect(page.getByRole('link', { name: /Not played/ }).first()).toBeVisible();

    await page.getByRole('button', { name: /Surprise me/ }).click();
    await expect(page).toHaveURL(/\/time-travel\/\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByText(/just for fun/)).toBeVisible();
  });

  test('invalid dates show not found', async ({ page }) => {
    const res = await page.goto('/time-travel/not-a-date');
    expect(res?.status()).toBe(404);
  });
});

const uniqueName = (prefix: string) => `${prefix} ${Math.random().toString(36).slice(2, 7)}`;

test.describe('display name (stored in Supabase)', () => {
  test('is asked on first visit, validated, saved on the server and remembered', async ({ page }) => {
    const name = uniqueName('Ravi');
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: /call you/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Clearing browser data');
    await dialog.getByLabel('Display name', { exact: true }).fill('<b>');
    await dialog.getByRole('button', { name: /LET’S PLAY/ }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByLabel('Display name', { exact: true }).fill(`  ${name.replace(' ', '   ')} `);
    await dialog.getByRole('button', { name: /LET’S PLAY/ }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.locator('.profile-copy strong')).toHaveText(name);
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('"Maybe later" lasts for the browser session', async ({ page }) => {
    await page.goto('/');
    await skipName(page);
    await page.goto('/how-to-play');
    await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('a name already taken by another player is rejected', async ({ page, browser }) => {
    test.setTimeout(60_000); // drives two browser sessions; slow under heavy parallel load
    const name = uniqueName('Taken');
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto('/');
    await otherPage.getByLabel('Display name', { exact: true }).fill(name);
    await otherPage.getByRole('button', { name: /LET’S PLAY/ }).click();
    await expect(otherPage.getByRole('dialog')).toBeHidden();
    await other.close();

    await page.goto('/');
    await page.getByLabel('Display name', { exact: true }).fill(name.toUpperCase());
    await page.getByRole('button', { name: /LET’S PLAY/ }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('already taken');
  });

  test('each browser is its own anonymous player (no login needed)', async ({ page, browser }) => {
    const name = uniqueName('Solo');
    await page.goto('/');
    await page.getByLabel('Display name', { exact: true }).fill(name);
    await page.getByRole('button', { name: /LET’S PLAY/ }).click();
    await expect(page.locator('.profile-copy strong')).toHaveText(name);

    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await freshPage.goto('/');
    await expect(freshPage.getByRole('dialog', { name: /call you/ })).toBeVisible();
    await expect(freshPage.locator('.profile-copy strong')).toHaveText('Guest Player');
    await fresh.close();
  });

  test('the profile button lets a player change their name', async ({ page }) => {
    const first = uniqueName('First');
    const second = uniqueName('Second');
    await page.goto('/');
    await page.getByLabel('Display name', { exact: true }).fill(first);
    await page.getByRole('button', { name: /LET’S PLAY/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('button', { name: 'Edit display name' }).click();
    await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(first);
    await page.getByLabel('Display name', { exact: true }).fill(second);
    await page.getByRole('button', { name: /LET’S PLAY/ }).click();
    await expect(page.locator('.profile-copy strong')).toHaveText(second);
  });

  test('Escape closes the dialog', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

test.describe('navigation', () => {
  test('every section has its own URL', async ({ page, isMobile }) => {
    await page.goto('/');
    await skipName(page);
    for (const [label, path] of [['Time Travel', '/time-travel'], ['Leaderboard', '/leaderboard'], ['Statistics', '/stats'], ['My History', '/history'], ['How to Play', '/how-to-play']]) {
      if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(path);
    }
    await page.goBack();
    await expect(page).toHaveURL('/history');
  });

  test('closed mobile menu is not reachable by keyboard', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/how-to-play');
    await skipName(page);
    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).toHaveAttribute('inert', '');
    // Tabbing through the page never lands inside the closed menu.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await sidebar.evaluate(el => el.contains(document.activeElement))).toBe(false);
    }
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(sidebar).not.toHaveAttribute('inert');
    await expect(page.getByRole('button', { name: 'Close menu' }).first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(sidebar).toHaveAttribute('inert', '');
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  });
});
