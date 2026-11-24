import { expect, test, type Page } from '@playwright/test';

/** Dismiss the first-visit name dialog. */
async function skipName(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

async function pick(page: Page, typed: string, option: string) {
  const input = page.getByRole('combobox', { name: 'WHICH MOVIE IS THIS?' });
  await input.fill(typed);
  await page.getByRole('option', { name: new RegExp(option) }).click();
  await expect(input).toHaveValue(option);
}

test.describe('daily game (demo data)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipName(page);
  });

  test('has no difficulty dropdown; shows clue 1 as Hard · 3 pts', async ({ page }) => {
    await expect(page.getByRole('combobox', { name: 'Difficulty' })).toHaveCount(0);
    await expect(page.getByText('Hard · 3 pts')).toBeVisible();
  });

  test('correct guess on clue 1 earns 3 points', async ({ page }) => {
    await pick(page, 'jer', 'Jersey');
    await page.getByRole('button', { name: /SUBMIT GUESS/ }).click();
    await expect(page.getByText('YOU GOT IT!')).toBeVisible();
    await expect(page.locator('.result-score')).toContainText('3POINTS');
  });

  test('wrong guess unlocks clue 2 (Medium); solving there earns 2 points', async ({ page }) => {
    await pick(page, 'rrr', 'RRR');
    await page.getByRole('button', { name: /SUBMIT GUESS/ }).click();
    await expect(page.getByText('Medium · 2 pts')).toBeVisible();
    await pick(page, 'jers', 'Jersey');
    await page.getByRole('button', { name: /SUBMIT GUESS/ }).click();
    await expect(page.locator('.result-score')).toContainText('2POINTS');
  });

  test('three skips reveal the movie with 0 points', async ({ page }) => {
    for (const difficulty of ['Hard', 'Medium', 'Easy']) {
      await expect(page.locator('.clue-badge')).toContainText(`${difficulty} ·`);
      await page.getByRole('button', { name: /Skip this clue/ }).click();
    }
    await expect(page.getByText('TODAY’S MOVIE REVEAL')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Jersey' })).toBeVisible();
    await expect(page.locator('.result-score')).toContainText('0POINTS');
  });

  test('free text that was not picked from the list is not submitted', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'WHICH MOVIE IS THIS?' });
    await input.fill('Jersey');
    await input.press('Escape'); // close the suggestions without picking one
    await page.getByRole('button', { name: /SUBMIT GUESS/ }).click();
    await expect(page.getByText('Pick a movie from the suggestions list.')).toBeVisible();
    await expect(page.getByText('Hard · 3 pts')).toBeVisible();
  });

  test('autocomplete works with the keyboard', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'WHICH MOVIE IS THIS?' });
    await input.fill('arya');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await input.press('ArrowDown');
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(input).toHaveValue('Arya 2');
    await input.press('Escape');
  });

  test('alternate names match (AVPL)', async ({ page }) => {
    await page.getByRole('combobox', { name: 'WHICH MOVIE IS THIS?' }).fill('avpl');
    await expect(page.getByRole('option', { name: /Ala Vaikunthapurramuloo/ })).toBeVisible();
  });

  test('replaying audio does not use up a clue', async ({ page }) => {
    await page.getByRole('button', { name: 'Replay clue from the start' }).click();
    await page.getByRole('button', { name: 'Replay clue from the start' }).click();
    await expect(page.getByText('Hard · 3 pts')).toBeVisible();
  });

  test('countdown shows a time until the next IST midnight', async ({ page }) => {
    await expect(page.getByRole('timer')).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  });
});

test.describe('display name', () => {
  test('is asked on first visit, validated, saved and remembered', async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: /call you/ });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Display name').fill('<b>');
    await dialog.getByRole('button', { name: /LET’S PLAY/ }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByLabel('Display name').fill('  Ravi   Teja ');
    await dialog.getByRole('button', { name: /LET’S PLAY/ }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Ravi Teja').first()).toBeAttached();
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
