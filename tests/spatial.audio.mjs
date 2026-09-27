// Does the sound field actually turn?
//
// The failure this guards against is silent in every sense: a field encoded
// with a sign flipped, or with its channels permuted by an encoder, still plays
// and still sounds like music. It is only wrong when you turn your head, and by
// then it is on YouTube.
//
// So the checks here are about direction, not about sound quality: point a
// virtual microphone at each creature in turn and confirm that the loudest
// thing in its own band is the one standing there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { foaGains, exhibitGains, createFoaBus, foaToStereo, focusGains, foaStereoMatrix } from '../src/audio/ambisonic.js';
import { renderSpatialStageScore, isolationMatrix, decodeCardioid } from '../src/story/scores/spatial.js';
import { addSphericalMp4Metadata, inspectSpatialAudio } from '../src/export/sphericalMp4.js';
import { filterLoop } from '../src/audio/dsp.js';
import { OBSERVATORY_EXHIBITS } from '../src/stories/spatial/stages.js';

/** RMS of one buffer through a band, in dB.
 *
 * The band has to be narrow. These parts differ by tens of dB in level, and a
 * gentle two-pole skirt lets a loud neighbour two octaves up leak into a quiet
 * part's band and swamp it -- which looks exactly like a mix that is not
 * directional, and is not.
 */
function bandDb(signal, sampleRate, centre, q = 6) {
  const band = filterLoop(signal, { sampleRate, mode: 'bandpass', cutoff: centre, q });
  let sum = 0;
  for (let i = 0; i < band.length; i++) sum += band[i] ** 2;
  return 20 * Math.log10(Math.max(Math.sqrt(sum / band.length), 1e-12));
}

/** A first-order cardioid aimed at one heading, which is what a listener gets. */
function aim(channels, heading, elevation = 0) {
  const [, y, z, x] = foaGains(-heading, elevation);
  const [W, Y, Z, X] = channels, n = W.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = .5 * W[i] + .5 * (Y[i] * y + Z[i] * z + X[i] * x);
  return out;
}

test('ACN/SN3D gains put each direction on the axis it belongs to', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);
  const [w, y, z, x] = foaGains(0, 0);
  near(w, 1); near(y, 0); near(z, 0); near(x, 1);          // front is +X
  near(foaGains(90, 0)[1], 1);                             // anticlockwise 90° is +Y
  near(foaGains(0, 90)[2], 1);                             // straight up is +Z
  near(foaGains(180, 0)[3], -1);                           // behind is -X
});

test('a stage heading turns the right way: heading 90 is to the viewer\'s right', () => {
  // A viewer turns right to find the exhibit at heading 90. Right is -Y, so a
  // positive heading must produce a negative Y. This is the sign that mirrors
  // the whole room when it is wrong, and nothing else catches it.
  const [, y] = exhibitGains({ heading: 90 });
  assert.ok(y < -0.99, `heading 90 should sit at -Y, got Y=${y}`);
  assert.ok(exhibitGains({ heading: -90 })[1] > 0.99, 'heading -90 should sit at +Y');
  assert.ok(exhibitGains({ heading: 0, elevation: 45 })[2] > 0, 'positive elevation should be above the horizon');
});

test('a source encoded at a heading is loudest when you look at it', () => {
  const sampleRate = 48000, n = sampleRate;
  const bus = createFoaBus(n);
  const gains = foaGains(-90); // one source, at heading 90
  for (let i = 0; i < n; i++) bus.add(i, Math.sin(2 * Math.PI * 440 * i / sampleRate), gains);
  const facing = aim(bus.channels, 90), away = aim(bus.channels, -90);
  const rms = s => Math.sqrt(s.reduce((sum, v) => sum + v * v, 0) / s.length);
  assert.ok(rms(facing) > rms(away) * 10, 'facing a source should be much louder than facing away');
});

test('whichever way you look, the creature you face is the loudest thing there', () => {
  // The check that matters, and the one an earlier draft of this file missed by
  // measuring each part through a narrow filter tuned to its own register. That
  // flatters the mix enormously: it hides a part mixed 8 dB hot, and it hides a
  // bed that is identical in every direction. This measures whole signals.
  const score = renderSpatialStageScore(OBSERVATORY_EXHIBITS, { duration: 12, sampleRate: 24000 });
  const { matrix } = score.stats.isolation;
  matrix.forEach((row, i) => {
    const facing = row[i];
    row.forEach((value, j) => {
      if (i === j) return;
      assert.ok(facing > value + 5,
        `facing part ${i}, part ${j} should be at least 5 dB down (facing ${facing}, other ${value})`);
    });
  });
});

test('nothing in the mix is the same in every direction', () => {
  // A part that does not move is a part written to W alone, and a mix with one
  // in it stops being a sound field however good the metadata is.
  const score = renderSpatialStageScore(OBSERVATORY_EXHIBITS, { duration: 8, sampleRate: 24000 });
  for (const [i, stem] of score.stems.entries()) {
    const here = stem.channels;
    let directional = 0, omni = 0;
    for (let k = 0; k < here[0].length; k++) {
      omni += here[0][k] ** 2;
      directional += here[1][k] ** 2 + here[2][k] ** 2 + here[3][k] ** 2;
    }
    assert.ok(directional > omni * .5,
      `part ${i} carries too little direction: ${Math.sqrt(directional).toFixed(3)} against ${Math.sqrt(omni).toFixed(3)} omni`);
  }
});

test('the parts are level-matched, so none is audible from everywhere', () => {
  const score = renderSpatialStageScore(OBSERVATORY_EXHIBITS, { duration: 12, sampleRate: 24000 });
  const levels = score.stems.map(s => {
    let sum = 0;
    for (const v of s.channels[0]) sum += v * v;
    return 20 * Math.log10(Math.sqrt(sum / s.channels[0].length) + 1e-12);
  });
  const spread = Math.max(...levels) - Math.min(...levels);
  assert.ok(spread < 1, `parts should be within 1 dB of each other, spread was ${spread.toFixed(1)} dB`);
});

test('each creature is loudest in its own band when you turn to face it', async () => {
  const score = renderSpatialStageScore(OBSERVATORY_EXHIBITS, { duration: 12, sampleRate: 24000 });
  const sampleRate = score.sampleRate;
  assert.equal(score.numberOfChannels, 4);

  // The three parts written in cleanly separated registers. The manta is left
  // out on purpose: it is breath and a pad, and shares a register with the
  // thumb piano, so a band test cannot tell them apart. That is a limit of the
  // test, not of the mix.
  const probes = [
    { name: 'THE NAUTILUS', heading: 0, centre: 260 },
    { name: 'THE GOLDEN KNOT', heading: 90, centre: 900 },
    { name: 'THE WHALE', heading: 180, centre: 90 },
  ];

  for (const probe of probes) {
    const facing = bandDb(aim(score.channelData, probe.heading), sampleRate, probe.centre);
    const away = bandDb(aim(score.channelData, probe.heading + 180), sampleRate, probe.centre);
    assert.ok(facing > away + 3,
      `${probe.name}: facing it should be at least 3 dB louder in its band (facing ${facing.toFixed(1)} dB, away ${away.toFixed(1)} dB)`);
  }
});

test('the soft ceiling does not drag sources towards the middle of the room', () => {
  // A per-channel limiter bends W, Y, Z and X by different amounts on the same
  // sample, which is a slow leak of direction that no listening test catches.
  // Drive the field hard and confirm the placement survives it.
  const sampleRate = 24000, n = sampleRate;
  const bus = createFoaBus(n);
  const gains = foaGains(-90);
  for (let i = 0; i < n; i++) bus.add(i, 3 * Math.sin(2 * Math.PI * 220 * i / sampleRate), gains);
  const before = ratio(bus.channels);
  const scored = renderSpatialStageScore([{ name: 'loud', heading: 90, elevation: 0 }],
    { duration: 2, sampleRate, bed: 0, level: 1, targetDb: -3, ceiling: .2 });
  const after = ratio(scored.channelData);
  assert.ok(Math.abs(after - before) < .05,
    `the Y:W ratio should survive limiting (was ${before.toFixed(3)}, now ${after.toFixed(3)})`);

  function ratio(channels) {
    let w = 0, y = 0;
    for (let i = 0; i < channels[0].length; i++) { w += channels[0][i] ** 2; y += channels[1][i] ** 2; }
    return Math.sqrt(y) / Math.sqrt(w);
  }
});

test('the field is levelled, gentle, and closes on itself', () => {
  const score = renderSpatialStageScore(OBSERVATORY_EXHIBITS, { duration: 12, sampleRate: 24000 });
  assert.ok(score.stats.peakDb < -6, `a gentle score should leave headroom, got ${score.stats.peakDb.toFixed(1)} dBFS`);
  for (const seam of score.stats.seam) assert.ok(seam < .02, `loop seam ${seam} is audible`);
  // Turning your head must not change how loud the film is, only what it is.
  const levels = [0, 90, 180, -90].map(h => {
    const s = aim(score.channelData, h);
    return 20 * Math.log10(Math.sqrt(s.reduce((sum, v) => sum + v * v, 0) / s.length));
  });
  const spread = Math.max(...levels) - Math.min(...levels);
  assert.ok(spread < 6, `overall level should not lurch as you turn, spread was ${spread.toFixed(1)} dB`);
});

test('stereo fold-down follows the yaw', () => {
  const sampleRate = 24000, n = sampleRate;
  const bus = createFoaBus(n);
  for (let i = 0; i < n; i++) bus.add(i, Math.sin(2 * Math.PI * 300 * i / sampleRate), foaGains(-90));
  const rms = s => Math.sqrt(s.reduce((sum, v) => sum + v * v, 0) / s.length);
  // Looking straight ahead, a source on the right should favour the right ear.
  const [l, r] = foaToStereo(bus.channels, { yaw: 0 });
  assert.ok(rms(r) > rms(l), 'a source at heading 90 should be louder on the right');
  // Turn to face it and the two even up.
  const [l2, r2] = foaToStereo(bus.channels, { yaw: 90 });
  assert.ok(Math.abs(20 * Math.log10(rms(r2) / rms(l2))) < 1, 'facing a source should centre it');
});

test('SA3D marks the soundtrack without disturbing the spherical video tags', () => {
  const tagged = addSphericalMp4Metadata(minimalMp4(), { ambisonic: true });
  const text = Buffer.from(tagged).toString('latin1');
  assert.ok(text.includes('SA3D'), 'SA3D should be written');
  assert.ok(text.includes('st3d') && text.includes('sv3d'), 'the video tags should survive');

  const at = text.indexOf('SA3D');
  const body = Buffer.from(tagged.subarray(at + 4, at + 32));
  assert.equal(body.readUInt8(0), 0, 'version');
  assert.equal(body.readUInt8(1), 0, 'periphonic, not head-locked');
  assert.equal(body.readUInt32BE(2), 1, 'first order');
  assert.equal(body.readUInt8(6), 0, 'ACN ordering');
  assert.equal(body.readUInt8(7), 0, 'SN3D normalisation');
  assert.equal(body.readUInt32BE(8), 4, 'four channels');
  for (let i = 0; i < 4; i++) assert.equal(body.readUInt32BE(12 + i * 4), i, `channel map ${i}`);
  assert.deepEqual(inspectSpatialAudio(tagged), { channelMap: [0, 1, 2, 3] });
  assert.equal(inspectSpatialAudio(minimalMp4()), null);

  // Tagging twice must not leave two boxes contradicting each other.
  const again = Buffer.from(addSphericalMp4Metadata(tagged, { ambisonic: true })).toString('latin1');
  assert.equal(again.split('SA3D').length - 1, 1, 'SA3D should not be duplicated');
  // And the untagged path must stay exactly as it was.
  assert.ok(!Buffer.from(addSphericalMp4Metadata(minimalMp4())).toString('latin1').includes('SA3D'));
});

test('focus isolates independent sounds at quarter turns and crosses the back seam smoothly', () => {
  const placements = [0, 90, 180, -90].map(heading => ({ heading }));
  for (let i = 0; i < placements.length; i++) {
    assert.deepEqual(focusGains(placements, { yaw: placements[i].heading }), placements.map((_, j) => i === j ? 1 : 0));
  }
  const boundary = focusGains(placements, { yaw: 45 });
  assert.ok(Math.abs(boundary[0] - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(boundary[1] - Math.SQRT1_2) < 1e-9);
  assert.equal(boundary[2], 0); assert.equal(boundary[3], 0);
  const a = focusGains(placements, { yaw: 179.99 }), b = focusGains(placements, { yaw: -180.01 });
  a.forEach((gain, i) => assert.ok(Math.abs(gain - b[i]) < 1e-10));
  assert.deepEqual(focusGains(placements, { pitch: 90 }), [0, 0, 0, 0]);
  assert.deepEqual(focusGains([{ heading: 0, elevation: 90 }], { pitch: 90 }), [1]);
});

test('pitched stereo microphones keep their angular separation', () => {
  const [left, right] = foaStereoMatrix({ yaw: 0, pitch: 90, width: 90, pattern: 1 });
  assert.ok(left[1] > .7 && right[1] < -.7, 'looking up must preserve the left/right axis');
  assert.ok(left[2] > .7 && right[2] > .7, 'both microphones look upward');
});

test('the distinct listening test keeps piano, drums, organ and rain in independent levelled tracks', () => {
  const score = renderSpatialStageScore(OBSERVATORY_EXHIBITS, { duration: 4, sampleRate: 24000, soundSet: 'distinct' });
  assert.deepEqual(score.stems.map(s => s.id), ['piano', 'drums', 'organ', 'rain']);
  const energy = signal => Math.sqrt(signal.reduce((sum, v) => sum + v * v, 0) / signal.length);
  const levels = score.stems.map(s => energy(s.focusAudio));
  assert.ok(Math.min(...levels) > .02, 'every independent track must be audible');
  assert.ok(Math.max(...levels) / Math.min(...levels) < 1.15, 'instruments should have comparable RMS levels');
  // A sustained organ is stable in level; piano/drums have clear attacks.
  const variation = stem => {
    const levels = Array.from({ length: 40 }, (_, i) => energy(stem.focusAudio.subarray(i * 2400, (i + 1) * 2400)));
    return Math.max(...levels) / Math.min(...levels);
  };
  assert.ok(variation(score.stems[0]) > 1.5, 'piano has struck notes');
  assert.ok(variation(score.stems[1]) > 2, 'drums have separated hits');
  assert.ok(variation(score.stems[2]) < 1.15, 'organ stays sustained');
  assert.ok(variation(score.stems[3]) < 1.15, 'rain stays continuous');
});

test('an ambisonic tag is refused when the file cannot carry one', () => {
  assert.throws(() => addSphericalMp4Metadata(minimalMp4(), { ambisonic: { order: 2, channels: 4 } }), /needs 9 channels/);
  assert.throws(() => addSphericalMp4Metadata(minimalMp4({ audio: false }), { ambisonic: true }), /exactly one audio track/);
});

// ---------------------------------------------------------------------------
// A hand-built MP4 with one 2:1 AVC track and one Opus track. Small enough to
// read, real enough for the box writer to walk.
function minimalMp4({ audio = true } = {}) {
  const u32 = v => { const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0); return b; };
  const box = (type, ...parts) => {
    const body = Buffer.concat(parts.map(p => (Buffer.isBuffer(p) ? p : Buffer.from(p))));
    return Buffer.concat([u32(body.length + 8), Buffer.from(type, 'latin1'), body]);
  };
  const hdlr = kind => box('hdlr', Buffer.alloc(8), Buffer.from(kind, 'latin1'), Buffer.alloc(13));
  const stco = box('stco', Buffer.alloc(4), u32(1), u32(0x10000));

  const avc1 = (() => {
    const body = Buffer.alloc(78);
    body.writeUInt16BE(1920, 24); body.writeUInt16BE(960, 26); // 2:1
    return box('avc1', body, box('avcC', Buffer.alloc(8)));
  })();
  const opus = box('Opus', Buffer.alloc(28), box('dOps', Buffer.alloc(11)));

  const trak = (kind, entry) => box('trak',
    box('mdia', hdlr(kind), box('minf', box('stbl',
      box('stsd', Buffer.alloc(4), u32(1), entry), stco))));

  const moov = box('moov', box('mvhd', Buffer.alloc(100)),
    trak('vide', avc1), ...(audio ? [trak('soun', opus)] : []));
  return new Uint8Array(Buffer.concat([box('ftyp', Buffer.from('isom\0\0\0\0isom', 'latin1')), moov, box('mdat', Buffer.alloc(64))]));
}
