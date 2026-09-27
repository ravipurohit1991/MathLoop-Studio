import { createFourier3DStory, spatialChapters } from '../../story/fourier3d.js';
import { createFourierCurve3D } from '../../math/fourier3d.js';

const TAU = Math.PI * 2;
const ring = (fn, id) => createFourierCurve3D(Array.from({ length: 96 }, (_, i) => fn(i / 96 * TAU)), { id, samples: 64, harmonics: 12, tracePoints: 24 });
const loft = (id, count, fn, colour = 'accent') => ({ id, colour, curves: Array.from({ length: count }, (_, i) => ring(a => fn(.002 + .996 * i / (count - 1), a), `${id}-${i}`)) });
const study = fn => createFourierCurve3D(Array.from({ length: 256 }, (_, i) => fn(i / 256 * TAU)), { samples: 256, harmonics: 40, tracePoints: 240 });

function turtleArtwork() {
  const parts = [loft('shell', 24, (u, a) => {
    const x = -198 + 402 * u, r = Math.sin(Math.PI * u) ** .6;
    return [x, -18 + 88 * r * Math.cos(a), 158 * r * Math.sin(a)];
  })];
  parts.push(loft('head', 14, (u, a) => {
    const r = Math.sin(Math.PI * u) ** .45;
    return [-173 - 153 * u, 6 + 46 * r * Math.cos(a), 55 * r * Math.sin(a)];
  }, 'guide'));
  for (const side of [-1, 1]) {
    parts.push(loft(`front${side}`, 14, (u, a) => [
      -103 - 51 * u + 64 * Math.sin(Math.PI * u) * Math.cos(a),
      26 + 31 * u + 11 * Math.sin(Math.PI * u) * Math.sin(a), side * (100 + 220 * u),
    ], 'guide'));
    parts.push(loft(`rear${side}`, 10, (u, a) => [
      140 + 69 * u + 38 * Math.sin(Math.PI * u) * Math.cos(a),
      27 + 20 * u + 9 * Math.sin(Math.PI * u) * Math.sin(a), side * (78 + 114 * u),
    ], 'guide'));
    parts.push(loft(`eye${side}`, 6, (u, a) => {
      const t = Math.PI * u; return [-274 + 7 * Math.cos(t), -13 + 8 * Math.sin(t) * Math.cos(a), side * 40 + 8 * Math.sin(t) * Math.sin(a)];
    }, 'eye'));
  }
  parts.push(loft('tail', 8, (u, a) => [184 + 84 * u, 23 + 13 * (1 - u) * Math.cos(a), 17 * (1 - u) * Math.sin(a)], 'guide'));
  // Scute seams sit just above the shell, so lighting still describes its dome.
  const surface = (u, a) => {
    const r = Math.sin(Math.PI * u) ** .6;
    return [-198 + 402 * u, -19 + 89 * r * Math.cos(a), 159 * r * Math.sin(a)];
  };
  const details = [];
  for (const u of [.17, .32, .5, .68, .83]) details.push({ colour: 'ink', points: Array.from({ length: 45 }, (_, j) => surface(u, Math.PI * (.52 + .96 * j / 44))) });
  for (const a of [Math.PI * .76, Math.PI * 1.24]) details.push({ colour: 'ink', points: Array.from({ length: 50 }, (_, j) => surface(.03 + .94 * j / 49, a)) });
  return { name: 'a sea turtle', parts, details, study: study(t => [205 * Math.cos(t), -24 + 35 * Math.sin(2 * t), 158 * Math.sin(t)]), pose(p, id, phase, life) {
    const [x, y, z] = p, wave = phase * TAU * 3;
    const front = id.startsWith('front') ? Math.max(0, (Math.abs(z) - 100) / 220) : 0;
    const rear = id.startsWith('rear') ? Math.max(0, (Math.abs(z) - 78) / 114) : 0;
    return [x, y + life * (9 * Math.sin(wave) + front * 70 * Math.sin(wave - .7) + rear * 16 * Math.sin(wave - 1.2)), z];
  } };
}

function lotusArtwork() {
  const parts = [];
  for (let layer = 0; layer < 3; layer++) {
    const count = 8 - layer, length = 298 - layer * 66;
    for (let k = 0; k < count; k++) {
      const th = k / count * TAU + layer * .38;
      parts.push(loft(`petal-${layer}-${k}`, 14, (u, a) => {
        const reach = 28 + length * u, width = (66 - layer * 8) * Math.sin(Math.PI * u) ** .8;
        const cross = width * Math.cos(a), y = 65 - layer * 15 - (140 + layer * 65) * u ** 1.8;
        return [reach * Math.cos(th) - cross * Math.sin(th), y + 9 * Math.sin(Math.PI * u) * Math.sin(a), reach * Math.sin(th) + cross * Math.cos(th)];
      }, layer === 1 ? 'ink' : 'accent'));
    }
  }
  parts.push(loft('heart', 12, (u, a) => {
    const t = Math.PI * u; return [53 * Math.sin(t) * Math.cos(a), 16 + 30 * Math.cos(t), 53 * Math.sin(t) * Math.sin(a)];
  }, 'pollen'));
  parts.push(loft('stem', 14, (u, a) => [10 * Math.sin(u * Math.PI) + 7 * Math.cos(a), 68 + 255 * u, 7 * Math.sin(a)], 'guide'));
  return { name: 'a lotus', parts, study: study(t => [240 * Math.cos(t), -25 + 70 * Math.sin(2 * t), 180 * Math.sin(t)]), pose(p, id, phase, life) {
    const [x, y, z] = p, wave = phase * TAU * 2;
    if (id.startsWith('petal')) {
      const reach = Math.hypot(x, z), opening = life * .1 * Math.sin(wave);
      const blend = Math.max(0, (reach - 28) / 300);
      return [x * (1 + opening * blend), y + opening * 140 * blend, z * (1 + opening * blend)];
    }
    return p;
  } };
}

export const fourierTurtleStory = createFourier3DStory({
  id: 'fourier-turtle-3d', title: 'The geometry of taking it slow.', artwork: turtleArtwork(),
  description: 'A domed shell grows from Fourier rings. Four jade flippers carry a sea turtle through a quiet current.',
  params: { cameraYaw: 15, cameraPitch: -34, orbitAmount: 27, zoom: 1.1 },
  theme: { background: '#12231f', mid: '#203b32', glow: '#3d6150', accent: '#9da873', guide: '#78b9a2', ink: '#eee2b7' },
  chapters: spatialChapters('a sea turtle').map(c => c.id === 'perform' ? { ...c, title: ['The geometry', 'of taking it slow.'], caption: 'The shell stays steady. A wave passes through the flippers.' } : c.id === 'reveal' ? { ...c, title: ['A roof of rings.', 'A shell of light.'], caption: 'The same contours carry the surface and its scute markings.' } : c),
  audio: { bars: 12, seed: 1421, transpose: -7, score: 'deep-current', tempoFeel: 'drift', level: .55, transitions: ['combine', 'draw', 'reveal', 'perform'] },
});

export const fourierLotusStory = createFourier3DStory({
  id: 'fourier-lotus-3d', title: 'A bloom in three dimensions.', artwork: lotusArtwork(),
  description: 'Twenty-one rose and ivory petals emerge ring by ring around a golden centre. A lotus opens with a slow breath.',
  params: { cameraYaw: -14, cameraPitch: -32, orbitAmount: 32, zoom: 1.15 },
  theme: { background: '#221c2c', mid: '#392e45', glow: '#5f425a', accent: '#e6a2b9', guide: '#92bbaa', ink: '#f7e5da', pollen: '#e7bd68' },
  chapters: spatialChapters('a lotus').map(c => c.id === 'perform' ? { ...c, title: ['A bloom in', 'three dimensions.'], caption: 'Three rings of petals. One slow, authored breath.' } : c.id === 'reveal' ? { ...c, title: ['Rose. Ivory.', 'A heart of gold.'], caption: 'Light turns the reconstructed rings into curved petals.' } : c),
  audio: { bars: 14, seed: 1537, transpose: 5, score: 'aurora-glass', tempoFeel: 'drift', level: .5, transitions: ['combine', 'draw', 'reveal', 'perform'] },
});
