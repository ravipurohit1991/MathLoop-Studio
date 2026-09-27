// Sound made of the same maths as the picture.
//
//   import { renderStoryScore } from 'mathloop/story';
//   import { toAudioBuffer, encodeWav } from 'mathloop/audio';
//
// A story composes its own score from its chapters. These are the pieces that
// score is built from: the DSP primitives, the WAV writer, and the wrapper that
// hands finished samples to the browser and to the encoder.

export * from './dsp.js';
export { toAudioBuffer } from './render.js';
export { encodeWav, wavBlob } from './wav.js';
