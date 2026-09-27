// Original deterministic scores. Whole bars fit the story; transition cues follow its chapters.
// All note tails and delays wrap so there is no clipped audio on replay.
//
// The notes live in src/story/scores/; this file is the mix desk they all pass
// through. Two things happen here that the arrangements deliberately do not do
// for themselves:
//
//   * loudness. Every score but the original is levelled to its own RMS target
//     rather than pushed up against the peak, so switching score changes the
//     mood and not the volume, and `audio.level` trims the lot.
//   * tone. A one-pole-per-pass roll-off takes the top off the mix. The ear is
//     most sensitive between 2 and 5 kHz, which is exactly where a synthesised
//     transient piles its energy, and where listening fatigue comes from.
import { encodeWav } from '../audio/wav.js';
import { filterLoop } from '../audio/dsp.js';
import { createTimeline } from './timeline.js';
import { createArrangement } from './scores/arrangement.js';
import { getScore } from './scores/library.js';

export { SCORE_LIBRARY, SCORE_CHOICES, SCORE_IDS, DEFAULT_SCORE, getScore } from './scores/library.js';

const dbToGain = db => 10 ** (db / 20);

export function renderStoryScore(project, { sampleRate = 48000 } = {}) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('Invalid soundtrack sample rate.');
  const timeline = createTimeline(project), duration = timeline.duration;
  if (duration > 600) throw new Error('Procedural scores support stories up to ten minutes.');
  const settings = project.audio ?? {};
  const bars = settings.bars ?? Math.max(1, Math.round(duration / 1.875));
  if (!Number.isInteger(bars) || bars < 1 || bars > 512) throw new Error('Score bars must be an integer from 1 to 512.');
  const score = getScore(settings.score);
  const level = settings.level ?? 1;
  if (!Number.isFinite(level) || level < 0 || level > 1) throw new Error('Score level must be between 0 and 1.');

  const ctx = createArrangement({ project, timeline, settings, duration, bars, sampleRate });
  const { n, channels } = ctx;
  score.compose(ctx);

  const mix = score.mix ?? {};
  // Tone first: the roll-off has to happen before the room, or the room sparkles.
  if (mix.tone) for (let ch = 0; ch < 2; ch++) channels[ch] = filterLoop(channels[ch], { sampleRate, cutoff: Math.min(mix.tone, sampleRate * .45), q: .5 });
  // Short, quiet room reflections are circular, including pre-roll tails.
  const dry = channels.map(c => c.slice());
  for (const [delay, gain] of mix.taps ?? []) {
    const d = Math.round(delay * sampleRate);
    for (let ch = 0; ch < 2; ch++) for (let i = 0; i < n; i++) if (project.loop || i >= d) channels[ch][i] += dry[1 - ch][((i - d) % n + n) % n] * gain;
  }
  if (!project.loop) for (const c of channels) for (let i = 0; i < n; i++) c[i] *= Math.min(1, i / (sampleRate * .02), (n - 1 - i) / (sampleRate * .08));

  let peak = 0, sum = 0;
  for (const c of channels) for (const v of c) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  const rms = Math.sqrt(sum / (n * 2));
  if (mix.legacy) {
    // The original score is normalised to its peak, as it always was.
    const gain = peak > 0 ? mix.peak / peak * level : 0;
    for (const c of channels) for (let i = 0; i < n; i++) c[i] *= gain;
    return finish(ctx, { score, level, peakDb: 20 * Math.log10(mix.peak * level || 1e-9), rmsDb: 20 * Math.log10(rms * gain || 1e-9) });
  }
  // Everything else is levelled by loudness, with a soft ceiling catching the
  // few transients that stick out. tanh is doing the work of a limiter without
  // a limiter's pumping, and it only bends what is already near the ceiling.
  const ceiling = mix.ceiling ?? .45, gain = rms > 0 ? dbToGain(mix.targetDb ?? -24) / rms : 0;
  let outPeak = 0, outSum = 0;
  for (const c of channels) for (let i = 0; i < n; i++) {
    const v = Math.tanh(c[i] * gain / ceiling) * ceiling * level;
    c[i] = v; outPeak = Math.max(outPeak, Math.abs(v)); outSum += v * v;
  }
  return finish(ctx, { score, level, peakDb: 20 * Math.log10(Math.max(outPeak, 1e-9)), rmsDb: 20 * Math.log10(Math.max(Math.sqrt(outSum / (n * 2)), 1e-9)) });
}

function finish({ channels, sampleRate, n, duration, beat, bars }, { score, level, peakDb, rmsDb }) {
  const seam = channels.map(c => Math.abs(c[0] - c[n - 1]));
  return {
    channelData: channels, sampleRate, length: n, numberOfChannels: 2,
    bytes: encodeWav({ channelData: channels, sampleRate, dither: false }),
    stats: { sampleRate, duration, peakDb, rmsDb, seam, bpm: 60 / beat, bars, level, score: score.id, scoreName: score.name, original: true },
  };
}
