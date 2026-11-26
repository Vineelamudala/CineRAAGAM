import { expect, test, type Page } from '@playwright/test';

const ANSWER = process.env.E2E_ANSWER_TITLE!;
const ANSWER_YEAR = process.env.E2E_ANSWER_YEAR ?? '';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function solveTodayOnClue1(page: Page) {
  const box = page.getByRole('combobox', { name: 'WHICH MOVIE IS THIS?' });
  await box.fill(ANSWER.slice(0, 4));
  await page.getByRole('option', { name: new RegExp(`^${esc(ANSWER)}\\s*${esc(ANSWER_YEAR)}`) }).first().click();
  await page.getByRole('button', { name: /SUBMIT GUESS/ }).click();
  await expect(page.getByText('YOU GOT IT!')).toBeVisible();
}

async function goTo(page: Page, isMobile: boolean, label: string) {
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: label }).click();
}

test('solving today updates streak, stats, leaderboard and history', async ({ page, isMobile }) => {
  const name = `Champ ${Math.random().toString(36).slice(2, 7)}`;
  await page.goto('/');
  await page.getByLabel('Display name', { exact: true }).fill(name);
  await page.getByRole('button', { name: /LET’S PLAY/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  // Before playing: no streak yet.
  await expect(page.locator('.streak-number')).toContainText('00');
  await solveTodayOnClue1(page);

  // The statistics popup opens by itself after the daily game.
  const popup = page.getByRole('dialog', { name: 'Statistics' });
  await expect(popup).toBeVisible();
  await expect(popup.getByLabel('Solved on clue 1: 1 game, 100% (today)')).toBeVisible();
  await popup.getByRole('button', { name: 'Close' }).click();
  await expect(popup).toBeHidden();

  // Streak updates immediately (sidebar + top bar).
  await expect(page.locator('.streak-number')).toContainText('01');
  await expect(page.locator('.top-streak strong')).toHaveText('1');
  await expect(page.getByRole('listitem', { name: /: solved$/ }).first()).toBeAttached();

  // Statistics page
  await goTo(page, isMobile, 'Statistics');
  await expect(page.getByText('Win rate', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 1 solved')).toBeVisible();
  await expect(page.getByLabel('Solved on clue 1: 1 game, 100%')).toBeVisible();

  // Leaderboard: I'm on this week's board with 3 points
  await goTo(page, isMobile, 'Leaderboard');
  const myRow = page.getByRole('row').filter({ hasText: name });
  await expect(myRow).toBeVisible();
  await expect(myRow).toContainText('(you)');
  await expect(myRow.getByRole('cell').nth(2)).toHaveText('3');
  await page.getByRole('tab', { name: 'All time' }).click();
  await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible();

  // History: today shows the movie and the result; earlier days point to Time Travel
  await goTo(page, isMobile, 'My History');
  const todayRow = page.getByRole('listitem').filter({ hasText: ANSWER }).first();
  await expect(todayRow).toContainText('Solved on clue 1 · 3 pts');
});

test('statistics popup: Played / Won / Win % / Points / streaks / distribution, reopened from the top bar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  // Miss clue 1 with a wrong guess, then solve on clue 2.
  const box = page.getByRole('combobox', { name: 'WHICH MOVIE IS THIS?' });
  await box.fill('mahanati');
  await page.getByRole('option', { name: /^Mahanati/ }).first().click();
  await page.getByRole('button', { name: /SUBMIT GUESS/ }).click();
  await expect(page.locator('.clue-badge')).toContainText('Medium');
  await box.fill(ANSWER.slice(0, 4));
  await page.getByRole('option', { name: new RegExp(`^${esc(ANSWER)}\\s*${esc(ANSWER_YEAR)}`) }).first().click();
  await page.getByRole('button', { name: /SUBMIT GUESS/ }).click();

  const popup = page.getByRole('dialog', { name: 'Statistics' });
  await expect(popup).toBeVisible();
  for (const [label, value] of [['Played', '1'], ['Won', '1'], ['Win %', '100'], ['Points', '2']]) {
    await expect(popup.locator('.stat-tile').locator('xpath=..').filter({ hasText: label }).locator('.stat-tile')).toHaveText(value);
  }
  await expect(popup.getByText('Current streak')).toBeVisible();
  await expect(popup.getByText('Max streak')).toBeVisible();
  await expect(popup.getByLabel('Solved on clue 2: 1 game, 100% (today)')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup).toBeHidden();

  await page.getByRole('button', { name: 'Open statistics' }).click();
  await expect(popup).toBeVisible();
});

test('share buttons: X, WhatsApp and Facebook with a spoiler-free message', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /Skip this clue/ }).click();
  await page.getByRole('dialog', { name: 'Statistics' }).getByRole('button', { name: 'Close' }).click();

  // Capture window.open instead of really opening the social sites.
  await page.evaluate(() => {
    (window as unknown as { opened: string[] }).opened = [];
    window.open = ((url: string) => { (window as unknown as { opened: string[] }).opened.push(url); return null; }) as typeof window.open;
  });
  await page.getByRole('button', { name: 'Share on X (Twitter)' }).click();
  await page.getByRole('button', { name: 'Share on WhatsApp' }).click();
  await page.getByRole('button', { name: 'Share on Facebook' }).click();
  const [x, whatsapp, facebook] = await page.evaluate(() => (window as unknown as { opened: string[] }).opened);
  expect(x).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?text=/);
  expect(whatsapp).toMatch(/^https:\/\/wa\.me\/\?text=/);
  expect(facebook).toMatch(/^https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?u=/);
  const message = decodeURIComponent(whatsapp.split('text=')[1]);
  expect(message).toContain('🎵 Cineraagam #');
  expect(message).toContain('⬛⬛⬛'); // three skipped clues
  expect(message.toLowerCase()).not.toContain(ANSWER.toLowerCase()); // never spoils the answer
});

test('players without a name are told how to join the leaderboard', async ({ page }) => {
  await page.goto('/leaderboard');
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  await expect(page.getByText(/Choose a display name/)).toBeVisible();
});

test('history links missed days to Time Travel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  // Play a past day so history starts before today.
  await page.goto('/time-travel');
  await page.getByRole('button', { name: 'List view' }).click(); // list is newest-first: last = oldest day
  await page.getByRole('link', { name: /#\d+/ }).last().click();
  await page.getByRole('button', { name: /Skip this clue/ }).click();
  await expect(page.locator('.clue-badge')).toContainText('Medium'); // wait until the server recorded it
  await page.goto('/history');
  await expect(page.getByRole('link', { name: /play in Time Travel/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /In progress — continue/ })).toBeVisible();
});
