import { createTimeline } from './timeline.js';
import { getScore } from './scores/library.js';

export const STORY_PROJECT_FORMAT = 'mathloop-story';
export const STORY_PROJECT_VERSION = 1;
export const STORY_EXPORT_DEFAULTS = Object.freeze({ width: 1080, height: 1920, fps: 60, samples: 2, shutter: .32, crf: 14, preset: 'slow' });

export function validateStoryExport(settings) {
  const out = { ...STORY_EXPORT_DEFAULTS, ...settings };
  for (const key of ['width', 'height']) if (!Number.isInteger(out[key]) || out[key] < 2 || out[key] > 16384 || out[key] % 2) throw new Error(`${key} must be an even integer between 2 and 16384.`);
  if (!Number.isInteger(out.fps) || out.fps < 1 || out.fps > 120) throw new Error('FPS must be an integer between 1 and 120.');
  if (!Number.isInteger(out.samples) || out.samples < 1 || out.samples > 64) throw new Error('Samples must be an integer between 1 and 64.');
  if (!Number.isFinite(out.shutter) || out.shutter < 0 || out.shutter > 1) throw new Error('Shutter must be between 0 and 1.');
  if (!Number.isFinite(out.crf) || out.crf < 0 || out.crf > 51) throw new Error('CRF must be between 0 and 51.');
  if (!['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'].includes(out.preset)) throw new Error('Unknown encoder preset.');
  return out;
}

function jsonData(value) {
  const visit = (v, depth = 0) => {
    if (depth > 32) throw new Error('Story project nesting is too deep.');
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if (Array.isArray(v)) { v.forEach(x => visit(x, depth + 1)); return; }
    if (v && Object.getPrototypeOf(v) === Object.prototype) {
      for (const [key, val] of Object.entries(v)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`Invalid project key "${key}".`);
        visit(val, depth + 1);
      }
      return;
    }
    throw new Error('Story projects must contain JSON data with finite numbers.');
  };
  visit(value);
  return structuredClone(value);
}

export function createStoryProject(story, overrides = {}) {
  if (!story?.id || !story.chapters) throw new Error('A story project needs a story definition.');
  const project = {
    format: STORY_PROJECT_FORMAT, version: STORY_PROJECT_VERSION, story: story.id,
    title: overrides.title ?? story.title, loop: overrides.loop ?? story.loop ?? true,
    chapters: overrides.chapters ?? story.chapters,
    tracks: overrides.tracks ?? story.tracks ?? {},
    theme: { ...story.theme, ...overrides.theme },
    params: { ...story.params, ...overrides.params },
    audio: { enabled: true, ...story.audio, ...overrides.audio },
    export: validateStoryExport({ ...story.export, ...overrides.export }),
    seed: overrides.seed ?? story.seed ?? 0,
    ...(overrides.artwork ? { artwork: overrides.artwork } : {}),
  };
  if (typeof project.title !== 'string' || !project.title.trim()) throw new Error('The story title cannot be empty.');
  if (typeof project.loop !== 'boolean' || typeof project.audio.enabled !== 'boolean') throw new Error('Loop and audio enabled must be boolean values.');
  if (!Number.isInteger(project.seed)) throw new Error('The story seed must be an integer.');
  for (const [name, value] of Object.entries(project.theme)) if (typeof value !== 'string') throw new Error(`Theme value "${name}" must be a string.`);
  const clean = jsonData(project);
  if(story.projection==='equirectangular'&&clean.export.width!==clean.export.height*2)throw new Error('360° export requires a 2:1 panorama (for example 3840 × 1920).');
  story.validateParams?.(clean.params);
  const timeline = createTimeline(clean);
  for (const name of story.requiredTracks ?? []) if (!Object.hasOwn(clean.tracks, name)) throw new Error(`This story requires the "${name}" animation track.`);
  if (clean.audio.bars !== undefined && (!Number.isInteger(clean.audio.bars) || clean.audio.bars < 1 || clean.audio.bars > 512)) throw new Error('Score bars must be an integer from 1 to 512.');
  if (clean.audio.seed !== undefined && !Number.isInteger(clean.audio.seed)) throw new Error('Audio seed must be an integer.');
  if (clean.audio.transpose !== undefined && (!Number.isInteger(clean.audio.transpose) || Math.abs(clean.audio.transpose)>24)) throw new Error('Score transpose must be an integer from -24 to 24.');
  if (clean.audio.tempoFeel !== undefined && !['drift','pulse'].includes(clean.audio.tempoFeel)) throw new Error('Score feel must be drift or pulse.');
  if (clean.audio.score !== undefined) getScore(clean.audio.score);
  if (clean.audio.level !== undefined && (!Number.isFinite(clean.audio.level) || clean.audio.level < 0 || clean.audio.level > 1)) throw new Error('Score level must be between 0 and 1.');
  if (clean.audio.transitions !== undefined) {
    if (!Array.isArray(clean.audio.transitions)) throw new Error('Audio transitions must be a list of chapter IDs.');
    clean.audio.transitions.forEach(chapter => timeline.anchor({ chapter }));
  }
  if (clean.audio.greeting !== undefined) timeline.anchor({ chapter: clean.audio.greeting });
  return clean;
}

export function readStoryProject(input, { resolveStory } = {}) {
  const raw = typeof input === 'string' ? JSON.parse(input) : jsonData(input);
  if (raw.format !== STORY_PROJECT_FORMAT) throw new Error('This is not a mathloop story project.');
  if (raw.version !== STORY_PROJECT_VERSION) throw new Error(`Unsupported story version ${raw.version}; expected ${STORY_PROJECT_VERSION}.`);
  if (typeof resolveStory !== 'function') throw new Error('Provide resolveStory to load a saved story.');
  const story = resolveStory(raw.story, raw);
  return { story, project: createStoryProject(story, raw) };
}

export const storyProjectToJson = project => JSON.stringify(jsonData(project), null, 2) + '\n';

/** Scale chapters together without breaking references to their boundaries. */
export function setStoryDuration(project, duration) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Story duration must be positive.');
  const old = project.chapters.reduce((sum, chapter) => sum + chapter.duration, 0);
  const ratio = duration / old;
  const scaleAnchor = at => typeof at === 'number' ? at * ratio : { ...at, ...(at.offset !== undefined ? { offset: at.offset * ratio } : {}) };
  const tracks = Object.fromEntries(Object.entries(project.tracks).map(([name, keys]) => [name, keys.map(key => Array.isArray(key) ? [scaleAnchor(key[0]), ...key.slice(1)] : { ...key, at: scaleAnchor(key.at) })]));
  const audio = { ...project.audio, ...(project.audio.bars ? { bars: Math.max(1, Math.round(project.audio.bars * ratio)) } : {}) };
  return { ...project, tracks, audio, chapters: project.chapters.map(chapter => ({ ...chapter, duration: chapter.duration * ratio })) };
}
