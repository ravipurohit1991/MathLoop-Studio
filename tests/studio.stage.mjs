// Browser integration checks for 360 Studio: placing reels, aiming them,
// looking around, persistence, and both exports the stage can deliver.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { SPHERICAL_STORY_LIST, STAGE_REEL_LIST, getStory } from '../src/stories/index.js';
import { createStoryProject, storyProjectToJson } from '../src/story/project.js';

const server = await createServer({ server: { port: 5203, strictPort: true } }); await server.listen();
const browser = await chromium.launch({ headless: true, channel: process.env.MATHLOOP_BROWSER ?? (process.platform === 'win32' ? 'msedge' : undefined) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
page.on('pageerror', e => errors.push(e.message));
const out = 'out/story-refactor/stage'; await mkdir(out, { recursive: true });
const bearing = () => page.locator('.stage-bearing').textContent();

try {
  await page.goto('http://127.0.0.1:5203/');
  await page.getByRole('tab', { name: '360 Studio' }).click();
  await page.getByRole('heading', { name: 'Build the room, not the shot.' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'desktop horizontal overflow');

  // Every authored stage is reachable, and each one names its reels.
  for (const stage of SPHERICAL_STORY_LIST) await page.getByRole('button', { name: `Open stage: ${stage.title}` }).waitFor();
  await page.getByRole('button', { name: `Open stage: ${SPHERICAL_STORY_LIST[0].title}` }).click();
  assert.equal(await page.locator('.stage-placed li').count(), 3, 'the aquarium opens with its three reels');
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: true });

  // Placing a reel adds it to the sphere and selects it for aiming.
  await page.getByRole('button', { name: `＋ ${STAGE_REEL_LIST[3].label}` }).click();
  assert.equal(await page.locator('.stage-placed li').count(), 4, 'a placed reel joins the sphere');
  await page.getByLabel('Caption', { exact: true }).fill('THE FOURTH WALL');
  await page.getByLabel('Heading', { exact: true }).fill('150');
  await page.getByLabel('Elevation', { exact: true }).fill('20');
  await page.getByLabel('Size', { exact: true }).fill('1.2');
  await page.locator('.stage-placed li').nth(3).getByText('THE FOURTH WALL').waitFor();

  // Looking around is a camera move, not an edit: the film itself is unchanged.
  const canvas = page.locator('.stage-screen canvas');
  const before = await bearing();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 220, box.y + box.height / 2 + 40, { steps: 8 }); await page.mouse.up();
  assert.notEqual(await bearing(), before, 'dragging turns the viewer');
  const pixels = () => page.evaluate(() => { const c = document.querySelector('.stage-screen canvas'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.join(','); });
  const looking = await pixels();
  await page.getByRole('button', { name: 'Panorama', exact: true }).click();
  assert.equal(await canvas.evaluate(c => c.width / c.height), 2, 'the exported frame is a 2:1 panorama');
  assert.notEqual(await pixels(), looking, 'the panorama is a different picture from the free look');
  await page.screenshot({ path: `${out}/panorama.png`, fullPage: true });
  await page.getByRole('button', { name: 'Look around', exact: true }).click();

  // The arrangement survives a reload, then travels in a saved stage file.
  await page.getByLabel('Total length', { exact: true }).fill('2');
  await page.getByLabel('Delivery size').selectOption('2048');
  await page.getByLabel('Frame rate').selectOption('24');
  await page.reload();
  await page.getByRole('heading', { name: 'Build the room, not the shot.' }).waitFor();
  assert.equal(await page.locator('.stage-placed li').count(), 4, 'the arrangement is restored');
  const saving = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save stage', exact: true }).click();
  await (await saving).saveAs(`${out}/edited.stage.json`);
  const stage = JSON.parse(await readFile(`${out}/edited.stage.json`, 'utf8'));
  assert.equal(stage.params.exhibits.length, 4);
  assert.equal(stage.params.exhibits[3].name, 'THE FOURTH WALL');
  assert.equal(stage.params.exhibits[3].heading, 150);
  assert.equal(stage.export.width, 2048); assert.equal(stage.export.height, 1024);

  // Both deliverables render from the one arrangement.
  const sphere = page.waitForEvent('download', { timeout: 180000 });
  await page.getByRole('button', { name: /Export 360° MP4/ }).click();
  await (await sphere).saveAs(`${out}/stage-360.mp4`);
  assert.ok((await stat(`${out}/stage-360.mp4`)).size > 20000, 'the 360 export has real footage in it');
  const short = page.waitForEvent('download', { timeout: 180000 });
  await page.getByRole('button', { name: /Export the 9:16 Short/ }).click();
  await (await short).saveAs(`${out}/stage-short.mp4`);
  assert.ok((await stat(`${out}/stage-short.mp4`)).size > 20000, 'the companion Short has real footage in it');

  // A film project belongs in the other studio, and says so.
  await page.getByRole('tab', { name: 'Story Studio' }).click();
  await page.getByRole('heading', { name: 'Give your maths a story.' }).waitFor();
  await page.getByRole('tab', { name: '360 Studio' }).click();
  const film = storyProjectToJson(createStoryProject(getStory('fourier-koi')));
  await page.locator('input[type=file]').setInputFiles({ name: 'film.json', mimeType: 'application/json', buffer: Buffer.from(film) });
  await page.getByRole('alert').getByText(/Open it in Story Studio/).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'mobile horizontal overflow');
  await page.screenshot({ path: `${out}/mobile.png`, fullPage: true });

  assert.deepEqual(errors, []);
  console.log('360 Studio passed: stage switching, placing, aiming, free look, panorama, persistence, save, and both exports.');
} finally {
  await browser.close(); await server.close();
}
