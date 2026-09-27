// Compatibility entry point for the approved film. New work uses mathloop/story.
import { fourierMonkeyStory } from '../stories/monkey/story.js';
import { createStoryRuntime } from '../story/definition.js';
export const FILM = { title: fourierMonkeyStory.title, duration: 45, fps: 60, width: 1080, height: 1920 };
const runtime = createStoryRuntime(fourierMonkeyStory);
export function filmState(time) {
  const frame = runtime.frame(time), { fill, life, motionPhase } = frame.values;
  return { t: frame.time, construction: 1-fill, fill, life, trace: 0, pen: ((frame.time/3.75+.18)%1+1)%1, swing: motionPhase };
}
export function drawMonkeyFilm(ctx, time, width = 1080, height = 1920) {
  ctx.save(); ctx.scale(width/1080, height/1920);
  try { runtime.draw(ctx, runtime.frame(time)); } finally { ctx.restore(); }
}
export const validateFilmMath = () => fourierMonkeyStory.audit();
