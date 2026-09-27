// Google Spherical Video V2, with matching V1 metadata for older players, and
// Google Spatial Audio (SA3D) for ambisonic soundtracks.
// https://github.com/google/spatial-media/blob/master/docs/spherical-video-v2-rfc.md
// https://github.com/google/spatial-media/blob/master/docs/spatial-audio-rfc.md
const utf8 = new TextEncoder();
const ascii = new TextDecoder();
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const join = parts => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};
function box(type, ...parts) {
  const payload = join(parts), result = new Uint8Array(payload.length + 8);
  if (result.length > 0xffffffff) throw new Error('MP4 metadata box exceeds 32-bit size.');
  view(result).setUint32(0, result.length); result.set(utf8.encode(type), 4); result.set(payload, 8); return result;
}
function boxes(bytes, start = 0, end = bytes.length) {
  const result = [];
  for (let offset = start; offset < end;) {
    if (end - offset < 8) throw new Error('Truncated MP4 box.');
    let size = view(bytes).getUint32(offset), header = 8;
    const type = ascii.decode(bytes.subarray(offset + 4, offset + 8));
    if (size === 1) { if (end - offset < 16) throw new Error('Truncated extended MP4 box.'); size = Number(view(bytes).getBigUint64(offset + 8)); header = 16; }
    if (size === 0) size = end - offset;
    if (!Number.isSafeInteger(size) || size < header || offset + size > end) throw new Error('Invalid MP4 box size.');
    result.push({ type, start: offset, end: offset + size, data: offset + header }); offset += size;
  }
  return result;
}
const uuid = Uint8Array.from([0xff, 0xcc, 0x82, 0x63, 0xf8, 0x55, 0x4a, 0x93, 0x88, 0x14, 0x58, 0x7a, 0x02, 0x52, 0x1f, 0xdd]);
function sphericalBoxes(width, height) {
  const st3d = box('st3d', new Uint8Array(5)); // FullBox version/flags + mono (0).
  const sv3d = box('sv3d', box('svhd', new Uint8Array(4), utf8.encode('mathloop\0')),
    box('proj', box('prhd', new Uint8Array(16)), box('equi', new Uint8Array(20))));
  const fields = { Spherical: 'true', Stitched: 'true', StitchingSoftware: 'mathloop', ProjectionType: 'equirectangular', StereoMode: 'mono',
    FullPanoWidthPixels: width, FullPanoHeightPixels: height, CroppedAreaImageWidthPixels: width, CroppedAreaImageHeightPixels: height,
    CroppedAreaLeftPixels: 0, CroppedAreaTopPixels: 0, InitialViewHeadingDegrees: 0, InitialViewPitchDegrees: 0, InitialViewRollDegrees: 0 };
  const xml = '<rdf:SphericalVideo xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:GSpherical="http://ns.google.com/videos/1.0/spherical/">'
    + Object.entries(fields).map(([key, value]) => `<GSpherical:${key}>${value}</GSpherical:${key}>`).join('') + '</rdf:SphericalVideo>';
  return { st3d, sv3d, legacy: box('uuid', uuid, utf8.encode(xml)) };
}

// An AudioSampleEntry carries 28 bytes of its own before any child box: the six
// reserved bytes and data reference index every sample entry has, then version,
// revision, vendor, channel count, sample size, compression id, packet size and
// the 16.16 sample rate.
const AUDIO_SAMPLE_ENTRY_BODY = 28;
const AUDIO_SAMPLE_ENTRIES = ['Opus', 'mp4a', 'fLaC', 'ipcm', 'twos', 'sowt'];

/**
 * SA3D, as Google's own injector writes it: a plain box, not a FullBox, so the
 * first byte is the box's own version rather than a version/flags word. The
 * head-locked stereo flag lives in the top bit of the ambisonic type.
 */
function spatialAudioBox({ order = 1, channels = 4, headLocked = false } = {}) {
  const payload = new Uint8Array(12 + channels * 4), data = view(payload);
  data.setUint8(0, 0);                            // version
  data.setUint8(1, headLocked ? 0x80 : 0);        // periphonic, head-locked flag in the MSB
  data.setUint32(2, order);                       // ambisonic order
  data.setUint8(6, 0);                            // channel ordering: ACN
  data.setUint8(7, 0);                            // normalisation: SN3D
  data.setUint32(8, channels);                    // channel count
  for (let i = 0; i < channels; i++) data.setUint32(12 + i * 4, i); // identity channel map
  return box('SA3D', payload);
}

/** Read the declared first-order layout; four ordinary surround channels aren't AmbiX. */
export function inspectSpatialAudio(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const found = [];
  function walk(start, end) {
    for (const b of boxes(bytes, start, end)) {
      if (b.type === 'SA3D') {
        const d = view(bytes), at = b.data;
        if (b.end - at !== 28 || d.getUint8(at) !== 0 || d.getUint8(at + 1) !== 0
          || d.getUint32(at + 2) !== 1 || d.getUint8(at + 6) !== 0
          || d.getUint8(at + 7) !== 0 || d.getUint32(at + 8) !== 4) {
          throw new Error('This preview supports first-order ACN/SN3D audio without head-locked stereo.');
        }
        const channelMap = [0, 1, 2, 3].map(i => d.getUint32(at + 12 + i * 4));
        if (channelMap.slice().sort().join() !== '0,1,2,3') throw new Error('Invalid ambisonic channel map.');
        found.push({ channelMap });
      } else if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(b.type)) walk(b.data, b.end);
      else if (b.type === 'stsd') walk(b.data + 8, b.end);
      else if (AUDIO_SAMPLE_ENTRIES.includes(b.type)) walk(b.data + AUDIO_SAMPLE_ENTRY_BODY, b.end);
    }
  }
  walk(0, bytes.length);
  if (found.length > 1) throw new Error('Spatial preview needs exactly one spatial audio sample entry.');
  return found[0] ?? null;
}

/** Tag an already rendered 2:1 panorama. Does not convert flat footage to 360°.
 * Rebuild only moov and relocate both video AND audio chunk offsets. Encoded
 * samples remain byte-for-byte intact. Supports ordinary, unfragmented AVC MP4.
 *
 * Pass `ambisonic` to mark the soundtrack as a first-order sound field. The
 * samples are neither inspected nor altered: this only states what they already
 * are, so they must already be W, Y, Z, X in ACN order with SN3D gains.
 */
export function addSphericalMp4Metadata(input, { ambisonic = null } = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const top = boxes(bytes), movies = top.filter(b => b.type === 'moov');
  if (movies.length !== 1 || top.some(b => b.type === 'moof')) throw new Error('360° metadata needs an unfragmented MP4 with one movie box.');
  const movie = movies[0];
  if (boxes(bytes, movie.data, movie.end).some(b => b.type === 'mvex')) throw new Error('Fragmented MP4 is not supported.');
  const spatial = ambisonic ? { order: 1, channels: 4, headLocked: false, ...(ambisonic === true ? {} : ambisonic) } : null;
  if (spatial) {
    const expected = (spatial.order + 1) ** 2;
    if (spatial.channels !== expected) throw new Error(`Order ${spatial.order} ambisonics needs ${expected} channels, not ${spatial.channels}.`);
  }
  let videoTracks = 0, audioTracks = 0, taggedAudio = 0;
  const raw = b => bytes.subarray(b.start, b.end);
  function rebuild(b, offsetDelta, context = false) {
    if (b.type === 'trak') {
      const children = boxes(bytes, b.data, b.end), media = children.find(c => c.type === 'mdia');
      const handler = media && boxes(bytes, media.data, media.end).find(c => c.type === 'hdlr');
      const kind = handler && ascii.decode(bytes.subarray(handler.data + 8, handler.data + 12));
      if (kind !== 'vide') {
        if (kind === 'soun') audioTracks++;
        const sound = kind === 'soun' && spatial ? { sa3d: spatialAudioBox(spatial) } : false;
        return box('trak', ...children.map(c => rebuild(c, offsetDelta, sound)));
      }
      videoTracks++;
      let dimensions;
      const findAvc = c => {
        if (['avc1', 'avc3'].includes(c.type)) dimensions = [view(bytes).getUint16(c.data + 24), view(bytes).getUint16(c.data + 26)];
        const skip = c.type === 'stsd' ? 8 : 0;
        if (['mdia', 'minf', 'stbl', 'stsd'].includes(c.type)) for (const child of boxes(bytes, c.data + skip, c.end)) findAvc(child);
      };
      if (media) findAvc(media);
      if (!dimensions || dimensions[0] !== dimensions[1] * 2) throw new Error('360° delivery requires a 2:1 H.264 panorama.');
      const tags = sphericalBoxes(...dimensions);
      const isLegacy = c => c.type === 'uuid' && uuid.every((value, i) => bytes[c.data + i] === value);
      return box('trak', ...children.filter(c => !isLegacy(c)).map(c => rebuild(c, offsetDelta, tags)), tags.legacy);
    }
    if (['avc1', 'avc3'].includes(b.type) && context.st3d) {
      const children = boxes(bytes, b.data + 78, b.end).filter(c => !['st3d', 'sv3d'].includes(c.type));
      const optional = children.findIndex(c => ['pasp', 'clap', 'btrt'].includes(c.type));
      const at = optional < 0 ? children.length : optional;
      return box(b.type, bytes.subarray(b.data, b.data + 78), ...children.slice(0, at).map(raw), context.st3d, context.sv3d, ...children.slice(at).map(raw));
    }
    if (AUDIO_SAMPLE_ENTRIES.includes(b.type) && context.sa3d) {
      // SA3D goes last among the sample entry's children, and any earlier one is
      // dropped, so re-tagging a file cannot leave two contradicting boxes.
      const children = boxes(bytes, b.data + AUDIO_SAMPLE_ENTRY_BODY, b.end).filter(c => c.type !== 'SA3D');
      taggedAudio++;
      return box(b.type, bytes.subarray(b.data, b.data + AUDIO_SAMPLE_ENTRY_BODY), ...children.map(raw), context.sa3d);
    }
    if (['stco', 'co64'].includes(b.type)) {
      const result = raw(b).slice(), header = b.data - b.start, data = view(result);
      const count = data.getUint32(header + 4), stride = b.type === 'stco' ? 4 : 8;
      if (header + 8 + count * stride > result.length) throw new Error('Truncated MP4 chunk table.');
      for (let i = 0; i < count; i++) {
        const at = header + 8 + i * stride, old = stride === 4 ? BigInt(data.getUint32(at)) : data.getBigUint64(at);
        const next = old >= BigInt(movie.end) ? old + BigInt(offsetDelta) : old;
        if (stride === 4) { if (next > 0xffffffffn) throw new Error('360° metadata exceeds 32-bit chunk offsets; export a smaller file.'); data.setUint32(at, Number(next)); }
        else data.setBigUint64(at, next);
      }
      return result;
    }
    if (['moov', 'mdia', 'minf', 'stbl', 'stsd'].includes(b.type)) {
      const skip = b.type === 'stsd' ? 8 : 0;
      return box(b.type, bytes.subarray(b.data, b.data + skip), ...boxes(bytes, b.data + skip, b.end).map(c => rebuild(c, offsetDelta, context)));
    }
    return raw(b);
  }
  const first = rebuild(movie, 0);
  if (videoTracks !== 1) throw new Error('360° delivery requires exactly one video track.');
  // YouTube reads one soundtrack. A second would play silently, or not at all.
  if (spatial && audioTracks !== 1) throw new Error(`Spatial audio needs exactly one audio track, found ${audioTracks}.`);
  if (spatial && taggedAudio !== 1) throw new Error('Could not find an audio sample entry to mark as ambisonic.');
  const delta = first.length - (movie.end - movie.start);
  audioTracks = 0; taggedAudio = 0; // The second pass walks the same tracks again.
  const patched = rebuild(movie, delta);
  return join([bytes.subarray(0, movie.start), patched, bytes.subarray(movie.end)]);
}
