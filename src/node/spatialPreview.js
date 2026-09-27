import { open, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { inspectSpatialAudio } from '../export/sphericalMp4.js';

/** Skip media payloads; even a large panorama only needs its movie metadata read. */
export async function spatialPreviewConfig(videoPath) {
  const file = await open(videoPath, 'r');
  let spatial = null;
  try {
    const { size: length } = await file.stat();
    const header = Buffer.alloc(16);
    for (let offset = 0; offset + 8 <= length;) {
      await file.read(header, 0, Math.min(16, length - offset), offset);
      let size = header.readUInt32BE(0);
      const type = header.toString('ascii', 4, 8);
      if (size === 1) size = Number(header.readBigUInt64BE(8));
      if (size === 0) size = length - offset;
      if (!Number.isSafeInteger(size) || size < 8 || offset + size > length) break;
      if (type === 'moov') {
        if (size > 64 * 1024 * 1024) throw new Error('Movie metadata is too large for this preview.');
        const movie = Buffer.alloc(size);
        const { bytesRead } = await file.read(movie, 0, size, offset);
        if (bytesRead !== size) throw new Error('Truncated movie metadata.');
        spatial = inspectSpatialAudio(movie);
        break;
      }
      offset += size;
    }
  } finally { await file.close(); }

  let manifest;
  try { manifest = JSON.parse(await readFile(join(dirname(videoPath), 'spatial-audio.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let focus = manifest?.video === basename(videoPath) ? manifest.preview?.focus : null;
  if (focus && manifest.videoSha256) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(videoPath)) hash.update(chunk);
    if (hash.digest('hex') !== manifest.videoSha256) focus = null;
  }
  const files = {};
  if (focus) {
    if (!Array.isArray(focus.stems) || !focus.stems.length || focus.stems.length > 4) throw new Error('Invalid focus stems.');
    for (const [i, stem] of focus.stems.entries()) {
      if (!/^[a-zA-Z0-9_-]+\.wav$/.test(stem.file) || !Number.isFinite(stem.heading) || !Number.isFinite(stem.elevation)) throw new Error('Invalid focus stem file or direction.');
      files[`/stem-${i}.wav`] = join(dirname(videoPath), stem.file);
    }
  }
  return {
    config: {
      spatial,
      focus: focus ? { duration: manifest.duration, stems: focus.stems.map((stem, i) => ({ ...stem, url: `/stem-${i}.wav` })) } : null,
    }, files,
  };
}
