import { parseArgs } from 'node:util';
import { start360Preview } from '../src/node/preview360.js';
import { getStory, SPHERICAL_STORY_LIST } from '../src/stories/index.js';

const { values } = parseArgs({ options: { video: { type: 'string' }, story: { type: 'string' }, port: { type: 'string', default: '5190' }, help: { type: 'boolean' } } });

/** Name whatever is being served, so the player never advertises another stage. */
function describe(story) {
  const exhibits = story.params.exhibits;
  return {
    title: `${story.title}.`, eyebrow: story.brand,
    lead: `${exhibits.length} ${exhibits.length === 1 ? 'sculpture' : 'sculptures'}. One world.`,
    exhibits: exhibits.map(exhibit => [exhibit.heading, exhibit.name.toLowerCase()]),
  };
}
const defaultVideo = story => `out/360-${story.id.replace(/^fourier-|-360$/g, '')}/${story.id}-${Number(story.duration.toFixed(2))}s.mp4`;

if (values.help) console.log(`Preview an exported 360° MP4 locally.\n  npm run 360:preview [-- --story <id> --video path/to/panorama.mp4 --port 5190]\nStages: ${SPHERICAL_STORY_LIST.map(s => s.id).join(', ')}\nDrag to look, scroll to zoom, or use the arrow keys.`);
else {
  try {
    const story = getStory(values.story ?? SPHERICAL_STORY_LIST[0].id);
    if (story.stage !== 'sphere') throw new Error(`"${story.id}" is not a 360° stage. Choose one of: ${SPHERICAL_STORY_LIST.map(s => s.id).join(', ')}.`);
    const { server, url, videoPath } = await start360Preview({ video: values.video ?? defaultVideo(story), port: Number(values.port), stage: describe(story) });
    console.log(`360° preview: ${url}\nStage: ${story.title}\nFilm: ${videoPath}\nPress Ctrl+C to stop.`);
    process.once('SIGINT', () => { server.close(); server.closeAllConnections(); });
  } catch (error) {
    console.error(error.code === 'EADDRINUSE' ? `Port ${values.port} is already in use. Choose another with --port 5191.`
      : `${error.message}\nRender the stage first, or provide --video path/to/panorama.mp4.`);
    process.exitCode = 1;
  }
}
