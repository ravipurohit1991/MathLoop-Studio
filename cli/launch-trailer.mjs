// Reproducible 1080p launch film, using the actual MathLoop renderers.
// Capture the UI and generate narration first. See marketing/README.md.
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { getStory, STAGE_REELS } from '../src/stories/index.js';
import { createStoryEngine } from '../src/story/engine.js';
import { createStoryProject, setStoryDuration } from '../src/story/project.js';
import { renderStoryScore } from '../src/story/score.js';
import { createFourierStory, artworkFromPaths } from '../src/story/fourier.js';
import { createStage360World, drawStageViewport } from '../src/story/stage360.js';
import { registerStoryFonts } from '../src/node/renderStory.js';

const spec = JSON.parse(await readFile('marketing/trailer.json', 'utf8'));
const out = 'out/launch', preview = process.argv.includes('--preview'), audioOnly = process.argv.includes('--audio-only');
await mkdir(out, { recursive: true });
await mkdir('docs/images', { recursive: true });
await registerStoryFonts();
if (process.platform === 'win32') {
  GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeui.ttf', 'Launch');
  GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeuib.ttf', 'Launch Bold');
  GlobalFonts.registerFromPath('C:/Windows/Fonts/consola.ttf', 'Code');
}
const W = 1920, H = 1080, fps = spec.fps;
const canvas = createCanvas(W, H), c = canvas.getContext('2d');
const ink = '#f1eee5', muted = '#9cbbb9', mint = '#9fe8d3', orange = '#ffc38c';
let duration = 0;
for (const scene of spec.scenes) { scene.start = duration; duration += scene.duration; }
const shots = {};
for (const name of ['story-workspace', 'spatial-studio', '360-studio', 'nature-worlds']) shots[name] = await loadImage(`docs/images/${name}.png`);
const engines = new Map();
function engine(id) {
  if (!engines.has(id)) {
    const story = id === 'leaf' ? leaf : getStory(id);
    const surface = createCanvas(540, 960);
    engines.set(id, createStoryEngine({ canvas: surface, story, createCanvas }));
  }
  return engines.get(id);
}
const points = Array.from({ length: 192 }, (_, i) => {
  const a = i / 192 * Math.PI * 2, r = 1 + .18 * Math.sin(3 * a);
  return [50 + 38 * r * Math.cos(a), 50 + 30 * r * Math.sin(a)];
});
const leaf = createFourierStory({ id: 'launch-outline', title: 'Your outline. In circles.', artwork: artworkFromPaths([{ points, closed: true }], { name: 'your outline', harmonics: 48 }) });
const sphere = getStory('fourier-aquarium-360');
const world = createStage360World(STAGE_REELS, sphere.params.exhibits, sphere.theme);
const viewport = createCanvas(1120, 630);
function text(value, x, y, size = 28, colour = ink, bold = false) {
  c.fillStyle = colour; c.font = `${size}px "${bold ? 'Launch Bold' : 'Launch'}", Arial`; c.fillText(value, x, y);
}
function box(x, y, w, h, colour = '#112c30', radius = 24) {
  c.fillStyle = colour; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
}
function wrapped(value, x, y, width, size = 30, colour = ink, lineHeight = 42) {
  c.font = `${size}px Launch, Arial`;
  const lines = []; let line = '';
  for (const word of value.split(' ')) {
    if (c.measureText(`${line} ${word}`).width > width && line) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  lines.forEach((s, i) => text(s, x, y + lineHeight * i, size, colour));
  return lines.length;
}
function film(id, seconds, x, y, w, h) {
  const e = engine(id); e.renderAt(seconds);
  c.save(); c.beginPath(); c.roundRect(x, y, w, h, 20); c.clip(); c.drawImage(e.canvas, x, y, w, h); c.restore();
  c.strokeStyle = '#416063'; c.lineWidth = 1; c.beginPath(); c.roundRect(x, y, w, h, 20); c.stroke();
}
function screenshot(name, x, y, w, h, u) {
  box(x - 2, y - 30, w + 4, h + 32, '#254247', 18);
  for (let i = 0; i < 3; i++) { c.fillStyle = [orange, mint, '#789394'][i]; c.beginPath(); c.arc(x + 20 + i * 20, y - 14, 5, 0, Math.PI * 2); c.fill(); }
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  const im = shots[name], scale = w / im.width;
  const offset = Math.max(0, im.height * scale - h) * (.3 + .4 * u);
  c.drawImage(im, x, y - offset, w, im.height * scale); c.restore();
}
function backdrop(t) {
  const grad = c.createLinearGradient(0, 0, W, H); grad.addColorStop(0, '#061a21'); grad.addColorStop(1, '#102f31');
  c.fillStyle = grad; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#244143'; c.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    c.beginPath(); c.arc(1620, 460, 170 + 82 * i + Math.sin(t * .15) * 16, 0, Math.PI * 2); c.stroke();
  }
  text('MATHLOOP', 88, 68, 24, mint, true); text('STUDIO', 249, 68, 24, muted);
  text('MATHS → ART → FILM', 1495, 68, 22, muted);
}
function render(scene, local, index, subtitles = true) {
  const u = local / scene.duration, t = scene.start + local;
  backdrop(t);
  text(scene.eyebrow, 88, 145, 21, orange, true);
  const titleSize = scene.id === 'svg' ? 62 : 76;
  scene.title.forEach((line, i) => text(line, 88, 300 + i * 87, titleSize, ink, true));
  wrapped(scene.detail, 92, 340 + scene.title.length * 87, 610, 28, muted);
  if (scene.id === 'hook' || scene.id === 'collection') {
    const ids = scene.id === 'hook' ? ['fourier-monkey', 'fourier-whale-3d', 'fourier-manta-3d'] : ['fourier-butterfly', 'fourier-koi', 'fourier-lotus-3d'];
    ids.forEach((id, i) => film(id, 53 + local * .3, 800 + i * 324, 208 + (i === 1 ? -28 : 20) + Math.sin(local * .6 + i) * 10, 302, 537));
    text('ACTUAL FILMS RENDERED FROM THE SOURCE', 804, 837, 21, mint);
  } else if (scene.id === 'studio') {
    screenshot('story-workspace', 760, 240, 1050, 595, u);
    text('EDIT  /  SEEK  /  PREVIEW  /  SAVE', 795, 893, 22, mint);
  } else if (scene.id === 'code') {
    box(82, 590, 800, 268);
    const lines = ["const story = getStory('fourier-whale-3d');", 'const engine = createStoryEngine({', '  canvas, story', '});', 'engine.renderAt(12.5);'];
    lines.forEach((line, i) => { c.font = '24px Code, monospace'; c.fillStyle = i === 4 ? orange : mint; c.fillText(line, 109, 636 + i * 42); });
    film('fourier-whale-3d', 5 + u * 45, 1160, 181, 385, 685);
    text('FOURIER RECONSTRUCTION → SURFACE', 969, 902, 22, mint);
  } else if (scene.id === 'svg') {
    box(94, 613, 500, 204);
    c.strokeStyle = orange; c.lineWidth = 4; c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(170 + x * 2.6, 622 + y * 1.7) : c.moveTo(170 + x * 2.6, 622 + y * 1.7)); c.closePath(); c.stroke();
    text('YOUR VECTOR OUTLINE', 186, 856, 20, mint);
    const e = engine('leaf'); film('leaf', e.duration * (.16 + .65 * u), 1050, 178, 390, 693);
    text('IMPORTED GEOMETRY → FOURIER STORY', 940, 909, 22, mint);
  } else if (scene.id === 'sound') {
    const names = ['Still Water', 'Paper Lanterns', 'Aurora Glass', 'Driftwood', 'Deep Current', 'Whale Song', 'Little Clockwork', 'Construction Site'];
    names.forEach((name, i) => { const x = 804 + (i % 2) * 482, y = 234 + Math.floor(i / 2) * 131; box(x, y, 458, 106, i === 5 ? '#356056' : '#15383b'); text(name, x + 25, y + 62, 30, i === 5 ? mint : ink, true); });
    for (let i = 0; i < 84; i++) { const h = 15 + 55 * Math.abs(Math.sin(i * .65 + t * 2) * Math.sin(i * .2 - t)); box(804 + i * 11, 845 - h / 2, 5, h, mint, 2); }
    text('ANIMATED AUDIO MOTIF · EIGHT SELECTABLE SCORES', 812, 919, 18, muted);
  } else if (scene.id === 'sphere') {
    drawStageViewport(viewport.getContext('2d'), world, { width: 1120, height: 630, heading: 360 * u, pitch: -4, phase: t / 20, fov: 82 });
    c.drawImage(viewport, 748, 229, 1080, 608);
    text(`360° VIEWPORT TOUR  /  ${Math.round(u * 360)}°`, 787, 881, 24, mint);
    text('Spherical export includes projection metadata.', 93, 720, 24, muted);
    text('Portrait export follows a guided camera.', 93, 760, 24, muted);
  } else if (scene.id === 'nature') {
    screenshot('nature-worlds', 755, 235, 1060, 620, u);
    text('PHOTOGRAPHIC ENVIRONMENTS / POLY HAVEN CC0', 779, 907, 19, mint);
  } else if (scene.id === 'cta') {
    film('fourier-whale-3d', 51 + local * .3, 1450, 207, 330, 587);
    box(788, 249, 589, 408);
    const commands = ['$ git clone <repository-url>', '$ cd MathLoop-Studio', '$ npm ci', '$ npm run dev'];
    commands.forEach((line, i) => { c.fillStyle = i === 3 ? orange : mint; c.font = '28px Code, monospace'; c.fillText(line, 821, 321 + i * 80); });
    text('github.com/ravipurohit1991/', 92, 718, 38, mint, true);
    text('MathLoop-Studio', 92, 776, 48, mint, true);
    text('REPOSITORY LINK IN THE DESCRIPTION', 92, 848, 21, orange);
    text('MP4 + sound  /  CLI batch render  /  360°', 795, 731, 23, muted);
  }
  if (subtitles) {
    const caption = scene.narration[local < scene.duration / 2 ? 0 : 1];
    box(72, 951, 1776, 100, '#041316', 16);
    const lines = wrapped(caption, 103, 989, 1690, 27, ink, 34);
    if (lines > 2) throw new Error('Caption exceeds its safe area.');
  }
  c.fillStyle = mint; c.fillRect(0, 1074, W * t / duration, 6);
  if (local < .28 || scene.duration - local < .25) { c.fillStyle = `rgba(4,19,22,${Math.max(0, 1 - local / .28, 1 - (scene.duration - local) / .25)})`; c.fillRect(0, 0, W, H); }
}
const timestamp = seconds => { const ms = Math.round(seconds * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
let srt = '', cue = 0;
for (const scene of spec.scenes) scene.narration.forEach((line, part) => { srt += `${++cue}\n${timestamp(scene.start + part * scene.duration / 2)} --> ${timestamp(scene.start + (part + 1) * scene.duration / 2 - .08)}\n${line}\n\n`; });
await writeFile(`${out}/mathloop-studio-trailer.en.srt`, srt);
const sheet = createCanvas(1440, 810), sc = sheet.getContext('2d');
for (const [i, scene] of spec.scenes.entries()) { render(scene, scene.duration * .6, i); await writeFile(`${out}/scene-${scene.id}.jpg`, await canvas.encode('jpeg', 88)); sc.drawImage(canvas, i % 3 * 480, Math.floor(i / 3) * 270, 480, 270); }
await writeFile(`${out}/storyboard.jpg`, await sheet.encode('jpeg', 92));
// A distinct, readable thumbnail rather than a captioned frame.
backdrop(0); text('MATHS INTO', 93, 310, 112, ink, true); text('MOVIES.', 93, 450, 132, mint, true);
text('FREE + OPEN SOURCE', 102, 563, 37, orange, true);
text('2D  /  3D  /  360°', 102, 630, 38, muted);
film('fourier-whale-3d', 53, 1050, 145, 422, 750); film('fourier-butterfly', 53, 1480, 229, 318, 565);
text('MathLoop Studio', 103, 859, 56, ink, true);
await writeFile(`${out}/youtube-thumbnail.jpg`, await canvas.encode('jpeg', 92));
await writeFile('docs/images/launch-banner.jpg', await canvas.encode('jpeg', 85));
if (preview) { for (const e of engines.values()) e.dispose(); console.log('Storyboard, thumbnail and captions ready.'); process.exit(0); }

function command(program, args) { return execFileSync(program, args, { windowsHide: true, maxBuffer: 20 * 1024 * 1024, encoding: 'utf8' }); }
const musicProject = setStoryDuration(createStoryProject(getStory('fourier-monkey'), { audio: { score: 'aurora-glass', level: .45 } }), duration);
await writeFile(`${out}/music.wav`, renderStoryScore(musicProject).bytes);
const clips = [];
for (const scene of spec.scenes) for (let part = 0; part < 2; part++) {
  const input = `${out}/narration/${scene.id}-${part}.wav`, target = scene.duration / 2;
  const length = Number(command('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input]));
  const speed = Math.max(1, length / (target - .35));
  if (speed > 1.35) throw new Error(`Narration too long for ${scene.id}; shorten the script.`);
  const output = `${out}/narration/padded-${scene.id}-${part}.wav`;
  command('ffmpeg', ['-v', 'error', '-y', '-i', input, '-af', `atempo=${speed},adelay=100,apad`, '-t', String(target), '-ar', '48000', '-ac', '2', output]);
  clips.push(`file 'narration/padded-${scene.id}-${part}.wav'`);
}
await writeFile(`${out}/narration-concat.txt`, clips.join('\n'));
command('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${out}/narration-concat.txt`, '-af', 'loudnorm=I=-17:TP=-2:LRA=7', '-ar', '48000', '-ac', '2', `${out}/voice.wav`]);
command('ffmpeg', ['-v', 'error', '-y', '-i', `${out}/voice.wav`, '-i', `${out}/music.wav`, '-filter_complex', `[1:a]volume=0.75,afade=t=in:d=1,afade=t=out:st=${duration-2}:d=2[m];[0:a][m]amix=inputs=2:normalize=0,alimiter=limit=0.89[a]`, '-map', '[a]', '-ar', '48000', `${out}/mix.wav`]);
const output = `${out}/mathloop-studio-trailer-1080p.mp4`;
if (audioOnly) {
  const temporary = `${out}/trailer-remix.mp4`;
  const existing = JSON.parse(command('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', output]));
  let videoInput = ['-i', output];
  if (Math.abs(Number(existing.format.duration) - duration) > .1) {
    if (!process.argv.includes('--retime')) throw new Error('Video timing differs. Render the full trailer, or use --retime with its saved video-timing.json.');
    const previous = JSON.parse(await readFile(`${out}/video-timing.json`, 'utf8'));
    if (Math.abs(previous.scenes.reduce((s, x) => s + x.duration, 0) - Number(existing.format.duration)) > .1) throw new Error('Saved timing does not describe the existing video.');
    await mkdir(`${out}/retimed`, { recursive: true });
    let start = 0; const segments = [];
    for (const [i, scene] of spec.scenes.entries()) {
      const old = previous.scenes[i];
      if (old?.id !== scene.id || JSON.stringify(old.narration) !== JSON.stringify(scene.narration)) throw new Error('Changed script or scene order requires a full render.');
      const name = `scene-${i}.mp4`;
      console.log(`Retiming scene ${i + 1}: ${old.duration}s → ${scene.duration}s`);
      command('ffmpeg', ['-v', 'error', '-y', '-ss', String(start), '-t', String(old.duration), '-i', output, '-an', '-vf', `setpts=${scene.duration / old.duration}*(PTS-STARTPTS),fps=${fps}`, '-t', String(scene.duration), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-map_metadata', '-1', `${out}/retimed/${name}`]);
      segments.push(`file 'retimed/${name}'`); start += old.duration;
    }
    await writeFile(`${out}/retimed-concat.txt`, segments.join('\n'));
    videoInput = ['-f', 'concat', '-safe', '0', '-i', `${out}/retimed-concat.txt`];
  }
  command('ffmpeg', ['-v', 'error', '-y', ...videoInput, '-i', `${out}/mix.wav`, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', String(duration), '-movflags', '+faststart', '-map_metadata', '-1', '-metadata', `title=${spec.title}`, temporary]);
  await rename(temporary, output);
  for (const e of engines.values()) e.dispose();
  console.log('Replaced narration and mix using the existing picture.');
} else {
const encoder = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', 'pipe:0', '-i', `${out}/mix.wav`, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', String(duration), '-movflags', '+faststart', '-map_metadata', '-1', '-metadata', `title=${spec.title}`, output], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
let log = ''; encoder.stderr.on('data', data => log += data); encoder.stdin.on('error', () => {});
const finished = new Promise((resolve, reject) => { encoder.on('error', reject); encoder.on('close', code => code === 0 ? resolve() : reject(new Error(log))); }); finished.catch(() => {});
try {
  for (const [index, scene] of spec.scenes.entries()) {
    console.log(`Rendering ${index + 1}/${spec.scenes.length}: ${scene.id}`);
    for (let f = 0; f < scene.duration * fps; f++) {
      render(scene, f / fps, index);
      if (encoder.exitCode !== null) throw new Error(log);
      if (!encoder.stdin.write(canvas.data())) await Promise.race([once(encoder.stdin, 'drain'), finished.then(() => { throw new Error('Encoder ended early.'); })]);
    }
  }
  encoder.stdin.end(); await finished;
} finally { for (const e of engines.values()) e.dispose(); if (encoder.exitCode === null) encoder.kill(); }
}
const probe = JSON.parse(command('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output]));
const voiceInfo = await readFile(`${out}/narration/voice.json`, 'utf8').then(JSON.parse).catch(() => ({ provider: 'Offline Windows speech synthesis' }));
// Store portable verification data; ffprobe's full output embeds an absolute filename on some platforms.
await writeFile(`${out}/verification.json`, JSON.stringify({ file: output.split('/').at(-1), duration: Number(probe.format.duration), streams: probe.streams.map(s => ({ type: s.codec_type, codec: s.codec_name, width: s.width, height: s.height, fps: s.r_frame_rate, sampleRate: s.sample_rate, channels: s.channels, frames: s.nb_frames })), narration: voiceInfo, sources: 'Current source renderers + captured local Studio UI' }, null, 2));
if (Math.abs(Number(probe.format.duration) - duration) > .1 || !probe.streams.some(s => s.width === W && s.height === H) || !probe.streams.some(s => s.codec_type === 'audio')) throw new Error('Trailer verification failed.');
console.log(`Verified ${output}`);
await writeFile(`${out}/video-timing.json`, JSON.stringify(spec, null, 2));
