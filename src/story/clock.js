import { assertFinite, wrapTime } from './timeline.js';

export function createStoryClock({ duration, fps = 60, loop = true, playing = false } = {}) {
  assertFinite(duration, 'Duration'); assertFinite(fps, 'FPS');
  if (duration <= 0 || fps <= 0 || !Number.isInteger(fps)) throw new Error('Use a positive duration and integer FPS.');
  let frame = 0, last = null, remainder = 0;
  const totalFrames = () => Math.max(1, Math.round(duration * fps));
  const seekFrame = next => {
    assertFinite(next, 'Frame');
    frame = loop ? wrapTime(Math.round(next), totalFrames()) : Math.max(0, Math.min(totalFrames() - 1, Math.round(next)));
    last = null; remainder = 0;
  };
  return {
    get playing() { return playing; }, get frame() { return frame; },
    get time() { return frame / fps; }, get duration() { return duration; }, get fps() { return fps; },
    get totalFrames() { return totalFrames(); },
    play() { playing = true; last = null; }, pause() { playing = false; last = null; },
    toggle() { playing ? this.pause() : this.play(); return playing; },
    seekFrame, seek(seconds) { seekFrame(seconds * fps); }, step(delta = 1) { seekFrame(frame + delta); },
    configure(options) {
      const nextDuration = options.duration ?? duration, nextFps = options.fps ?? fps;
      if (!Number.isFinite(nextDuration) || nextDuration <= 0 || !Number.isInteger(nextFps) || nextFps < 1) throw new Error('Invalid playback settings.');
      const time = frame / fps; duration = nextDuration; fps = nextFps; loop = options.loop ?? loop; seekFrame(time * fps);
    },
    tick(now) {
      if (!playing || last === null) { last = now; return false; }
      const elapsed = Math.max(0, Math.min(.25, (now - last) / 1000)); last = now;
      remainder += elapsed * fps; const advance = Math.floor(remainder); remainder -= advance;
      if (!advance) return false;
      const next = frame + advance;
      if (!loop && next >= totalFrames() - 1) { frame = totalFrames() - 1; playing = false; }
      else frame = wrapTime(next, totalFrames());
      return true;
    },
  };
}
