import { createFourierStory } from '../../story/fourier.js';
import { compileChapters } from '../../story/timeline.js';
import { monkeyArtwork } from './art.js';

const chapters = [
  { id: 'seed', duration: 3.75, title: ['Start with', 'one circle.'], caption: 'A rotating arrow traces a circle.' },
  { id: 'combine', duration: 5.625, title: ['Add a', 'few more.'], caption: 'Each tip carries the next circle.' },
  { id: 'contour', duration: 7.5, title: ['A contour', 'takes shape.'], caption: 'Together, their rotations draw a curve.' },
  { id: 'drawBody', duration: 7.5, title: ['Piece by piece,', 'a monkey.'], caption: 'One contour at a time. Watch the tip.' },
  { id: 'drawLimbs', duration: 9.375, title: ['Keep the', 'circles turning.'], caption: 'Arms, legs, and one very curly tail.' },
  { id: 'reveal', duration: 1.875, title: ['A little', 'colour.'], caption: 'The same curves. A warmer character.' },
  { id: 'perform', duration: 6.375, title: ['A monkey.', 'Made of', 'circles.'], caption: 'A little maths. A lot of personality.' },
  { id: 'outro', duration: 3, title: ['Start with', 'one circle.'], caption: 'A rotating arrow traces a circle.' },
];
// Convert the approved edit into chapter-relative cues once, at authoring time.
// Saved projects contain these anchors; the renderer has no hardcoded cut times.
const reference = compileChapters(chapters);
const at = seconds => {
  const chapter = reference.find(c => seconds < c.end) ?? reference.at(-1);
  return { chapter: chapter.id, progress: (seconds - chapter.start) / chapter.duration };
};
const track = values => values.map(([seconds, value, ease = 'smooth']) => ({ at: at(seconds), value, ease }));
const parts = Object.fromEntries(Object.entries({
  body: [16.875, 18.75], head: [18.75, 20.625], earL: [20.625, 21.5625], earR: [21.5625, 22.5],
  face: [22.5, 24.375], earInnerL: [22.5, 23.4375], earInnerR: [23.4375, 24.375], belly: [24.375, 25.3125],
  leftArm: [25.3125, 27.1875], grasp: [27.1875, 28.125], rightArm: [28.125, 30], palm: [30, 30.9375],
  leftLeg: [30.9375, 32.34375], rightLeg: [32.34375, 33.75],
}).map(([id, range]) => [id, range.map(at)]));

export const fourierMonkeyStory = createFourierStory({
  id: 'fourier-monkey', title: 'From one circle to a Fourier monkey', referenceDuration: 45,
  description: 'Rotating circles become contours, a character, and a playful greeting.',
  artwork: monkeyArtwork, chapters, parts,
  tracks: {
    terms: track([[0,1],[3.75,1],[4.45,2],[5.625,2],[6.325,3],[7.5,3],[8.7,8],[9.375,8],[10.55,16],[11.25,16],[12.45,32],[13.125,32],[14.4,64],[42.5,64],[44.7,1]]),
    studyZoom: track([[0,0],[14.25,0],[16.875,1],[42.8,1],[44.8,0]]),
    studyOpacity: track([[0,1],[16.875,0,'hold'],[42,0],[43,1]]),
    studyRigFade: track([[0,1],[16.45,1],[16.875,0],[42,1,'hold']]),
    studyLabel: track([[0,1],[14.25,1],[15.6,0],[43.5,0],[44.7,1]]),
    artOpacity: track([[0,0],[16.875,1,'hold'],[42,1],[43,0]]),
    fill: track([[0,0],[33.75,0],[35.625,1],[42,1],[43,0]]),
    life: track([[0,0],[33.75,0],[34.6875,1],[41.25,1],[42.25,0]]),
    motionPhase: track([[0,0],[33.75,0],[45,Math.PI*6,'linear']]),
    wave: track([[0,0],[35.25,0],[36,1],[41,1],[42,0]]),
    faceOpacity: track([[0,0],[24.05,0],[24.6,1],[42,1],[43,0]]),
    branch: track([[0,0],[25.1,0],[27.1,1],[42,1],[43,0]]),
  },
  study: { turns: 12 },
  signals(frame, { timeline }) {
    let blink = 1;
    for (const time of [34.82, 37.6, 40.3, 42.72]) {
      // Evaluate in chapter time so a retimed greeting keeps its blinks.
      const delta = (frame.time - timeline.anchor(at(time))) / (timeline.anchor(at(time + .074)) - timeline.anchor(at(time)));
      blink *= 1 - .98 * Math.exp(-delta * delta);
    }
    return { swing: frame.values.motionPhase, blink, studyRigs: (1 - .18 * frame.values.studyZoom) * frame.values.studyRigFade };
  },
  audio: { bars: 24, seed: 73019, score: 'driftwood', transitions: ['combine', 'contour', 'drawBody', 'reveal', 'perform'], greeting: 'perform' },
});
