// Compatibility wrapper; score synthesis and chapter cues are shared by stories.
import { renderStoryScore } from '../story/score.js';
import { createStoryProject } from '../story/project.js';
import { fourierMonkeyStory } from '../stories/monkey/story.js';
// The film itself is now scored with Driftwood; this wrapper stays pinned to the
// original mallet score so anything still calling it gets the sound it expects.
export const renderMonkeyScore = (sampleRate = 48000) =>
  renderStoryScore(createStoryProject(fourierMonkeyStory, { audio: { score: 'construction' } }), { sampleRate });
