// Finished samples, handed to the browser.
//
// A story's score is composed by src/story/score.js and arrives here as plain
// arrays. This is the one place that knows about Web Audio, so Node can render
// and write a score without ever touching an AudioBuffer.

/** Wrap a rendered score in a Web Audio AudioBuffer for playback and for the encoder. */
export function toAudioBuffer(rendered) {
  const Ctor = globalThis.AudioBuffer;
  if (!Ctor) throw new Error('AudioBuffer is not available here; use the raw channelData.');
  const buffer = new Ctor({
    length: rendered.length,
    numberOfChannels: rendered.numberOfChannels,
    sampleRate: rendered.sampleRate,
  });
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    buffer.copyToChannel(rendered.channelData[c], c);
  }
  return buffer;
}
