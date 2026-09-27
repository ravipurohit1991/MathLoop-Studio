// The instruments the scores are played on.
//
// Every voice is a function of the note it plays and returns a function of
// (t, i) -> sample, so a score only ever schedules notes; it never touches the
// buffer. Two rules hold across the whole cabinet, and they are the reason the
// gentle scores stay gentle:
//
//   * nothing starts instantly. An envelope that opens in under a millisecond
//     is a click, and a hundred clicks a minute is the sound of a headache.
//   * nothing sings above about 5 kHz. The ear's sore spot is 2-5 kHz, so the
//     bright partials that make an instrument recognisable are kept short and
//     quiet, and the mix stage rolls off what is left.

export const TAU = Math.PI * 2;

/** Bright struck metal. The original construction score is written for this one. */
export const mallet = (f, d = .24) => t => {
  const attack = 1 - Math.exp(-t * 1600), release = Math.exp(-t / d);
  return attack * (Math.sin(TAU * f * t) * release + .35 * Math.sin(TAU * f * 4.003 * t) * Math.exp(-t / .065) + .12 * Math.sin(TAU * f * 7.99 * t) * Math.exp(-t / .023));
};

/** A wooden bar. Slow enough on the attack that the strike is felt, not heard. */
export const marimba = (f, d = .55) => t => {
  const attack = 1 - Math.exp(-t * 260), release = Math.exp(-t / d);
  return attack * (Math.sin(TAU * f * t) * release + .2 * Math.sin(TAU * f * 3.99 * t) * Math.exp(-t / (d * .2)) + .05 * Math.sin(TAU * f * 9.2 * t) * Math.exp(-t / (d * .08)));
};

/** Thumb piano: one clean tone over a short woody knock. */
export const kalimba = (f, d = .8) => t => {
  const attack = 1 - Math.exp(-t * 420);
  return attack * (Math.sin(TAU * f * t) * Math.exp(-t / d) + .3 * Math.sin(TAU * f * 2 * t) * Math.exp(-t / (d * .3)) + .16 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t / .05));
};

/** Glass. Inharmonic partials, a long tail and no bite at the front. */
export const bell = (f, d = 2.6) => t => {
  const attack = 1 - Math.exp(-t * 90);
  return attack * (Math.sin(TAU * f * t) * Math.exp(-t / d)
    + .34 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t / (d * .42))
    + .13 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t / (d * .16))
    + .06 * Math.sin(TAU * f * 8.9 * t) * Math.exp(-t / (d * .07)));
};

/** A music box comb: the bell's cousin, sweeter and shorter. */
export const chime = (f, d = 1.5) => t => {
  const attack = 1 - Math.exp(-t * 300);
  return attack * (Math.sin(TAU * f * t) * Math.exp(-t / d)
    + .28 * Math.sin(TAU * f * 4 * t) * Math.exp(-t / (d * .2))
    + .1 * Math.sin(TAU * f * 6.1 * t) * Math.exp(-t / .09));
};

/** A slow swell. `dur` is the whole note length, so the envelope fits the note. */
export const pad = (f, dur, detune = .09) => t => {
  const env = Math.sin(Math.PI * Math.min(1, t / dur)) ** 1.7;
  return env * (Math.sin(TAU * f * t) + .7 * Math.sin(TAU * (f + detune) * t + 1.1) + .18 * Math.sin(TAU * f * 2 * t) + .05 * Math.sin(TAU * f * 3 * t)) * .42;
};

/** Bowed string. The vibrato is what keeps a long note from sounding synthetic. */
export const bowed = (f, dur, depth = .0022) => t => {
  const env = Math.min(1, t / (dur * .34)) * Math.min(1, Math.max(0, (dur - t) / (dur * .3))) * (t < dur ? 1 : 0);
  const vib = 1 + depth * Math.sin(TAU * 4.7 * t) * Math.min(1, t / (dur * .5));
  const g = TAU * f * vib * t;
  return env * (Math.sin(g) + .3 * Math.sin(2 * g) + .14 * Math.sin(3 * g) + .06 * Math.sin(4 * g)) * .5;
};

/** A round low note with no edge on it at all. */
export const sub = (f, d = 1.1) => t => {
  const attack = 1 - Math.exp(-t * 42);
  return attack * Math.exp(-t / d) * (Math.sin(TAU * f * t) + .12 * Math.sin(TAU * f * 2 * t));
};

/** Soft wooden pulse. Stands in for a kick drum without the punch in the chest. */
export const thump = (f = 62, d = .3) => t => {
  const sweep = TAU * (f * t + f * 1.4 * .03 * (1 - Math.exp(-t / .03)));
  return Math.sin(sweep) * (1 - Math.exp(-t * 320)) * Math.exp(-t / d);
};

/** Brushed air. What a gentle score has instead of a snare: a swell, not a hit. */
export const brush = (rng, dur = .3, colour = .5) => {
  let state = 0;
  return t => {
    state += (rng() * 2 - 1 - state) * colour;
    const env = Math.sin(Math.PI * Math.min(1, t / dur)) ** 2;
    return state * env;
  };
};

/** Breath: filtered noise held under a chord, so silence never sounds empty. */
export const air = (rng, dur) => {
  let state = 0;
  return t => {
    state += (rng() * 2 - 1 - state) * .07;
    return state * Math.sin(Math.PI * Math.min(1, t / dur)) ** 2 * 2.6;
  };
};
