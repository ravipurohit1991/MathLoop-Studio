import { createStage360Story, createStage360Short, stageExhibit, stageTourHeading } from '../../story/stage360.js';
import { STAGE_REELS } from './reels.js';

/** One reel placed four times: the same jellyfish, at four sizes and depths. */
export const LANTERN_EXHIBITS = [
  stageExhibit('fourier-jellyfish-3d', { name: 'THE NEAR LANTERN', heading: 0, elevation: -4, pitch: -8, yaw: 0, scale: 1.5, distance: 950 }),
  stageExhibit('fourier-jellyfish-3d', { name: 'THE HIGH LANTERN', heading: 96, elevation: 32, pitch: -14, yaw: 40, scale: 1.05, distance: 1250 }),
  stageExhibit('fourier-nautilus-3d', { name: 'THE NAUTILUS', heading: -178, elevation: 6, pitch: -6, yaw: -22, scale: 1.35, distance: 1150, turns: 1, tint: true }),
  stageExhibit('fourier-jellyfish-3d', { name: 'THE DEEP LANTERN', heading: -84, elevation: -26, pitch: 10, yaw: -60, scale: .85, distance: 1450 }),
];

const LANTERN_THEME = { background: '#0f0b24', ink: '#f4ecff', accent: '#c9a8e8', guide: '#a99adb' };
const LANTERN_AUDIO = { score: 'paper-lanterns', bars: 10, seed: 553, transpose: 3, tempoFeel: 'drift', level: .55 };

export const fourierLanterns360Story = createStage360Story({
  id: 'fourier-lanterns-360', title: 'A drift of lanterns',
  description: 'Three jellyfish and one nautilus hang at four depths around a single viewpoint. Turn slowly; the far one is the smallest.',
  reels: STAGE_REELS, exhibits: LANTERN_EXHIBITS, brand: 'A DRIFT OF LANTERNS  /  360°',
  backdrop: ['#2a1f4c', '#1b1439', '#100b24', '#05040f'], mote: '#c8a9e8',
  chapters: [{ id: 'perform', duration: 24, title: ['A drift of lanterns'], caption: 'Four depths. One viewpoint. Drag to look around.' }],
  theme: LANTERN_THEME, audio: LANTERN_AUDIO,
});

export const fourierLanternsShortStory = createStage360Short({
  id: 'fourier-lanterns-short', title: 'Four depths. One place.',
  description: 'A portrait tour of the lantern drift, for a standard Short that points at the 360° film.',
  reels: STAGE_REELS, exhibits: LANTERN_EXHIBITS, brand: 'MATHLOOP / A DRIFT OF LANTERNS',
  sky: ['#2a1f4c', '#160f30', '#08061a'],
  chapters: [{ id: 'perform', duration: 24, title: ['Four depths.', 'One place.'], caption: 'The same bell, near and far.' }],
  theme: LANTERN_THEME, audio: LANTERN_AUDIO,
});

/** Four different sculptures, one per quarter turn, on a warm ground. */
export const OBSERVATORY_EXHIBITS = [
  stageExhibit('fourier-nautilus-3d', { name: 'THE NAUTILUS', heading: 0, elevation: -2, pitch: -8, yaw: -14, scale: 1.45, distance: 1000, tint: true }),
  stageExhibit('fourier-trefoil-3d', { name: 'THE GOLDEN KNOT', heading: 90, elevation: 14, pitch: -18, yaw: 0, scale: 1.2, distance: 1150, turns: 1, tint: true }),
  stageExhibit('fourier-whale-3d', { name: 'THE WHALE', heading: 180, elevation: -12, pitch: -22, yaw: 24, scale: 1.5, distance: 1300, tint: true }),
  stageExhibit('fourier-manta-3d', { name: 'THE MANTA', heading: -90, elevation: 26, pitch: -34, yaw: -50, scale: 1.3, distance: 1200, tint: true }),
];

const OBSERVATORY_THEME = { background: '#150f12', ink: '#fff4e2', accent: '#f0cf9a', guide: '#c8a887' };
const OBSERVATORY_AUDIO = { score: 'driftwood', bars: 12, seed: 674, transpose: -3, level: .55 };

export const fourierObservatory360Story = createStage360Story({
  id: 'fourier-observatory-360', title: 'The golden observatory',
  description: 'A shell, a knot, a whale and a manta, one at each quarter turn. Four sculptures, one set of equations.',
  reels: STAGE_REELS, exhibits: OBSERVATORY_EXHIBITS, brand: 'THE GOLDEN OBSERVATORY  /  360°',
  backdrop: ['#4a3524', '#2c1f1a', '#171015', '#08060a'], mote: '#f0cf9a',
  chapters: [{ id: 'perform', duration: 24, title: ['The golden observatory'], caption: 'A quarter turn between each one.' }],
  theme: OBSERVATORY_THEME, audio: OBSERVATORY_AUDIO,
});

export const fourierObservatoryShortStory = createStage360Short({
  id: 'fourier-observatory-short', title: 'Four sculptures. One room.',
  description: 'A portrait tour of the golden observatory, for a standard Short that points at the 360° film.',
  reels: STAGE_REELS, exhibits: OBSERVATORY_EXHIBITS, brand: 'MATHLOOP / THE GOLDEN OBSERVATORY',
  sky: ['#4a3524', '#241a16', '#0c0809'],
  chapters: [{ id: 'perform', duration: 24, title: ['Four sculptures.', 'One room.'], caption: 'Turn a quarter, and there is another.' }],
  theme: OBSERVATORY_THEME, audio: OBSERVATORY_AUDIO,
});

export const observatoryTourHeading = phase => stageTourHeading(OBSERVATORY_EXHIBITS.map(exhibit => exhibit.heading), phase);
