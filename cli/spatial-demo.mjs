#!/usr/bin/env node
// Build one 360° film whose soundtrack turns with the viewer.
//
// The picture is rendered by the ordinary story pipeline, silent. The score is
// rendered separately as a first-order sound field, piped into ffmpeg as raw
// floats, and the finished MP4 is tagged with both the spherical video boxes
// and SA3D.
//
// Why it is built this way rather than folded into `renderStoryProject`: the
// picture takes minutes and the sound takes seconds, and while the format is
// still being proved on an actual upload it is worth being able to re-cut the
// sound a dozen times without re-rendering a single frame.
//
//   node cli/spatial-demo.mjs                       # render if needed, then mix
//   node cli/spatial-demo.mjs --video out/x.mp4     # reuse a silent render
//   node cli/spatial-demo.mjs --stereo              # also write a stereo check
import { spawn, execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderSpatialStageScore } from '../src/story/scores/spatial.js';
import { addSphericalMp4Metadata } from '../src/export/sphericalMp4.js';
import { foaToStereo } from '../src/audio/ambisonic.js';
import { encodeWav } from '../src/audio/wav.js';
import { OBSERVATORY_EXHIBITS } from '../src/stories/spatial/stages.js';
import { renderStoryProject } from '../src/node/renderStory.js';
import { getStory } from '../src/stories/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// AAC rather than Opus. Both are on YouTube's list, but 4-channel Opus in MP4 is
// refused outright by most desktop players, which makes the file impossible to
// check before uploading it. AAC's floor for first order is 256 kbps.
//
// `4.0` is a surround layout, not an ambisonic one, and naming it here is safe
// only because of a specific measured fact: ffmpeg's AAC encoder writes the
// channels into the bitstream in the order it was handed them. Decoding the raw
// ADTS -- which ignores the container's layout tag, as an ambisonic decoder does
// -- returns them unpermuted. What SA3D says the channels are is what they are.
const BITRATE = '384k';
const LAYOUT = '4.0';

function run(command, args, { input } = {}) {
  return new Promise((ok, fail) => {
    const child = spawn(command, args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'], windowsHide: true });
    let log = '';
    child.stderr.on('data', d => { log = (log + d).slice(-4000); });
    child.once('error', fail);
    child.once('close', code => code === 0 ? ok() : fail(new Error(`${command} failed (${code}): ${log}`)));
    if (input) { child.stdin.on('error', () => {}); child.stdin.end(input); }
  });
}

const exists = path => stat(path).then(() => true, () => false);

/** Interleave the sound field into the raw floats ffmpeg will read. */
function interleave({ channelData, length }) {
  const channels = channelData.length, out = new Float32Array(length * channels);
  for (let i = 0; i < length; i++) for (let c = 0; c < channels; c++) out[i * channels + c] = channelData[c][i];
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
}

export async function buildSpatialDemo(argv = process.argv.slice(2)) {
  const { values: a } = parseArgs({ args: argv, options: {
    video: { type: 'string' }, out: { type: 'string' }, duration: { type: 'string' },
    width: { type: 'string' }, level: { type: 'string' }, seed: { type: 'string' },
    'sound-set': { type: 'string', default: 'distinct' },
    stereo: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (a.help) {
    console.log('mathloop 360° spatial audio demo\n'
      + '  --video path/to/silent.mp4   reuse an existing silent render\n'
      + '  --out folder                 default out/360-spatial-demo\n'
      + '  --duration 20 --width 2048   render settings, if rendering\n'
      + '  --level 0.55 --seed 674      score settings\n'
      + '  --sound-set distinct        piano / drums / organ / rain (default); or original\n'
      + '  --stereo                     also write a stereo fold-down to listen to');
    return;
  }

  const output = resolve(ROOT, a.out ?? 'out/360-spatial-demo');
  await mkdir(output, { recursive: true });
  let duration = Number(a.duration ?? 20);
  const width = Number(a.width ?? 2048);

  // 1. The picture, silent. Rendered only if there is not one already.
  let silent = a.video ? resolve(ROOT, a.video) : join(output, `fourier-observatory-360-${duration}s.mp4`);
  if (!await exists(silent)) {
    console.log(`Rendering the panorama at ${width}×${width / 2}, ${duration}s. This is the slow part.`);
    const story = getStory('fourier-observatory-360');
    const { output: folder } = await renderStoryProject({
      story, out: output,
      project: { export: { width, height: width / 2, preset: 'fast' }, audio: { enabled: false } },
      onProgress: ({ stage, fraction }) => process.stdout.write(`\r  ${stage} ${Math.round(fraction * 100)}%   `),
    });
    process.stdout.write('\n');
    silent = join(folder, `fourier-observatory-360-${duration}s.mp4`);
  } else {
    console.log(`Reusing the panorama at ${silent}`);
  }
  if (!await exists(silent)) throw new Error(`No silent render found at ${silent}. Pass --video.`);

  const probe = JSON.parse((await promisify(execFile)('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,duration', '-of', 'json', silent], { windowsHide: true })).stdout).streams[0];
  if (!probe || probe.width !== probe.height * 2) throw new Error('Spatial audio needs a full 2:1 panorama.');
  const videoDuration = Number(probe.duration);
  if (!Number.isFinite(videoDuration) || videoDuration <= 0) throw new Error('Could not determine the video duration.');
  if (a.duration !== undefined && Math.abs(duration - videoDuration) > .05) throw new Error(`Requested ${duration}s of audio, but the video is ${videoDuration}s. Omit --duration to match the film.`);
  duration = videoDuration;

  // 2. The sound field. Each creature sings from where it stands.
  console.log('Mixing the sound field…');
  const score = renderSpatialStageScore(OBSERVATORY_EXHIBITS, {
    duration, sampleRate: 48000,
    level: a.level === undefined ? .55 : Number(a.level),
    seed: a.seed === undefined ? 674 : Number(a.seed),
    soundSet: a['sound-set'],
  });
  for (const p of score.stats.placements) {
    console.log(`  ${p.name.padEnd(18)} ${String(p.heading).padStart(4)}°  ${p.voice}`);
  }
  // What you actually hear from each place you can look. The diagonal is the
  // part you are facing; everything else is how far below it the others sit.
  const { headings, matrix } = score.stats.isolation;
  const ids = score.stats.placements.map(p => p.part);
  console.log('\n  Virtual cardioid diagnostic, in dB (not a YouTube playback measurement):\n');
  console.log('    looking'.padEnd(16) + ids.map(x => x.padStart(8)).join(''));
  matrix.forEach((row, i) => {
    console.log('    ' + `${ids[i]} ${headings[i]}°`.padEnd(12) + row.map(v => String(v).padStart(8)).join(''));
  });

  // 3. Mux. The layout is named so ffmpeg cannot helpfully reorder the channels
  //    into a surround layout's canonical order, which would scramble the axes.
  const merged = join(output, '.spatial-mux.mp4');
  await run('ffmpeg', [
    '-hide_banner', '-y',
    '-i', silent,
    '-f', 'f32le', '-ar', '48000', '-ac', '4', '-channel_layout', LAYOUT, '-i', 'pipe:0',
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', BITRATE, '-ar', '48000',
    '-shortest', '-movflags', '+faststart',
    '-metadata', 'title=The golden observatory — 360° with spatial audio',
    merged,
  ], { input: interleave(score) });

  // 4. Tag. Both the spherical video boxes and SA3D, in one pass, because the
  //    remux above dropped whatever the silent render had been given.
  const name = `observatory-360-spatial-${duration}s.mp4`;
  const finished = join(output, name);
  const finishedBytes = addSphericalMp4Metadata(await readFile(merged), { ambisonic: true });
  await writeFile(finished, finishedBytes);

  // Keep the independent parts for the local player's look-to-listen mode.
  // YouTube receives the AmbiX mix above, which cannot mute individual parts.
  const focusStems = [];
  for (const stem of score.stems) {
    const file = `focus-${stem.id}.wav`;
    await writeFile(join(output, file), encodeWav({ channelData: [stem.focusAudio], sampleRate: score.sampleRate, dither: false }));
    focusStems.push({ file, name: stem.name, voice: stem.voice, heading: stem.heading, elevation: stem.elevation });
  }

  // 5. A stereo fold-down, so the mix can be judged without an upload. This is
  //    a pair of virtual microphones, not a binaural render: it shows that the
  //    balance moves with the yaw, not what a headset will do with it.
  const extras = [];
  if (a.stereo) {
    // A narrow pair, so the contrast is as stark as a first-order field allows.
    for (const { name, heading } of score.stats.placements) {
      const [left, right] = foaToStereo(score.channelData, { yaw: heading, width: 60 });
      const slug = name.replace(/^THE /i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const path = join(output, `listen-facing-${slug}.wav`);
      await writeFile(path, encodeWav({ channelData: [left, right], sampleRate: score.sampleRate, dither: false }));
      extras.push(path);
    }
  }

  await writeFile(join(output, 'spatial-audio.json'), JSON.stringify({
    video: name,
    videoSha256: createHash('sha256').update(finishedBytes).digest('hex'),
    stage: 'fourier-observatory-360',
    duration,
    soundSet: score.stats.soundSet,
    audio: {
      codec: 'AAC-LC', bitrate: BITRATE, sampleRate: 48000, containerLayout: LAYOUT,
      ...score.stats.format,
      metadata: ['SA3D', 'Spherical Video V2', 'Spherical Video V1'],
    },
    placements: score.stats.placements,
    isolation: score.stats.isolation,
    peakDb: Number(score.stats.peakDb.toFixed(1)),
    preview: { focus: { stems: focusStems, youtubeCompatible: false } },
    youtubePlaybackVerified: false,
  }, null, 2));

  console.log(`\nWrote ${finished}`);
  console.log('YouTube: spatial placement; other sounds remain audible. Local Focus mode: separate sounds follow your view.');
  console.log(`Preview: npm run 360:preview -- --story fourier-observatory-360 --video "${finished}"`);
  for (const path of extras) console.log(`  ${path}`);
  return { output: finished, folder: output, score };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildSpatialDemo().catch(error => { console.error(error.message); process.exitCode = 1; });
}
