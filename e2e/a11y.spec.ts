import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Automated accessibility audit (axe-core, WCAG 2.2 A/AA rules) of every
 * player page plus the admin login. Fails on any violation.
 */
const PAGES = [
  { name: 'Today', path: '/', ready: (p: Page) => p.getByRole('button', { name: 'Play clue', exact: true }).waitFor() },
  { name: 'Time Travel', path: '/time-travel', ready: (p: Page) => p.getByRole('region', { name: 'Calendar' }).waitFor() },
  { name: 'Leaderboard', path: '/leaderboard', ready: (p: Page) => p.getByRole('tabpanel').waitFor() },
  { name: 'Statistics', path: '/stats', ready: (p: Page) => p.getByText('Current streak', { exact: true }).waitFor() },
  { name: 'My History', path: '/history', ready: (p: Page) => p.getByRole('heading', { name: 'Your game history' }).waitFor() },
  { name: 'How to Play', path: '/how-to-play', ready: (p: Page) => p.getByRole('heading', { name: 'How to play' }).waitFor() },
];

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(v => `${v.impact} ${v.id}: ${v.help} — ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
  return summary;
}

for (const p of PAGES) {
  test(`${p.name} has no accessibility violations`, async ({ page }) => {
    await page.goto(p.path);
    await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
    await p.ready(page);
    await page.waitForTimeout(400); // let fonts and transitions settle
    expect(await audit(page)).toEqual([]);
  });
}

test('the name dialog has no accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('admin login and offline pages have no accessibility violations', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('E-mail').waitFor();
  expect(await audit(page)).toEqual([]);
  await page.goto('/offline');
  expect(await audit(page)).toEqual([]);
});

test('keyboard users can skip straight to the content', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard navigation');
  await page.goto('/how-to-play');
  await page.getByRole('dialog').getByRole('button', { name: 'Maybe later' }).click();
  // Closing the first-visit dialog moves focus to the content, not into the void.
  await expect(page.locator('#main')).toBeFocused();
  // On a fresh page load, the first Tab reaches the skip link.
  await page.reload();
  await page.getByRole('heading', { name: 'How to play' }).waitFor();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});
