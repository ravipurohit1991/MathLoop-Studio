// First-order ambisonics, so a 360° film can be listened to as well as looked at.
//
// A stage already knows where everything stands: every exhibit carries a
// heading and an elevation. That is all a sound field needs. Instead of mixing
// each voice to a fixed place between two speakers, we mix it to a *direction*,
// and the player rotates the whole field under the viewer's head at playback.
//
// The format is the one YouTube documents: four channels, ACN order, SN3D
// normalisation, which is to say
//
//   ACN 0  W = 1                      the sound, with no direction at all
//   ACN 1  Y = sin(az) · cos(el)      how far to the left it is
//   ACN 2  Z = sin(el)                how far above the horizon it is
//   ACN 3  X = cos(az) · cos(el)      how far in front it is
//
// Two warnings, both learned the hard way and both silent when wrong:
//
//   * the channels must stay in that order all the way to the file. Handing
//     four channels to an encoder as a named layout like `4.0` lets it permute
//     them into that layout's canonical order, which scrambles the axes and
//     leaves a field that rotates the wrong way. See `docs/360-audio.md`.
//   * azimuth runs anticlockwise from front, and a stage heading runs
//     clockwise -- a viewer turns *right* by 90° to find the exhibit at 90°.
//     So azimuth = -heading. Getting this backwards mirrors the room, which
//     nobody notices until they turn their head.

const RADIANS = Math.PI / 180;

/** The four ACN/SN3D gains for one direction, in degrees. */
export function foaGains(azimuthDegrees, elevationDegrees = 0) {
  const az = azimuthDegrees * RADIANS, el = elevationDegrees * RADIANS;
  const cosEl = Math.cos(el);
  return [1, Math.sin(az) * cosEl, Math.sin(el), Math.cos(az) * cosEl];
}

/** Where a stage exhibit stands, in the sound field's own convention. */
export function exhibitDirection({ heading = 0, elevation = 0 } = {}) {
  return { azimuth: -heading, elevation };
}

/** The gains for a stage exhibit, straight from its placement. */
export function exhibitGains(exhibit) {
  const { azimuth, elevation } = exhibitDirection(exhibit);
  return foaGains(azimuth, elevation);
}

/**
 * A four-channel bus that voices are written into by direction.
 *
 * `n` is the length in frames. `spread` softens the field towards omni: 1 keeps
 * a fully directional encode, 0 collapses to W alone. First-order ambisonics is
 * broad to begin with, so this is usually left alone and used only to keep a
 * bed from wandering.
 */
export function createFoaBus(n) {
  const channels = [0, 1, 2, 3].map(() => new Float32Array(n));
  return {
    n, channels, numberOfChannels: 4,
    /** Add one sample at one direction. `gains` comes from `foaGains`. */
    add(index, sample, gains) {
      channels[0][index] += sample * gains[0];
      channels[1][index] += sample * gains[1];
      channels[2][index] += sample * gains[2];
      channels[3][index] += sample * gains[3];
    },
    /**
     * Write a whole note, wrapping past the end so a looping film never clicks.
     * `voice` is the repo's ordinary (t, i) -> sample function.
     */
    note({ start, frames, voice, gain = 1, gains, sampleRate, loop = true, spread = 1 }) {
      const g = [gains[0], gains[1] * spread, gains[2] * spread, gains[3] * spread];
      const from = loop ? 0 : Math.max(0, -start), to = loop ? frames : Math.min(frames, n - start);
      let at = ((start + from) % n + n) % n;
      for (let i = from; i < to; i++) {
        const v = voice(i / sampleRate, i) * gain;
        channels[0][at] += v * g[0]; channels[1][at] += v * g[1];
        channels[2][at] += v * g[2]; channels[3][at] += v * g[3];
        if (++at === n) at = 0;
      }
    },
  };
}

/**
 * Decode a sound field to stereo for one look direction.
 *
 * This is not the binaural decode a headset does; it is a pair of first-order
 * virtual microphones, which is enough to *check* a mix -- turn the yaw and the
 * balance moves -- and it is what the local player uses when the browser has no
 * better decoder. `width` sets how far apart the two microphones point.
 */
export function foaToStereo(channels, { yaw = 0, pitch = 0, width = 90, pattern = .5 } = {}) {
  const [W, Y, Z, X] = channels, n = W.length;
  const left = new Float32Array(n), right = new Float32Array(n);
  const [l, r] = foaStereoMatrix({ yaw, pitch, width, pattern });
  for (let i = 0; i < n; i++) {
    left[i] = l[0] * W[i] + l[1] * Y[i] + l[2] * Z[i] + l[3] * X[i];
    right[i] = r[0] * W[i] + r[1] * Y[i] + r[2] * Z[i] + r[3] * X[i];
  }
  return [left, right];
}

/** Stereo virtual microphone coefficients, shared with the live Web Audio graph. */
export function foaStereoMatrix({ yaw = 0, pitch = 0, width = 90, pattern = .5 } = {}) {
  const az = -yaw * RADIANS, el = pitch * RADIANS;
  return [1, -1].map(side => {
    const angle = side * width * RADIANS / 2, c = Math.cos(angle), s = Math.sin(angle);
    return [1 - pattern,
      pattern * (c * Math.sin(az) * Math.cos(el) + s * Math.cos(az)),
      pattern * c * Math.sin(el),
      pattern * (c * Math.cos(az) * Math.cos(el) - s * Math.sin(az))];
  });
}

/** Independent stems only: silence off-screen sources and crossfade at boundaries. */
export function focusGains(placements, { yaw = 0, pitch = 0 } = {}) {
  const [, y, z, x] = foaGains(-yaw, pitch);
  const weights = placements.map(placement => {
    const [, sy, sz, sx] = exhibitGains(placement);
    const dot = y * sy + z * sz + x * sx;
    return dot <= 1e-6 ? 0 : Math.min(1, dot) ** 8;
  });
  // Equal power through a crossfade; looking into empty space may be silent.
  const norm = Math.max(.05, Math.hypot(...weights));
  return weights.map(weight => weight / norm);
}
