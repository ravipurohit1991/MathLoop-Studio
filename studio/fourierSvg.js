const SVG_NS = 'http://www.w3.org/2000/svg';
const GEOMETRY_SELECTOR = 'path, polyline, polygon, rect, circle, ellipse, line';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_GEOMETRIES = 96;

function sanitizeSvg(root) {
  root.querySelectorAll('script, foreignObject, image, use, style, iframe, audio, video').forEach((node) => node.remove());
  for (const node of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'href' || name === 'xlink:href' || name === 'style') {
        node.removeAttribute(attribute.name);
      }
    }
  }
}

function applyMatrix(point, matrix) {
  if (!matrix) return [point.x, point.y];
  return [
    matrix.a * point.x + matrix.c * point.y + matrix.e,
    matrix.b * point.x + matrix.d * point.y + matrix.f,
  ];
}

function viewBoxSize(svg) {
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox?.width > 0 && viewBox?.height > 0) return [viewBox.width, viewBox.height];
  const width = Number.parseFloat(svg.getAttribute('width'));
  const height = Number.parseFloat(svg.getAttribute('height'));
  return [Number.isFinite(width) ? width : 300, Number.isFinite(height) ? height : 150];
}

/** Parse and sample SVG geometry using the browser's native path implementation. */
export function parseSvgText(text) {
  if (!String(text).trim()) throw new Error('That SVG file is empty.');
  const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
  const parseError = parsed.querySelector('parsererror');
  if (parseError) throw new Error('The SVG could not be parsed. Try exporting it again as plain SVG.');
  if (parsed.documentElement?.localName !== 'svg') throw new Error('The selected file is not an SVG document.');

  const svg = document.importNode(parsed.documentElement, true);
  if (svg.namespaceURI !== SVG_NS) throw new Error('The selected file does not use the SVG namespace.');
  sanitizeSvg(svg);

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '1000px',
    height: '1000px',
    overflow: 'hidden',
    pointerEvents: 'none',
    opacity: '0',
  });
  svg.setAttribute('width', '1000');
  svg.setAttribute('height', '1000');
  host.appendChild(svg);
  document.body.appendChild(host);

  try {
    const measured = [...svg.querySelectorAll(GEOMETRY_SELECTOR)]
      .map((element, sourceIndex) => {
        try {
          return { element, sourceIndex, length: element.getTotalLength() };
        } catch {
          return null;
        }
      })
      .filter((entry) => entry && Number.isFinite(entry.length) && entry.length > 0.01)
      .sort((a, b) => b.length - a.length);

    if (!measured.length) {
      throw new Error('No path, line, polygon, rectangle, circle, or ellipse was found in the SVG.');
    }

    const selected = measured.slice(0, MAX_GEOMETRIES).sort((a, b) => a.sourceIndex - b.sourceIndex);
    const paths = selected.map(({ element, length }) => {
      const tag = element.localName.toLowerCase();
      const matrix = element.getCTM();
      const sampleCount = Math.max(12, Math.min(900, Math.ceil(length / 3)));
      const points = [];
      for (let i = 0; i < sampleCount; i++) {
        const point = element.getPointAtLength((i / Math.max(1, sampleCount - 1)) * length);
        points.push(applyMatrix(point, matrix));
      }
      const inherentlyClosed = ['polygon', 'rect', 'circle', 'ellipse'].includes(tag);
      const endpointDistance = Math.hypot(
        points[0][0] - points[points.length - 1][0],
        points[0][1] - points[points.length - 1][1],
      );
      const closed = inherentlyClosed || endpointDistance < Math.max(0.01, length * 0.002);
      if (closed && endpointDistance < 0.01) points.pop();
      return { points, closed, length };
    });

    return {
      paths,
      geometryCount: measured.length,
      usedGeometryCount: selected.length,
      ignoredGeometryCount: Math.max(0, measured.length - selected.length),
      viewBox: viewBoxSize(svg),
    };
  } finally {
    host.remove();
  }
}

export async function loadSvgFile(file) {
  if (!file) throw new Error('Choose an SVG file first.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Keep SVG files under 5 MB for reliable browser processing.');
  if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
    throw new Error('Fourier Lab currently accepts SVG vector files.');
  }
  return parseSvgText(await file.text());
}
