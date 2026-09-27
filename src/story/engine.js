import { createStoryRuntime } from './definition.js';
import { validateStoryExport } from './project.js';

export function browserCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; }
  throw new Error('Supply a canvas factory outside the browser.');
}

/** Canvas stories implement the existing engine/frame-source export contract. */
export function createStoryEngine({ canvas, story, project, createCanvas = browserCanvas } = {}) {
  if (!canvas || !story) throw new Error('A story engine needs a canvas and a story.');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The story canvas is already being used by a different renderer.');
  let runtime = createStoryRuntime(story, project, { createCanvas });
  let accumulator = null, disposed = false;
  const resizeCanvas = (width, height) => {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('Canvas dimensions must be positive integers.');
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  };
  const paint = seconds => {
    if (disposed) throw new Error('This story engine has been disposed.');
    const frame = runtime.frame(seconds);
    ctx.save(); ctx.resetTransform(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = runtime.theme.background; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / story.size.width, canvas.height / story.size.height);
    ctx.translate((canvas.width - story.size.width * scale) / 2, (canvas.height - story.size.height * scale) / 2); ctx.scale(scale, scale);
    try { runtime.draw(ctx, frame); } finally { ctx.restore(); }
    return frame;
  };
  const renderAt = (seconds, options = {}) => {
    const width = options.width ?? canvas.width, height = options.height ?? canvas.height;
    const samples = options.samples ?? 1, shutter = options.shutter ?? 0, fps = options.fps ?? runtime.project.export.fps;
    if (!Number.isInteger(samples) || samples < 1 || samples > 64 || !Number.isFinite(fps) || fps <= 0 || !Number.isFinite(shutter) || shutter < 0 || shutter > 1) throw new Error('Invalid frame sampling settings.');
    resizeCanvas(width, height);
    if (samples === 1) return paint(seconds);
    if (!accumulator || accumulator.width !== width || accumulator.height !== height) accumulator = createCanvas(width, height);
    const sum = accumulator.getContext('2d'); sum.clearRect(0, 0, width, height);
    for (let sample = 0; sample < samples; sample++) {
      paint(seconds + ((sample + .5) / samples - .5) * shutter / fps);
      sum.globalAlpha = 1 / (sample + 1); sum.drawImage(canvas, 0, 0);
    }
    ctx.save(); ctx.resetTransform(); ctx.globalAlpha = 1; ctx.clearRect(0, 0, width, height); ctx.drawImage(accumulator, 0, 0); ctx.restore();
    return runtime.frame(seconds);
  };
  return {
    canvas, kind: 'story', get story() { return story; }, get project() { return runtime.project; },
    get timeline() { return runtime.timeline; }, get duration() { return runtime.timeline.duration; },
    // Frame composition can ask these questions without knowing the renderer type.
    get scene() { return { id: story.id, equations: story.equations ?? [] }; },
    get params() { return runtime.params; }, get palette() { return { stops: [{ at: 0, color: runtime.theme.background }, { at: 1, color: runtime.theme.ink }] }; },
    resizeCanvas, renderAt,
    renderPreview(options) { return renderAt(options.time ?? options.phase * runtime.timeline.duration, options); },
    renderFrameToPixels({ phase, frameSpan = 1 / (runtime.timeline.duration * runtime.project.export.fps), ...options }) {
      renderAt(phase * runtime.timeline.duration, { ...options, fps: 1 / (frameSpan * runtime.timeline.duration) });
      return new Uint8Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
    },
    setProject(next) {
      if (disposed) throw new Error('This story engine has been disposed.');
      validateStoryExport(next.export ?? runtime.project.export);
      const replacement = createStoryRuntime(story, next, { createCanvas });
      runtime.dispose(); runtime = replacement;
    },
    dispose() { if (!disposed) runtime.dispose(); accumulator = null; disposed = true; },
  };
}

export function auditStory({ engine, width = 270, height = 480, fps = 60 } = {}) {
  const canvas = engine.canvas, context = canvas.getContext('2d');
  const original = { width: canvas.width, height: canvas.height };
  const pixels = time => { engine.renderAt(time, { width, height }); return context.getImageData(0, 0, width, height).data.slice(); };
  const difference = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i += 4) for (let c = 0; c < 3; c++) sum += Math.abs(a[i + c] - b[i + c]); return sum / (a.length / 4 * 3); };
  try {
    const start = pixels(0), end = pixels(engine.duration), previous = pixels(engine.duration - 1 / fps), next = pixels(1 / fps);
    const exactBoundaryDelta = difference(start, end), wrapDelta = difference(start, previous), ordinaryDelta = difference(start, next);
    return { loop: engine.project.loop, exactBoundaryDelta, wrapDelta, ordinaryDelta, ratio: ordinaryDelta > 0 ? wrapDelta / ordinaryDelta : wrapDelta === 0 ? 1 : null };
  } finally { engine.resizeCanvas(original.width, original.height); }
}
