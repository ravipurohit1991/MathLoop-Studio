import { createFourierStory, fourierChapters } from '../story/fourier.js';
import { createFourierContour } from '../math/contour.js';
import { bezierPath as curve, ellipsePath as ellipse } from '../math/geometry.js';
import { gradient, path, dot } from '../story/drawing.js';

const TAU = Math.PI * 2;
const contour = (id, points) => createFourierContour(points, { id, harmonics: 48, samples: 256, tracePoints: 360 });

function owlArtwork() {
  const contours = {}, add = (id, points) => contours[id] = contour(id, points);
  add('body', curve([0, -220], [
    [[155, -235], [203, -50], [162, 156]], [[140, 276], [70, 305], [0, 304]],
    [[-70, 305], [-140, 276], [-162, 156]], [[-203, -50], [-155, -235], [0, -220]],
  ]));
  for (const side of [-1, 1]) {
    const mirror = points => points.map(([x, y]) => [side * x, y]);
    add(`wing${side}`, mirror(curve([124, -67], [
      [[232, -30], [252, 127], [159, 259]], [[107, 212], [91, 62], [124, -67]],
    ])));
    add(`tuft${side}`, mirror(curve([58, -190], [
      [[91, -244], [156, -265], [180, -315]], [[205, -223], [170, -156], [134, -132]],
      [[98, -125], [76, -157], [58, -190]],
    ])));
    add(`mask${side}`, ellipse(side * 70, -121, 84, 101));
    add(`iris${side}`, ellipse(side * 68, -127, 37, 42));
    add(`pupil${side}`, ellipse(side * 68, -125, 19, 29));
    add(`foot${side}`, ellipse(side * 66, 295, 35, 15));
  }
  add('bib', curve([0, -18], [
    [[76, -39], [119, 62], [104, 164]], [[83, 249], [36, 270], [0, 273]],
    [[-36, 270], [-83, 249], [-104, 164]], [[-119, 62], [-76, -39], [0, -18]],
  ]));
  add('beak', curve([0, -87], [[[34, -80], [15, -35], [0, -23]], [[-15, -35], [-34, -80], [0, -87]]]));
  return { name: 'an owl', contours, studyId: 'body', placement: { x: 540, y: 1015, scale: 1.05 }, draw(ctx, state, paint) {
    const life = state.life ?? 0, phase = state.frame.phase * TAU;
    ctx.save(); ctx.translate(540, 1015 + life * 9 * Math.sin(phase * 3)); ctx.scale(1.05, 1.05);
    for (const side of [-1, 1]) paint(ctx, contours[`foot${side}`], state.theme.accent, state);
    paint(ctx, contours.body, gradient(ctx, '#91afc9', '#3d526f', -220, 300), state);
    paint(ctx, contours.bib, state.theme.ink, state);
    ctx.save(); path(ctx, contours.bib.points); ctx.clip(); ctx.globalAlpha *= state.fill * .5;
    ctx.strokeStyle = '#82776f'; ctx.lineWidth = 2.2;
    for (let row = 0; row < 6; row++) for (let col = -2; col <= 2; col++) {
      const x = col * 36 + (row % 2) * 18, y = 36 + row * 38;
      ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.quadraticCurveTo(x, y + 20, x + 9, y); ctx.stroke();
    }
    ctx.restore();
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side * 125, -60); ctx.rotate(side * life * .09 * Math.sin(phase * 3)); ctx.translate(-side * 125, 60);
      paint(ctx, contours[`wing${side}`], gradient(ctx, '#728aa8', '#263e5c', -40, 280), state);
      ctx.save(); path(ctx, contours[`wing${side}`].points); ctx.clip(); ctx.globalAlpha *= state.fill * .4;
      ctx.strokeStyle = state.theme.guide; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(side * (132 + i * 14), 0); ctx.quadraticCurveTo(side * (203 + i * 5), 120, side * (143 + i * 11), 251); ctx.stroke(); }
      ctx.restore(); ctx.restore();
    }
    ctx.save(); ctx.translate(0, -120); ctx.rotate(life * .12 * Math.sin(phase * 2)); ctx.translate(0, 120);
    for (const side of [-1, 1]) {
      paint(ctx, contours[`tuft${side}`], '#7088a5', state);
      paint(ctx, contours[`mask${side}`], gradient(ctx, '#fff1d4', '#cfc5b4', -222, -18), state);
      const blink = 1 - life * .94 * Math.max(0, Math.cos(phase * 4)) ** 24;
      ctx.save(); ctx.translate(side * 68, -127); ctx.scale(1, blink); ctx.translate(-side * 68, 127);
      paint(ctx, contours[`iris${side}`], state.theme.accent, state);
      paint(ctx, contours[`pupil${side}`], '#172334', state);
      ctx.save(); ctx.globalAlpha *= state.fill; dot(ctx, side * 68 - 9, -139, 6, '#ffffff'); ctx.restore(); ctx.restore();
    }
    paint(ctx, contours.beak, '#d49a58', state); ctx.restore(); ctx.restore();
  } };
}

function foxArtwork() {
  const contours = {}, add = (id, points) => contours[id] = contour(id, points);
  add('tail', curve([86, 213], [
    [[246, 241], [313, 95], [291, -55]], [[401, 66], [363, 286], [212, 321]],
    [[135, 350], [77, 297], [86, 213]],
  ]));
  add('tip', curve([291, -55], [
    [[346, 7], [365, 81], [351, 154]], [[325, 133], [301, 100], [289, 132]],
    [[316, 42], [305, -16], [291, -55]],
  ]));
  add('body', curve([0, -82], [
    [[108, -52], [132, 98], [113, 259]], [[70, 303], [-72, 303], [-111, 259]],
    [[-132, 98], [-108, -52], [0, -82]],
  ]));
  add('chest', curve([0, -48], [
    [[86, -21], [84, 82], [0, 199]], [[-84, 82], [-86, -21], [0, -48]],
  ]));
  for (const side of [-1, 1]) {
    const mirror = points => points.map(([x, y]) => [side * x, y]);
    add(`ear${side}`, mirror(curve([62, -168], [
      [[81, -242], [126, -305], [155, -329]], [[173, -246], [177, -175], [139, -120]],
      [[102, -108], [76, -131], [62, -168]],
    ])));
    add(`inner${side}`, mirror(curve([98, -180], [
      [[110, -221], [134, -263], [145, -280]], [[153, -230], [151, -183], [135, -157]],
      [[119, -149], [108, -166], [98, -180]],
    ])));
    add(`cheek${side}`, mirror(curve([0, -66], [
      [[39, -111], [85, -135], [146, -112]], [[110, -51], [52, -17], [0, -9]],
      [[-5, -31], [-4, -45], [0, -66]],
    ])));
    add(`eye${side}`, ellipse(side * 65, -124, 9, 14));
    add(`paw${side}`, ellipse(side * 57, 268, 34, 25));
  }
  add('head', curve([0, -235], [
    [[79, -235], [132, -202], [162, -128]], [[136, -62], [56, -26], [0, -5]],
    [[-56, -26], [-136, -62], [-162, -128]], [[-132, -202], [-79, -235], [0, -235]],
  ]));
  add('nose', curve([-18, -48], [[[0, -56], [20, -55], [19, -43]], [[14, -26], [0, -24], [-2, -27]], [[-10, -31], [-18, -36], [-18, -48]]]));
  return { name: 'a fox', contours, studyId: 'head', placement: { x: 505, y: 1030, scale: 1 }, draw(ctx, state, paint) {
    const life = state.life ?? 0, phase = state.frame.phase * TAU;
    ctx.save(); ctx.translate(505, 1030 + life * 5 * Math.sin(phase * 3));
    ctx.save(); ctx.translate(90, 215); ctx.rotate(life * .12 * Math.sin(phase * 3)); ctx.translate(-90, -215);
    paint(ctx, contours.tail, gradient(ctx, '#e29055', '#a44535', -55, 340), state);
    paint(ctx, contours.tip, state.theme.ink, state); ctx.restore();
    paint(ctx, contours.body, gradient(ctx, '#eaa06a', '#b6583d', -80, 290), state);
    paint(ctx, contours.chest, state.theme.ink, state);
    for (const side of [-1, 1]) paint(ctx, contours[`paw${side}`], '#543b3c', state);
    ctx.save(); ctx.translate(0, -50); ctx.rotate(life * .1 * Math.sin(phase * 2)); ctx.translate(0, 50);
    for (const side of [-1, 1]) {
      paint(ctx, contours[`ear${side}`], state.theme.accent, state);
      paint(ctx, contours[`inner${side}`], '#614046', state);
    }
    paint(ctx, contours.head, gradient(ctx, '#f5b276', '#ce704a', -230, 0), state);
    for (const side of [-1, 1]) {
      paint(ctx, contours[`cheek${side}`], state.theme.ink, state);
      paint(ctx, contours[`eye${side}`], '#322b33', state);
      ctx.save(); ctx.globalAlpha *= state.fill;
      dot(ctx, side * 65 - 2, -128, 2.7, '#fff8e5');
      ctx.strokeStyle = '#79594f'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(side * 35, -45 + i * 8); ctx.lineTo(side * 110, -50 + i * 15); ctx.stroke(); }
      ctx.restore();
    }
    paint(ctx, contours.nose, '#322b33', state); ctx.restore(); ctx.restore();
  } };
}

export const fourierOwlStory = createFourierStory({
  id: 'fourier-owl', title: 'Who draws the night?', artwork: owlArtwork(),
  description: 'Moon-blue feathers, amber eyes and a curious head tilt. Rotating circles draw a watchful woodland owl.',
  theme: { background: '#101827', mid: '#1d2b40', glow: '#354860', accent: '#f0bd69', guide: '#a8c5d4', ink: '#f6e7cd' },
  chapters: fourierChapters('an owl').map(c => c.id === 'perform' ? { ...c, title: ['Who draws', 'the night?'], caption: 'A slow blink. A curious tilt. The drawing is awake.' } : c.id === 'reveal' ? { ...c, title: ['Moonlit feathers.', 'Amber eyes.'], caption: 'Colour settles inside the contours you just watched.' } : c),
  audio: { bars: 13, seed: 1083, transpose: -3, score: 'paper-lanterns', tempoFeel: 'drift', level: .55, transitions: ['contour', 'draw', 'reveal', 'perform'] },
});

export const fourierFoxStory = createFourierStory({
  id: 'fourier-fox', title: 'A little wild in the equations.', artwork: foxArtwork(),
  description: 'A russet fox with a cream-tipped tail grows from circles, finds its colours, and listens to the forest.',
  theme: { background: '#201a25', mid: '#352838', glow: '#56414c', accent: '#e49561', guide: '#b9b8d6', ink: '#fff0d8' },
  chapters: fourierChapters('a fox').map(c => c.id === 'perform' ? { ...c, title: ['A little wild', 'in the equations.'], caption: 'The tail sways. The ears listen. A contour has character.' } : c.id === 'reveal' ? { ...c, title: ['Russet fur.', 'A tail dipped in cream.'], caption: 'The outlines stay. Their colours tell you who this is.' } : c),
  audio: { bars: 17, seed: 1207, transpose: 2, score: 'driftwood', level: .55, transitions: ['contour', 'draw', 'reveal', 'perform'] },
});
