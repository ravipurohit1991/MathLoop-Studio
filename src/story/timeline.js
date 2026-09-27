// Stateless story time. Seek, preview and export all sample this same model.
export const clamp01 = value => Math.max(0, Math.min(1, value));
export const wrapTime = (time, duration) => ((time % duration) + duration) % duration;
export const EASINGS = Object.freeze({
  linear: t => t,
  smooth: t => t * t * (3 - 2 * t),
  smoother: t => t * t * t * (t * (t * 6 - 15) + 10),
  inCubic: t => t * t * t,
  outCubic: t => 1 - (1 - t) ** 3,
  inOutCubic: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  hold: t => t < 1 ? 0 : 1,
});

export function ease(name, progress) {
  const fn = EASINGS[name ?? 'linear'];
  if (!fn) throw new Error(`Unknown easing "${name}".`);
  return fn(clamp01(progress));
}

export function intervalProgress(time, start, end, easing = 'linear') {
  if (end < start) throw new Error('An interval must end after it starts.');
  return ease(easing, end === start ? (time >= end ? 1 : 0) : (time - start) / (end - start));
}

export function assertFinite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function assertValue(value, label) {
  if (typeof value === 'number') return assertFinite(value, label);
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value) && value.length && value.every(v => typeof v === 'number' && Number.isFinite(v))) return value.slice();
  throw new Error(`${label} must be a number, string, boolean, or finite numeric vector.`);
}

const parseColour = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
  ? [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)) : null;

export function interpolate(a, b, progress) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * progress;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) throw new Error('Animated vectors must have matching dimensions.');
    return a.map((v, i) => interpolate(v, b[i], progress));
  }
  const ac = parseColour(a), bc = parseColour(b);
  if (ac && bc) return '#' + ac.map((v, i) => Math.round(v + (bc[i] - v) * progress).toString(16).padStart(2, '0')).join('');
  return progress < 1 ? a : b;
}

export function compileChapters(chapters) {
  if (!Array.isArray(chapters) || !chapters.length) throw new Error('A story needs at least one chapter.');
  const ids = new Set();
  let cursor = 0;
  return Object.freeze(chapters.map((chapter, index) => {
    if (!chapter || !/^[A-Za-z][\w-]*$/.test(chapter.id ?? '') || ids.has(chapter.id)) {
      throw new Error(`Chapter ${index + 1} needs a unique identifier.`);
    }
    ids.add(chapter.id);
    const duration = assertFinite(chapter.duration, `Chapter "${chapter.id}" duration`);
    if (duration <= 0) throw new Error(`Chapter "${chapter.id}" duration must be positive.`);
    const title = chapter.title ?? [];
    if (chapter.caption !== undefined && typeof chapter.caption !== 'string') throw new Error('Chapter captions must be text.');
    if (!(typeof title === 'string' || (Array.isArray(title) && title.every(s => typeof s === 'string')))) throw new Error('Chapter titles must be text or an array of lines.');
    const out = Object.freeze({ ...chapter, title: Object.freeze(Array.isArray(title) ? title.slice() : [title]), index, start: cursor, end: cursor + duration });
    cursor += duration;
    return out;
  }));
}

/** Anchors survive chapter edits: { chapter: 'reveal', progress: .5, offset: 0 }. */
export function resolveAnchor(anchor, chapters) {
  if (typeof anchor === 'number') return assertFinite(anchor, 'Keyframe time');
  if (!anchor || typeof anchor !== 'object') throw new Error('A time must be seconds or a chapter anchor.');
  const chapter = chapters.find(c => c.id === anchor.chapter);
  if (!chapter) throw new Error(`Unknown chapter anchor "${anchor.chapter}".`);
  const progress = assertFinite(anchor.progress ?? 0, 'Anchor progress');
  const offset = assertFinite(anchor.offset ?? 0, 'Anchor offset');
  if (progress < 0 || progress > 1) throw new Error('Anchor progress must be between 0 and 1.');
  return chapter.start + chapter.duration * progress + offset;
}

export function compileTrack(keys, chapters, name = 'track') {
  if (!Array.isArray(keys) || !keys.length) throw new Error(`Track "${name}" needs keyframes.`);
  const duration = chapters.at(-1).end;
  const compiled = keys.map(entry => {
    const key = Array.isArray(entry) ? { at: entry[0], value: entry[1], ease: entry[2] } : entry;
    if (!key || !Object.hasOwn(key, 'value')) throw new Error(`Track "${name}" has a keyframe without a value.`);
    const time = resolveAnchor(key.at, chapters);
    if (time < -1e-8 || time > duration + 1e-8) throw new Error(`Track "${name}" has a keyframe outside the story.`);
    const easing = key.ease ?? 'linear';
    if (!EASINGS[easing]) throw new Error(`Unknown easing "${easing}" in "${name}".`);
    return Object.freeze({ time: Math.max(0, Math.min(duration, time)), value: assertValue(key.value, name), ease: easing });
  }).sort((a, b) => a.time - b.time);
  for (let i = 1; i < compiled.length; i++) {
    if (compiled[i].time === compiled[i - 1].time) throw new Error(`Track "${name}" has two keys at ${compiled[i].time}s.`);
    interpolate(compiled[i - 1].value, compiled[i].value, .5);
  }
  return Object.freeze(compiled);
}

export function sampleTrack(keys, time) {
  if (time <= keys[0].time) return structuredClone(keys[0].value);
  if (time >= keys.at(-1).time) return structuredClone(keys.at(-1).value);
  let lo = 0, hi = keys.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (keys[mid].time <= time) lo = mid; else hi = mid; }
  const a = keys[lo], b = keys[hi];
  return interpolate(a.value, b.value, ease(b.ease, (time - a.time) / (b.time - a.time)));
}

export function createTimeline({ chapters, tracks = {}, loop = true } = {}) {
  const compiled = compileChapters(chapters);
  const duration = compiled.at(-1).end;
  const channels = Object.fromEntries(Object.entries(tracks).map(([name, keys]) => [name, compileTrack(keys, compiled, name)]));
  const anchor = value => resolveAnchor(value, compiled);
  const at = (seconds, { wrap = loop } = {}) => {
    assertFinite(seconds, 'Story time');
    const time = wrap ? wrapTime(seconds, duration) : Math.max(0, Math.min(duration, seconds));
    const chapter = compiled.find(c => time < c.end) ?? compiled.at(-1);
    const values = Object.fromEntries(Object.entries(channels).map(([name, keys]) => [name, sampleTrack(keys, time)]));
    return {
      time, duration, phase: time / duration, chapter,
      localTime: time - chapter.start, chapterProgress: clamp01((time - chapter.start) / chapter.duration), values,
      progress: (from, to, easing) => intervalProgress(time, anchor(from), anchor(to), easing),
      since: value => time - anchor(value),
    };
  };
  return Object.freeze({ chapters: compiled, tracks: Object.freeze(channels), duration, loop: Boolean(loop), anchor, at });
}

/** Sequential title fades never place two sentences on top of one another. */
export function chapterOpacity(chapter, time, duration, fade = .2, loop = true) {
  const span = Math.min(fade, chapter.duration / 2);
  if (time < chapter.start || time >= chapter.end) return 0;
  const incoming = loop && chapter.start === 0 ? 1 : intervalProgress(time, chapter.start, chapter.start + span, 'smooth');
  const outgoing = loop && chapter.end === duration ? 1 : 1 - intervalProgress(time, chapter.end - span, chapter.end, 'smooth');
  return incoming * outgoing;
}
