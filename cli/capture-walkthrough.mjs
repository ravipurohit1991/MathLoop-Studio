// Record real Studio interactions in a fresh browser profile.
// First run `uv run cli/narrate-walkthrough.py` to derive natural cue lengths.
// --only=id,id or --from=id resume capture; preceding scenes must exist.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, basename } from 'node:path';
import { performance } from 'node:perf_hooks';

const out = resolve('out/walkthrough');
await mkdir(`${out}/captures`, { recursive: true });
await mkdir(`${out}/examples`, { recursive: true });
const spec = JSON.parse(await readFile('marketing/walkthrough.json', 'utf8'));
const timings = JSON.parse(await readFile(`${out}/timing.json`, 'utf8'));
const args = process.argv.slice(2);
const only = args.find(a => a.startsWith('--only='))?.slice(7).split(',');
const from = args.find(a => a.startsWith('--from='))?.slice(7);
const media = new Map([
  ['my-first-film.mp4', `${out}/examples/my-first-film.mp4`],
  ['sphere.mp4', resolve('out/launch/aquarium-360/fourier-aquarium-360-20s.mp4')],
  ['short.mp4', resolve('out/360-aquarium-short/fourier-aquarium-short-20s.mp4')],
]);
const server = await createServer({ server: { port: 5197, strictPort: true, host: '127.0.0.1' }, plugins: [{
  name: 'walkthrough-media', configureServer(vite) {
    vite.middlewares.use('/walkthrough-media', async (req, res, next) => {
      const path = media.get(basename((req.url ?? '').split('?')[0]));
      if (!path) return next();
      try {
        const { size } = await stat(path);
        const match = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
        const start = match ? Number(match[1]) : 0, end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
        res.writeHead(match ? 206 : 200, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(match ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
        createReadStream(path, { start, end }).pipe(res);
      } catch { res.writeHead(404); res.end(); }
    });
  }
}] });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: process.env.MATHLOOP_BROWSER ?? (process.platform === 'win32' ? 'msedge' : undefined) });
let state;
const firstIndex = only ? spec.scenes.findIndex(s => s.id === only[0]) : from ? spec.scenes.findIndex(s => s.id === from) : 0;
if (firstIndex > 0) {
  try { state = JSON.parse(await readFile(`${out}/captures/${spec.scenes[firstIndex - 1].id}.state.json`, 'utf8')); } catch { /* An isolated visual can start with defaults. */ }
}
const contextOptions = { viewport: { width: 1600, height: 900 }, recordVideo: { dir: `${out}/raw`, size: { width: 1600, height: 900 } } };
let context = await browser.newContext({ ...contextOptions, storageState: state });
let capturedIndex = firstIndex - 1;
const wait = ms => new Promise(r => setTimeout(r, ms));
let page;
const label = name => name === 'Weather intensity' ? page.getByRole('slider', { name, exact: true }) : page.getByLabel(name, { exact: true });
const button = name => page.getByRole('button', { name, exact: !['Export MP4', 'Export 360° MP4', 'Animation tracks'].includes(name) });
async function mark(locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate(el => {
    document.querySelectorAll('[data-tutorial-focus]').forEach(n => n.removeAttribute('data-tutorial-focus'));
    el.setAttribute('data-tutorial-focus', '');
  });
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + Math.min(box.width / 2, 100), box.y + box.height / 2, { steps: 14 });
  await wait(350);
}
async function action([op, key, value]) {
  if (op === 'wait') return wait(key * 1000);
  if (op === 'top') return page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  if (op === 'focus') return page.locator(key).first().evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  if (op === 'highlight') return mark(page.locator(key).first());
  if (op === 'highlightButton') return mark(button(key));
  if (op === 'click') { const target = button(key); await mark(target); await target.click(); }
  if (op === 'fill' || op === 'select' || op === 'check') {
    const target = label(key); await mark(target);
    if (op === 'select') await target.selectOption(value);
    else if (op === 'check') await target.setChecked(value);
    else if (['range', 'color'].includes(await target.getAttribute('type'))) {
      // Playwright fill does not support range inputs; use the browser's native setter.
      await target.evaluate((el, next) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, next); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, value);
    } else await target.fill(value);
  }
  if (op === 'chapter') { const target = page.locator('.story-chapters li button').nth(key); await mark(target); await target.click(); }
  if (op === 'score') { const target = page.locator('.score-card').filter({ hasText: key }).first(); await mark(target); await target.click(); }
  if (op === 'save' || op === 'export') {
    const target = button(key); await mark(target);
    const downloading = page.waitForEvent('download', { timeout: 300000 });
    await target.click();
    const download = await downloading;
    await download.saveAs(`${out}/examples/${value}`);
    console.log(`  Downloaded ${value}`);
  }
  if (op === 'open') await page.locator('input[accept=".json"]').setInputFiles(`${out}/examples/${key}`);
  if (op === 'svg') {
    await mark(button('＋ Turn an SVG into a story'));
    await page.locator('input[accept=".svg"]').setInputFiles(resolve(key));
    await page.getByRole('status').filter({ hasText: 'contours imported' }).waitFor();
  }
  if (op === 'addReel') { const target = page.locator('.stage-rack .stage-reel').last(); await mark(target); await target.click(); }
  if (op === 'lastReel') await page.locator('.stage-placed li').last().locator('button').first().click();
  if (op === 'region') { const target = page.locator('.nature-regions button').nth(key); await mark(target); await target.click(); await page.locator('.nature-player').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'smooth' })); }
  if (op === 'drag') {
    const target = page.locator(key); await mark(target); const box = await target.boundingBox();
    await page.mouse.move(box.x + box.width * .75, box.y + box.height * .5);
    await page.mouse.down();
    for (let i = 0; i <= 45; i++) { await page.mouse.move(box.x + box.width * (.75 - .5 * i / 45), box.y + box.height * (.5 + .07 * Math.sin(i / 45 * Math.PI))); await wait(40); }
    await page.mouse.up();
  }
  await wait(600);
}
function card(scene) {
  const content = {
    setup: `<p class="eyebrow">COPY THESE COMMANDS · NODE.JS 22+ + GIT</p><h1>Open your local studio</h1><pre>git clone https://github.com/ravipurohit1991/MathLoop-Studio.git\ncd MathLoop-Studio\nnpm ci\nnpm run dev</pre><p>Open <strong>http://127.0.0.1:5180</strong></p><p class="muted">Use a recent Chrome or Edge. Native command-line export also needs FFmpeg + ffprobe.</p>`,
    code: `<p class="eyebrow">SOURCE MAP · WHERE TO START READING</p><h1>One project. One timeline.</h1><div class="rows"><p><code>studio/</code><span>React editor and browser controls</span></p><p><code>src/stories/</code><span>Film definitions, artwork and defaults</span></p><p><code>src/story/</code><span>Project model, timeline, renderer and score</span></p><p><code>src/nature/</code><span>Photographic worlds, weather and ambience</span></p><p><code>cli/</code><span>Native rendering and batch commands</span></p></div><p class="muted">Editor → saved JSON → shared renderer → frames + audio → MP4</p>`,
    cli: `<p class="eyebrow">COPY THESE COMMANDS · FFMPEG + FFPROBE ON PATH</p><h1>Repeat and automate</h1><p>Render your downloaded project</p><pre>npm run story:render -- --project my-first-film.story.json</pre><p>Render the 14-film showcase collection</p><pre>npm run collection</pre><p>Render a nature world with spatial audio</p><pre>npm run nature:render -- --world jungle --width 3840 --duration 20</pre>`,
    companions: `<p class="eyebrow">ACTUAL INCLUDED SAMPLE FILES</p><h1>Sphere and portrait companion</h1><div style="display:flex;gap:50px;align-items:center;justify-content:center"><div><video src="/walkthrough-media/sphere.mp4" autoplay loop muted style="width:960px"></video><p>360° frame · 3840 × 1920</p></div><div><video src="/walkthrough-media/short.mp4" autoplay loop muted style="height:580px"></video><p>Portrait tour · 9:16</p></div></div>`,
  };
  const body = scene.result ? `<div style="display:flex;align-items:center;gap:90px;justify-content:center;height:780px"><div><p class="eyebrow">OUR ACTUAL BROWSER EXPORT</p><h1>My first<br>Fourier film</h1><p>20 seconds · 540 × 960 · 24 fps</p><p>Edited chapters + Still Water score</p><p class="muted">The example project is included.</p></div><video src="/walkthrough-media/my-first-film.mp4" autoplay loop muted style="height:760px"></video></div>` : content[scene.card];
  return `<html><head><style>body{margin:0;background:#0f1c22;color:#eee8da;font:28px/1.55 'Segoe UI',Arial,sans-serif;padding:50px 80px}h1{font-size:54px;line-height:1.15;margin:18px 0 32px}p{margin:12px 0}.eyebrow{color:#8fcdc3;font-size:18px;letter-spacing:3px}.muted{color:#a4b7bb;font-size:23px}pre{background:#182d35;padding:24px 30px;border-left:5px solid #e9b78c;font:25px/1.8 Consolas,monospace;white-space:pre-wrap}.rows p{display:flex;padding:18px;border-bottom:1px solid #35505b}.rows code{width:350px;color:#e9b78c}video{border:1px solid #35505b;border-radius:12px}</style></head><body>${body}</body></html>`;
}
try {
  for (const [index, scene] of spec.scenes.entries()) {
    if (index < firstIndex || only && !only.includes(scene.id)) continue;
    if (only && index > capturedIndex + 1) {
      await context.close();
      state = JSON.parse(await readFile(`${out}/captures/${spec.scenes[index - 1].id}.state.json`, 'utf8'));
      context = await browser.newContext({ ...contextOptions, storageState: state });
    }
    const opened = performance.now();
    page = await context.newPage(); page.setDefaultTimeout(20000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    console.log(`Recording ${scene.id} (${timings[scene.id].duration.toFixed(1)}s)`);
    try {
      await page.goto(`http://127.0.0.1:5197/?studio=${scene.mode ?? 'story'}`);
      await page.locator('main').waitFor();
      if (scene.card || scene.result) { await page.setContent(card(scene)); await page.locator('video').evaluateAll(videos => Promise.all(videos.map(v => v.play()))); }
      else {
        if (scene.mode === 'nature') await page.locator('.nature-loading').waitFor({ state: 'hidden', timeout: 60000 });
        await page.addStyleTag({ content: '[data-tutorial-focus]{outline:3px solid #ffd292!important;outline-offset:5px!important;transition:outline .2s}html{scroll-behavior:smooth}' });
        await page.evaluate(() => {
          const cursor = document.createElement('div'); cursor.id = 'tutorial-pointer';
          cursor.style.cssText = 'position:fixed;width:18px;height:18px;border:3px solid #ffd292;border-radius:50%;background:#11212888;pointer-events:none;z-index:99999;left:-100px;top:-100px;box-shadow:0 0 0 5px #ffd29222'; document.body.append(cursor);
          document.addEventListener('mousemove', e => { cursor.style.left = `${e.clientX - 9}px`; cursor.style.top = `${e.clientY - 9}px`; });
        });
        for (const step of scene.setup ?? []) await action(step);
      }
      await wait(1000);
      if (scene.result || scene.card === 'companions') await page.locator('video').evaluateAll(videos => videos.forEach(v => { v.currentTime = 0; }));
      const start = performance.now(); const cueMarks = [];
      for (const [i, cue] of scene.cues.entries()) {
        const cueStart = performance.now(); cueMarks.push((cueStart - start) / 1000);
        for (const step of cue.actions ?? []) await action(step);
        await wait(Math.max(0, timings[scene.id].cues[i].duration * 1000 - (performance.now() - cueStart)));
      }
      await wait((scene.listen ?? 0) * 1000 + 500);
      const duration = (performance.now() - start) / 1000;
      await page.screenshot({ path: `${out}/captures/${scene.id}.png` });
      await context.storageState({ path: `${out}/captures/${scene.id}.state.json` });
      const video = page.video();
      await page.close();
      await video.saveAs(`${out}/captures/${scene.id}.webm`);
      if (errors.length) throw new Error(errors.join('\n'));
      await writeFile(`${out}/captures/${scene.id}.json`, JSON.stringify({ id: scene.id, lead: (start - opened) / 1000, duration, cueMarks, target: timings[scene.id].duration }, null, 2));
      console.log(`  Saved ${scene.id}: ${duration.toFixed(1)}s`);
      capturedIndex = index;
    } catch (error) {
      if (!page.isClosed()) await page.screenshot({ path: `${out}/captures/${scene.id}-error.png` });
      throw error;
    }
  }
  await copyFile('examples/walkthrough-leaf.svg', `${out}/examples/walkthrough-leaf.svg`);
} finally { await context.close(); await browser.close(); await server.close(); }
