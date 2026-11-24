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

  // Streak updates immediately (sidebar + top bar).
  await expect(page.locator('.streak-number')).toContainText('01');
  await expect(page.locator('.top-streak strong')).toHaveText('1');
  await expect(page.getByRole('listitem', { name: /: solved$/ }).first()).toBeAttached();

  // Statistics
  await goTo(page, isMobile, 'Statistics');
  await expect(page.getByText('Win rate', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 1 solved')).toBeVisible();
  await expect(page.getByLabel('Clue 1: 1 game, 100% of games played')).toBeVisible();

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
  await page.getByRole('link', { name: /#\d+/ }).last().click();
  await page.getByRole('button', { name: /Skip this clue/ }).click();
  await expect(page.locator('.clue-badge')).toContainText('Medium'); // wait until the server recorded it
  await page.goto('/history');
  await expect(page.getByRole('link', { name: /play in Time Travel/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /In progress — continue/ })).toBeVisible();
});
