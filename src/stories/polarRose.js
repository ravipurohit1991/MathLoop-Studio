import { defineStory } from '../story/definition.js';
import { chapterAt as at } from '../story/fourier.js';
import { drawDraftingBackground, drawStoryTypography, path, dot } from '../story/drawing.js';
const TAU = Math.PI * 2;
const key = (chapter, progress, value, ease = 'smooth') => ({ at: at(chapter, progress), value, ease });

/** A second film authored with the same timeline, without Fourier reconstruction. */
export const polarRoseStory = defineStory({
  id: 'polar-rose', title: 'One equation. A living flower.',
  description: 'A circle changes its radius, grows petals, and becomes a luminous bloom.',
  params: { petals: 5, layers: 9 },
  audio: { score: 'little-clockwork' },
  theme: { background: '#171625', glow: '#423249', mid: '#242139', accent: '#eeb88d', guide: '#b3a8db' },
  chapters: [
    { id: 'seed', duration: 3, title: ['Begin with', 'a circle.'], caption: 'A constant radius. One complete turn.' },
    { id: 'modulate', duration: 5, title: ['Let the', 'radius change.'], caption: 'A cosine wave pulls the curve inward.' },
    { id: 'draw', duration: 8, title: ['A rose.', 'One equation.'], caption: 'Follow the point as the angle increases.' },
    { id: 'reveal', duration: 3, title: ['Repeat.', 'Add colour.'], caption: 'The same rose, rotated and scaled.' },
    { id: 'perform', duration: 7, title: ['Maths,', 'in bloom.'], caption: 'Small rotations bring the pattern to life.' },
    { id: 'outro', duration: 4, title: ['Begin with', 'a circle.'], caption: 'A constant radius. One complete turn.' },
  ],
  tracks: {
    modulation: [key('seed',0,0),key('modulate',0,0),key('modulate',1,1),key('outro',0,1),key('outro',.9,0)],
    trace: [key('seed',0,1),key('draw',0,0,'hold'),key('draw',1,1,'linear')],
    bloom: [key('reveal',0,0),key('reveal',1,1),key('outro',0,1),key('outro',.6,0)],
  },
  render(ctx, frame) {
    const { modulation, trace, bloom } = frame.values;
    const petals = Math.max(1, Math.min(15, Math.round(frame.params.petals)));
    const layers = Math.max(1, Math.min(20, Math.round(frame.params.layers)));
    drawDraftingBackground(ctx, frame.phase * 45, { theme: frame.theme });
    const angle = frame.phase * TAU;
    const sweep = modulation === 1 && petals % 2 === 1 ? Math.PI : TAU;
    ctx.save(); ctx.translate(535,1010);
    const point = t => { const r = 320 * (1-modulation + modulation * Math.cos(petals*t)); return [r*Math.cos(t),r*Math.sin(t)]; };
    for(let layer=layers-1;layer>=0;layer--) {
      const scale = Math.max(.08,1-layer*.065);
      ctx.save(); ctx.rotate(layer*.23*bloom + Math.sin(angle)*.16*bloom); ctx.scale(scale,scale);
      ctx.globalAlpha = layer===0?1:bloom*(.25+.5*(1-layer/layers));
      const count = Math.max(2,Math.ceil(1000*trace));
      const points = Array.from({length:count},(_,i)=>point(i*sweep*trace/(count-1)));
      path(ctx,points,false); ctx.lineWidth=layer===0?3:2;
      ctx.strokeStyle=layer%2?frame.theme.guide:frame.theme.accent;
      ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=layer===0?14:5;ctx.stroke();
      if(layer===0&&trace<1){const tip=point(trace*sweep);dot(ctx,...tip,6,frame.theme.ink);}
      ctx.restore();
    }
    ctx.restore();
    drawStoryTypography(ctx,frame,{brand:'MATHS INTO ART',footer:'THE LIVING EQUATIONS',equation:`r = ${Math.round((1-modulation)*320)} + ${Math.round(modulation*320)} cos(${petals}θ)`});
  },
});
