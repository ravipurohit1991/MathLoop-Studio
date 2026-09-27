// Offline video export.
//
// The render clock is the frame index, never wall time, so a slow machine
// produces the same file as a fast one -- just later. Frames come out of the
// engine as top-down RGBA and go straight into WebCodecs; nothing round-trips
// through a second 2D canvas, so there is no colour-space or premultiply
// surprise in the middle.

import {
  Output,
  Mp4OutputFormat,
  MovOutputFormat,
  WebMOutputFormat,
  BufferTarget,
  VideoSampleSource,
  VideoSample,
  canEncodeVideo,
} from 'mediabunny';
import { createAudioWriter } from './audio.js';

export const CONTAINERS = {
  mp4: { name: 'MP4', ext: 'mp4', mime: 'video/mp4', make: () => new Mp4OutputFormat() },
  mov: { name: 'MOV', ext: 'mov', mime: 'video/quicktime', make: () => new MovOutputFormat() },
  webm: { name: 'WebM', ext: 'webm', mime: 'video/webm', make: () => new WebMOutputFormat() },
};

// Bits per pixel per frame. Ambient gradients are cheap to encode but punish
// low bitrates with banding, so these sit above the usual streaming defaults.
const BPP = { draft: 0.04, good: 0.08, high: 0.14, archive: 0.24 };

export function estimateBitrate({ width, height, fps, quality = 'high' }) {
  const bpp = BPP[quality] ?? BPP.high;
  return Math.round(width * height * fps * bpp);
}

// Some browser/GPU H.264 encoders emit malformed SPS cropping data for tall 4K
// frames. Windows Media Foundation rejects those files even though tolerant
// decoders can recover all their frames. We explicitly select High Profile at
// the lowest standards-compliant level and prefer the browser's software
// encoder, whose bitstream is portable. Accounting for macroblocks/second also
// avoids incorrectly tagging 4K60 as Level 5.1 (it requires 5.2).
const AVC_HIGH_LEVELS = [
  { level: 0x0a, maxFrameMbs: 99, maxMbsPerSecond: 1485, maxBitrate: 64_000 },
  { level: 0x0b, maxFrameMbs: 396, maxMbsPerSecond: 3000, maxBitrate: 192_000 },
  { level: 0x0c, maxFrameMbs: 396, maxMbsPerSecond: 6000, maxBitrate: 384_000 },
  { level: 0x0d, maxFrameMbs: 396, maxMbsPerSecond: 11880, maxBitrate: 768_000 },
  { level: 0x14, maxFrameMbs: 396, maxMbsPerSecond: 11880, maxBitrate: 2_000_000 },
  { level: 0x15, maxFrameMbs: 792, maxMbsPerSecond: 19800, maxBitrate: 4_000_000 },
  { level: 0x16, maxFrameMbs: 1620, maxMbsPerSecond: 20250, maxBitrate: 4_000_000 },
  { level: 0x1e, maxFrameMbs: 1620, maxMbsPerSecond: 40500, maxBitrate: 10_000_000 },
  { level: 0x1f, maxFrameMbs: 3600, maxMbsPerSecond: 108000, maxBitrate: 14_000_000 },
  { level: 0x20, maxFrameMbs: 5120, maxMbsPerSecond: 216000, maxBitrate: 20_000_000 },
  { level: 0x28, maxFrameMbs: 8192, maxMbsPerSecond: 245760, maxBitrate: 20_000_000 },
  { level: 0x29, maxFrameMbs: 8192, maxMbsPerSecond: 245760, maxBitrate: 50_000_000 },
  { level: 0x2a, maxFrameMbs: 8704, maxMbsPerSecond: 522240, maxBitrate: 50_000_000 },
  { level: 0x32, maxFrameMbs: 22080, maxMbsPerSecond: 589824, maxBitrate: 135_000_000 },
  { level: 0x33, maxFrameMbs: 36864, maxMbsPerSecond: 983040, maxBitrate: 240_000_000 },
  { level: 0x34, maxFrameMbs: 36864, maxMbsPerSecond: 2073600, maxBitrate: 240_000_000 },
  { level: 0x3c, maxFrameMbs: 139264, maxMbsPerSecond: 4177920, maxBitrate: 240_000_000 },
];

export function compatibleAvcCodecString({ width, height, fps = 30, bitrate }) {
  const frameMbs = Math.ceil(width / 16) * Math.ceil(height / 16);
  const mbsPerSecond = frameMbs * fps;
  const match = AVC_HIGH_LEVELS.find((entry) => (
    frameMbs <= entry.maxFrameMbs
    && mbsPerSecond <= entry.maxMbsPerSecond
    && bitrate <= entry.maxBitrate
  ));
  if (!match) {
    throw new Error(
      `H.264 compatibility mode cannot represent ${width}x${height} at ${fps} fps and ` +
      `${(bitrate / 1e6).toFixed(1)} Mbps. Lower the resolution, frame rate, or bitrate.`
    );
  }
  return `avc1.6400${match.level.toString(16).padStart(2, '0')}`;
}

const AVC_PARAMETER_SET_TYPES = new Set([7, 8, 13]);
const AVC_HIGH_PROFILES = new Set([100, 110, 122, 144]);

const asBytes = (value) => {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error('H.264 encoder returned an unreadable decoder configuration.');
};

/**
 * Repair the AVCDecoderConfigurationRecord returned by some Chromium hardware
 * encoders for tall 4K video. Those records have three repeatable defects:
 * reserved bits cleared in bytes 4/5, duplicated SPS/PPS NAL header bytes, and
 * omitted High-Profile extension fields. Tolerant decoders recover; Windows
 * Media Foundation rejects the whole file with 0xC00D5212.
 */
export function normalizeAvcDecoderConfigDescription(description) {
  const input = asBytes(description);
  if (input.length < 8 || input[0] !== 1) {
    throw new Error('H.264 encoder returned an invalid AVC decoder configuration.');
  }

  let offset = 6;
  const readNalUnits = (count, label) => {
    const units = [];
    for (let i = 0; i < count; i++) {
      if (offset + 2 > input.length) throw new Error(`Truncated H.264 ${label} length.`);
      const length = (input[offset] << 8) | input[offset + 1];
      offset += 2;
      if (!length || offset + length > input.length) throw new Error(`Truncated H.264 ${label} data.`);
      let unit = input.slice(offset, offset + length);
      offset += length;

      const nalType = unit[0] & 0x1f;
      if (
        unit.length > 1
        && unit[0] === unit[1]
        && AVC_PARAMETER_SET_TYPES.has(nalType)
      ) {
        unit = unit.slice(1);
      }
      units.push(unit);
    }
    return units;
  };

  // The low bits still contain the real count in malformed records; only the
  // required all-ones reserved prefix is missing.
  const spsCount = input[5] & 0x1f;
  if (!spsCount) throw new Error('H.264 decoder configuration contains no SPS.');
  const sequenceParameterSets = readNalUnits(spsCount, 'SPS');

  if (offset >= input.length) throw new Error('H.264 decoder configuration contains no PPS count.');
  const ppsCount = input[offset++];
  if (!ppsCount) throw new Error('H.264 decoder configuration contains no PPS.');
  const pictureParameterSets = readNalUnits(ppsCount, 'PPS');

  let extension = input.slice(offset);
  if (AVC_HIGH_PROFILES.has(input[1]) && extension.length === 0) {
    // chroma_format=1 (4:2:0), 8-bit luma/chroma, no extended SPS.
    extension = new Uint8Array([0xfd, 0xf8, 0xf8, 0x00]);
  }

  const size = 6
    + sequenceParameterSets.reduce((sum, unit) => sum + 2 + unit.length, 0)
    + 1
    + pictureParameterSets.reduce((sum, unit) => sum + 2 + unit.length, 0)
    + extension.length;
  const output = new Uint8Array(size);
  output.set(input.slice(0, 6), 0);
  output[4] = 0xfc | (input[4] & 0x03);
  output[5] = 0xe0 | sequenceParameterSets.length;

  offset = 6;
  const writeNalUnits = (units) => {
    for (const unit of units) {
      output[offset++] = unit.length >> 8;
      output[offset++] = unit.length & 0xff;
      output.set(unit, offset);
      offset += unit.length;
    }
  };
  writeNalUnits(sequenceParameterSets);
  output[offset++] = pictureParameterSets.length;
  writeNalUnits(pictureParameterSets);
  output.set(extension, offset);
  return output;
}

function normalizeAvcMetadata(meta) {
  const decoderConfig = meta?.decoderConfig;
  if (!decoderConfig?.description) return;
  decoderConfig.description = normalizeAvcDecoderConfigDescription(decoderConfig.description);
}

class AbortedError extends Error {
  constructor() { super('Render cancelled.'); this.name = 'AbortedError'; }
}

/** Render a story's frames and encode them into one file. */
export async function renderVideo({
  engine,
  width = 1920,
  height = 1080,
  fps = 30,
  duration = 12,
  samples = 12,
  shutter = 0.5,
  codec = 'avc',
  quality = 'high',
  bitrate,
  keyFrameInterval = 2,
  container = 'mp4',
  audio,
  onProgress,
  signal,
} = {}) {
  if (!engine) throw new Error('renderVideo needs an engine.');
  if (width % 2 || height % 2) {
    throw new Error(`Encoders need even dimensions; got ${width}x${height}.`);
  }

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameSpan = 1 / totalFrames;         // one frame, in story-phase units
  const loopSeconds = totalFrames / fps;

  const containerSpec = CONTAINERS[container];
  if (!containerSpec) throw new Error(`Unknown container "${container}".`);

  const targetBitrate = bitrate ?? estimateBitrate({ width, height, fps, quality });

  const codecOptions = codec === 'avc'
    ? {
        fullCodecString: compatibleAvcCodecString({ width, height, fps, bitrate: targetBitrate }),
        hardwareAcceleration: 'prefer-software',
      }
    : {};

  const supported = await canEncodeVideo(codec, {
    width, height, bitrate: targetBitrate, ...codecOptions,
  });
  if (!supported) {
    throw new Error(
      `This browser cannot encode ${codec} at ${width}x${height}. ` +
      `Try H.264 at a lower resolution, or a Chromium-based browser.`
    );
  }

  engine.resizeCanvas(width, height);

  const started = performance.now();
  const check = () => { if (signal?.aborted) throw new AbortedError(); };

  const report = (frame, stage) => {
    if (!onProgress) return;
    const elapsed = performance.now() - started;
    const done = frame / totalFrames;
    onProgress({
      stage,
      frame,
      totalFrames,
      fraction: done,
      elapsedMs: elapsed,
      etaMs: done > 0 ? (elapsed / done) * (1 - done) : null,
      framesPerSecond: frame > 0 ? frame / (elapsed / 1000) : 0,
    });
  };

  let resolvedCodecString = codec;
  const encodingConfig = {
    codec,
    bitrate: targetBitrate,
    keyFrameInterval,
    sizeChangeBehavior: 'deny',
    ...codecOptions,
    onEncoderConfig: (config) => { resolvedCodecString = config.codec; },
    onEncodedPacket: (_packet, meta) => {
      if (codec === 'avc') normalizeAvcMetadata(meta);
    },
  };

  // One frame is one render. The maths panel that used to be composed beside
  // it belonged to the loop studio; a story draws its own titles.
  const renderFrame = (i) => engine.renderFrameToPixels({
    phase: i / totalFrames, samples, shutter, frameSpan, width, height, frameIndex: i,
  });

  const output = new Output({ format: containerSpec.make(), target: new BufferTarget() });
  const source = new VideoSampleSource(encodingConfig);
  output.addVideoTrack(source, { frameRate: fps });
  let work = [], stopped = false;
  try {
    const audioWriter = await createAudioWriter({
      output, audio, container, totalDuration: loopSeconds, signal, onProgress,
    });
    await output.start();

    const writeVideo = async () => {
      for (let i = 0; i < totalFrames; i++) {
        check();
        if (stopped) throw new AbortedError();
        const pixels = renderFrame(i);
        const sample = new VideoSample(pixels, {
          format: 'RGBX',
          codedWidth: width,
          codedHeight: height,
          timestamp: i / fps,
          duration: 1 / fps,
        });
        try { await source.add(sample); } finally { sample.close(); }
        report(i + 1, 'render');
      }
    };

    work = [writeVideo(), audioWriter?.write()];
    await Promise.all(work);

    await output.finalize();
    return finish(output, containerSpec, {
      totalFrames, loopSeconds, codec, resolvedCodecString, targetBitrate, started,
      audioCodec: audioWriter?.codec,
    });
  } catch (error) {
    stopped = true;
    await output.cancel().catch(() => {});
    await Promise.allSettled(work);
    throw error;
  }
}

function finish(output, containerSpec, meta) {
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('The muxer produced no output.');
  const blob = new Blob([buffer], { type: containerSpec.mime });
  return {
    blob,
    bytes: buffer.byteLength,
    extension: containerSpec.ext,
    frames: meta.totalFrames,
    seconds: meta.loopSeconds,
    codec: meta.codec,
    codecString: meta.resolvedCodecString,
    bitrate: meta.targetBitrate,
    audioCodec: meta.audioCodec ?? null,
    elapsedMs: performance.now() - meta.started,
  };
}

/** Trigger a browser download for a finished render. */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Same as download(), for text we generate rather than encode -- project files. */
export function downloadText(text, filename, type = 'application/json') {
  download(new Blob([text], { type }), filename);
}
