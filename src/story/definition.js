import { createTimeline } from './timeline.js';
import { createStoryProject } from './project.js';

export function defineStory(definition) {
  if (!/^[A-Za-z][\w/-]*$/.test(definition?.id ?? '')) throw new Error('A story needs a stable identifier.');
  if (typeof definition.render !== 'function' && typeof definition.createRenderer !== 'function') throw new Error('A story needs render(ctx, frame) or createRenderer(context).');
  const story = {
    ...definition,
    title: definition.title ?? definition.id,
    description: definition.description ?? '', kind: definition.kind ?? 'canvas', dimension: definition.dimension ?? '2d',
    loop: definition.loop ?? true,
    size: definition.size ?? { width: 1080, height: 1920 },
    chapters: structuredClone(definition.chapters), tracks: structuredClone(definition.tracks ?? {}),
    theme: { background: '#0c1923', ink: '#f4eee0', accent: '#eab182', guide: '#93c7be', ...definition.theme },
    params: { ...definition.params }, audio: { ...definition.audio },
    export: { ...definition.export },
  };
  if (![story.size.width, story.size.height].every(v => Number.isFinite(v) && v > 0)) throw new Error('Story design dimensions must be positive.');
  story.timeline = createTimeline(story);
  story.duration = story.timeline.duration;
  createStoryProject(story);
  return Object.freeze(story);
}

export function createStoryRuntime(story, project, environment = {}) {
  const resolved = createStoryProject(story, project);
  const timeline = createTimeline(resolved);
  const context = { story, project: resolved, timeline, theme: resolved.theme, params: resolved.params, ...environment };
  const renderer = story.createRenderer?.(context) ?? { draw: (ctx, frame) => story.render(ctx, frame, context) };
  if (!renderer || typeof renderer.draw !== 'function') throw new Error(`Story "${story.id}" did not create a renderer.`);
  return {
    ...context,
    frame(seconds, options) { return { ...timeline.at(seconds, options), theme: resolved.theme, params: resolved.params, seed: resolved.seed, project: resolved }; },
    draw: renderer.draw.bind(renderer), dispose: () => renderer.dispose?.(),
  };
}
