// Scores are synthesised sample by sample, which takes seconds for a minute of
// film. Doing that on the main thread would freeze the studio every time you
// tried another one, so auditions are rendered here and the finished samples
// are transferred back rather than copied.
import { renderStoryScore } from '../src/story/score.js';

self.onmessage = ({ data: { id, project, sampleRate } }) => {
  try {
    const rendered = renderStoryScore(project, { sampleRate });
    const payload = {
      id, channelData: rendered.channelData, sampleRate: rendered.sampleRate,
      length: rendered.length, numberOfChannels: rendered.numberOfChannels, stats: rendered.stats,
    };
    self.postMessage(payload, rendered.channelData.map(c => c.buffer));
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
