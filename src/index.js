// mathloop -- mathematical art told as a film.
//
//   import { getStory, createStoryEngine, renderStoryVideo, download } from 'mathloop';
//
//   const story = getStory('fourier-monkey');
//   const engine = createStoryEngine({ canvas, story });
//   const result = await renderStoryVideo({ engine });
//   download(result.blob, 'monkey.mp4');
//
// A story owns its chapters, its typography, its score and its export settings.
// Node-side rendering lives in 'mathloop/node'.

export {
  defineStory, createStoryRuntime, createStoryEngine, auditStory, browserCanvas,
  createStoryClock, createTimeline, chapterAt, ease, EASINGS,
  createStoryProject, readStoryProject, storyProjectToJson, setStoryDuration,
  validateStoryExport, STORY_PROJECT_FORMAT, STORY_PROJECT_VERSION, STORY_EXPORT_DEFAULTS,
  createFourierStory, fourierChapters, fourierTracks, artworkFromPaths,
  renderStoryScore, renderStoryVideo, SCORE_LIBRARY, SCORE_CHOICES, SCORE_IDS, DEFAULT_SCORE, getScore,
} from './story/index.js';

export { getStory, STORIES, STORY_LIST, fourierMonkeyStory, polarRoseStory, fourierButterflyStory, fourierKoiStory, fourierDragonflyStory, fourierSeahorseStory, fourierWhaleStory, fourierMantaStory, fourierTrefoilStory, fourierJellyfishStory, fourierNautilusStory } from './stories/index.js';
export { createFourier3DStory, spatialChapters, spatialTracks, createCamera3D, stroke3D, drawMesh3D, drawEpicycles3D, loftCurves3D } from './story/index.js';
export { createFourierCurve3D, resamplePath3D, pointOnCurve3D, epicycleChain3D, auditCurves3D } from './math/fourier3d.js';
export { createShowcaseStory, createShowcaseEdit } from './story/showcase.js';
export { fourierAquarium360Story, fourierAquariumShortStory, fourierLanterns360Story, fourierLanternsShortStory, fourierObservatory360Story, fourierObservatoryShortStory,
  SPHERICAL_STORY_LIST, SHORTS_STORY_LIST, STAGE_STORIES, STAGE_STORY_LIST, STAGE_PAIRS, STAGE_REELS, STAGE_REEL_LIST } from './stories/index.js';
export { createSphericalCamera, createPanoramaViewport, sphericalPathCopies, drawSphericalMeshes, strokeSpherical } from './story/spherical.js';
export { createStage360Story, createStage360Short, createStage360World, drawStageViewport, stageExhibit, stageTourHeading, validateStageExhibits, STAGE_CONTROLS, STAGE_EXHIBIT_DEFAULTS, STAGE_SIZE } from './story/stage360.js';
export { addSphericalMp4Metadata } from './export/sphericalMp4.js';

export {
  spliceBranch, mirrorTimes, routeValues, routeSeam, pathNormalization, dominantChain, reconstruct,
} from './math/fourier.js';

export {
  renderVideo, download, downloadText, estimateBitrate,
  compatibleAvcCodecString, normalizeAvcDecoderConfigDescription, CONTAINERS,
} from './export/video.js';
export { decodeAudioFile, audioCodecForContainer, AUDIO_BITRATE } from './export/audio.js';

export { toAudioBuffer, encodeWav, wavBlob } from './audio/index.js';
