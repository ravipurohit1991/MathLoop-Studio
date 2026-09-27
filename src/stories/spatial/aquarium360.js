import { createStage360Story, stageExhibit } from '../../story/stage360.js';
import { STAGE_REELS } from './reels.js';

/** The first stage: three sculptures placed a third of a turn apart. */
export const AQUARIUM_EXHIBITS = [
  stageExhibit('fourier-whale-3d', { name: 'THE WHALE', heading: 0, pitch: -9, yaw: 14, scale: 1.6 }),
  stageExhibit('fourier-manta-3d', { name: 'THE MANTA', heading: 120, pitch: -37, yaw: -46, scale: 1.4 }),
  stageExhibit('fourier-trefoil-3d', { name: 'THE GOLDEN KNOT', heading: -120, pitch: -11, yaw: 6, scale: 1.25 }),
];

export const fourierAquarium360Story = createStage360Story({
  id: 'fourier-aquarium-360', title: 'Inside a Fourier aquarium',
  description: 'Look around a complete sphere: a whale, a manta and a golden knot, all built from Fourier contours.',
  reels: STAGE_REELS, exhibits: AQUARIUM_EXHIBITS, brand: 'FOURIER AQUARIUM  /  360°',
  chapters: [{ id: 'perform', duration: 20, title: ['Inside a Fourier aquarium'], caption: 'Drag to look around.' }],
  theme: { background: '#061725', ink: '#eaf5ee', accent: '#79bbd5', guide: '#a5cfcf' },
  audio: { score: 'deep-current', bars: 8, seed: 831, transpose: -5, level: .7 },
});
