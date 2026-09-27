import { fourierMonkeyStory as monkeyConstruction } from './monkey/story.js';
import { polarRoseStory } from './polarRose.js';
import { fourierOwlStory as owlConstruction, fourierFoxStory as foxConstruction } from './woodland2d.js';
import { fourierTurtleStory as turtleConstruction, fourierLotusStory as lotusConstruction } from './spatial/garden.js';
import { fourierButterflyStory as butterflyConstruction, fourierKoiStory as koiConstruction, fourierDragonflyStory as dragonflyConstruction, fourierSeahorseStory as seahorseConstruction } from './creatures2d.js';
import { fourierWhaleStory as whaleConstruction, fourierMantaStory as mantaConstruction, fourierTrefoilStory as trefoilConstruction, fourierJellyfishStory as jellyfishConstruction, fourierNautilusStory as nautilusConstruction } from './spatial/stories.js';
import { createFourierStory, artworkFromPaths } from '../story/fourier.js';
import { createShowcaseStory } from '../story/showcase.js';
import { fourierAquarium360Story } from './spatial/aquarium360.js';
import { fourierAquariumShortStory } from './spatial/aquariumShort.js';
import { fourierLanterns360Story, fourierLanternsShortStory, fourierObservatory360Story, fourierObservatoryShortStory } from './spatial/stages.js';

export { fourierAquarium360Story, fourierAquariumShortStory, fourierLanterns360Story, fourierLanternsShortStory, fourierObservatory360Story, fourierObservatoryShortStory };
export { STAGE_REELS, STAGE_REEL_LIST } from './spatial/reels.js';
export const SPHERICAL_STORY_LIST = [fourierAquarium360Story, fourierLanterns360Story, fourierObservatory360Story];
export const SHORTS_STORY_LIST = [fourierAquariumShortStory, fourierLanternsShortStory, fourierObservatoryShortStory];
/** Every stage: the spherical films and the portrait tours that advertise them. */
export const STAGE_STORIES = Object.fromEntries([...SPHERICAL_STORY_LIST, ...SHORTS_STORY_LIST].map(story => [story.id, story]));
export const STAGE_STORY_LIST = Object.values(STAGE_STORIES);
/** Each spherical film paired with the Short that links back to it. */
export const STAGE_PAIRS = SPHERICAL_STORY_LIST.map((sphere, index) => ({ sphere, short: SHORTS_STORY_LIST[index] }));

export { polarRoseStory };
export const fourierMonkeyStory=createShowcaseStory(monkeyConstruction);
export const fourierButterflyStory=createShowcaseStory(butterflyConstruction);
export const fourierKoiStory=createShowcaseStory(koiConstruction);
export const fourierDragonflyStory=createShowcaseStory(dragonflyConstruction);
export const fourierSeahorseStory=createShowcaseStory(seahorseConstruction);
export const fourierWhaleStory=createShowcaseStory(whaleConstruction);
export const fourierMantaStory=createShowcaseStory(mantaConstruction);
export const fourierTrefoilStory=createShowcaseStory(trefoilConstruction);
export const fourierJellyfishStory=createShowcaseStory(jellyfishConstruction);
export const fourierNautilusStory=createShowcaseStory(nautilusConstruction);
export const fourierOwlStory=createShowcaseStory(owlConstruction);
export const fourierFoxStory=createShowcaseStory(foxConstruction);
export const fourierTurtleStory=createShowcaseStory(turtleConstruction);
export const fourierLotusStory=createShowcaseStory(lotusConstruction);
export const STORIES = Object.fromEntries([fourierMonkeyStory,polarRoseStory,fourierButterflyStory,fourierKoiStory,fourierDragonflyStory,fourierSeahorseStory,fourierOwlStory,fourierFoxStory,fourierWhaleStory,fourierMantaStory,fourierTrefoilStory,fourierJellyfishStory,fourierNautilusStory,fourierTurtleStory,fourierLotusStory].map(s=>[s.id,s]));
export const STORY_LIST = Object.values(STORIES);
export function getStory(id, project) {
  if(STAGE_STORIES[id]) return STAGE_STORIES[id];
  if(STORIES[id]) return project?.chapters&&!project.chapters.some(c=>c.id==='hook') ? STORIES[id].constructionStory??STORIES[id] : STORIES[id];
  if(id==='custom-fourier') {
    if(!project?.artwork?.paths) throw new Error('A custom Fourier project needs its sampled artwork paths.');
    return createFourierStory({id,title:project.title??'Your Fourier story',artwork:artworkFromPaths(project.artwork.paths,project.artwork)});
  }
  throw new Error(`Unknown story "${id}".`);
}
