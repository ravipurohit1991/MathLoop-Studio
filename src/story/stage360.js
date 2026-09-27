import { defineStory } from './definition.js';
import { createSphericalCamera, createPanoramaViewport, drawSphericalMeshes, strokeSpherical } from './spherical.js';
import { loftCurves3D, drawMesh3D, stroke3D } from './spatial.js';
import { text, tracked } from './drawing.js';

const TAU = Math.PI * 2, RADIANS = Math.PI / 180;
export const STAGE_SIZE = Object.freeze({ width: 2048, height: 1024 });

/** One placement control per editable field, shared by the validator and 360 Studio. */
export const STAGE_CONTROLS = Object.freeze({
  heading: { label: 'Heading', min: -180, max: 180, step: 1, unit: '°', hint: 'Which way a viewer turns to find it' },
  elevation: { label: 'Elevation', min: -70, max: 70, step: 1, unit: '°', hint: 'How far above the horizon it hangs' },
  pitch: { label: 'Tilt', min: -80, max: 80, step: 1, unit: '°', hint: 'Lean it towards the viewer or away' },
  yaw: { label: 'Facing', min: -180, max: 180, step: 1, unit: '°', hint: 'Turn the sculpture on the spot' },
  scale: { label: 'Size', min: .2, max: 4, step: .05, unit: '×', hint: 'Its size where it stands' },
  distance: { label: 'Distance', min: 400, max: 3000, step: 25, unit: '', hint: 'How far away it sits' },
  turns: { label: 'Rotations', min: 0, max: 4, step: 1, unit: ' / loop', hint: 'Whole turns keep the loop seamless' },
});
export const STAGE_EXHIBIT_DEFAULTS = Object.freeze({ heading: 0, elevation: 0, pitch: -10, yaw: 0, scale: 1.4, distance: 1100, turns: 0, tint: false });

/** A placement is plain JSON so a stage travels inside an ordinary story project. */
export function stageExhibit(reel, overrides = {}) {
  return { reel, name: overrides.name ?? 'A SCULPTURE', ...STAGE_EXHIBIT_DEFAULTS, ...overrides };
}

export function validateStageExhibits(exhibits, reels) {
  if (!Array.isArray(exhibits) || !exhibits.length || exhibits.length > 8) throw new Error('A 360° stage holds between one and eight reels.');
  for (const exhibit of exhibits) {
    if (!reels[exhibit?.reel]) throw new Error(`"${exhibit?.reel}" is not a film that can stand in the sphere.`);
    if (typeof exhibit.name !== 'string' || !exhibit.name.trim() || exhibit.name.length > 40) throw new Error('Every placed reel needs a caption of up to 40 characters.');
    for (const [key, control] of Object.entries(STAGE_CONTROLS)) {
      const value = exhibit[key];
      if (!Number.isFinite(value) || value < control.min || value > control.max) throw new Error(`${exhibit.name}: ${control.label.toLowerCase()} must be between ${control.min} and ${control.max}.`);
    }
    if (!Number.isInteger(exhibit.turns)) throw new Error(`${exhibit.name}: rotations must be a whole number so the loop closes.`);
    if (typeof exhibit.tint !== 'boolean') throw new Error(`${exhibit.name}: matching the stage palette must be true or false.`);
  }
  return exhibits;
}

/**
 * The shared world for a stage. Both the spherical film and its portrait
 * companion sample the same geometry, so the Short can never drift from the
 * sphere it advertises.
 */
export function createStage360World(reels, exhibits, stageTheme) {
  const objects = validateStageExhibits(exhibits, reels).map(exhibit => {
    const reel = reels[exhibit.reel];
    // A tinted reel drops its own film palette and takes the colours of the room.
    const theme = exhibit.tint && stageTheme ? stageTheme : reel.theme;
    return { ...exhibit, pose: reel.artwork.pose, guide: theme.guide,
      meshes: reel.artwork.parts.map(part => ({ part,
        mesh: loftCurves3D(part.curves, { closed: part.closed, colour: part.colour === 'eye' ? '#101d2c' : theme[part.colour] ?? theme.accent }) })) };
  });
  return { exhibits: objects, sample(phase, guides = true) {
    const wave = Math.sin(phase * TAU), meshes = [], outlines = [];
    for (const exhibit of objects) {
      const { scale, distance } = exhibit;
      const yaw = (exhibit.yaw + exhibit.turns * 360 * phase) * RADIANS + wave * .12, pitch = exhibit.pitch * RADIANS;
      const angle = exhibit.heading * RADIANS, ca = Math.cos(angle), sa = Math.sin(angle);
      // +Y points down, so raising an exhibit is a negative rotation about X.
      const rise = -exhibit.elevation * RADIANS, ce = Math.cos(rise), se = Math.sin(rise);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const transform = (p, part) => {
        const [x, y, z] = exhibit.pose?.(p, part, phase, 1) ?? p;
        const a = (cy * x + sy * z) * scale, b = (-sy * x + cy * z) * scale;
        const ty = cp * y * scale - sp * b, tz = sp * y * scale + cp * b - distance;
        const vertical = ty * ce - tz * se, depth = ty * se + tz * ce;
        return [ca * a - sa * depth, vertical + 18 * wave, sa * a + ca * depth];
      };
      for (const { part, mesh } of exhibit.meshes) {
        meshes.push({ ...mesh, vertices: mesh.vertices.map(p => transform(p, part.id)) });
        if (guides) for (let i = 2; i < part.curves.length; i += 5) outlines.push({ points: part.curves[i].points.map(p => transform(p, part.id)), colour: exhibit.guide });
      }
    }
    return { meshes, outlines };
  } };
}

/** Dwell on each reel in turn, then close the full circle exactly at the loop. */
export function stageTourHeading(headings, phase) {
  const count = headings.length, stops = [];
  let previous = headings[0];
  for (const [i, heading] of headings.entries()) {
    const unwrapped = i === 0 ? heading : previous + ((heading - previous) % 360 + 360) % 360;
    stops.push([i / count, unwrapped], [i / count + .6 / count, unwrapped]);
    previous = unwrapped;
  }
  stops.push([1, headings[0] + 360]);
  const t = Math.max(0, Math.min(1, phase));
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [from, a] = stops[i - 1], [to, b] = stops[i];
    if (to === from) return b;
    const u = (t - from) / (to - from);
    return a + (b - a) * u * u * (3 - 2 * u);
  }
  return stops.at(-1)[1];
}

const OCEAN = ['#173e50', '#0c2c3c', '#071b2b', '#030b13'];

function drawStageBackdrop(ctx, { width, height, colours, mote, phase }) {
  const glow = ctx.createLinearGradient(0, 0, 0, height);
  for (const [i, colour] of colours.entries()) glow.addColorStop(i / (colours.length - 1), colour);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
  // Uniformly distributed directions avoid particle crowding at the poles.
  ctx.fillStyle = mote;
  for (let i = 0; i < 180; i++) {
    const longitude = i * 2.399963 + Math.sin(phase * TAU) * .06;
    const latitude = Math.asin(2 * ((i + .5) / 180) - 1);
    const x = ((.5 + longitude / TAU) % 1) * width, y = height * (.5 + latitude / Math.PI);
    ctx.globalAlpha = .12 + .16 * (.5 + .5 * Math.sin(i + phase * TAU));
    ctx.beginPath(); ctx.ellipse(x, y, .8 / Math.max(.12, Math.cos(latitude)), .8, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const latitude of [-65, 58, 72]) {
    ctx.strokeStyle = `${mote}18`; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(0, height * (.5 + latitude / 180)); ctx.lineTo(width, height * (.5 + latitude / 180)); ctx.stroke();
  }
}

const hex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
/** Sample a panorama's vertical gradient at a latitude in degrees. */
function skyAt(colours, latitude) {
  const t = Math.max(0, Math.min(1, (latitude + 90) / 180)) * (colours.length - 1);
  const i = Math.min(colours.length - 2, Math.floor(t)), u = t - i;
  const a = hex(colours[i]), b = hex(colours[i + 1]);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * u)).join(',')})`;
}

/**
 * The free-look preview: the same world seen through an ordinary camera, so
 * 360 Studio can show what a viewer sees without reprojecting the panorama.
 * The backdrop is banded by the latitude down the centre of the frame, which
 * is exact there and drifts a little towards the corners.
 */
export function drawStageViewport(ctx, world, { width, height, heading = 0, pitch = 0, fov = 80, phase = 0, guides = true, backdrop = OCEAN, mote = '#92d9d2' } = {}) {
  const camera = createPanoramaViewport({ width, height, heading, pitch, horizontalFov: fov });
  const focal = width / (2 * Math.tan(fov * RADIANS / 2));
  const tilt = pitch * RADIANS, cp = Math.cos(tilt), sp = Math.sin(tilt), bands = 64;
  for (let i = 0; i < bands; i++) {
    const q = ((i + .5) / bands * height - height / 2) / focal;
    const y = cp * q - sp, latitude = Math.asin(y / Math.hypot(q, 1, 0)) / RADIANS;
    ctx.fillStyle = skyAt(backdrop, latitude);
    ctx.fillRect(0, Math.floor(i * height / bands), width, Math.ceil(height / bands) + 1);
  }
  ctx.fillStyle = mote;
  for (let i = 0; i < 150; i++) {
    const a = i * 2.399963, y = 2 * (i + .5) / 150 - 1, r = Math.sqrt(1 - y * y);
    const p = camera.project([Math.sin(a) * r * 3000, y * 3000, -Math.cos(a) * r * 3000]);
    if (!p) continue;
    ctx.globalAlpha = .16 + .14 * Math.sin(i + phase * TAU) ** 2;
    ctx.beginPath(); ctx.arc(p[0], p[1], 1.6, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const { meshes, outlines } = world.sample(phase, guides);
  drawMesh3D(ctx, meshes, camera);
  for (const outline of outlines) stroke3D(ctx, outline.points, camera, { colour: outline.colour, alpha: .13, width: 1, close: true });
}

/**
 * A 360° film assembled from placed reels. Everything an editor changes lives
 * in `params.exhibits`, so a stage is authored, saved and reloaded like any
 * other story project.
 */
export function createStage360Story({ reels, exhibits, backdrop = OCEAN, mote = '#92d9d2', brand, ...definition }) {
  const { width, height } = STAGE_SIZE;
  const label = brand ?? `${(definition.title ?? 'MATHLOOP').toUpperCase()}  /  360°`;
  return defineStory({
    dimension: '3d', kind: 'spherical', projection: 'equirectangular', size: { width, height },
    chapters: [{ id: 'perform', duration: 20, title: [definition.title ?? 'A world made of maths'], caption: 'Drag to look around.' }],
    export: { width: 3840, height: 1920, fps: 30, samples: 1, shutter: .32, crf: 18, preset: 'fast' },
    ...definition,
    reels, stage: 'sphere', backdrop, mote, brand: label,
    params: { guides: true, ...definition.params, exhibits },
    validateParams(params) {
      if (typeof params.guides !== 'boolean') throw new Error('Construction guides must be true or false.');
      validateStageExhibits(params.exhibits, reels);
      definition.validateParams?.(params);
    },
    createRenderer(context) {
      const camera = createSphericalCamera({ width, height });
      const world = createStage360World(reels, context.params.exhibits, context.theme);
      return { draw(ctx, frame) {
        drawStageBackdrop(ctx, { width, height, colours: backdrop, mote, phase: frame.phase });
        const { meshes, outlines } = world.sample(frame.phase, frame.params.guides);
        drawSphericalMeshes(ctx, meshes, camera);
        for (const outline of outlines) strokeSpherical(ctx, outline.points, camera, { colour: outline.colour, alpha: .13, width: .65, close: true });
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const exhibit of world.exhibits) {
          // A caption near the seam is drawn again on the far edge so it reads whole.
          const lift = Math.max(-300, Math.min(300, exhibit.elevation / 180 * height));
          for (const offset of [-width, 0, width]) {
            const x = width * (.5 + exhibit.heading / 360) + offset;
            if (x < -width / 2 || x > width * 1.5) continue;
            ctx.fillStyle = frame.theme.guide; ctx.font = '10px "Film Sans", Arial'; ctx.fillText(label, x, 300 - lift);
            ctx.fillStyle = frame.theme.ink; ctx.font = 'bold 24px "Film Sans", Arial'; ctx.fillText(exhibit.name, x, 332 - lift);
            ctx.fillStyle = frame.theme.guide; ctx.font = '12px "Film Sans", Arial'; ctx.fillText('Drag to look around · Scroll to zoom', x, 357 - lift);
          }
        }
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      } };
    },
  });
}

/**
 * The portrait companion. It records a camera tour of the same stage, so it can
 * be uploaded as an ordinary Short that points at the 360° film.
 */
export function createStage360Short({ reels, exhibits, sky = ['#123a49', '#082536', '#041019'], brand, callToAction = 'Explore the full 360° film.', ...definition }) {
  const label = brand ?? `MATHLOOP / ${(definition.title ?? '').toUpperCase()}`;
  return defineStory({
    dimension: '3d', kind: 'guided-tour', size: { width: 1080, height: 1920 },
    chapters: [{ id: 'perform', duration: 20, title: [definition.title ?? 'A whole world.'], caption: 'One continuous world.' }],
    export: { width: 1080, height: 1920, fps: 30, samples: 2, shutter: .32, crf: 17, preset: 'fast' },
    ...definition,
    reels, stage: 'short', backdrop: sky, mote: '#9fd6d0',
    params: { guides: true, ...definition.params, exhibits },
    validateParams(params) {
      if (typeof params.guides !== 'boolean') throw new Error('Construction guides must be true or false.');
      validateStageExhibits(params.exhibits, reels);
      definition.validateParams?.(params);
    },
    createRenderer(context) {
      const placed = context.params.exhibits, world = createStage360World(reels, placed, context.theme);
      const headings = placed.map(e => e.heading);
      return { draw(ctx, frame) {
        const heading = stageTourHeading(headings, frame.phase), camera = createPanoramaViewport({ heading });
        const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
        for (const [i, colour] of sky.entries()) gradient.addColorStop(i / (sky.length - 1), colour);
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1920);
        for (let i = 0; i < 120; i++) {
          const a = i * 2.399963, y = 2 * (i + .5) / 120 - 1, r = Math.sqrt(1 - y * y);
          const p = camera.project([Math.sin(a) * r * 3000, y * 3000, -Math.cos(a) * r * 3000]);
          if (!p) continue;
          ctx.globalAlpha = .16 + .12 * Math.sin(i + frame.phase * TAU) ** 2; ctx.fillStyle = frame.theme.guide;
          ctx.beginPath(); ctx.arc(p[0], p[1], 1.5, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
        const { meshes, outlines } = world.sample(frame.phase, frame.params.guides);
        // Reserve the headline and call to action while the camera turns.
        ctx.save(); ctx.beginPath(); ctx.rect(0, 610, 1080, 800); ctx.clip();
        drawMesh3D(ctx, meshes, camera);
        for (const outline of outlines) stroke3D(ctx, outline.points, camera, { colour: outline.colour, alpha: .12, width: 1, close: true });
        ctx.restore();
        const index = Math.min(placed.length - 1, Math.floor(frame.phase * placed.length));
        tracked(ctx, label, 80, 155, 19, frame.theme.guide, 2.4);
        for (const [i, line] of frame.chapter.title.slice(0, 2).entries()) {
          ctx.font = '700 88px "Film Sans",Arial'; const size = 88 * Math.min(1, 835 / Math.max(1, ctx.measureText(line).width));
          text(ctx, line, 80, 282 + i * 106, size, i ? frame.theme.accent : frame.theme.ink, 700);
        }
        tracked(ctx, `0${index + 1} / ${placed[index].name}`, 80, 555, 22, frame.theme.guide, 2);
        text(ctx, frame.chapter.caption, 80, 1510, 27, frame.theme.ink, 400);
        text(ctx, callToAction, 80, 1610, 38, frame.theme.accent, 600);
        text(ctx, 'Open the related video to look around.', 80, 1660, 24, frame.theme.guide, 400);
        const span = Math.min(250, 830 / placed.length - 25);
        for (let i = 0; i < placed.length; i++) { ctx.fillStyle = i === index ? frame.theme.accent : '#36525d'; ctx.fillRect(80 + i * (span + 25), 1740, span, 3); }
        text(ctx, 'A GUIDED TOUR', 80, 1783, 17, frame.theme.guide, 500);
      } };
    },
  });
}
