// A real vector Fourier series: r(t) = c + Σ(a cos(2πkt) + b sin(2πkt)).
// Each harmonic ellipse is exactly the sum of two counter-rotating circles
// in its own plane. Sphere cages visualize their radii, not spherical harmonics.
const TAU = Math.PI * 2;
export const add3 = (a, b) => a.map((v, i) => v + b[i]);
export const sub3 = (a, b) => a.map((v, i) => v - b[i]);
export const scale3 = (a, s) => a.map(v => v * s);
export const dot3 = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross3 = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const unit3 = a => scale3(a, 1 / (Math.hypot(...a) || 1));

export function resamplePath3D(input, count = 128, { closed = true } = {}) {
  if (!Number.isInteger(count) || count < 8 || count > 1024) throw new Error('3D samples must be an integer from 8 to 1024.');
  if (!Array.isArray(input) || input.length < 3 || input.some(p => !Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite))) throw new Error('A 3D path needs at least three finite [x, y, z] points.');
  let points = input.filter((p, i) => !i || Math.hypot(...sub3(p, input[i-1])) > 1e-10);
  if (!closed) points = points.concat(points.slice(1, -1).reverse());
  const lengths = points.map((p, i) => Math.hypot(...sub3(points[(i+1)%points.length], p)));
  const total = lengths.reduce((a, b) => a+b, 0);
  if (total < 1e-8) throw new Error('A 3D path must have measurable length.');
  let segment = 0, distance = 0;
  return Array.from({ length: count }, (_, i) => {
    const target = i * total / count;
    while (segment < points.length-1 && distance + lengths[segment] < target) distance += lengths[segment++];
    return add3(points[segment], scale3(sub3(points[(segment+1)%points.length], points[segment]), (target-distance)/(lengths[segment] || 1)));
  });
}

export function createFourierCurve3D(input, { samples = 128, harmonics = 24, tracePoints = 160, closed = true, id } = {}) {
  if (!Number.isInteger(harmonics) || harmonics < 1 || harmonics > 512) throw new Error('3D harmonics must be an integer from 1 to 512.');
  if (!Number.isInteger(tracePoints) || tracePoints < 16 || tracePoints > 8192) throw new Error('3D trace points must be an integer from 16 to 8192.');
  const source = resamplePath3D(input, samples, { closed });
  const centre = scale3(source.reduce(add3, [0, 0, 0]), 1/samples), terms = [];
  for (let k = 1; k <= Math.min(harmonics, samples/2); k++) {
    let a = [0,0,0], b = [0,0,0];
    const factor = k === samples/2 ? 1/samples : 2/samples;
    for (let n = 0; n < samples; n++) {
      const angle = TAU*k*n/samples;
      a = add3(a, scale3(source[n], factor*Math.cos(angle)));
      b = add3(b, scale3(source[n], factor*Math.sin(angle)));
    }
    terms.push({ freq:k, a, b, energy:dot3(a,a)+dot3(b,b) });
  }
  terms.sort((a,b) => b.energy-a.energy);
  const curve = { id, centre, terms, source };
  curve.points = Array.from({ length:tracePoints }, (_, i) => pointOnCurve3D(curve, i/tracePoints));
  return curve;
}

export function pointOnCurve3D(curve, time, count = curve.terms.length) {
  if (!Number.isFinite(time) || !Number.isFinite(count)) throw new Error('Fourier time and term count must be finite.');
  let point = curve.centre.slice();
  curve.terms.forEach((term, i) => {
    const weight = Math.max(0, Math.min(1, count-i)), angle = TAU*term.freq*time;
    point = add3(point, scale3(add3(scale3(term.a, Math.cos(angle)), scale3(term.b, Math.sin(angle))), weight));
  });
  return point;
}

export function epicycleChain3D(curve, time, count = curve.terms.length) {
  if (!Number.isFinite(time) || !Number.isFinite(count)) throw new Error('Fourier time and term count must be finite.');
  let centre = curve.centre.slice();
  const circles = [];
  curve.terms.forEach((term, i) => {
    const weight = Math.max(0, Math.min(1, count-i));
    if (!weight || term.energy < 1e-16) return;
    const a = scale3(term.a, weight), b = scale3(term.b, weight);
    let normal = cross3(a,b);
    if (Math.hypot(...normal) < 1e-10) {
      const direction = unit3(Math.hypot(...a) > Math.hypot(...b) ? a : b);
      normal = cross3(direction, Math.abs(direction[0]) < .8 ? [1,0,0] : [0,1,0]);
    }
    normal = unit3(normal);
    const jb = cross3(normal,b);
    for (const [vector, sign] of [[scale3(sub3(a,jb),.5),1], [scale3(add3(a,jb),.5),-1]]) {
      const radius = Math.hypot(...vector);
      if (radius < 1e-8) continue;
      const u = scale3(vector,1/radius), v = cross3(normal,u), angle = sign*TAU*term.freq*time;
      const tip = add3(centre, scale3(add3(scale3(u,Math.cos(angle)),scale3(v,Math.sin(angle))),radius));
      circles.push({ centre, tip, radius, u, v, normal, freq:sign*term.freq });
      centre = tip;
    }
  });
  return { circles, tip:centre };
}

export function auditCurves3D(curves) {
  return Object.fromEntries(Object.entries(curves).map(([id, curve]) => {
    const seamError = Math.hypot(...sub3(pointOnCurve3D(curve,0),pointOnCurve3D(curve,1)));
    const chainError = Math.hypot(...sub3(pointOnCurve3D(curve,.371),epicycleChain3D(curve,.371).tip));
    if (seamError > 1e-7 || chainError > 1e-7) throw new Error(`${id}: invalid 3D Fourier reconstruction.`);
    return [id, { harmonics:curve.terms.length, seamError, chainError }];
  }));
}
