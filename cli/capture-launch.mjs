// Capture the running Studio with a fresh, temporary browser context.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const out = 'docs/images';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.MATHLOOP_BROWSER ?? (process.platform === 'win32' ? 'msedge' : undefined) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.MATHLOOP_URL ?? 'http://127.0.0.1:5180/');
  await page.getByRole('heading', { name: 'Give your maths a story.' }).waitFor();
  await page.getByLabel('Story playhead').fill('53');
  await page.locator('.story-workspace').screenshot({ path: `${out}/story-workspace.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${out}/story-studio.png` });
  await page.getByRole('button', { name: '3D authored films', exact: true }).click();
  await page.getByRole('button', { name: 'Load film: A whale, drawn through space.', exact: true }).click();
  await page.getByLabel('Story playhead').fill('48');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${out}/spatial-studio.png` });
  await page.getByRole('tab', { name: '360 Studio', exact: true }).click();
  await page.getByRole('heading', { name: 'Build the room, not the shot.' }).waitFor();
  await page.screenshot({ path: `${out}/360-studio.png` });
  await page.getByRole('button', { name: 'Panorama', exact: true }).click();
  await page.screenshot({ path: `${out}/360-panorama.png` });
  await page.getByRole('tab', { name: 'Nature Worlds', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.screenshot({ path: `${out}/nature-worlds.png` });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Saved five Studio screenshots to ${out}`);
} finally { await browser.close(); }
