// A score written for a 360° stage, where each exhibit sings from where it stands.
//
// An ordinary score in this repo mixes to two channels and decides left-to-right
// with a pan. This one mixes to a first-order sound field and decides direction
// with a heading, so the balance is not baked in: it is resolved at playback,
// against wherever the viewer happens to be looking.
//
// Three rules shape the writing. All three were learned by getting them wrong,
// and all three matter more than the encoding does.
//
//   * Nothing may change on its own. An earlier draft swelled each part in turn
//     on a timer, which meant the music changed while the viewer was perfectly
//     still -- and that masks the only effect this format has. Every part now
//     plays at a steady level from end to end, so *all* change is head-turning.
//   * The parts must be equally loud. They are level-matched by measurement,
//     not by ear and not by a written gain: one part mixed a few dB hot is
//     audible from every direction and flattens the whole illusion.
//   * There is nothing omnidirectional in the mix. A bed written to W is by
//     construction identical whichever way you turn, so it is exactly the thing
//     that makes a sound field sound like a stereo file.
//
// What is left is separation by timbre, register and rhythm: a busy mid-register
// pluck in front, sparse high glass to the right, a continuous low drone behind,
// unpitched breath to the left. A binaural first-order field rotates sources
// around the listener; it does not select music based on the viewing direction.
// Keep independent stems for that behavior in an interactive player.
import { mulberry32, filterLoop } from '../../audio/dsp.js';
import { createFoaBus, exhibitGains, foaGains } from '../../audio/ambisonic.js';
import { kalimba, bell, chime, pad, bowed, sub, air, brush } from './voices.js';
import { DISTINCT_SPATIAL_PARTS } from './spatialDistinct.js';

const dbToGain = db => 10 ** (db / 20);
const hz = (midi, transpose = 0) => 440 * 2 ** ((midi + transpose - 69) / 12);

/**
 * The four characters a stage can hand out, in the order its exhibits are
 * placed. Each one owns a register and a rhythm that no other one touches.
 */
const PARTS = [
  {
    id: 'shell', name: 'a thumb piano, steady and close', notes: [57, 62, 64, 69, 64, 62],
    // Front. Busy and rhythmic: the part with the most events per second, so it
    // reads as "the one playing" whenever you are facing it.
    play({ bus, duration, beat, sampleRate, gains, transpose, loop }) {
      const step = beat;
      for (let i = 0, t = 0; t < duration; i++, t = i * step) {
        const midi = this.notes[i % this.notes.length];
        bus.note({
          start: Math.round(t * sampleRate), frames: Math.round(sampleRate * 1.1),
          voice: kalimba(hz(midi, transpose), .55), gain: i % 2 ? .34 : .5,
          gains, sampleRate, loop,
        });
        if (i % 3 === 0) bus.note({
          start: Math.round((t + beat * .5) * sampleRate), frames: Math.round(sampleRate * .7),
          voice: kalimba(hz(midi + 12, transpose), .3), gain: .2, gains, sampleRate, loop,
        });
      }
    },
  },
  {
    id: 'knot', name: 'struck glass, high and sparse', notes: [84, 88, 91, 86],
    // Right, above the horizon. The opposite of the thumb piano in every
    // dimension: two octaves up, one event where the piano has eight, and a
    // tail long enough that it is still ringing when the next one lands.
    play({ bus, duration, beat, sampleRate, gains, transpose, loop }) {
      const step = beat * 4;
      for (let i = 0, t = 0; t < duration; i++, t = i * step) {
        const midi = this.notes[i % this.notes.length];
        bus.note({
          start: Math.round(t * sampleRate), frames: Math.round(sampleRate * 3.4),
          voice: bell(hz(midi, transpose), 2.4), gain: .5, gains, sampleRate, loop,
        });
        bus.note({
          start: Math.round((t + beat * 2) * sampleRate), frames: Math.round(sampleRate * 1.8),
          voice: chime(hz(midi + 7, transpose), 1.3), gain: .22, gains, sampleRate, loop,
        });
      }
    },
  },
  {
    id: 'whale', name: 'a low drone, continuous', notes: [33, 35, 31, 33],
    // Behind, below the horizon. Front and back is the weak axis of a
    // first-order field, so this part is not asked to be located -- it is asked
    // to be unmistakable. Nothing else in the mix goes anywhere near this low,
    // so when it is the loudest thing you are facing away from the front.
    play({ bus, duration, beat, sampleRate, gains, transpose, loop }) {
      const step = beat * 8, length = beat * 8.6; // Deliberately overlapping, so it never stops.
      for (let i = 0, t = 0; t < duration; i++, t = i * step) {
        const midi = this.notes[i % this.notes.length];
        bus.note({
          start: Math.round(t * sampleRate), frames: Math.round(length * sampleRate),
          voice: bowed(hz(midi + 12, transpose), length, .004), gain: .4, gains, sampleRate, loop,
        });
        bus.note({
          start: Math.round(t * sampleRate), frames: Math.round(sampleRate * 3.2),
          voice: sub(hz(midi, transpose), 2.1), gain: .55, gains, sampleRate, loop,
        });
      }
    },
  },
  {
    id: 'manta', name: 'breath, unpitched', notes: [69, 74, 71],
    // Left, high overhead. Noise rather than pitch: it cannot be confused with
    // any of the other three, because it is the only part with no note in it at
    // all. Left and right is the strong axis, so this one moves the most.
    play({ bus, duration, beat, sampleRate, gains, transpose, loop, rng }) {
      const step = beat * 3;
      for (let i = 0, t = 0; t < duration; i++, t = i * step) {
        const length = beat * 3.4;
        bus.note({
          start: Math.round(t * sampleRate), frames: Math.round(length * sampleRate),
          voice: air(rng, length), gain: .5, gains, sampleRate, loop,
        });
        bus.note({
          start: Math.round(t * sampleRate), frames: Math.round(length * sampleRate),
          voice: brush(rng, length, .35), gain: .18, gains, sampleRate, loop,
        });
        if (i % 2 === 0) bus.note({
          start: Math.round(t * sampleRate), frames: Math.round(length * sampleRate),
          voice: pad(hz(this.notes[(i / 2) % this.notes.length], transpose), length, .13),
          gain: .12, gains, sampleRate, loop,
        });
      }
    },
  },
];

/** RMS of one buffer. */
function rms(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] ** 2;
  return Math.sqrt(sum / buffer.length);
}

/**
 * Decode a first-order cardioid aimed at one heading.
 *
 * This is the pattern with a true null behind it, which makes it the honest
 * best case for "turn away and it goes quiet". A binaural decoder -- which is
 * what YouTube actually uses -- trades some of that rejection for a convincing
 * sense of space, so treat these numbers as the ceiling, not the forecast.
 */
export function decodeCardioid(channels, heading, elevation = 0) {
  const [, y, z, x] = foaGains(-heading, elevation);
  const [W, Y, Z, X] = channels, n = W.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = .5 * W[i] + .5 * (Y[i] * y + Z[i] * z + X[i] * x);
  return out;
}

/**
 * How much of each part you hear from each place you can look.
 *
 * Rows are look directions, columns are parts, values are dB relative to that
 * part heard from its own direction. The diagonal is 0 by definition; what
 * matters is how far below it everything else sits.
 */
export function isolationMatrix(stems, headings) {
  return headings.map(heading => stems.map(stem => {
    const here = rms(decodeCardioid(stem.channels, heading));
    const best = rms(decodeCardioid(stem.channels, stem.heading, stem.elevation));
    return Number((20 * Math.log10(Math.max(here, 1e-12) / Math.max(best, 1e-12))).toFixed(1));
  }));
}

/**
 * Render a stage's exhibits to a first-order sound field.
 *
 * Returns the same shape as `renderStoryScore`, with four channels instead of
 * two: W, Y, Z, X in ACN order with SN3D gains, ready to be encoded without any
 * further reordering.
 */
export function renderSpatialStageScore(exhibits, {
  duration = 20, sampleRate = 48000, bars = 10, seed = 674, transpose = -3,
  level = .55, loop = true, targetDb = -23, ceiling = .5, tone = 5600, bed = 0,
  only = null, soundSet = 'original',
} = {}) {
  if (!['original', 'distinct'].includes(soundSet)) throw new Error('Choose the original or distinct spatial sound set.');
  const parts = soundSet === 'distinct' ? DISTINCT_SPATIAL_PARTS : PARTS;
  if (!Array.isArray(exhibits) || !exhibits.length) throw new Error('A spatial score needs at least one placed exhibit.');
  if (exhibits.length > PARTS.length) throw new Error(`This score is written for up to ${PARTS.length} exhibits.`);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600) throw new Error('A spatial score runs from 0 to 600 seconds.');
  if (!Number.isFinite(level) || level < 0 || level > 1) throw new Error('Score level must be between 0 and 1.');

  const n = Math.round(duration * sampleRate), beat = duration / (bars * 4);
  const rng = mulberry32(seed);

  // Each part is rendered into a field of its own, so it can be measured and
  // levelled before anything is summed. Mixing first and levelling afterwards
  // would be levelling the wash rather than the parts.
  const stems = exhibits.map((exhibit, i) => {
    const part = parts[i % parts.length];
    const bus = createFoaBus(n);
    if (only === null || only === i || only === part.id) {
      part.play({ bus, duration, beat, sampleRate, gains: exhibitGains(exhibit), rng, transpose, loop });
    }
    return {
      id: part.id, voice: part.name, name: exhibit.name ?? part.id,
      heading: exhibit.heading ?? 0, elevation: exhibit.elevation ?? 0,
      channels: bus.channels, gains: exhibitGains(exhibit),
    };
  });

  // Level-matched on W, which is each part's own mono sum and so its loudness
  // regardless of where it was placed. Without this the loudest part is audible
  // from everywhere and there is no illusion left to hear.
  const loudest = Math.max(...stems.map(s => rms(s.channels[0])));
  for (const stem of stems) {
    const own = rms(stem.channels[0]);
    const trim = own > 0 ? loudest / own : 0;
    stem.trimDb = Number((20 * Math.log10(Math.max(trim, 1e-12))).toFixed(1));
    for (const c of stem.channels) for (let i = 0; i < n; i++) c[i] *= trim;
    // Retain independent, mastered mono tracks for view-dependent playback.
    // They cannot be recovered in isolation from the summed first-order field.
    const mono = tone ? filterLoop(stem.channels[0], { sampleRate, cutoff: Math.min(tone, sampleRate * .45), q: .5 }) : stem.channels[0];
    const monoRms = rms(mono), monoGain = monoRms > 0 ? dbToGain(targetDb) / monoRms : 0;
    stem.focusAudio = Float32Array.from(mono, v => Math.tanh(v * monoGain / ceiling) * ceiling * level);
  }

  const channels = [0, 1, 2, 3].map(() => new Float32Array(n));
  for (const stem of stems) {
    for (let c = 0; c < 4; c++) {
      const src = stem.channels[c], dst = channels[c];
      for (let i = 0; i < n; i++) dst[i] += src[i];
    }
  }

  // A bed, if one is asked for, is omnidirectional by construction and therefore
  // the one part of the mix that cannot change as you turn. It defaults to
  // nothing for that reason, and exists only for stages too sparse to hold up.
  if (bed > 0) {
    const breath = air(rng, duration);
    for (let i = 0; i < n; i++) channels[0][i] += breath(i / sampleRate, i) * bed * .35 * Math.sin(Math.PI * i / n) ** .5;
  }

  // Tone is applied identically to all four channels. Treating one on its own
  // would tilt the field and steer every source away from where it was placed.
  const shaped = tone
    ? channels.map(c => filterLoop(c, { sampleRate, cutoff: Math.min(tone, sampleRate * .45), q: .5 }))
    : channels;

  // The soft ceiling is applied to the field, not to its channels: running tanh
  // down each channel separately bends W, Y, Z and X by different amounts on the
  // same sample, and the direction a source is heard from is exactly the ratio
  // between them. One scalar per sample, applied to all four.
  const gain = rms(shaped[0]) > 0 ? dbToGain(targetDb) / rms(shaped[0]) : 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    let magnitude = 0;
    for (const c of shaped) magnitude = Math.max(magnitude, Math.abs(c[i] * gain));
    const soft = magnitude > 0 ? Math.tanh(magnitude / ceiling) * ceiling / magnitude : 0;
    const scale = gain * soft * level;
    for (const c of shaped) {
      const v = c[i] * scale;
      c[i] = v;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
  }

  const headings = stems.map(s => s.heading);
  return {
    channelData: shaped, sampleRate, length: n, numberOfChannels: 4,
    stems,
    stats: {
      sampleRate, duration, bars, level, seed, transpose, soundSet,
      bpm: 60 / beat, peakDb: 20 * Math.log10(Math.max(peak, 1e-9)),
      seam: shaped.map(c => Math.abs(c[0] - c[n - 1])),
      format: { ambisonic: 'first-order', order: 1, ordering: 'ACN', normalization: 'SN3D', channels: ['W', 'Y', 'Z', 'X'] },
      placements: stems.map(s => ({
        name: s.name, part: s.id, voice: s.voice, heading: s.heading, elevation: s.elevation,
        levelTrimDb: s.trimDb, gains: s.gains.map(g => Number(g.toFixed(4))),
      })),
      isolation: { headings, matrix: isolationMatrix(stems, headings) },
    },
  };
}

export { PARTS as SPATIAL_PARTS };
