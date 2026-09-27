// The stage every score is played on.
//
// A score is handed one of these and does nothing but schedule notes against
// the story's own chapters: `intro`, `build` and `outro` are times, not tastes,
// and `transitions` and `greeting` are the same cue points the picture uses. A
// score never sees the sample buffer, the sample rate or the loop flag, so the
// same arrangement renders identically in the browser and in Node.
import { mulberry32 } from '../../audio/dsp.js';

export const TAU = Math.PI * 2;

export function createArrangement({ project, timeline, settings, duration, bars, sampleRate }) {
  const n = Math.round(duration * sampleRate), beat = duration / (bars * 4);
  const channels = [new Float32Array(n), new Float32Array(n)];
  const rng = mulberry32(settings.seed ?? project.seed ?? 73019);
  const hz = m => 440 * 2 ** ((m + (settings.transpose ?? 0) - 69) / 12);
  const boundary = (id, fallback) => timeline.chapters.find(c => c.id === id)?.start ?? duration * fallback;

  /**
   * Schedule one note. Tails wrap around the seam so a looping film never clicks.
   *
   * The write position is stepped rather than taken modulo, and a one-shot film
   * clips the range up front instead of testing every sample: a minute of score
   * is tens of millions of these iterations, and the studio auditions seven of
   * them. The arithmetic is unchanged -- the same notes land on the same samples.
   */
  function event(time, length, voice, gain = .1, pan = 0) {
    const start = Math.round(time * sampleRate), frames = Math.round(length * sampleRate);
    const l = Math.sqrt((1 - pan) / 2) * gain, r = Math.sqrt((1 + pan) / 2) * gain;
    const from = project.loop ? 0 : Math.max(0, -start), to = project.loop ? frames : Math.min(frames, n - start);
    const left = channels[0], right = channels[1];
    let at = ((start + from) % n + n) % n;
    for (let i = from; i < to; i++) {
      const v = voice(i / sampleRate, i);
      left[at] += v * l; right[at] += v * r;
      if (++at === n) at = 0;
    }
  }

  return {
    project, timeline, settings, sampleRate, duration, bars, beat, n, channels, rng, hz, event, boundary,
    // The three moments every story has, whatever its chapters are called.
    intro: boundary('combine', 1 / 12),
    build: boundary('contour', 5 / 24),
    outro: boundary('outro', 14 / 15),
    transitions: (settings.transitions ?? timeline.chapters.slice(1, -1).map(c => c.id)).map(id => timeline.anchor({ chapter: id })),
    greeting: boundary(settings.greeting ?? 'perform', .8),
    tempoFeel: settings.tempoFeel,
    /** How loud this moment should be: quieter either side of the story's middle. */
    arc(at) { return at < this.intro ? .64 : at < this.build ? .82 : at > this.outro ? .6 : 1; },
    /** Walk a bar grid, skipping anything that would fall past the end of a one-shot film. */
    each(step, fn) {
      for (let i = 0, at = 0; at < duration - 1e-9; i++, at = i * step * beat) if (at < duration) fn(at, i);
    },
  };
}
