import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spatialPreviewConfig } from './spatialPreview.js';

/** Describe the stage inside the served page, so the player names what it shows. */
function stagePage(html, stage) {
  if (!stage) return null;
  for (const key of ['title', 'eyebrow', 'lead']) if (typeof stage[key] !== 'string' || !stage[key]) throw new Error('A previewed stage needs a title, an eyebrow and a lead.');
  if (!Array.isArray(stage.exhibits) || stage.exhibits.some(e => !Array.isArray(e) || !Number.isFinite(e[0]) || typeof e[1] !== 'string')) throw new Error('Stage exhibits must be [heading, name] pairs.');
  // The payload is inert data, but it still has to be unable to close its own tag.
  const payload = JSON.stringify(stage).replaceAll('<', '\\u003c');
  return html
    .replace(/(<script id="stage" type="application\/json">)[\s\S]*?(<\/script>)/, `$1${payload}$2`)
    .replace(/<title>[^<]*<\/title>/, `<title>${stage.title.replace(/[.\s]+$/, '')} · 360° cinema</title>`);
}

/** Serve only this viewer and the explicitly selected film, on loopback. */
export async function start360Preview({ video, port = 5190, stage } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be an integer between 0 and 65535.');
  const videoPath = resolve(video ?? 'out/360-aquarium/fourier-aquarium-360-20s.mp4');
  if (!(await stat(videoPath)).isFile()) throw new Error('Select an exported MP4 file.');
  const indexPath = fileURLToPath(new URL('./viewer360/index.html', import.meta.url));
  const { config: audioConfig, files: audioFiles } = await spatialPreviewConfig(videoPath);
  const html = await readFile(indexPath, 'utf8');
  const page = (stagePage(html, stage) ?? html).replace('<!--audio-config-->', `<script id="audio-config" type="application/json">${JSON.stringify(audioConfig).replaceAll('<', '\\u003c')}</script>`);
  const assets = { '/': ['index.html','text/html; charset=utf-8'], '/viewer.js': ['viewer.js','text/javascript; charset=utf-8'], '/viewer.css': ['viewer.css','text/css; charset=utf-8'], '/audio.js': ['audio.js','text/javascript; charset=utf-8'], '/ambisonic.js': ['../../audio/ambisonic.js','text/javascript; charset=utf-8'] };
  const server = createServer(async (request, response) => {
    try {
      if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      const path = new URL(request.url, 'http://localhost').pathname;
      const asset = assets[path];
      if (!asset && path !== '/video.mp4' && !audioFiles[path]) { response.writeHead(404); response.end('Not found'); return; }
      if (page && path === '/') {
        const body = Buffer.from(page);
        response.writeHead(200, { 'Content-Type': asset[1], 'Content-Length': body.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
        response.end(request.method === 'HEAD' ? undefined : body); return;
      }
      const file = asset ? fileURLToPath(new URL(`./viewer360/${asset[0]}`, import.meta.url)) : audioFiles[path] ?? videoPath;
      const { size } = await stat(file); let start = 0, end = size - 1, code = 200;
      const headers = { 'Content-Type': asset?.[1] ?? (audioFiles[path] ? 'audio/wav' : 'video/mp4'), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
      if (request.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (range && (range[1] || range[2])) {
          if (!range[1]) start = Math.max(0, size - Number(range[2]));
          else { start = Number(range[1]); if (range[2]) end = Math.min(end, Number(range[2])); }
        } else start = size;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) { response.writeHead(416, { 'Content-Range': `bytes */${size}` }); response.end(); return; }
        code = 206; headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      }
      headers['Content-Length'] = end - start + 1; response.writeHead(code, headers);
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = createReadStream(file, { start, end });
      stream.on('error', () => response.destroy()); response.on('close', () => stream.destroy()); stream.pipe(response);
    } catch { if (!response.headersSent) response.writeHead(500); response.end('Could not read the film.'); }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', ok); });
  return { server, url: `http://127.0.0.1:${server.address().port}`, videoPath };
}
