// Renders public/icons/icon.svg to the PNG sizes needed for PWA install,
// Apple home screen and favicons. Usage: node scripts/generate-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const targets = [
  { file: 'public/icons/icon-192.png', size: 192, pad: 0 },
  { file: 'public/icons/icon-512.png', size: 512, pad: 0 },
  // Maskable: launchers may crop to a circle, so keep the mark inside the 80% safe zone.
  { file: 'public/icons/maskable-512.png', size: 512, pad: 0.1 },
  { file: 'app/apple-icon.png', size: 180, pad: 0 },
  { file: 'app/icon.png', size: 48, pad: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const inset = Math.round(t.size * t.pad);
  await page.setContent(`<html><body style="margin:0;background:#050505">
    <div style="width:${t.size}px;height:${t.size}px;display:grid;place-items:center">
      <div style="width:${t.size - 2 * inset}px;height:${t.size - 2 * inset}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </div></body></html>`);
  await page.screenshot({ path: t.file, omitBackground: false });
  console.log(`wrote ${t.file}`);
}
await browser.close();
