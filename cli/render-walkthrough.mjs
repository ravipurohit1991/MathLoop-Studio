// Compose captured interactions and dry, centred narration into a 1080p tutorial.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createCanvas } from '@napi-rs/canvas';

const out = resolve('out/walkthrough');
await mkdir(`${out}/edit`, { recursive: true });
await mkdir(`${out}/ready-to-upload`, { recursive: true });
const spec = JSON.parse(await readFile('marketing/walkthrough.json', 'utf8'));
const timings = JSON.parse(await readFile(`${out}/timing.json`, 'utf8'));
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
const run = args => new Promise((ok, fail) => {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let error = ''; p.stderr.on('data', d => error = (error + d).slice(-6000)); p.on('error', fail); p.on('close', c => c === 0 ? ok() : fail(new Error(error)));
});
const clock = s => { const n = Math.floor(s); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const srtClock = s => { const ms = Math.round(s * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const chapters = [], subtitles = [], transcript = [], sequence = [];
let elapsed = 0;
for (const [index, scene] of spec.scenes.entries()) {
  // Quantise once; all downstream timings use exactly the encoded frame count.
  const duration = Math.ceil(timings[scene.id].duration * 30) / 30;
  if (scene.chapter) chapters.push(`${clock(elapsed)} ${scene.chapter}`);
  sequence.push({ id: scene.id, start: elapsed, duration });
  transcript.push(`## ${clock(elapsed)} — ${scene.heading}\n\n${scene.cues.map(c => c.text).join('\n\n')}`);
  let local = 0;
  for (const [i, cue] of scene.cues.entries()) {
    const words = cue.text.split(/\s+/); let word = 0;
    while (word < words.length) {
      let end = Math.min(words.length, word + 12);
      while (end > word + 4 && words.slice(word, end).join(' ').length > 90) end--;
      const start = elapsed + local + timings[scene.id].cues[i].speech * word / words.length;
      const stop = elapsed + local + timings[scene.id].cues[i].speech * end / words.length;
      subtitles.push(`${subtitles.length + 1}\n${srtClock(start)} --> ${srtClock(stop)}\n${words.slice(word, end).join(' ')}\n`); word = end;
    }
    local += timings[scene.id].cues[i].duration;
  }
  elapsed += duration;
  if (only && !only.includes(scene.id)) continue;
  console.log(`Rendering ${scene.id}: ${duration.toFixed(2)}s`);
  const meta = JSON.parse(await readFile(`${out}/captures/${scene.id}.json`, 'utf8'));
  const canvas = createCanvas(1920, 1080), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#09171d'; ctx.fillRect(0, 0, 1920, 1080);
  ctx.fillStyle = '#e8b98f'; ctx.font = 'bold 25px Arial'; ctx.fillText('MATHLOOP STUDIO', 96, 36);
  ctx.fillStyle = '#eef2e9'; ctx.font = '25px Arial'; ctx.fillText(scene.heading, 420, 36);
  ctx.fillStyle = '#a3c8c4'; ctx.font = '22px Arial'; ctx.fillText(scene.note, 96, 1061);
  ctx.fillStyle = '#e8b98f'; ctx.font = '22px Arial'; ctx.textAlign = 'right'; ctx.fillText(`${String(index + 1).padStart(2, '0')} / ${spec.scenes.length}`, 1824, 36);
  await writeFile(`${out}/edit/${scene.id}.png`, canvas.toBuffer('image/png'));

  const inputs = [], filters = [];
  for (const [i, cue] of timings[scene.id].cues.entries()) {
    inputs.push('-i', `${out}/${cue.file}`);
    filters.push(`[${i}:a]aresample=48000,aformat=channel_layouts=mono,apad,atrim=duration=${cue.duration},asetpts=PTS-STARTPTS[a${i}]`);
  }
  filters.push(`${timings[scene.id].cues.map((_, i) => `[a${i}]`).join('')}concat=n=${scene.cues.length}:v=0:a=1,apad,atrim=duration=${duration}[voice]`);
  await run([...inputs, '-filter_complex', filters.join(';'), '-map', '[voice]', '-c:a', 'pcm_s16le', `${out}/edit/${scene.id}-voice.wav`]);
  let audio = `${out}/edit/${scene.id}-voice.wav`;
  if (scene.listen) {
    await run(['-i', audio, '-stream_loop', '-1', '-i', `${out}/examples/${scene.result}`, '-filter_complex', `[1:a]atrim=start=${local}:duration=${scene.listen},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st=${scene.listen - .5}:d=0.5,adelay=${Math.round(local * 1000)}:all=1[m];[0:a][m]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]`, '-map', '[a]', '-t', String(duration), `${out}/edit/${scene.id}-mix.wav`]);
    audio = `${out}/edit/${scene.id}-mix.wav`;
  }
  let video = `${out}/captures/${scene.id}.webm`, lead = meta.lead;
  if (scene.id === 'export') {
    // Keep the click and completed state, explicitly labelled as a shortened wait.
    const tail = Math.min(duration - 4, meta.duration - 4);
    await run(['-i', video, '-filter_complex', `[0:v]trim=start=${lead}:duration=2,setpts=PTS-STARTPTS[a];[0:v]trim=start=${lead + meta.duration - tail}:duration=${tail},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]`, '-map', '[v]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', `${out}/edit/export-wait.mp4`]);
    video = `${out}/edit/export-wait.mp4`; lead = 0;
  }
  await run(['-ss', String(lead), '-i', video, '-loop', '1', '-framerate', '30', '-i', `${out}/edit/${scene.id}.png`, '-i', audio,
    '-filter_complex', `[0:v]scale=1728:972:flags=lanczos,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=${duration}[screen];[1:v][screen]overlay=96:54:shortest=1[v]`,
    '-map', '[v]', '-map', '2:a:0', '-t', String(duration), '-r', '30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-ar', '48000', '-movflags', '+faststart', `${out}/edit/${scene.id}.mp4`]);
}
if (!only) {
  await writeFile(`${out}/edit/concat.txt`, spec.scenes.map(s => `file '${s.id}.mp4'`).join('\n'));
  const dest = `${out}/ready-to-upload/mathloop-studio-walkthrough-1080p.mp4`;
  const joined = `${out}/edit/joined.mp4`;
  await run(['-f', 'concat', '-safe', '0', '-i', `${out}/edit/concat.txt`, '-c', 'copy', joined]);
  // Two-pass loudness matching changes level only; no reverb, widening or delay.
  const analysis = await new Promise((ok, fail) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-i', joined, '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let log = ''; p.stderr.on('data', d => log = (log + d).slice(-12000)); p.on('error', fail);
    p.on('close', code => code === 0 ? ok(JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1))) : fail(new Error(log)));
  });
  await writeFile(`${out}/loudness.json`, JSON.stringify(analysis, null, 2));
  const norm = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${analysis.input_i}:measured_TP=${analysis.input_tp}:measured_LRA=${analysis.input_lra}:measured_thresh=${analysis.input_thresh}:offset=${analysis.target_offset}:linear=true`;
  await run(['-i', joined, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy', '-af', norm, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', dest]);
  await writeFile(`${out}/ready-to-upload/mathloop-studio-walkthrough.srt`, subtitles.join('\n'));
  await writeFile('marketing/walkthrough-transcript.md', `# MathLoop Studio walkthrough\n\nNarration: Microsoft Edge neural synthetic voice.\n\n${transcript.join('\n\n')}\n`);
  await writeFile(`${out}/chapters.txt`, chapters.join('\n') + '\n');
  await writeFile(`${out}/sequence.json`, JSON.stringify(sequence, null, 2));
  await copyFile('marketing/walkthrough-transcript.md', `${out}/ready-to-upload/walkthrough-transcript.md`);
  console.log(`Finished ${clock(elapsed)}: ${dest}`);
  console.log(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,channels:format=duration,size', '-of', 'json', dest], { encoding: 'utf8' }));
}
