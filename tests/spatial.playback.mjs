// Exercise real AAC decoding, the actual audio graph and the viewer's controls.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { start360Preview } from '../src/node/preview360.js';
import { addSphericalMp4Metadata } from '../src/export/sphericalMp4.js';
import { exhibitGains } from '../src/audio/ambisonic.js';
import { encodeWav } from '../src/audio/wav.js';

const folder = 'out/tests-spatial-playback';
await mkdir(folder, { recursive: true });
const rate = 48000, duration = 4, length = rate * duration;
const headings = [0, 90, 180, -90], frequencies = [240, 480, 720, 960];
const channels = [0, 1, 2, 3].map(() => new Float32Array(length));
const stems = [];
for (const [index, heading] of headings.entries()) {
  const signal = Float32Array.from({ length }, (_, i) => .1 * Math.sin(2 * Math.PI * frequencies[index] * i / rate));
  const gains = exhibitGains({ heading });
  for (let c = 0; c < 4; c++) for (let i = 0; i < length; i++) channels[c][i] += signal[i] * gains[c];
  const file = `focus-${index}.wav`;
  await writeFile(`${folder}/${file}`, encodeWav({ channelData: [signal], sampleRate: rate, dither: false }));
  stems.push({ file, name: `source ${index}`, heading, elevation: 0 });
}
const raw = new Float32Array(length * 4);
for (let i = 0; i < length; i++) for (let c = 0; c < 4; c++) raw[i * 4 + c] = channels[c][i];
const result = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=size=128x64:rate=10',
  '-f', 'f32le', '-ar', String(rate), '-ac', '4', '-channel_layout', '4.0', '-i', 'pipe:0',
  '-map', '0:v', '-map', '1:a', '-t', String(duration), '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '384k',
  '-movflags', '+faststart', `${folder}/raw.mp4`], { input: Buffer.from(raw.buffer), windowsHide: true });
assert.equal(result.status, 0, result.stderr?.toString());
await writeFile(`${folder}/field.mp4`, addSphericalMp4Metadata(await readFile(`${folder}/raw.mp4`), { ambisonic: true }));
await writeFile(`${folder}/spatial-audio.json`, JSON.stringify({ video: 'field.mp4', duration, preview: { focus: { stems } } }));
const { server, url } = await start360Preview({ video: `${folder}/field.mp4`, port: 0,
  stage: { title: 'Spatial test', eyebrow: 'Test', lead: 'Four sources', exhibits: stems.map(s => [s.heading, s.name]) } });
const browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' ? 'msedge' : undefined });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const Original = window.AudioContext, connect = AudioNode.prototype.connect;
    window.AudioContext = class extends Original {
      constructor(...args) { super(...args); this.meter = this.createAnalyser(); this.meter.fftSize = 32768; window.testContext = this; }
    };
    AudioNode.prototype.connect = function(destination, ...args) {
      if (destination === this.context.destination && this.context.meter) connect.call(this, this.context.meter);
      return connect.call(this, destination, ...args);
    };
  });
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('#play').disabled);
  await page.getByRole('button', { name: 'Sound on', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const spectrum = async () => page.evaluate(frequencies => {
    const context = window.testContext, meter = context.meter, samples = new Float32Array(meter.fftSize);
    meter.getFloatTimeDomainData(samples);
    return frequencies.map(hz => {
      let sin = 0, cos = 0;
      // A Hann window avoids mistaking spectral leakage for another stem.
      for (let i = 0; i < samples.length; i++) {
        const v = samples[i] * (.5 - .5 * Math.cos(2 * Math.PI * i / (samples.length - 1)));
        sin += v * Math.sin(2 * Math.PI * hz * i / context.sampleRate);
        cos += v * Math.cos(2 * Math.PI * hz * i / context.sampleRate);
      }
      return Math.hypot(sin, cos) * 4 / samples.length;
    });
  }, frequencies);
  const spectra = [];
  for (const heading of headings) {
    await page.locator(`[data-heading="${heading}"]`).click();
    await page.waitForTimeout(1000); spectra.push(await spectrum());
  }
  spectra.forEach((row, i) => {
    assert.ok(row[i] > .06, `facing ${headings[i]} should hear its encoded source: ${row}`);
    assert.ok(row[i] > row[(i + 2) % 4] * 4, `AAC axis/rotation mismatch at ${headings[i]}: ${row}`);
  });
  await page.getByLabel('Listening mode', { exact: true }).selectOption('focus');
  const focusSpectra = [];
  for (const [i, heading] of headings.entries()) {
    await page.locator(`[data-heading="${heading}"]`).click();
    await page.waitForTimeout(1000);
    const row = await spectrum(); focusSpectra.push(row);
    assert.ok(row[i] > .07, `focused source ${i} must play: ${row}`);
    row.forEach((value, j) => { if (i !== j) assert.ok(value < row[i] * .01, `off-screen source ${j} must be at least 40 dB down: ${row}`); });
  }
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForTimeout(800); assert.ok(Math.max(...await spectrum()) < .0001, 'pause stops stems');
  await page.getByLabel('Video time', { exact: true }).fill('3.6');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(1600); assert.ok((await spectrum())[3] > .07, 'stems restart after video loop');
  await page.getByLabel('Video time', { exact: true }).fill('1');
  await page.waitForTimeout(900); assert.ok((await spectrum())[3] > .07, 'seeking resumes stems');
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  await page.waitForTimeout(800); assert.ok(Math.max(...await spectrum()) < .0001, 'mute stops audio');
  assert.deepEqual(errors, []);
  await writeFile(`${folder}/measurements.json`, JSON.stringify({ headings, frequencies, spatial: spectra, focus: focusSpectra }, null, 2));
  await page.screenshot({ path: `${folder}/player.png`, fullPage: true });
  console.log('PASS: actual AAC channels rotate; Focus rejects off-screen tones by >40 dB; pause, seek, loop and mute work.');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
