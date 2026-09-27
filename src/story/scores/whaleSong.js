// Original whale-like synthesis, not a wildlife recording. Audio and picture
// sample the same chapter-relative calls, so seeking and retiming stay in sync.
import { TAU, pad, air } from './voices.js';

export function whaleCalls(chapters) {
  const calls = [];
  const add = (id, progress, span, from, to, gain) => {
    const c = chapters.find(chapter => chapter.id === id);
    if (c) calls.push({ chapter: id, start: c.start + c.duration * progress,
      length: c.duration * span, from, to, gain });
  };
  add('hook', .06, .82, 175, 92, .8);
  add('reveal', .08, .84, 115, 245, .85);
  add('perform', .02, .40, 220, 105, 1);
  add('perform', .53, .42, 135, 285, .82);
  add('outro', .05, .80, 160, 95, .55);
  return calls;
}

export function whaleEnvelope(progress) {
  return progress <= 0 || progress >= 1 ? 0 : Math.sin(Math.PI * progress) ** 1.6;
}

export function whaleCallState(calls, time) {
  let amplitude = 0, progress = 0;
  for (const call of calls) {
    const p = (time - call.start) / call.length;
    const value = whaleEnvelope(p) * call.gain;
    if (value > amplitude) { amplitude = value; progress = p; }
  }
  return { amplitude, progress };
}

export function whaleVoice(call) {
  return time => {
    const p = time / call.length;
    // Analytic phase integral: a slow pitch glide with a wavering throat tone.
    const phase = TAU * (call.from * time + (call.to - call.from) * time * time / (2 * call.length))
      + 1.4 * Math.sin(TAU * 1.7 * time) + .3 * Math.sin(TAU * 4.1 * time);
    return whaleEnvelope(p) * (Math.sin(phase) + .32 * Math.sin(2 * phase + .3)
      + .14 * Math.sin(3 * phase) + .055 * Math.sin(5 * phase)) / 1.515;
  };
}

export const whaleSong = {
  id: 'whale-song', name: 'Whale Song', mood: 'deep',
  description: 'Original synthesized whale calls follow the reveal and swimming, over a quiet ocean bed.',
  mix: { tone: 1800, taps: [[.23, .16], [.47, .10], [.79, .06]], targetDb: -24, ceiling: .48 },
  compose(ctx) {
    ctx.each(8, at => {
      const length = ctx.beat * 10;
      ctx.event(at, length, pad(55, length, .05), .018, -.25);
      ctx.event(at, length, pad(82.4, length, .07), .012, .25);
      ctx.event(at, length, air(ctx.rng, length), .014);
    });
    for (const call of whaleCalls(ctx.timeline.chapters)) {
      ctx.event(call.start, call.length, whaleVoice(call), .62 * call.gain, -.12);
    }
  },
};
