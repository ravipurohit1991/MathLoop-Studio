import { cross3, sub3, dot3, unit3 } from '../math/fourier3d.js';

const TAU = Math.PI * 2;

/** Fixed viewpoint: forward is -Z, right is +X, and +Y points down. */
export function createSphericalCamera({ width = 2048, height = 1024 } = {}) {
  if (!(width > 0 && height > 0 && width === height * 2)) throw new Error('A full spherical panorama must have a 2:1 aspect ratio.');
  return {
    width, height,
    project([x, y, z]) {
      const radius = Math.hypot(x, y, z);
      if (!Number.isFinite(radius) || radius < 1e-6) return null;
      return [width * (.5 + Math.atan2(x, -z) / TAU), height * (.5 + Math.asin(Math.max(-1, Math.min(1, y / radius))) / Math.PI), radius];
    },
  };
}

/** A conventional camera looking out from the same origin as the panorama. */
export function createPanoramaViewport({ width = 1080, height = 1920, heading = 0, pitch = 0, horizontalFov = 70 } = {}) {
  if (![width,height,heading,pitch,horizontalFov].every(Number.isFinite) || width <= 0 || height <= 0 || horizontalFov <= 0 || horizontalFov >= 170) throw new Error('Invalid panorama viewport.');
  const angle = heading * Math.PI / 180, tilt = pitch * Math.PI / 180;
  const ca = Math.cos(angle), sa = Math.sin(angle), cp = Math.cos(tilt), sp = Math.sin(tilt);
  const focal = width / (2 * Math.tan(horizontalFov * Math.PI / 360));
  const view = ([x,y,z]) => { const a = ca*x + sa*z, b = -sa*x + ca*z; return [a,cp*y-sp*b,sp*y+cp*b]; };
  return { view, project(p) { const q = view(p); return q[2] >= -10 ? null : [width/2-q[0]*focal/q[2],height/2-q[1]*focal/q[2],q[2]]; } };
}

/** Unwrap short, tessellated edges, then duplicate paths at the longitude seam. */
export function sphericalPathCopies(points, width) {
  if (!points.length || points.some(p => !p)) return [];
  const unwrapped = [points[0].slice()];
  for (const p of points.slice(1)) {
    const previous = unwrapped.at(-1)[0];
    unwrapped.push([p[0] + Math.round((previous - p[0]) / width) * width, ...p.slice(1)]);
  }
  const min = Math.min(...unwrapped.map(p => p[0])), max = Math.max(...unwrapped.map(p => p[0]));
  const copies = [];
  for (let turn = Math.ceil(-max / width); turn <= Math.floor((width - min) / width); turn++) {
    copies.push(unwrapped.map(([x, ...rest]) => [x + turn * width, ...rest]));
  }
  return copies;
}

function trace(ctx, points, close) {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) ctx.lineTo(p[0], p[1]);
  if (close) ctx.closePath();
}

export function strokeSpherical(ctx, points, camera, { colour = '#90e2d2', alpha = 1, width = 1, close = false } = {}) {
  if (points.length < 2 || alpha <= 0) return;
  ctx.save(); ctx.strokeStyle = colour; ctx.globalAlpha *= alpha; ctx.lineWidth = width; ctx.lineJoin = 'round';
  for (const path of sphericalPathCopies(points.map(camera.project), camera.width)) { trace(ctx, path, close); ctx.stroke(); }
  ctx.restore();
}

/** Small world-space triangles retain their geometry around the entire sphere. */
export function drawSphericalMeshes(ctx, meshes, camera, { wire = 0 } = {}) {
  const faces = [], lightDirection = unit3([-.4, -.7, 1]);
  for (const mesh of meshes) {
    const screen = mesh.vertices.map(camera.project);
    const base = [1, 3, 5].map(i => parseInt(mesh.colour.slice(i, i + 2), 16));
    for (const face of mesh.faces) {
      const p = face.map(i => screen[i]);
      if (p.some(v => !v)) continue;
      const [a, b, c] = face.map(i => mesh.vertices[i]);
      const normal = unit3(cross3(sub3(b, a), sub3(c, a)));
      const light = .34 + .6 * Math.abs(dot3(normal, lightDirection));
      faces.push({ p, depth: p.reduce((sum, v) => sum + v[2], 0) / p.length,
        colour: `rgb(${base.map(v => Math.min(255, Math.round(v * light + 9))).join(',')})` });
    }
  }
  faces.sort((a, b) => b.depth - a.depth);
  ctx.save(); ctx.lineJoin = 'round';
  for (const face of faces) for (const path of sphericalPathCopies(face.p, camera.width)) {
    trace(ctx, path, true); ctx.fillStyle = face.colour; ctx.fill();
    ctx.strokeStyle = face.colour; ctx.lineWidth = .45; ctx.stroke();
    if (wire > 0) { ctx.strokeStyle = `rgba(220,255,248,${wire * .3})`; ctx.lineWidth = .5; ctx.stroke(); }
  }
  ctx.restore();
}
