import { defineStory } from './definition.js';
import { contourWithTerms, createFourierContour, auditContours } from '../math/contour.js';
import { boundsOf } from '../math/geometry.js';
import { intervalProgress, wrapTime } from './timeline.js';
import { drawFourierContour, drawEpicycles, drawStoryTypography, drawDraftingBackground, path, text } from './drawing.js';

export const chapterAt = (chapter, progress = 0) => ({ chapter, progress });
const key = (chapter, progress, value, easing = 'smooth') => ({ at: chapterAt(chapter, progress), value, ease: easing });

export function fourierChapters(name = 'a creature') {
  return [
    { id: 'seed', duration: 3, title: ['Start with', 'one circle.'], caption: 'A rotating arrow traces a circle.' },
    { id: 'combine', duration: 5, title: ['Add a', 'few more.'], caption: 'Each tip carries the next circle.' },
    { id: 'contour', duration: 4, title: ['A contour', 'takes shape.'], caption: 'Together, their rotations draw a curve.' },
    { id: 'draw', duration: 12, title: ['Piece by piece,', name + '.'], caption: 'One contour at a time. Watch the tip.' },
    { id: 'reveal', duration: 2, title: ['A little', 'colour.'], caption: 'The same curves. A warmer character.' },
    { id: 'perform', duration: 6, title: [name + '.', 'Made of', 'circles.'], caption: 'A little maths. A lot of personality.' },
    { id: 'outro', duration: 3, title: ['Start with', 'one circle.'], caption: 'A rotating arrow traces a circle.' },
  ];
}

export function fourierTracks(harmonics = 64) {
  return {
    terms: [key('seed', 0, 1), key('combine', 0, 1), key('combine', .3, Math.min(3, harmonics)), key('combine', 1, Math.min(8, harmonics)), key('contour', .7, harmonics), key('outro', .15, harmonics), key('outro', .9, 1)],
    studyZoom: [key('seed', 0, 0), key('contour', .7, 0), key('contour', 1, 1), key('outro', .2, 1), key('outro', 1, 0)],
    studyOpacity: [key('seed', 0, 1), key('draw', 0, 0, 'hold'), key('outro', 0, 0), key('outro', .3, 1)],
    studyRigs: [key('seed', 0, 1), key('contour', .85, .82), key('contour', 1, 0), key('outro', 0, .82, 'hold'), key('outro', 1, 1)],
    studyLabel: [key('seed', 0, 1), key('contour', .7, 1), key('contour', .9, 0), key('outro', .5, 0), key('outro', 1, 1)],
    artOpacity: [key('seed', 0, 0), key('draw', 0, 1, 'hold'), key('outro', 0, 1), key('outro', .3, 0)],
    fill: [key('reveal', 0, 0), key('reveal', 1, 1), key('outro', 0, 1), key('outro', .3, 0)],
    life: [key('reveal', 0, 0), key('reveal', 1, 1), key('outro', 0, 1), key('outro', .3, 0)],
    motionPhase: [key('reveal', 0, 0), key('outro', 1, Math.PI * 6, 'linear')],
  };
}

/** Common construction/reveal pipeline. The artist supplies geometry and poses. */
export function createFourierStory({ artwork, parts, tracks, chapters, study = {}, signals, typography, ...definition }) {
  if (!artwork?.contours || !artwork.studyId || !artwork.contours[artwork.studyId]) throw new Error('Fourier artwork needs contours and a valid studyId.');
  const initial = artwork.contours[artwork.studyId];
  const chapterDefinitions = chapters ?? fourierChapters(artwork.name);
  const others = Object.keys(artwork.contours).filter(id => id !== artwork.studyId);
  const ids = others.length ? others : [artwork.studyId];
  const schedules = parts ?? Object.fromEntries(ids.map((id, i) => [id, [chapterAt('draw', i / ids.length), chapterAt('draw', (i + 1) / ids.length)]]));
  return defineStory({
    ...definition, kind: 'fourier', chapters: chapterDefinitions, tracks: tracks ?? fourierTracks(initial.chain.length),
    equations: ['z(t) = \\sum_k c_k e^{i2\\pi kt}'],
    artwork, parts: schedules, requiredTracks: Object.keys(tracks ?? fourierTracks(initial.chain.length)),
    audit: () => auditContours(artwork.contours),
    createRenderer(context) {
      const { timeline, project } = context;
      const ranges = Object.fromEntries(Object.entries(schedules).map(([id, range]) => [id, range.map(timeline.anchor)]));
      const placement = artwork.placement ?? { x: 540, y: 1030, scale: 1 };
      const centre = study.center ?? [535, 1010], extentTarget = study.radius ?? 290;
      const progressFor = (id, frame) => frame.values.showcase ? 1 : ranges[id] ? intervalProgress(frame.time, ...ranges[id]) : 1;
      const paintArtwork = (ctx, frame, colour) => {
        const state = { ...frame.values, ...signals?.(frame, context), t: frame.phase * (definition.referenceDuration ?? timeline.duration), fill: colour, frame, theme: frame.theme };
        const rigs=[];
        const paint = (target, contour, fill, _state, offset, id = contour.id) => {
          drawFourierContour(target, contour, { progress: progressFor(id, frame), fill, colour, ink: frame.theme.ink });
          if(frame.values.showcase&&frame.values.guideOpacity>0){
            const m=target.getTransform();rigs.push({contour,matrix:[m.a,m.b,m.c,m.d,m.e,m.f],alpha:target.globalAlpha,offset:offset??rigs.length*.137});
          }
        };
        if (artwork.draw) artwork.draw(ctx, state, paint);
        else {
          ctx.save(); ctx.translate(placement.x, placement.y); ctx.scale(placement.scale, placement.scale);
          ctx.rotate(Math.sin(frame.phase * Math.PI * 2) * .045 * (state.life ?? 0));
          for (const [id, contour] of Object.entries(artwork.contours)) paint(ctx, contour, artwork.fills?.[id] ?? frame.theme.accent, state, 0, id);
          ctx.restore();
        }
        for(const rig of rigs){ctx.save();ctx.setTransform(...rig.matrix);ctx.globalAlpha=rig.alpha;drawEpicycles(ctx,rig.contour,wrapTime(frame.phase*12+rig.offset,1),frame.values.guideOpacity,{ink:frame.theme.ink,minRadius:.7});ctx.restore();}
      };
      return {
        draw(ctx, frame) {
          const value = { ...frame.values, ...signals?.(frame, context) };
          if (artwork.background) artwork.background(ctx, frame, context);
          else drawDraftingBackground(ctx, frame.phase * 45, { theme: frame.theme });
          if (value.artOpacity > 0) {
            ctx.save(); ctx.globalAlpha *= value.artOpacity;
            if(value.showcase)paintArtwork(ctx,frame,value.fill);
            else if (value.fill < 1) paintArtwork(ctx, frame, 0);
            if (!value.showcase && value.fill > 0) {
              ctx.save(); ctx.beginPath(); ctx.rect(0, 480, 1080, 1110 * value.fill); ctx.clip(); paintArtwork(ctx, frame, 1); ctx.restore();
            }
            ctx.restore();
          }
          if (value.studyOpacity > 0) {
            ctx.save(); ctx.globalAlpha *= value.studyOpacity;
            const terms = Math.max(1, Math.min(initial.chain.length, value.terms)), contour = contourWithTerms(initial, terms);
            const zoom = value.studyZoom ?? 0;
            const extent = Math.max(...contour.points.flatMap(p => p.map((v, j) => Math.abs(v - initial.norm.centre[j]))));
            const fit = extentTarget / Math.max(.001, extent), scale = fit + (placement.scale - fit) * zoom;
            const cx = centre[0] + (placement.x + initial.norm.centre[0] * placement.scale - centre[0]) * zoom;
            const cy = centre[1] + (placement.y + initial.norm.centre[1] * placement.scale - centre[1]) * zoom;
            ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-initial.norm.centre[0], -initial.norm.centre[1]);
            path(ctx, contour.points); ctx.strokeStyle = 'rgba(247,225,187,.85)'; ctx.lineWidth = 1.4; ctx.stroke();
            drawEpicycles(ctx, contour, wrapTime(frame.phase * (study.turns ?? 12) + .18, 1), value.studyRigs, { ink: frame.theme.ink }); ctx.restore();
            ctx.globalAlpha *= value.studyLabel;
            text(ctx, String(Math.ceil(terms)).padStart(2, '0'), 535, 1410, 49, frame.theme.ink, 400, 'center');
            text(ctx, Math.ceil(terms) === 1 ? 'ROTATING CIRCLE' : 'ROTATING CIRCLES', 535, 1454, 18, frame.theme.guide, 400, 'center');
            ctx.restore();
          }
          drawStoryTypography(ctx, frame, typography);
        },
      };
    },
  });
}

/** SVG samplers hand this factory plain points, so saved projects work in Node. */
export function artworkFromPaths(paths, { name = 'a drawing', harmonics = 64 } = {}) {
  if (!Array.isArray(paths) || !paths.length || paths.length > 96) throw new Error('Use between 1 and 96 SVG contours.');
  const all = paths.flatMap(p => p.points ?? p), bounds = boundsOf(all);
  const scale = Math.min(760 / Math.max(1, bounds.width), 840 / Math.max(1, bounds.height));
  const contours = {}, fills = {};
  for (const [index, entry] of paths.entries()) {
    const id = `part${index}`, points = (entry.points ?? entry).map(p => [(p[0] - bounds.center[0]) * scale, (p[1] - bounds.center[1]) * scale]);
    const closed = entry.closed !== false, route = closed ? points : points.concat(points.slice(0, -1).reverse());
    contours[id] = createFourierContour(route, { id, harmonics });
    if (entry.fill) fills[id] = entry.fill;
  }
  const studyId = Object.keys(contours).sort((a, b) => contours[b].chain.slice(1, 6).reduce((s, e) => s + e.amp * contours[b].norm.radius, 0) - contours[a].chain.slice(1, 6).reduce((s, e) => s + e.amp * contours[a].norm.radius, 0))[0];
  return { name, contours, fills, studyId, placement: { x: 510, y: 1050, scale: 1 } };
}
