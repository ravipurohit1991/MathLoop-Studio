import { pointOnContour } from '../math/contour.js';
import { chapterOpacity, intervalProgress } from './timeline.js';
const TAU = Math.PI * 2;

export function path(ctx, points, close = true) {
  if (!points.length) return;
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  if (close) ctx.closePath();
}
export function gradient(ctx, a, b, y1 = -240, y2 = 220) {
  const fill = ctx.createLinearGradient(-80, y1, 130, y2); fill.addColorStop(0, a); fill.addColorStop(1, b); return fill;
}
export function text(ctx, value, x, y, size, colour = '#f4eee0', weight = 600, align = 'left') {
  ctx.font = `${weight} ${size}px "Film Sans", "Arial", sans-serif`; ctx.fillStyle = colour; ctx.textAlign = align; ctx.fillText(value, x, y);
}
export function tracked(ctx, value, x, y, size, colour, space = 3) {
  ctx.font = `500 ${size}px "Film Sans", "Arial", sans-serif`; ctx.fillStyle = colour; ctx.textAlign = 'left';
  for (const char of value) { ctx.fillText(char, x, y); x += ctx.measureText(char).width + space; }
}
export function dot(ctx, x, y, radius, colour) { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill(); }

export function drawEpicycles(ctx, contour, time, opacity = 1, { ink = '#f4eee0', guides = '147,199,190', rods = '240,193,130', minRadius = 1.9 } = {}) {
  if (opacity < .005) return;
  ctx.save(); opacity *= ctx.globalAlpha; ctx.globalAlpha = 1; ctx.lineWidth = .95;
  let position = contour.norm.centre.slice();
  for (let i = 0; i < contour.chain.length; i++) {
    const term = contour.chain[i], radius = term.amp * contour.norm.radius, angle = TAU * term.freq * time + term.phase;
    const next = [position[0] + radius * Math.cos(angle), position[1] + radius * Math.sin(angle)];
    if (radius > minRadius) {
      ctx.strokeStyle = `rgba(${guides},${opacity * (i < 5 ? .63 : .36)})`;
      ctx.beginPath(); ctx.arc(...position, radius, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(${rods},${opacity * .82})`; ctx.beginPath(); ctx.moveTo(...position); ctx.lineTo(...next); ctx.stroke();
      if (i < 6) dot(ctx, ...position, 1.6, `rgba(${guides},${opacity * .7})`);
    }
    position = next;
  }
  ctx.globalAlpha = opacity; ctx.fillStyle = ink; ctx.shadowColor = '#ffe0b2'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(...position, 3.7, 0, TAU); ctx.fill(); ctx.restore();
}

export function drawFourierContour(ctx, contour, { progress = 1, fill = '#df986a', colour = 0, ink = '#f4eee0', rings = true } = {}) {
  if (progress <= 0) return;
  ctx.save(); const inherited = ctx.globalAlpha;
  path(ctx, contour.points); ctx.globalAlpha = inherited * colour; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = inherited;
  if (progress >= 1) {
    ctx.strokeStyle = `rgba(249,214,173,${.14 + .7 * (1 - colour)})`; ctx.lineWidth = 1.55; ctx.stroke();
  } else {
    const points = contour.points.slice(0, Math.max(2, Math.ceil(progress * contour.points.length)));
    points.push(pointOnContour(contour, progress)); path(ctx, points, false);
    ctx.strokeStyle = ink; ctx.lineWidth = 2.3; ctx.lineCap = 'round'; ctx.stroke();
    if (rings) drawEpicycles(ctx, contour, progress, .92 * intervalProgress(progress, 0, .07, 'smooth') * (1 - intervalProgress(progress, .93, 1, 'smooth')), { ink });
  }
  ctx.restore();
}

export function drawFourierEquation(ctx, colour = '#99aea8') {
  text(ctx, 'z(t) =', 80, 1752, 24, colour, 400);
  text(ctx, 'Σ', 150, 1753, 29, colour, 400);
  text(ctx, 'c', 179, 1752, 24, colour, 400); text(ctx, 'k', 192, 1758, 14, colour, 400);
  text(ctx, 'e', 210, 1752, 24, colour, 400); text(ctx, 'i2πkt', 224, 1739, 14, colour, 400);
}

export function drawStoryTypography(ctx, frame, { brand = 'THE FOURIER SERIES', footer = 'FOURIER LIVING CREATURES', equation = drawFourierEquation } = {}) {
  const { theme, chapter, time, duration, project } = frame;
  dot(ctx, 87, 130, 5, theme.guide); tracked(ctx, brand, 106, 137, 19, theme.guide, 3.5);
  const opacity = chapterOpacity(chapter, time, duration, .2, project.loop);
  if (opacity >= .001) {
    ctx.save(); ctx.globalAlpha *= opacity;
    for (let i = 0; i < chapter.title.length; i++) {
      const line = chapter.title[i], maximum = 915 - 80;
      let size = line.length > 12 ? 87 : 100;
      ctx.font = `700 ${size}px "Film Sans", "Arial", sans-serif`;
      size *= Math.min(1, maximum / Math.max(1, ctx.measureText(line).width));
      text(ctx, line, 80, 254 + i * 112, size, i === chapter.title.length - 1 ? theme.accent : theme.ink, 700);
    }
    const caption = chapter.caption ?? '';
    ctx.font = '500 29px "Film Sans", "Arial", sans-serif';
    const size = 29 * Math.min(1, 845 / Math.max(1, ctx.measureText(caption).width));
    text(ctx, caption, 80, 1614, size, theme.ink, 500); ctx.restore();
  }
  ctx.strokeStyle = 'rgba(173,204,194,.24)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(80, 1660); ctx.lineTo(925, 1660); ctx.stroke();
  tracked(ctx, footer, 80, 1705, 16, theme.guide, 2.8);
  if (typeof equation === 'function') equation(ctx, '#99aea8', frame);
  else if (equation) text(ctx, equation, 80, 1752, 24, '#99aea8', 400);
  if (project.loop) {
    ctx.strokeStyle = theme.guide; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(912, 1737, 9, .3, TAU - .6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(915, 1726); ctx.lineTo(921, 1729); ctx.lineTo(917, 1734); ctx.stroke();
  }
}

export function drawDraftingBackground(ctx, time, { theme = {}, foliage = false } = {}) {
  ctx.fillStyle = theme.background ?? '#0c1923'; ctx.fillRect(0, 0, 1080, 1920);
  const glow = ctx.createRadialGradient(545, 955, 20, 545, 955, 850);
  glow.addColorStop(0, theme.glow ?? '#254341'); glow.addColorStop(.56, theme.mid ?? '#142c32'); glow.addColorStop(1, theme.background ?? '#0c1923');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 1920);
  ctx.save(); ctx.strokeStyle = 'rgba(179,211,196,0.045)'; ctx.lineWidth = 1;
  for (let x = 108; x < 1000; x += 72) { ctx.beginPath(); ctx.moveTo(x, 510); ctx.lineTo(x, 1480); ctx.stroke(); }
  for (let y = 544; y < 1480; y += 72) { ctx.beginPath(); ctx.moveTo(72, y); ctx.lineTo(1008, y); ctx.stroke(); }
  for (const r of [325, 405, 480]) { ctx.strokeStyle = `rgba(180,209,186,${r === 405 ? .13 : .055})`; ctx.beginPath(); ctx.arc(535, 1010, r, 0, TAU); ctx.stroke(); }
  for (let i = 0; i < 36; i++) {
    const a = i * 2.3999632 + Math.sin(time * TAU / 15 + i) * .04, r = 290 + (i * 61 % 210);
    dot(ctx, 535 + Math.cos(a) * r, 1010 + Math.sin(a) * r, i % 7 === 0 ? 2 : 1, 'rgba(210,219,186,0.23)');
  }
  ctx.restore();
  if (!foliage) return;
  for (const [x, y, flip] of [[25, 617, 1], [1059, 1220, -1], [16, 1497, 1]]) {
    ctx.save(); ctx.translate(x, y); ctx.scale(flip, 1); ctx.rotate(-.2 + Math.sin(time * TAU / 15) * .015);
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.translate(0, i * 39); ctx.rotate(-.8 + i * .08);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(54, -52, 127, -24, 152, 0); ctx.bezierCurveTo(81, 28, 29, 34, 0, 0);
      ctx.fillStyle = i % 2 ? 'rgba(55,94,81,0.18)' : 'rgba(64,100,86,0.13)'; ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }
}
