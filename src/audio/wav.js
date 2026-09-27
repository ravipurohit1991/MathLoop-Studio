// WAV, because a generated soundtrack should be a file you can keep.
//
// The studio mixes the sonification straight into the video, but the same
// twenty seconds are often wanted on their own: to drop under a different edit,
// to check on headphones, or to hand to an editor who does not have this repo.
// 16-bit PCM for the widest compatibility, with TPDF dither so the quietest
// parts of a Sleep render do not turn into stair-steps.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Encode interleaved 16-bit PCM.
 *
 * `channelData` is an array of Float32Arrays, one per channel, all the same
 * length -- exactly what `renderSonification` returns.
 */
export function encodeWav({ channelData, sampleRate, dither = true }) {
  const channels = channelData.length;
  const frames = channelData[0].length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataBytes = frames * blockAlign;

  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const ascii = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM header length
  view.setUint16(20, 1, true);           // format: uncompressed
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      let v = channelData[c][i];
      // Triangular dither, one LSB peak to peak: it trades an inaudible hiss
      // for the quantisation distortion that would otherwise ride on top of a
      // very quiet drone.
      if (dither) v += ((Math.random() + Math.random() - 1) / 32768);
      const s = clamp(v, -1, 1);
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

/** The same bytes as a Blob, for `download()`. */
export function wavBlob(rendered) {
  const bytes = encodeWav(rendered);
  return new Blob([bytes], { type: 'audio/wav' });
}
