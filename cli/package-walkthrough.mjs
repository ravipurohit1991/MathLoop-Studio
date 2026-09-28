// Create the upload copy, thumbnail and media checks after the walkthrough render.
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { resolve } from 'node:path';
const out = resolve('out/walkthrough'), ready = `${out}/ready-to-upload`;
const video = `${ready}/mathloop-studio-walkthrough-1080p.mp4`;
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video], { encoding: 'utf8' }));
const visual = probe.streams.filter(s => s.codec_type === 'video'), audio = probe.streams.filter(s => s.codec_type === 'audio');
const [rateNumerator, rateDenominator] = visual[0].avg_frame_rate.split('/').map(Number);
// MP4 timescale rounding at joins can make the reported average fraction differ slightly.
if (visual.length !== 1 || audio.length !== 1 || visual[0].width !== 1920 || visual[0].height !== 1080 || Math.abs(rateNumerator / rateDenominator - 30) > .01 || audio[0].channels !== 2) throw new Error('Unexpected delivery format');
execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-f', 'null', '-'], { stdio: 'pipe', windowsHide: true });
// Check the narration-only opening for the earlier stereo-delay regression.
const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-t', '20', '-vn', '-f', 'f32le', '-acodec', 'pcm_f32le', '-'], { maxBuffer: 16000000, windowsHide: true });
let difference = 0, peak = 0, leftEnergy = 0, rightEnergy = 0, cross = 0, residual = 0;
for (let i = 0; i + 7 < pcm.length; i += 8) {
  const left = pcm.readFloatLE(i), right = pcm.readFloatLE(i + 4);
  difference = Math.max(difference, Math.abs(left - right)); peak = Math.max(peak, Math.abs(left), Math.abs(right));
  leftEnergy += left * left; rightEnergy += right * right; cross += left * right; residual += (left - right) ** 2;
}
const correlation = cross / Math.sqrt(leftEnergy * rightEnergy);
const residualDb = 10 * Math.log10(residual / leftEnergy);
// AAC can introduce tiny channel differences after loudness matching. A delayed
// duplicate fails both these zero-lag checks by a wide margin.
if (correlation < .999 || residualDb > -40) throw new Error(`Narration is not centred: correlation ${correlation}, residual ${residualDb}dB`);
const project = JSON.parse(await readFile(`${out}/examples/my-first-film.story.json`, 'utf8'));
const chapterSum = project.chapters.reduce((n, c) => n + c.duration, 0);
if (project.title !== 'My first Fourier film' || Math.abs(chapterSum - 20) > .001 || project.export.width !== 540 || project.export.fps !== 24 || project.theme.accent !== '#e68938' || project.audio.level !== .35) throw new Error('Worked example did not preserve the demonstrated settings');
const report = { duration: Number(probe.format.duration), bytes: Number(probe.format.size), video: '1920x1080 H.264 30fps', audio: 'one stereo AAC stream at 48kHz', fullDecode: 'passed', narrationZeroLagCorrelation: correlation, narrationChannelResidualDb: residualDb, narrationLeftRightMaxDifference: difference, openingPeak: peak, exampleProject: 'saved settings verified', note: 'The result listening interval intentionally includes the actual stereo soundtrack. Small AAC channel differences are expected after encoding.' };
await writeFile(`${out}/verification.json`, JSON.stringify(report, null, 2));

const seconds = Math.round(Number(probe.format.duration));
const canvas = createCanvas(1280, 720), ctx = canvas.getContext('2d');
const shot = await loadImage(`${out}/captures/text.png`);
ctx.fillStyle = '#0c1e26'; ctx.fillRect(0, 0, 1280, 720);
ctx.globalAlpha = .35; ctx.drawImage(shot, 0, 0, 1280, 720); ctx.globalAlpha = 1;
const gradient = ctx.createLinearGradient(0, 0, 1000, 0); gradient.addColorStop(0, '#071923'); gradient.addColorStop(.7, '#071923f5'); gradient.addColorStop(1, '#07192300'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1280, 720);
ctx.fillStyle = '#90d5c5'; ctx.font = 'bold 26px Arial'; ctx.fillText('MATHLOOP STUDIO', 60, 83);
ctx.fillStyle = '#eff5ed'; ctx.font = 'bold 78px Arial'; ctx.fillText('MAKE YOUR', 60, 227); ctx.fillText('FIRST', 60, 322);
ctx.fillStyle = '#f0ba83'; ctx.font = 'bold 108px Arial'; ctx.fillText('MATH FILM', 55, 449);
ctx.fillStyle = '#e4ece7'; ctx.font = '29px Arial'; ctx.fillText('A complete, step-by-step app walkthrough', 60, 518);
ctx.fillStyle = '#9dd5ca'; ctx.font = '25px Arial'; ctx.fillText('STORY  /  SVG  /  3D  /  360°', 60, 575);
ctx.fillStyle = '#eeb483'; ctx.fillRect(60, 623, 414, 48); ctx.fillStyle = '#10222a'; ctx.font = 'bold 22px Arial'; ctx.fillText(`FULL WALKTHROUGH  ·  ${Math.round(seconds / 60)} MIN`, 78, 655);
// Crop the real preview out of the editor; no invented application UI.
ctx.shadowColor = '#0009'; ctx.shadowBlur = 25; ctx.drawImage(shot, 615, 51, 340, 604, 870, 54, 340, 604); ctx.shadowBlur = 0;
await writeFile(`${ready}/walkthrough-thumbnail.jpg`, canvas.toBuffer('image/jpeg', 92));
await copyFile(`${ready}/walkthrough-thumbnail.jpg`, 'docs/images/walkthrough-thumbnail.jpg');
await writeFile(`${out}/examples/README.txt`, `MathLoop Studio walkthrough examples\n\nSetup and written guide:\nhttps://github.com/ravipurohit1991/MathLoop-Studio/blob/main/docs/walkthrough.md\n\nmy-first-film.story.json: Open project in Story Studio.\nmy-first-film.mp4: The actual 20-second browser export.\nwalkthrough-leaf.svg: Import with Turn an SVG into a story.\nmy-aquarium.stage.json: Open stage in 360 Studio.\n\nThe walkthrough uses a 540x960 review export at 24fps. Choose 1080x1920 for a larger portrait video.\n`);
execFileSync(process.env.PYTHON ?? 'python', ['-m', 'zipfile', '-c', `${ready}/walkthrough-examples.zip`, ...['README.txt', 'my-first-film.story.json', 'my-first-film.mp4', 'walkthrough-leaf.svg', 'my-aquarium.stage.json'].map(name => `${out}/examples/${name}`)], { windowsHide: true });

const chapters = await readFile(`${out}/chapters.txt`, 'utf8');
const upload = `# YouTube walkthrough upload copy

## Title

MathLoop Studio Tutorial: Make Math Films, Import SVGs & Build 360° Worlds

## Description

Learn MathLoop Studio by making a real film from start to finish. In this complete walkthrough, we choose a Fourier monkey, edit its chapters and timing, add music, save and reopen the project, and export an actual MP4. Then we explore SVG import, 3D camera controls, animation tracks, 360° scenes and photographic Nature Worlds.

CODE + SETUP:
https://github.com/ravipurohit1991/MathLoop-Studio

FOLLOW ALONG — project, leaf SVG, exported example and this walkthrough:
https://github.com/ravipurohit1991/MathLoop-Studio/releases/tag/v0.1.2

WRITTEN WALKTHROUGH:
https://github.com/ravipurohit1991/MathLoop-Studio/blob/main/docs/walkthrough.md

360° AQUARIUM + PORTRAIT SAMPLE VIDEOS:
https://github.com/ravipurohit1991/MathLoop-Studio/releases/tag/v0.1.1

CHAPTERS:
${chapters}
GET STARTED:
Install Node.js 22+ and Git. Clone the repository, run npm ci, then npm run dev. Open http://127.0.0.1:5180 in a recent Chrome or Edge. Native exports also need FFmpeg and ffprobe. See the README for browser export and spatial-audio compatibility.

MathLoop Studio is free and open source under the MIT license. It includes 15 authored films, SVG outline import, eight procedural scores, three 360° stages and three Nature Worlds. A project JSON keeps the editable recipe; an MP4 is the rendered film. This walkthrough is a standard landscape video; the interactive spherical samples are separate files.

The export waiting interval is shortened. Narration uses Microsoft's Andrew Multilingual neural synthetic voice. The example film uses the app's Still Water score. Nature photography: Poly Haven, CC0; source credits are in the repository.

Try one film, change one chapter, and share what you make. Which workflow should the next tutorial explain in more depth?

#CreativeCoding #Fourier #GenerativeArt

## Pinned comment

Follow along here: https://github.com/ravipurohit1991/MathLoop-Studio/releases/tag/v0.1.2

The download includes the exact project, leaf SVG and exported example used in this tutorial. Start by changing one chapter, then save the JSON before exporting your MP4. What did you make — and which step would you like a deeper tutorial on?

## Tags

MathLoop Studio, MathLoop tutorial, Fourier animation, math visualization, creative coding, generative art, SVG animation, JavaScript animation, open source video editor, procedural audio, 360 video tutorial, mathematical art

## Upload files

- Video: mathloop-studio-walkthrough-1080p.mp4
- Thumbnail: walkthrough-thumbnail.jpg
- English captions: mathloop-studio-walkthrough.srt
- Transcript: walkthrough-transcript.md

The video is a regular 16:9 upload. Upload the SRT as English captions. Copy the description and chapter timestamps above. The spherical sample is a separate video.
`;
await writeFile('marketing/youtube-walkthrough.md', upload);
await copyFile('marketing/youtube-walkthrough.md', `${ready}/youtube-walkthrough.md`);
console.log(JSON.stringify(report, null, 2));
