export const NATURE_TEXTURES = {
  jungle: new URL('../../assets/nature/rainforest_trail.jpg', import.meta.url).href,
  summer: new URL('../../assets/nature/phalzer_forest_01.jpg', import.meta.url).href,
  winter: new URL('../../assets/nature/snowy_forest_path_01.jpg', import.meta.url).href,
  autumn: new URL('../../assets/nature/autumn_forest_04.jpg', import.meta.url).href,
  sky: new URL('../../assets/nature/kloofendal_48d_partly_cloudy_puresky.jpg', import.meta.url).href,
  water: new URL('../../assets/nature/secluded_beach.jpg', import.meta.url).href,
};

export const NATURE_WORLDS = [
  { id: 'seasons', title: 'A year around you', eyebrow: 'FOUR SEASONS · ONE HORIZON',
    description: 'Rain in front. Summer to your right. Snow behind you. Autumn to your left. Turn to wander through a year.',
    colours: ['#0d3630', '#d4e3ad'], image: NATURE_TEXTURES.summer,
    regions: [{ heading: 0, name: 'Rainforest', sound: 'Rain' }, { heading: 90, name: 'Summer', sound: 'Birdsong' },
      { heading: 180, name: 'Winter', sound: 'Winter wind' }, { heading: -90, name: 'Autumn', sound: 'Rustling leaves' }] },
  { id: 'jungle', title: 'Under the living canopy', eyebrow: 'AN IMMERSIVE RAINFOREST',
    description: 'A photographic forest in every direction, with drifting mist, swaying foliage and rain falling through the trees.',
    colours: ['#153b2c', '#a8d9a0'], image: NATURE_TEXTURES.jungle,
    regions: [{ heading: 0, name: 'The forest floor', sound: 'Rain' }, { heading: 90, name: 'The canopy', sound: 'Birdsong' },
      { heading: 180, name: 'The deep woods', sound: 'Insects' }, { heading: -90, name: 'The undergrowth', sound: 'Leaves' }] },
  { id: 'ocean', title: 'Where the water meets the sky', eyebrow: 'AN OPEN OCEAN · 360°',
    description: 'Stand just above the water. Long rolling waves, moving reflections, pale foam and a photographic sky surround you.',
    colours: ['#123d56', '#abdfe8'], image: NATURE_TEXTURES.water,
    regions: [{ heading: 0, name: 'Open water', sound: 'Waves' }, { heading: 90, name: 'The sunlit swell', sound: 'Sea birds' },
      { heading: 180, name: 'The far horizon', sound: 'Ocean wind' }, { heading: -90, name: 'The rolling sea', sound: 'Water' }] },
];

export function natureWorld(id) {
  const world = NATURE_WORLDS.find(world => world.id === id);
  if (!world) throw new Error(`Unknown nature world: ${id}`);
  return world;
}
