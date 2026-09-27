// The Fourier machinery shared by every creature in the series: path cleaning,
// constant-distance resampling, the discrete transform, the dominant-term
// chain, and the reconstruction that becomes shader constants.
//
// Nothing here knows about owls, penguins, or shaders. `fourierDrawing.js`
// builds the studio's general-purpose lab scene on it; each production
// creature builds its own anatomy on it too.

export const TAU = Math.PI * 2;
export const DEFAULT_SAMPLES = 512;
export const DEFAULT_PATH_POINTS = 240;

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

function cleanPath(path) {
  const out = [];
  for (const point of path ?? []) {
    const x = Number(point?.[0]);
    const y = Number(point?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const next = [x, y];
    if (!out.length || dist2(out[out.length - 1], next) > 1e-12) out.push(next);
  }
  if (out.length > 2 && dist2(out[0], out[out.length - 1]) < 1e-12) out.pop();
  return out;
}

function pathLength(path, closed = false) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.sqrt(dist2(path[i - 1], path[i]));
  if (closed && path.length > 2) total += Math.sqrt(dist2(path[path.length - 1], path[0]));
  return total;
}

function rotateClosedPath(path, point) {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = dist2(path[i], point);
    if (d < bestDistance) { bestDistance = d; best = i; }
  }
  return path.slice(best).concat(path.slice(0, best));
}

/**
 * Convert one or more SVG geometry paths into one continuous signal. For the
 * stitched mode, the next path is chosen by its nearest end point. Closed
 * contours can start at whichever sampled point makes the shortest bridge.
 */
export function drawingPointsFromPaths(inputPaths, { mode = 'stitch' } = {}) {
  const candidates = (inputPaths ?? [])
    .map((entry) => ({
      points: cleanPath(entry.points ?? entry),
      closed: entry.closed ?? false,
      length: entry.length ?? pathLength(cleanPath(entry.points ?? entry), entry.closed ?? false),
    }))
    .filter((entry) => entry.points.length >= 2 && entry.length > 1e-8)
    .sort((a, b) => b.length - a.length);

  if (!candidates.length) throw new Error('No drawable lines were found in this SVG.');
  if (mode === 'longest' || candidates.length === 1) return candidates[0].points.slice();

  const remaining = candidates.slice(1);
  const combined = candidates[0].points.slice();
  while (remaining.length) {
    const cursor = combined[combined.length - 1];
    let bestIndex = 0;
    let bestPath = remaining[0].points;
    let bestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const entry = remaining[i];
      let points = entry.points;
      if (entry.closed) {
        points = rotateClosedPath(points, cursor);
        const d = dist2(cursor, points[0]);
        if (d < bestDistance) { bestDistance = d; bestIndex = i; bestPath = points; }
      } else {
        const startDistance = dist2(cursor, points[0]);
        const endDistance = dist2(cursor, points[points.length - 1]);
        const reverse = endDistance < startDistance;
        const d = reverse ? endDistance : startDistance;
        if (d < bestDistance) {
          bestDistance = d;
          bestIndex = i;
          bestPath = reverse ? points.slice().reverse() : points;
        }
      }
    }

    combined.push(...bestPath);
    remaining.splice(bestIndex, 1);
  }
  return combined;
}

/**
 * Splice one branch into a route at the place the two come closest.
 *
 * A drawing of an animal is a tree, not a cycle -- a beak meets a head, a foot
 * meets a belly -- but a Fourier series needs one closed periodic route. The
 * greedy stitcher in `drawingPointsFromPaths` solves that by bridging between
 * whole shapes, which on a creature can send the pen right across the frame.
 *
 * This joins at the junction instead. A closed branch is entered and left at
 * the same point; an open one is walked out to its far end and back the way it
 * came, so the pen retraces a line it has already drawn rather than jumping.
 * The seam it leaves is the real gap between the two shapes, usually a pixel.
 */
export function spliceBranch(route, branch, { closed = false, mirror = null } = {}) {
  if (!route?.length) throw new Error('spliceBranch needs a route to splice into.');
  const pairs = mirror ?? new Array(route.length).fill(-1);
  if (!branch?.length) return { route: route.slice(), mirror: pairs.slice(), gap: 0 };

  let at = 0;
  let from = 0;
  let best = Infinity;
  for (let i = 0; i < route.length; i++) {
    for (let j = 0; j < branch.length; j++) {
      const d = dist2(route[i], branch[j]);
      if (d < best) { best = d; at = i; from = j; }
    }
  }

  let insert;
  let insertMirror;
  if (closed) {
    insert = branch.slice(from).concat(branch.slice(0, from), [branch[from]]);
    insertMirror = new Array(insert.length).fill(-1);
  } else {
    const forward = dist2(route[at], branch[0]) <= dist2(route[at], branch[branch.length - 1]);
    const walk = forward ? branch : branch.slice().reverse();
    insert = walk.concat(walk.slice(0, -1).reverse());
    // Offset j and offset (2L - 2 - j) are the same point of the branch, seen
    // on the way out and on the way back. That pairing is exact -- it is how
    // the block was built -- so nothing downstream has to guess at it.
    const span = insert.length - 1;
    insertMirror = insert.map((_, j) => (j === span - j ? -1 : span - j));
  }

  // Everything after the junction moves along by the length of the block, and
  // any pairing already recorded there has to move with it.
  const shift = (index, boundary) => (index < 0 ? -1 : (index > boundary ? index + insert.length : index));
  const head = pairs.slice(0, at + 1).map((m) => shift(m, at));
  const tail = pairs.slice(at).map((m) => shift(m, at));
  const block = insertMirror.map((m) => (m < 0 ? -1 : m + at + 1));

  return {
    route: route.slice(0, at + 1).concat(insert, route.slice(at)),
    mirror: head.concat(block, tail),
    gap: Math.sqrt(best),
  };
}

/**
 * Turn an exact retrace pairing over route points into the loop positions a
 * shader needs: for each of `count` samples of the reconstructed outline, when
 * the pen's *other* pass through that point happens, and how sure we are that
 * there is one.
 *
 * Anything reading the route's time at a position -- a fading ink trail, above
 * all -- has to know both times, or it picks one arbitrarily per pixel and the
 * retraced strokes come out dashed. Deriving the second one by looking for the
 * nearest far-in-time point does not work: where two different strokes of the
 * drawing run alongside each other, as a penguin's two feet do, it pairs them
 * with each other and the trail tears along the join. The pairing is structural,
 * so it is carried down from the splice rather than inferred here.
 *
 * The confidence tapers to zero over `blend` of the loop at each end of a
 * retraced run, because a step in it is drawn as a hard edge across the stroke.
 */
export function mirrorTimes(route, mirror, count, { blend = 0.02 } = {}) {
  const n = route.length;
  const cumulative = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    cumulative[i + 1] = cumulative[i] + Math.sqrt(dist2(route[i], route[(i + 1) % n]));
  }
  const total = cumulative[n];
  if (!(total > 0)) throw new Error('mirrorTimes needs a route with measurable length.');

  const out = [];
  let segment = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total;
    while (segment < n - 1 && cumulative[segment + 1] < target) segment++;
    const paired = mirror[segment];
    out.push(paired >= 0 ? [cumulative[paired] / total, 1] : [0, 0]);
  }

  // Taper the ends of each run of paired samples.
  const span = Math.max(1, Math.round(blend * count));
  const faded = out.map(([t, w], i) => {
    if (!w) return [t, 0];
    let toEdge = span;
    for (let d = 1; d <= span; d++) {
      if (!out[(i - d + count) % count][1] || !out[(i + d) % count][1]) { toEdge = d - 1; break; }
    }
    return [t, Math.min(1, toEdge / span)];
  });
  return faded;
}

/**
 * Sample a per-route-point value onto `count` equal-arc-length positions of the
 * loop, then smooth it round.
 *
 * Which part of an animal a point belongs to is a fact about the route, not
 * about where the point sits. A beard and a forearm can be neighbours in the
 * plane and be nowhere near each other along the pen's path, so a mask worked
 * out from position gets it wrong in the worst possible way -- it drags the arm
 * along when the jaw opens. Membership is carried down from the contours
 * instead, exactly as the retrace pairing is, and this turns it into the
 * per-sample table a shader can read.
 *
 * `valueOf` is handed the route point itself, so identity works: the points a
 * route is built from are the very arrays the contours were built from.
 *
 * The smoothing matters as much as the table. A step in the mask is drawn as a
 * kink across the outline; blended over `blend` of the loop it is drawn as a
 * neck.
 */
export function routeValues(route, valueOf, count, { blend = 0.02 } = {}) {
  const n = route.length;
  const cumulative = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    cumulative[i + 1] = cumulative[i] + Math.sqrt(dist2(route[i], route[(i + 1) % n]));
  }
  const total = cumulative[n];
  if (!(total > 0)) throw new Error('routeValues needs a route with measurable length.');

  const raw = [];
  let segment = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total;
    while (segment < n - 1 && cumulative[segment + 1] < target) segment++;
    raw.push(Number(valueOf(route[segment], segment)) || 0);
  }

  const span = Math.max(1, Math.round(blend * count));
  return raw.map((_, i) => {
    let sum = 0;
    let weight = 0;
    for (let d = -span; d <= span; d++) {
      const w = 1 - Math.abs(d) / (span + 1);
      sum += raw[(i + d + count) % count] * w;
      weight += w;
    }
    return sum / weight;
  });
}

/** A per-sample table as a GLSL constant array of float. */
export function valuesGlsl(name, values) {
  const lines = values.map((v) => `  ${number(v)}`).join(',\n');
  return `const float ${name}[${values.length}] = float[${values.length}](\n${lines}\n);`;
}

/** The longest single step in a closed route, as a share of its total length. */
export function routeSeam(route) {
  let total = 0;
  let worst = 0;
  for (let i = 0; i < route.length; i++) {
    const step = Math.sqrt(dist2(route[i], route[(i + 1) % route.length]));
    total += step;
    worst = Math.max(worst, step);
  }
  return { total, worst, share: total > 0 ? worst / total : 0 };
}

/** Walk a point list at constant speed, in the coordinates it was authored in. */
function resampleRaw(input, count) {
  const points = cleanPath(input);
  if (points.length < 3) throw new Error('A Fourier drawing needs at least three distinct points.');

  const lengths = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const length = Math.sqrt(dist2(points[i], points[(i + 1) % points.length]));
    lengths.push(length);
    total += length;
  }
  if (total < 1e-8) throw new Error('The SVG path has no measurable length.');

  const sampleCount = Math.max(64, Math.min(1024, Math.round(count)));
  const output = [];
  let segment = 0;
  let accumulated = 0;
  for (let i = 0; i < sampleCount; i++) {
    const target = (i / sampleCount) * total;
    while (segment < lengths.length - 1 && accumulated + lengths[segment] < target) {
      accumulated += lengths[segment];
      segment++;
    }
    const a = points[segment];
    const b = points[(segment + 1) % points.length];
    const t = lengths[segment] > 1e-10 ? (target - accumulated) / lengths[segment] : 0;
    output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return output;
}

// Centre by the signal mean so the DC term is exactly zero, then normalise.
function normalisationOf(samples) {
  const centre = samples.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
  centre[0] /= samples.length;
  centre[1] /= samples.length;
  let radius = 0;
  for (const point of samples) radius = Math.max(radius, Math.abs(point[0] - centre[0]), Math.abs(point[1] - centre[1]));
  return { centre, radius };
}

/** Walk a point list at constant speed and close it into a periodic signal. */
export function resampleFourierPath(input, count = DEFAULT_SAMPLES) {
  const output = resampleRaw(input, count);
  const { centre, radius } = normalisationOf(output);
  return output.map((point) => [(point[0] - centre[0]) / radius, (point[1] - centre[1]) / radius]);
}

/**
 * The centre and scale `resampleFourierPath` applies to a path. Anatomy
 * anchors -- an eye, a bill hinge, a shoulder -- are authored in the same
 * coordinates as the outline, so they have to travel through the same map or
 * they land somewhere off the drawing.
 */
export function pathNormalization(input, count = DEFAULT_SAMPLES) {
  const { centre, radius } = normalisationOf(resampleRaw(input, count));
  const at = (point) => [
    (Number(point[0]) - centre[0]) / radius,
    (Number(point[1]) - centre[1]) / radius,
  ];
  return { centre, radius, at };
}

/** Plain complex DFT. The uploaded drawings are small enough that O(n²) is quicker than loading an FFT dependency. */
export function fourierCoefficients(samples) {
  const count = samples.length;
  const bins = [];
  for (let k = 0; k < count; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < count; n++) {
      const angle = (-TAU * k * n) / count;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      re += samples[n][0] * cos - samples[n][1] * sin;
      im += samples[n][0] * sin + samples[n][1] * cos;
    }
    bins.push({
      freq: k <= count / 2 ? k : k - count,
      re: re / count,
      im: im / count,
    });
  }
  return bins;
}

/** The `count` largest terms, ordered largest first -- the circles you see. */
export function dominantChain(samples, count) {
  return fourierCoefficients(samples)
    .filter((bin) => bin.freq !== 0)
    .map((bin) => ({
      freq: bin.freq,
      amp: Math.hypot(bin.re, bin.im),
      phase: Math.atan2(bin.im, bin.re),
    }))
    .sort((a, b) => b.amp - a.amp)
    .slice(0, count);
}

/** Walk the chain once and record where the last tip lands. */
export function reconstruct(chain, count) {
  const path = [];
  let extentX = 0;
  let extentY = 0;
  for (let i = 0; i < count; i++) {
    const t = i / count;
    let x = 0;
    let y = 0;
    for (const circle of chain) {
      const angle = TAU * circle.freq * t + circle.phase;
      x += circle.amp * Math.cos(angle);
      y += circle.amp * Math.sin(angle);
    }
    path.push([x, y]);
    extentX = Math.max(extentX, Math.abs(x));
    extentY = Math.max(extentY, Math.abs(y));
  }
  return { path, extent: [Math.max(extentX, 0.01), Math.max(extentY, 0.01)] };
}

export const number = (value) => Number(value).toFixed(6);

/** A chain as a GLSL constant array of vec3(frequency, amplitude, phase). */
export function chainGlsl(name, chain) {
  const lines = chain
    .map((circle) => `  vec3(${number(circle.freq)}, ${number(circle.amp)}, ${number(circle.phase)})`)
    .join(',\n');
  return `const vec3 ${name}[${chain.length}] = vec3[${chain.length}](\n${lines}\n);`;
}

/** A reconstructed outline as a GLSL constant array of vec2. */
export function traceGlsl(name, path) {
  const lines = path
    .map((point) => `  vec2(${number(point[0])}, ${number(point[1])})`)
    .join(',\n');
  return `const vec2 ${name}[${path.length}] = vec2[${path.length}](\n${lines}\n);`;
}

/** Stable short id for a source signal, so generated scene ids do not collide. */
export function pathHash(source) {
  return source.slice(0, 24).reduce((value, point, index) => (
    (Math.imul(value ^ Math.round((point[0] + point[1]) * 100000), 16777619) + index) >>> 0
  ), 2166136261).toString(36);
}
