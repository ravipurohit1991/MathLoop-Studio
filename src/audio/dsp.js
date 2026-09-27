// Signal primitives for the sonification engine.
//
// Everything here obeys one rule, the audio version of the rule the shaders
// live under: a loop is a circle, not a line. Arrays are treated as periodic,
// smoothing wraps around the seam rather than tapering into it, and any effect
// with memory -- a delay, a reverb -- is run over several copies of the loop so
// that what you keep is the steady state, with the tail of the previous lap
// already present at the start of this one.
//
// That is what lets a generated soundtrack be repeated for ten hours without a
// click, and without the fade-to-silence-and-back that gives most "seamless"
// ambient loops away.

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep01 = (t) => { const x = clamp01(t); return x * x * (3 - 2 * x); };

/** The same small PRNG the point scenes use, so a seed means one thing here too. */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fract = (x) => x - Math.floor(x);

/**
 * The prelude's hash11, in JS.
 *
 * Rounded to 32-bit at every step on purpose: a scene that scatters raindrops
 * with this hash must scatter them to the same places for the ear as it does
 * for the eye, and double precision quietly moves them.
 */
export function hash11(p) {
  const f = Math.fround;
  let x = f(fract(f(p * 0.1031)));
  x = f(x * f(x + 33.33));
  x = f(x * f(x + x));
  return fract(x);
}

// ------------------------------------------------------------ loop-safe arrays

/** Linear interpolation at fractional position u in [0,1), wrapping at the seam. */
export function sampleLoop(arr, u) {
  const n = arr.length;
  const x = fract(u) * n;
  const i = Math.floor(x);
  const t = x - i;
  return arr[i % n] * (1 - t) + arr[(i + 1) % n] * t;
}

/** Resample a periodic array to a new length, still periodic. */
export function resampleLoop(src, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = sampleLoop(src, i / n);
  return out;
}

/**
 * Circular box blur, applied twice so the result is smooth in slope as well as
 * in value. Wrapping is the whole point: a linear smoother would pull the ends
 * toward zero and put a dip at the loop seam.
 */
export function smoothLoop(arr, radius) {
  const n = arr.length;
  if (n < 4) return Float32Array.from(arr);
  const r = Math.max(1, Math.min(Math.floor(radius), Math.floor(n / 2) - 1));
  const wrap = (i) => ((i % n) + n) % n;
  let src = Float32Array.from(arr);
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(n);
    // Running sum: the window moves by one, so this is O(n) not O(n*r).
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += src[wrap(k)];
    const width = 2 * r + 1;
    for (let i = 0; i < n; i++) {
      out[i] = sum / width;
      sum -= src[wrap(i - r)];
      sum += src[wrap(i + r + 1)];
    }
    src = out;
  }
  return src;
}

/**
 * Force a signal that nearly closes to close exactly.
 *
 * A chaotic orbit never returns to where it started, so the last stretch is
 * eased toward the first sample with a smoothstep weight. Keep the tail short:
 * everything inside it is no longer the maths, it is the join.
 */
export function closeLoop(arr, tailFraction = 0.08) {
  const n = arr.length;
  const tail = Math.max(2, Math.round(tailFraction * n));
  const head = arr[0];
  const out = Float32Array.from(arr);
  for (let i = 0; i < tail; i++) {
    const w = smoothstep01((i + 1) / tail);
    const idx = n - tail + i;
    out[idx] = lerp(out[idx], head, w);
  }
  return out;
}

/** Percentiles, used to normalise without letting one spike set the scale. */
export function percentile(arr, p) {
  const sorted = Float64Array.from(arr).sort();
  const idx = clamp((p / 100) * (sorted.length - 1), 0, sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return lerp(sorted[lo], sorted[hi], idx - lo);
}

/**
 * Map a signal into roughly [0,1] using its 2nd and 98th percentiles.
 *
 * Chaotic systems throw the occasional excursion far outside their usual range.
 * Normalising by min and max would squash the other 99% of the signal into a
 * sliver and the sound would go flat.
 *
 * Outside the range the signal is folded through a tanh rather than clipped.
 * Clipping would be the obvious thing and it is wrong here: the biggest
 * excursions are exactly the ones that become events, and a clipped peak is a
 * plateau with no maximum in it at all. The knee keeps the ordering -- a bigger
 * excursion stays a bigger excursion -- while bounding the result near [-0.25,
 * 1.25], which every consumer downstream is happy with.
 */
export function robustNorm(arr) {
  const lo = percentile(arr, 2);
  const hi = percentile(arr, 98);
  const span = hi - lo || 1e-12;
  const knee = 0.25;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const v = (arr[i] - lo) / span;
    out[i] = v > 1 ? 1 + knee * Math.tanh((v - 1) / knee)
      : v < 0 ? knee * Math.tanh(v / knee)
        : v;
  }
  return out;
}

/**
 * Local maxima of a periodic signal, as sample indices.
 *
 * Strict on both sides. Accepting `>=` would report the first sample of every
 * flat stretch as a peak, and the tail of a closed loop is very nearly flat --
 * which is how you end up with a phantom event sitting exactly on the seam.
 */
export function peaksLoop(arr, minGap = 0) {
  const n = arr.length;
  const found = [];
  let last = -Infinity;
  for (let i = 0; i < n; i++) {
    const prev = arr[(i - 1 + n) % n];
    const next = arr[(i + 1) % n];
    if (arr[i] > prev && arr[i] > next && i - last >= minGap) {
      found.push(i);
      last = i;
    }
  }
  // The gap test above cannot see across the wrap, so the first and last peaks
  // may be the same peak counted twice.
  if (found.length > 1 && n - found[found.length - 1] + found[0] < minGap) {
    const first = found[0];
    const lastIndex = found[found.length - 1];
    if (arr[first] >= arr[lastIndex]) found.pop();
    else found.shift();
  }
  return found;
}

// ------------------------------------------------------------------- filters

/**
 * Topology-preserving state variable filter.
 *
 * Chosen over a biquad because the cutoff here is not a setting, it is a signal:
 * it follows the maths from sample to sample. A biquad's coefficients misbehave
 * when swept fast; this form stays stable.
 */
export class SVF {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.ic1 = 0;
    this.ic2 = 0;
  }

  reset() { this.ic1 = 0; this.ic2 = 0; }

  /** Returns [lowpass, bandpass, highpass] for one sample. */
  tick(input, cutoffHz, q = 0.707) {
    const fc = clamp(cutoffHz, 8, this.sr * 0.45);
    const g = Math.tan(Math.PI * fc / this.sr);
    const k = 1 / Math.max(q, 0.05);
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = input - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    return [v2, v1, input - k * v1 - v2];
  }
}

/**
 * Filter a whole buffer; cutoff may be a number or a per-sample array.
 *
 * The signal is run through twice and only the second pass is kept, so the
 * filter state at sample zero is the state the loop actually ends in rather
 * than silence.
 */
export function filterLoop(input, { sampleRate, mode = 'lowpass', cutoff, q = 0.707 }) {
  const n = input.length;
  const out = new Float32Array(n);
  const svf = new SVF(sampleRate);
  const cut = typeof cutoff === 'number' ? () => cutoff : (i) => cutoff[i];
  const pick = mode === 'lowpass' ? 0 : mode === 'bandpass' ? 1 : 2;
  // A fixed cutoff is the common case and worth its own loop: the coefficients
  // stop being recomputed per sample and the tick's result triple stops being
  // allocated. Same expressions in the same order, so the samples are identical.
  if (typeof cutoff === 'number') {
    const fc = clamp(cutoff, 8, sampleRate * 0.45);
    const g = Math.tan(Math.PI * fc / sampleRate);
    const k = 1 / Math.max(q, 0.05);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    let ic1 = 0, ic2 = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const x = input[i];
        const v3 = x - ic2;
        const v1 = a1 * ic1 + a2 * v3;
        const v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
        if (pass === 1) out[i] = pick === 0 ? v2 : pick === 1 ? v1 : x - k * v1 - v2;
      }
    }
    return out;
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const v = svf.tick(input[i], cut(i), q);
      if (pass === 1) out[i] = v[pick];
    }
  }
  return out;
}

// -------------------------------------------------------------------- effects

/**
 * Run an effect over several copies of the loop and keep the last one.
 *
 * For anything linear and time-invariant this converges to the periodic steady
 * state: the reverb tail you hear at second zero is the tail of the lap before,
 * exactly as it will be once the file is repeated for an hour. It is the honest
 * way to put a four-second reverb inside a twenty-second loop.
 */
export function periodicSteadyState(input, periods, process) {
  const n = input.length;
  const long = new Float32Array(n * periods);
  for (let p = 0; p < periods; p++) long.set(input, p * n);
  return process(long).slice(n * (periods - 1));
}

class Delay {
  constructor(size) {
    this.buf = new Float32Array(size);
    this.i = 0;
  }
  read(offset) {
    const n = this.buf.length;
    return this.buf[((this.i - offset) % n + n) % n];
  }
  write(v) {
    this.buf[this.i] = v;
    this.i = (this.i + 1) % this.buf.length;
  }
}

/**
 * A small feedback delay network: two allpass diffusers into four delay lines
 * mixed by a Householder matrix. Not a concert hall -- a cold, wide space, which
 * is what these pictures want.
 */
export function reverb(input, { sampleRate, decay = 0.86, damp = 4200, spread = 1 }) {
  const times = [0.0297, 0.0371, 0.0411, 0.0437]
    .map((t) => Math.max(1, Math.round(t * spread * sampleRate)));
  const apTimes = [0.0053, 0.0127].map((t) => Math.max(1, Math.round(t * sampleRate)));
  const lines = times.map((t) => new Delay(t + 2));
  const aps = apTimes.map((t) => new Delay(t + 2));
  const lp = [0, 0, 0, 0];
  const damping = Math.exp(-TAU * clamp(damp, 200, sampleRate * 0.45) / sampleRate);

  return periodicSteadyState(input, 3, (long) => {
    const out = new Float32Array(long.length);
    for (let i = 0; i < long.length; i++) {
      let v = long[i];
      for (let a = 0; a < aps.length; a++) {
        const d = aps[a].read(apTimes[a]);
        const y = d - 0.62 * v;
        aps[a].write(v + 0.62 * d);
        v = y;
      }
      const r0 = lines[0].read(times[0]);
      const r1 = lines[1].read(times[1]);
      const r2 = lines[2].read(times[2]);
      const r3 = lines[3].read(times[3]);
      // Householder: every line feeds every other, which is what stops the
      // network sounding like four separate echoes.
      const mean = (r0 + r1 + r2 + r3) * 0.5;
      const r = [r0, r1, r2, r3];
      for (let k = 0; k < 4; k++) {
        const fb = (r[k] - mean) * decay + v * 0.25;
        lp[k] = lp[k] * damping + fb * (1 - damping);
        lines[k].write(lp[k]);
      }
      out[i] = (r0 + r1 + r2 + r3) * 0.25;
    }
    return out;
  });
}

/** Fixed-time echo, wrapped the same way so its tail crosses the seam. */
export function echo(input, { sampleRate, time = 0.38, feedback = 0.35 }) {
  const d = Math.max(1, Math.round(time * sampleRate));
  return periodicSteadyState(input, 3, (long) => {
    const out = new Float32Array(long.length);
    for (let i = 0; i < long.length; i++) {
      out[i] = long[i] + (i >= d ? out[i - d] * feedback : 0);
    }
    return out;
  });
}

/** Gentle saturation. Keeps peaks in check without the pumping of a limiter. */
export function softClip(v, drive = 1) {
  return Math.tanh(v * drive) / Math.tanh(drive);
}

/** Remove any constant offset the synthesis left behind. */
export function dcBlock(arr) {
  let mean = 0;
  for (let i = 0; i < arr.length; i++) mean += arr[i];
  mean /= arr.length || 1;
  for (let i = 0; i < arr.length; i++) arr[i] -= mean;
  return arr;
}

/** Equal-power stereo placement: 0 hard left, 1 hard right, 0.5 centre. */
export function equalPower(pan) {
  const p = clamp01(pan) * Math.PI * 0.5;
  return [Math.cos(p), Math.sin(p)];
}

/** Gaussian noise of a given length, from a seeded generator. */
export function whiteNoise(rng, n) {
  const out = new Float32Array(n);
  // Box-Muller: the flat distribution of rng() sounds thinner than gaussian.
  for (let i = 0; i < n; i += 2) {
    const u = Math.max(rng(), 1e-12);
    const v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    out[i] = r * Math.cos(TAU * v);
    if (i + 1 < n) out[i + 1] = r * Math.sin(TAU * v);
  }
  return out;
}

/**
 * Turn a frequency signal into a phase signal, nudged so the loop contains a
 * whole number of cycles.
 *
 * Without this the oscillator restarts mid-cycle at the seam and every repeat
 * of the video comes with a click. The nudge is a few thousandths of a hertz:
 * nothing you can hear, everything the seam needs.
 */
export function lockedPhase(freq, sampleRate) {
  const n = freq.length;
  let total = 0;
  for (let i = 0; i < n; i++) total += freq[i];
  const cycles = total / sampleRate;
  const wanted = Math.max(1, Math.round(cycles));
  const correction = (wanted - cycles) * sampleRate / n;
  const phase = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    phase[i] = TAU * acc / sampleRate;
    acc += freq[i] + correction;
  }
  return phase;
}
