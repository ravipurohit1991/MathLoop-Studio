export const TAU = Math.PI * 2;

export function bezierPath(start, segments, samplesPerSegment = 24) {
  let previous = start;
  const points = [start];
  for (const [c1, c2, end] of segments) {
    for (let k = 1; k <= samplesPerSegment; k++) {
      const t = k / samplesPerSegment, u = 1 - t;
      points.push([0, 1].map(i => u*u*u*previous[i] + 3*u*u*t*c1[i] + 3*u*t*t*c2[i] + t*t*t*end[i]));
    }
    previous = end;
  }
  return points;
}

export const ellipsePath = (x, y, rx, ry, count = 180) => Array.from({ length: count }, (_, i) => [x + rx * Math.cos(i * TAU / count), y + ry * Math.sin(i * TAU / count)]);

export function sampleParametric(fn, { count = 640, from = 0, to = TAU, closed = true } = {}) {
  if (typeof fn !== 'function' || !Number.isInteger(count) || count < 3) throw new Error('A parametric curve needs a function and at least three samples.');
  return Array.from({ length: count }, (_, i) => {
    const p = fn(from + (to - from) * i / (closed ? count : count - 1));
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) throw new Error('A parametric curve must return finite [x, y] points.');
    return p;
  });
}

export function boundsOf(points) {
  if (!points?.length) throw new Error('Cannot measure an empty path.');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Path coordinates must be finite.');
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, center: [(minX + maxX) / 2, (minY + maxY) / 2] };
}

export const transformPoint = (p, [a, b, c, d, e, f]) => [a * p[0] + c * p[1] + e, b * p[0] + d * p[1] + f];
export const transformPath = (points, matrix) => points.map(p => transformPoint(p, matrix));
export const roseCurve = (angle, petals = 5, radius = 1) => { const r = radius * Math.cos(petals * angle); return [r * Math.cos(angle), r * Math.sin(angle)]; };
export const lissajousCurve = (angle, a = 3, b = 2, phase = Math.PI / 2) => [Math.sin(a * angle + phase), Math.sin(b * angle)];
