import { AudioBufferSource, canEncodeAudio } from 'mediabunny';

export const AUDIO_BITRATE = 192_000;
const CHUNK_SECONDS = 8;
const channelCount = audio => audio.ambisonic ? 4 : Math.max(1, Math.min(2, audio.buffer.numberOfChannels));

export function audioCodecForContainer(container) {
  return container === 'webm' ? 'opus' : 'aac';
}

/** Decode a user-selected MP3/WAV/M4A/OGG file with the browser's codecs. */
export async function decodeAudioFile(file) {
  if (!file) throw new Error('Choose an audio file first.');
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Context) throw new Error('This browser cannot decode local audio files.');
  const context = new Context();
  try {
    const bytes = await file.arrayBuffer();
    return await context.decodeAudioData(bytes.slice(0));
  } catch (error) {
    throw new Error(`Could not decode "${file.name}". Try MP3, WAV, M4A, or OGG. ${error.message ?? ''}`.trim());
  } finally {
    await context.close().catch(() => {});
  }
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));

/**
 * Build one small output chunk. Long videos call this repeatedly, keeping
 * memory bounded even when a short ambience is looped for an hour.
 */
export function buildAudioChunk(audio, startFrame, frameCount, renderFrames) {
  const input = audio.buffer;
  const sampleRate = input.sampleRate;
  const channels = channelCount(audio);
  const chunk = new AudioBuffer({ length: frameCount, numberOfChannels: channels, sampleRate });
  const sourceLength = input.length;
  const volume = clamp01(audio.volume ?? 0.75);
  const fadeInFrames = Math.round(Math.max(0, audio.fadeIn ?? 0) * sampleRate);
  const fadeOutFrames = Math.round(Math.max(0, audio.fadeOut ?? 0) * sampleRate);

  // A small overlap makes ordinary non-loop-authored music wrap without a
  // click. The effective period shortens by this overlap.
  //
  // Sonified audio is exempt. It was generated to be exactly as long as the
  // visual loop and to close on itself, so crossfading it would do damage
  // twice: once by blurring a join that is already clean, and once by
  // shortening its period, which would slide the sound out of step with the
  // picture a little further on every repeat.
  const crossfadeFrames = audio.loop && !audio.seamless
    ? Math.min(Math.round(sampleRate * 0.12), Math.floor(sourceLength / 4))
    : 0;
  const period = Math.max(1, sourceLength - crossfadeFrames);

  for (let channel = 0; channel < channels; channel++) {
    const src = input.getChannelData(Math.min(channel, input.numberOfChannels - 1));
    const dst = chunk.getChannelData(channel);
    for (let j = 0; j < frameCount; j++) {
      const absolute = startFrame + j;
      let value = 0;

      if (audio.loop) {
        const cycle = Math.floor(absolute / period);
        const position = absolute % period;
        if (cycle > 0 && crossfadeFrames > 0 && position < crossfadeFrames) {
          const mix = position / crossfadeFrames;
          const tail = src[period + position] ?? 0;
          const head = src[position] ?? 0;
          // Equal-power crossfade preserves perceived loudness through a wrap.
          value = tail * Math.cos(mix * Math.PI * 0.5) + head * Math.sin(mix * Math.PI * 0.5);
        } else {
          value = src[position] ?? 0;
        }
      } else if (absolute < sourceLength) {
        value = src[absolute];
      }

      let envelope = volume;
      if (fadeInFrames > 0) envelope *= clamp01(absolute / fadeInFrames);
      if (fadeOutFrames > 0) envelope *= clamp01((renderFrames - 1 - absolute) / fadeOutFrames);
      dst[j] = value * envelope;
    }
  }
  return chunk;
}

/**
 * Register an encoded audio track before Output.start(), then return a writer
 * that can run concurrently with video rendering.
 */
export async function createAudioWriter({ output, audio, container, totalDuration, signal, onProgress }) {
  if (!audio?.buffer || totalDuration <= 0) return null;

  const codec = audioCodecForContainer(container);
  const input = audio.buffer;
  const channels = channelCount(audio);
  if (audio.ambisonic && (input.numberOfChannels !== 4 || input.sampleRate !== 48000 || container !== 'mp4')) {
    throw new Error('Spatial audio export needs four ACN/SN3D channels at 48 kHz in MP4.');
  }
  const bitrate = audio.ambisonic ? 384_000 : AUDIO_BITRATE;
  const supported = await canEncodeAudio(codec, {
    numberOfChannels: channels,
    sampleRate: input.sampleRate,
    bitrate,
  });
  if (!supported) {
    if (audio.ambisonic) throw new Error('This browser cannot encode four-channel AAC spatial audio. Use the native FFmpeg rendering workflow (npm run nature:render for Nature Worlds).');
    throw new Error(`This browser cannot encode ${codec.toUpperCase()} audio. Try a Chromium-based browser or a different container.`);
  }

  const source = new AudioBufferSource({ codec, bitrate });
  output.addAudioTrack(source);

  const requestedFrames = Math.max(1, Math.round(totalDuration * input.sampleRate));
  const renderFrames = audio.loop ? requestedFrames : Math.min(requestedFrames, input.length);
  const chunkFrames = Math.max(1, Math.round(CHUNK_SECONDS * input.sampleRate));

  return {
    codec,
    async write() {
      for (let start = 0; start < renderFrames; start += chunkFrames) {
        if (signal?.aborted) {
          const error = new Error('Render cancelled.');
          error.name = 'AbortedError';
          throw error;
        }
        const length = Math.min(chunkFrames, renderFrames - start);
        const chunk = buildAudioChunk(audio, start, length, renderFrames);
        await source.add(chunk);
        onProgress?.({
          stage: 'audio',
          frame: Math.min(renderFrames, start + length),
          totalFrames: renderFrames,
          fraction: Math.min(1, (start + length) / renderFrames),
          elapsedMs: 0,
          etaMs: null,
          framesPerSecond: 0,
        });
      }
    },
  };
}
