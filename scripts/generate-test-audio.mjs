// Generates three short synthetic melodies (WebM/Opus, ~6 s) used as test and
// local-development clues. No copyrighted audio is involved.
// Usage: node scripts/generate-test-audio.mjs   (writes e2e/fixtures/clue-{1,2,3}.webm)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const MELODIES = [
  [262, 330, 392, 523, 392, 330], // C major arpeggio
  [294, 370, 440, 587, 440, 370], // D major
  [330, 415, 494, 659, 494, 415], // E major
];

mkdirSync('e2e/fixtures', { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto('about:blank');

for (const [i, notes] of MELODIES.entries()) {
  const base64 = await page.evaluate(async (freqs) => {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    gain.connect(dest);
    const step = 1.0; // seconds per note
    const t0 = ctx.currentTime + 0.05;
    freqs.forEach((f, n) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start(t0 + n * step);
      osc.stop(t0 + n * step + step * 0.9);
    });
    const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    const done = new Promise(r => (recorder.onstop = r));
    recorder.start();
    await new Promise(r => setTimeout(r, freqs.length * step * 1000 + 200));
    recorder.stop();
    await done;
    const buf = new Uint8Array(await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer());
    let bin = '';
    for (const b of buf) bin += String.fromCharCode(b);
    return btoa(bin);
  }, notes);
  const file = `e2e/fixtures/clue-${i + 1}.webm`;
  writeFileSync(file, Buffer.from(base64, 'base64'));
  console.log(`wrote ${file}`);
}
await browser.close();
