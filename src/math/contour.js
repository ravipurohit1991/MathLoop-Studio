import { resampleFourierPath, pathNormalization, dominantChain, reconstruct, TAU } from './fourier.js';

/** Compile artwork once; no transform or path sampling happens per output pixel. */
export function createFourierContour(points, { harmonics = 64, samples = 512, tracePoints = 640, id } = {}) {
  if (!Number.isInteger(harmonics) || harmonics < 1 || harmonics > 512) throw new Error('Harmonics must be an integer from 1 to 512.');
  if (!Number.isInteger(tracePoints) || tracePoints < 16 || tracePoints > 8192) throw new Error('Trace points must be an integer from 16 to 8192.');
  const norm = pathNormalization(points, samples);
  const source = resampleFourierPath(points, samples);
  const chain = dominantChain(source, harmonics);
  const path = reconstruct(chain, tracePoints).path.map(p => p.map((v, i) => v * norm.radius + norm.centre[i]));
  return { id, points: path, chain, norm, source };
}

export function pointOnContour(contour, time) {
  let [x, y] = contour.norm.centre;
  for (const e of contour.chain) {
    const angle = TAU * e.freq * time + e.phase;
    x += e.amp * contour.norm.radius * Math.cos(angle);
    y += e.amp * contour.norm.radius * Math.sin(angle);
  }
  return [x, y];
}

const prefixCache = new WeakMap();
export function contourWithTerms(contour, count) {
  if (!Number.isFinite(count)) throw new Error('A harmonic count must be finite.');
  count = Math.max(0, Math.min(contour.chain.length, count));
  let prefixes = prefixCache.get(contour);
  if (!prefixes) {
    const n = contour.points.length;
    prefixes = [Array.from({ length: n }, () => contour.norm.centre.slice())];
    for (const e of contour.chain) {
      const previous = prefixes.at(-1);
      prefixes.push(previous.map((p, i) => {
        const a = TAU * e.freq * i / n + e.phase, r = e.amp * contour.norm.radius;
        return [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
      }));
    }
    prefixCache.set(contour, prefixes);
  }
  const k = Math.floor(count), fraction = count - k, chain = contour.chain.slice(0, k);
  if (k < contour.chain.length && fraction > 0) chain.push({ ...contour.chain[k], amp: contour.chain[k].amp * fraction });
  const a = prefixes[k], b = prefixes[Math.min(contour.chain.length, k + 1)];
  return { ...contour, chain, points: a.map((p, i) => p.map((v, j) => v + (b[i][j] - v) * fraction)) };
}

export function auditContours(contours, tolerance = 1e-8) {
  return Object.fromEntries(Object.entries(contours).map(([name, contour]) => {
    const a = pointOnContour(contour, 0), b = pointOnContour(contour, 1);
    const seamError = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (seamError > tolerance) throw new Error(`${name}: Fourier contour does not close (${seamError}).`);
    return [name, { harmonics: contour.chain.length, seamError, largestRadii: contour.chain.slice(0, 6).map(e => e.amp * contour.norm.radius) }];
  }));
}
