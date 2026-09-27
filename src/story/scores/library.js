// Original scores, written for these films.
//
// Each one is arranged against the story's own chapters rather than a fixed
// clock, so a score fits a twenty-second short and a two-minute film without
// being edited. Choosing one is a project setting -- `audio.score` -- and the
// studio auditions them side by side before you export.
//
// `mix` is as much a part of the writing as the notes. `targetDb` is a loudness
// the whole library is levelled to, so switching scores changes the mood and
// not the volume, and `tone` is the corner frequency of the roll-off that keeps
// the top end out of the ear's sore spot.
import { TAU, mallet, marimba, kalimba, bell, chime, pad, bowed, sub, thump, brush, air } from './voices.js';
import { whaleSong } from './whaleSong.js';

/** A breath of air under a cue. Gentle scores use this where a loud one uses noise. */
const swell = (ctx, at, { length = 1.5, gain = .05, pan = -.2 } = {}) =>
  ctx.event(at - length * .78, length, air(ctx.rng, length), gain, pan);

/** Hold one chord across `beats`, one pad voice per note, spread across the stereo field. */
const chordPad = (ctx, at, notes, beats, gain, detune = .09) => {
  const length = ctx.beat * beats;
  for (const [j, m] of notes.entries()) ctx.event(at, length, pad(ctx.hz(m), length, detune), gain * ctx.arc(at), (j - (notes.length - 1) / 2) * .44);
};

export const SCORE_LIBRARY = [
  {
    id: 'still-water',
    name: 'Still Water',
    description: 'Pads and a far-off bell. No percussion at all, and the quietest thing here.',
    mood: 'calm',
    mix: { tone: 2600, taps: [[.137, .12], [.219, .09], [.331, .065], [.487, .04]], targetDb: -26, ceiling: .42 },
    compose(ctx) {
      const roots = [38, 35, 43, 45], voicings = [[57, 62, 66], [54, 59, 62], [55, 59, 62], [57, 61, 64]];
      ctx.each(8, (at, i) => {
        const c = i % 4;
        chordPad(ctx, at, voicings[c], 8, .085);
        ctx.event(at, ctx.beat * 8, sub(ctx.hz(roots[c]), ctx.beat * 3.4), .09 * ctx.arc(at));
        if (at > ctx.intro) ctx.event(at + ctx.beat * 4.5, 3.4, bell(ctx.hz(voicings[c][2] + 12), 2.9), .05 * ctx.arc(at), i % 2 ? .3 : -.3);
      });
      // One held tone reaches over the whole story, so nothing ever restarts from silence.
      ctx.event(0, ctx.duration, pad(ctx.hz(50), ctx.duration, .05), .035);
      for (const [i, at] of ctx.transitions.entries()) {
        swell(ctx, at, { gain: .035, pan: i % 2 ? .25 : -.25 });
        ctx.event(at, 3.6, bell(ctx.hz([74, 78, 81, 86][i % 4]), 3), .055, i % 2 ? -.2 : .2);
      }
      for (const [i, m] of [81, 86, 88].entries()) ctx.event(ctx.greeting + i * ctx.beat * 1.5, 3.4, bell(ctx.hz(m), 2.6), .06, (i - 1) * .34);
    },
  },
  {
    id: 'paper-lanterns',
    name: 'Paper Lanterns',
    description: 'A thumb piano over a warm pad, with a soft wooden pulse. Sparse and unhurried.',
    mood: 'calm',
    mix: { tone: 4200, taps: [[.109, .1], [.173, .08], [.263, .055], [.379, .035]], targetDb: -24, ceiling: .46 },
    compose(ctx) {
      const phrases = [
        [[0, 74], [1.25, 81], [2, 78], [3.5, 76], [5, 74], [6, 69], [7, 71]],
        [[0, 78], [1, 76], [2.5, 71], [3.25, 74], [4.5, 69], [6, 66], [7.25, 69]],
      ];
      const voicings = [[54, 62, 66], [52, 59, 64], [50, 57, 62], [45, 57, 61]], roots = [38, 40, 43, 45];
      ctx.each(8, (at, i) => {
        const c = i % 4;
        chordPad(ctx, at, voicings[c], 8, .05);
        ctx.event(at, ctx.beat * 6, sub(ctx.hz(roots[c] - 12), ctx.beat * 2.6), .075 * ctx.arc(at));
        for (const [b, m] of phrases[i % 2]) {
          const time = at + b * ctx.beat;
          if (time >= ctx.duration) continue;
          ctx.event(time, 1.9, kalimba(ctx.hz(m), .85), .12 * ctx.arc(time), Math.sin(b * 1.9) * .38);
        }
        // The pulse only joins once the story has started building.
        if (at >= ctx.intro) for (const b of [0, 3, 5.5]) ctx.event(at + b * ctx.beat, .5, thump(58, .26), .1 * ctx.arc(at));
      });
      for (const [i, at] of ctx.transitions.entries()) {
        swell(ctx, at, { gain: .045, pan: i % 2 ? .3 : -.3 });
        ctx.event(at, 2.2, kalimba(ctx.hz(86), .9), .07, .15);
      }
      for (const [i, m] of [81, 83, 86].entries()) ctx.event(ctx.greeting + i * ctx.beat * .75, 2.2, kalimba(ctx.hz(m), .8), .1, (i - 1) * .38);
    },
  },
  {
    id: 'aurora-glass',
    name: 'Aurora Glass',
    description: 'Glass arpeggios drifting over a wide pad. Bright without being sharp.',
    mood: 'calm',
    mix: { tone: 5200, taps: [[.127, .11], [.199, .085], [.293, .06], [.441, .038]], targetDb: -25, ceiling: .44 },
    compose(ctx) {
      const voicings = [[57, 64, 69, 73], [55, 62, 67, 71], [53, 60, 65, 69], [55, 59, 64, 71]], roots = [45, 43, 41, 47];
      ctx.each(8, (at, i) => {
        const c = i % 4, notes = voicings[c];
        chordPad(ctx, at, notes.slice(0, 3), 8, .055, .13);
        ctx.event(at, ctx.beat * 7, sub(ctx.hz(roots[c] - 12), ctx.beat * 3), .07 * ctx.arc(at));
        // The arpeggio climbs and falls across the bar; every other lap it reaches an octave up.
        const shape = [0, 1, 2, 3, 2, 1, 3, 2], step = at < ctx.build ? 2 : 1;
        for (let k = 0; k * step < 8; k++) {
          const time = at + k * step * ctx.beat;
          if (time >= ctx.duration) continue;
          const m = notes[shape[k % 8]] + (i % 2 && k % 4 === 3 ? 12 : 0);
          ctx.event(time, 3.2, bell(ctx.hz(m), 1.7), .055 * ctx.arc(time), Math.sin(k * 1.3) * .45);
        }
      });
      for (const [i, at] of ctx.transitions.entries()) {
        swell(ctx, at, { length: 1.8, gain: .04, pan: i % 2 ? -.3 : .3 });
        ctx.event(at, 4.2, bell(ctx.hz(88 + (i % 2 ? 0 : 5)), 3.2), .05, i % 2 ? .25 : -.25);
      }
      for (const [i, m] of [84, 88, 91].entries()) ctx.event(ctx.greeting + i * ctx.beat * .5, 3.6, bell(ctx.hz(m), 2.4), .06, (i - 1) * .4);
    },
  },
  {
    id: 'driftwood',
    name: 'Driftwood',
    description: 'Marimba and a walking bass, brushed instead of drummed. Warm and moving.',
    mood: 'warm',
    mix: { tone: 3800, taps: [[.083, .1], [.131, .078], [.197, .054], [.289, .032]], targetDb: -23, ceiling: .48 },
    compose(ctx) {
      const melody = [
        [0, 76], [1, 79], [2, 81], [3.5, 79], [5, 76], [6.5, 72], [7.25, 74],
        [0, 81], [1.5, 84], [2.5, 81], [4, 79], [5.5, 76], [7, 79],
      ];
      const voicings = [[53, 60, 65], [52, 60, 64], [52, 57, 64], [50, 55, 62]], roots = [41, 36, 45, 43];
      ctx.each(8, (at, i) => {
        const c = i % 4, phrase = i % 2 ? melody.slice(7) : melody.slice(0, 7);
        chordPad(ctx, at, voicings[c], 8, .045);
        for (const [b, m] of phrase) {
          const time = at + b * ctx.beat;
          if (time >= ctx.duration) continue;
          ctx.event(time, 1.6, marimba(ctx.hz(m), .6), .13 * ctx.arc(time), Math.sin(b * 1.6) * .36);
          ctx.event(time + ctx.beat * .5, 1, marimba(ctx.hz(m - 12), .4), .035 * ctx.arc(time), -Math.sin(b * 1.6) * .3);
        }
        // The bass walks root, fifth, octave, third: the same four steps in every key.
        for (const [k, step] of [0, 7, 12, 4].entries()) {
          const time = at + k * 2 * ctx.beat;
          if (time < ctx.duration) ctx.event(time, ctx.beat * 2.4, sub(ctx.hz(roots[c] - 12 + step), ctx.beat * 1.5), .085 * ctx.arc(time));
        }
        if (at >= ctx.intro) {
          for (const b of [0, 4]) ctx.event(at + b * ctx.beat, .55, thump(60, .3), .1 * ctx.arc(at));
          // A brushed swell where a snare would be, if this were a louder score.
          if (ctx.tempoFeel !== 'drift') for (const b of [2, 6]) ctx.event(at + (b - .5) * ctx.beat, .62, brush(ctx.rng, .62, .35), .05 * ctx.arc(at), .18);
        }
      });
      for (const [i, at] of ctx.transitions.entries()) {
        swell(ctx, at, { gain: .05, pan: i % 2 ? .28 : -.28 });
        ctx.event(at, 1.8, marimba(ctx.hz(88), .55), .07, .2);
      }
      for (const [i, m] of [84, 88, 91].entries()) ctx.event(ctx.greeting + i * ctx.beat * .5, 1.8, marimba(ctx.hz(m), .5), .11, (i - 1) * .4);
    },
  },
  {
    id: 'deep-current',
    name: 'Deep Current',
    description: 'Bowed open fifths and a slow swell. Written for the films that move through space.',
    mood: 'deep',
    mix: { tone: 2200, taps: [[.163, .13], [.251, .1], [.373, .07], [.541, .045]], targetDb: -25, ceiling: .43 },
    compose(ctx) {
      const voicings = [[45, 52, 57], [43, 50, 55], [48, 55, 60], [41, 48, 53]];
      ctx.each(8, (at, i) => {
        const c = i % 4, notes = voicings[c], length = ctx.beat * 8;
        for (const [j, m] of notes.entries()) ctx.event(at, length, bowed(ctx.hz(m), length), .075 * ctx.arc(at), (j - 1) * .5);
        ctx.event(at, ctx.beat * 8, sub(ctx.hz(notes[0] - 24), ctx.beat * 4), .1 * ctx.arc(at));
        // A high line joins once the artwork starts being built.
        if (at >= ctx.build && at < ctx.outro) ctx.event(at + ctx.beat * 2, ctx.beat * 5, bowed(ctx.hz(notes[2] + 12), ctx.beat * 5, .003), .05, i % 2 ? .4 : -.4);
        if (at >= ctx.intro) ctx.event(at, .9, thump(48, .5), .085 * ctx.arc(at));
      });
      for (const [i, at] of ctx.transitions.entries()) {
        swell(ctx, at, { length: 2.2, gain: .05, pan: i % 2 ? -.35 : .35 });
        ctx.event(at, 4.4, bell(ctx.hz(69 + (i % 2 ? 5 : 0)), 3.4), .04, i % 2 ? .3 : -.3);
      }
      for (const [i, m] of [69, 76, 81].entries()) ctx.event(ctx.greeting + i * ctx.beat, ctx.beat * 4, bowed(ctx.hz(m), ctx.beat * 4), .07, (i - 1) * .36);
    },
  },
  {
    id: 'little-clockwork',
    name: 'Little Clockwork',
    description: 'A music box in three-time. Delicate, toy-like, and very quiet.',
    mood: 'playful',
    mix: { tone: 4600, taps: [[.097, .1], [.151, .08], [.233, .055], [.347, .033]], targetDb: -25, ceiling: .45 },
    compose(ctx) {
      const roots = [43, 40, 36, 38], voicings = [[59, 62, 67], [59, 64, 67], [60, 64, 67], [57, 62, 66]];
      const phrases = [[[0, 79], [1, 83], [2, 86], [3, 83], [4, 79], [5, 76]], [[0, 86], [1.5, 83], [2, 79], [3, 81], [4.5, 78], [5, 74]]];
      // Six beats to a lap: two bars of three, the way a music box winds.
      ctx.each(6, (at, i) => {
        const c = i % 4;
        ctx.event(at, ctx.beat * 6, sub(ctx.hz(roots[c] - 12), ctx.beat * 2), .06 * ctx.arc(at));
        for (const b of [0, 3]) {
          const time = at + b * ctx.beat;
          if (time >= ctx.duration) continue;
          ctx.event(time, 1.4, chime(ctx.hz(roots[c]), .8), .07 * ctx.arc(time), -.25);
          for (const [j, m] of voicings[c].entries()) ctx.event(time + ctx.beat, 1.1, chime(ctx.hz(m), .5), .035 * ctx.arc(time), (j - 1) * .3);
        }
        for (const [b, m] of phrases[i % 2]) {
          const time = at + b * ctx.beat;
          if (time >= ctx.duration) continue;
          ctx.event(time, 2.4, chime(ctx.hz(m), 1.2), .1 * ctx.arc(time), Math.sin(b * 2.1) * .34);
        }
        if (at >= ctx.build) ctx.event(at + ctx.beat * 1.5, .4, brush(ctx.rng, .4, .6), .025, .3);
      });
      for (const [i, at] of ctx.transitions.entries()) {
        swell(ctx, at, { length: 1.2, gain: .035, pan: i % 2 ? .3 : -.3 });
        ctx.event(at, 2.6, chime(ctx.hz(91), 1.4), .055, i % 2 ? -.2 : .2);
      }
      for (const [i, m] of [86, 90, 93].entries()) ctx.event(ctx.greeting + i * ctx.beat * .5, 2.6, chime(ctx.hz(m), 1.3), .075, (i - 1) * .4);
    },
  },
  {
    id: 'construction',
    name: 'Construction Site',
    description: 'The original mallet score: brisk, bright and busy. Much the loudest in the library.',
    mood: 'bright',
    // Kept exactly as first published, mix and all, so films made with it re-render byte for byte.
    mix: { legacy: true, taps: [[.071, .1], [.113, .08], [.173, .055], [.263, .03]], peak: .79 },
    compose(ctx) {
      const { beat, bars, hz, rng, event, duration } = ctx, introEnd = ctx.intro, build = ctx.build, outro = ctx.outro;
      const melody = [
        [0, 74], [.75, 81], [1.5, 77], [2.5, 76], [3.25, 74],
        [4, 77], [4.75, 81], [5.5, 84], [6.5, 81], [7.25, 77],
        [8, 81], [8.75, 79], [9.5, 77], [10.5, 74], [11.25, 72],
        [12, 76], [12.75, 79], [13.5, 81], [14.5, 79], [15.25, 76],
      ];
      for (let half = 0; half < Math.ceil(bars / 4); half++) for (const [b, m] of melody) {
        const at = (b + half * 16) * beat, pan = Math.sin(b * 1.7) * .34;
        if (at >= duration) continue;
        const arrangement = at < introEnd ? .64 : at < build ? .8 : at > outro ? .64 : 1;
        event(at, 1.3, mallet(hz(m)), .24 * arrangement, pan);
        event(at + beat * .75, 1, mallet(hz(m), .18), .057 * arrangement, -pan);
      }
      const chords = [[50, 57, 60, 64], [46, 53, 57, 60], [41, 53, 57, 60], [48, 55, 62, 64]];
      for (let bar = 0; bar < bars; bar++) {
        const notes = chords[bar % 4], start = bar * 4 * beat;
        for (const [j, m] of notes.entries()) event(start, beat * 4, t => {
          const env = Math.sin(Math.PI * Math.min(1, t / (beat * 4))) ** 1.5;
          return env * (Math.sin(TAU * hz(m + 12) * t) + .15 * Math.sin(TAU * hz(m + 24) * t));
        }, .018, (j - 1.5) * .4);
        for (const b of [0, 1.5, 2.75]) event(start + b * beat, .48, t => {
          const f = hz(notes[0] - 12);
          return (1 - Math.exp(-t * 250)) * Math.exp(-t / .19) * (Math.sin(TAU * f * t) + .22 * Math.sin(TAU * f * 2 * t));
        }, start < introEnd ? .07 : bar > bars - 3 ? .1 : .26);
      }
      for (let b = Math.round(introEnd / beat); b < bars * 4 - 6; b++) {
        if (ctx.tempoFeel === 'drift' && b % 2) continue;
        if (b % 4 === 0 || b % 4 === 2) event(b * beat, .32, t => {
          const phase = TAU * (47 * t + 65 * .024 * (1 - Math.exp(-t / .024)));
          return Math.sin(phase) * (1 - Math.exp(-t * 1800)) * Math.exp(-t / .068);
        }, b * beat < build ? .18 : .31);
        if (b % 4 === 1 || b % 4 === 3) event(b * beat, .12, t => {
          const noise = rng() * 2 - 1;
          return (.6 * noise + .4 * Math.sin(TAU * 187 * t)) * (1 - Math.exp(-t * 2400)) * Math.exp(-t / .018);
        }, .10, .1);
        for (const off of [0, .5]) event((b + off) * beat, .065, t => (rng() * 2 - 1) * Math.sin(Math.PI * Math.min(1, t / .065)) ** 3 * Math.exp(-t / .016), off ? .065 : .043, off ? .42 : -.42);
      }
      // Gentle rises lead into the construction and the character reveal.
      for (const end of ctx.transitions) event(end - .34, .42, t => {
        const envelope = t < .34 ? (t / .34) ** 2 : Math.exp(-(t - .34) * 60);
        return (rng() * 2 - 1) * envelope * .35 + Math.sin(TAU * (520 * t + 1200 * t * t)) * envelope * .12;
      }, .09, -.2);
      // A bright three-note response coincides with the greeting.
      for (const [i, m] of [86, 89, 93].entries()) event(ctx.greeting + i * beat * .5, .8, mallet(hz(m), .16), .1, (i - 1) * .4);
    },
  },
];

SCORE_LIBRARY.push(whaleSong);
export const SCORE_IDS = SCORE_LIBRARY.map(s => s.id);
export const DEFAULT_SCORE = 'paper-lanterns';

/** Look a score up by id. Unknown ids fail here rather than silently at render time. */
export function getScore(id = DEFAULT_SCORE) {
  const score = SCORE_LIBRARY.find(s => s.id === id);
  if (!score) throw new Error(`Unknown score "${id}". Choose one of: ${SCORE_IDS.join(', ')}.`);
  return score;
}

/** What the studio needs to list the scores without importing the arrangements. */
export const SCORE_CHOICES = SCORE_LIBRARY.map(({ id, name, description, mood }) => ({ id, name, description, mood }));
