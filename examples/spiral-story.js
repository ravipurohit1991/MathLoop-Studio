// A new film needs only its maths and its story. Render with:
// npm run story:render -- --module ./examples/spiral-story.js
import { defineStory, chapterAt, drawDraftingBackground, drawStoryTypography, path, dot } from '../src/story/index.js';

const key = (chapter, progress, value) => ({ at: chapterAt(chapter, progress), value, ease: 'smooth' });
export default defineStory({
  id: 'spiral-story', title: 'A spiral from one rule', loop: false,
  chapters: [
    { id: 'seed', duration: 3, title: ['Start with', 'a point.'], caption: 'Choose a centre.' },
    { id: 'draw', duration: 8, title: ['Turn.', 'Move outward.'], caption: 'The radius grows with the angle.' },
    { id: 'reveal', duration: 4, title: ['One rule.', 'A spiral.'], caption: 'Every turn adds the same distance.' },
    { id: 'perform', duration: 5, title: ['Maths', 'makes art.'], caption: 'Simple instructions. A beautiful curve.' },
  ],
  tracks: { growth: [key('seed',0,0), key('draw',0,0), key('draw',1,1)] },
  render(ctx, frame) {
    drawDraftingBackground(ctx, frame.phase * 45, { theme: frame.theme });
    const turn = Math.PI * 10 * frame.values.growth;
    const point = theta => [535 + 11 * theta * Math.cos(theta), 1010 + 11 * theta * Math.sin(theta)];
    const points = Array.from({ length: 1600 }, (_, i) => point(turn * i / 1599));
    ctx.save();path(ctx,points,false);ctx.strokeStyle=frame.theme.accent;
    ctx.lineWidth=3;ctx.shadowColor=frame.theme.accent;ctx.shadowBlur=12;ctx.stroke();
    dot(ctx,...points.at(-1),5,frame.theme.ink);ctx.restore();
    drawStoryTypography(ctx,frame,{brand:'MATHS INTO ART',footer:'THE LIVING EQUATIONS',equation:'r = 11θ'});
  },
});
