import { createStage360Short, stageTourHeading } from '../../story/stage360.js';
import { STAGE_REELS } from './reels.js';
import { AQUARIUM_EXHIBITS } from './aquarium360.js';

export const aquariumTourHeading = phase => stageTourHeading(AQUARIUM_EXHIBITS.map(exhibit => exhibit.heading), phase);

/** Regular 9:16 video. The authored camera tour is baked into its frames. */
export const fourierAquariumShortStory = createStage360Short({
  id: 'fourier-aquarium-short', title: 'A whole world. Made of maths.',
  description: 'A portrait tour of the Fourier aquarium, for a standard YouTube Short. Viewers follow the authored camera.',
  reels: STAGE_REELS, exhibits: AQUARIUM_EXHIBITS, brand: 'MATHLOOP / FOURIER AQUARIUM',
  chapters: [{ id: 'perform', duration: 20, title: ['A whole world.', 'Made of maths.'], caption: 'Three sculptures. One continuous world.' }],
  theme: { background: '#061725', ink: '#eaf5ee', accent: '#a7ddcd', guide: '#90bfc7' },
  audio: { score: 'deep-current', bars: 8, seed: 831, transpose: -5, level: .7 },
});
