import { fourierWhaleStory, fourierMantaStory, fourierTrefoilStory, fourierJellyfishStory, fourierNautilusStory } from './stories.js';

/**
 * The films that can stand inside a sphere. A reel is a 3D film's geometry and
 * palette, without its chapters: a 360° stage borrows the sculpture, not the
 * story it was built to tell.
 */
const reel = (story, label) => ({ id: story.id, title: story.title, label, description: story.description, artwork: story.artwork, theme: story.theme });

export const STAGE_REELS = Object.freeze(Object.fromEntries([
  [fourierWhaleStory, 'THE WHALE'],
  [fourierMantaStory, 'THE MANTA'],
  [fourierTrefoilStory, 'THE GOLDEN KNOT'],
  [fourierJellyfishStory, 'THE JELLYFISH'],
  [fourierNautilusStory, 'THE NAUTILUS'],
].map(([story, label]) => [story.id, reel(story, label)])));

export const STAGE_REEL_LIST = Object.freeze(Object.values(STAGE_REELS));
