// Deliberately different source families for a human listening test.
// Every direction keeps its own instrument for the entire film.
import { TAU, thump } from './voices.js';

const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const piano = frequency => t => {
  const attack = 1 - Math.exp(-t * 650);
  let value = 0;
  for (let h = 1; h <= 7; h++) {
    const f = frequency * h * Math.sqrt(1 + .00006 * h * h);
    value += Math.sin(TAU * f * t) * Math.exp(-t / (1.2 / Math.sqrt(h))) / h ** 1.6;
  }
  return value * attack;
};
const snare = rng => {
  let low = 0;
  return t => {
    const noise = rng() * 2 - 1; low += .12 * (noise - low);
    return (1 - Math.exp(-t * 1200)) * (.8 * (noise - low) * Math.exp(-t / .09)
      + .3 * Math.sin(TAU * 185 * t) * Math.exp(-t / .055));
  };
};
const hat = rng => {
  let previous = 0;
  return t => {
    const noise = rng() * 2 - 1, high = noise - previous; previous = noise;
    return high * (1 - Math.exp(-t * 1600)) * Math.exp(-t / .022);
  };
};

export const DISTINCT_SPATIAL_PARTS = [
  {
    id: 'piano', name: 'Piano only',
    play({ bus, duration, sampleRate, gains, loop }) {
      const step = duration / Math.max(1, Math.round(duration * 2));
      const melody = [60, 64, 67, 72, 69, 67, 64, 62];
      for (let i = 0, t = 0; t < duration; t = ++i * step) {
        bus.note({ start: Math.round(t * sampleRate), frames: Math.round(2.8 * sampleRate),
          voice: piano(hz(melody[i % melody.length])), gain: .5, gains, sampleRate, loop });
      }
    },
  },
  {
    id: 'drums', name: 'Drums only · kick, snare and hi-hat',
    play({ bus, duration, sampleRate, gains, loop, rng }) {
      const beats = Math.max(4, Math.round(duration / 2) * 4), step = duration / beats;
      const hit = (t, voice, gain, seconds) => bus.note({ start: Math.round(t * sampleRate),
        frames: Math.round(seconds * sampleRate), voice, gain, gains, sampleRate, loop });
      for (let i = 0; i < beats; i++) {
        const t = i * step;
        if (i % 2 === 0) hit(t, thump(55, .13), .9, .6);
        else hit(t, snare(rng), .65, .45);
        hit(t, hat(rng), .12, .14);
        hit(t + step / 2, hat(rng), .09, .14);
      }
    },
  },
  {
    id: 'organ', name: 'Organ only · sustained low tone',
    play({ bus, duration, sampleRate, gains, loop }) {
      // An integer number of periods keeps the sustained tone seamless.
      const f = Math.round(hz(48) * duration) / duration;
      bus.note({ start: 0, frames: Math.round(duration * sampleRate), gain: .4, gains, sampleRate, loop,
        voice: t => (Math.sin(TAU * f * t) + .45 * Math.sin(TAU * f * 2 * t)
          + .18 * Math.sin(TAU * f * 3 * t) + .1 * Math.sin(TAU * f * 4 * t))
          * (loop ? 1 : Math.min(1, t / .03, (duration - t) / .03)) });
    },
  },
  {
    id: 'rain', name: 'Rain only · steady unpitched water noise',
    play({ bus, duration, sampleRate, gains, loop, rng }) {
      let low = 0;
      bus.note({ start: 0, frames: Math.round(duration * sampleRate), gain: .45, gains, sampleRate, loop,
        voice: t => {
          const noise = rng() * 2 - 1; low += .08 * (noise - low);
          return (noise - low) * (loop ? 1 : Math.min(1, t / .03, (duration - t) / .03));
        } });
    },
  },
];
