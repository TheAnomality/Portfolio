// Cross-sections through hydrogen orbitals, to show radial and angular nodes.
import { h } from '../lib/dom.js';
import { segmented } from '../lib/controls.js';
import { psiPlane, orbitalName, radialNodes, angularNodes, radiusContaining } from '../lib/hydrogen.js';

const SETS = {
  radial: { label: 'Radial nodes', items: [[1, 0, 0], [2, 0, 0], [3, 0, 0], [4, 0, 0]], plane: 'xz' },
  angular: { label: 'Angular nodes', items: [[4, 0, 0], [4, 1, 0], [4, 2, 0], [4, 3, 0]], plane: 'xz' },
  both: { label: 'Both', items: [[3, 1, 0], [4, 1, 0], [4, 2, 1], [5, 2, 2]], plane: 'xz' },
};

function render(cv, n, l, m, plane, half) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.round(cv.clientWidth * dpr) || 200;
  const res = Math.min(220, size);
  cv.width = res; cv.height = res;
  const { data } = psiPlane(n, l, m, { plane, half, res });
  let max = 0;
  for (const v of data) if (Math.abs(v) > max) max = Math.abs(v);
  const g = cv.getContext('2d');
  const img = g.createImageData(res, res);
  for (let i = 0; i < res * res; i++) {
    const v = data[i];
    // brightness follows the wave's amplitude |psi| so faint outer lobes stay visible
    const t = Math.pow(Math.abs(v) / (max || 1), 0.75);
    const c = v >= 0 ? [245, 154, 58] : [58, 156, 255];
    img.data[4 * i] = 11 + (c[0] - 11) * t;
    img.data[4 * i + 1] = 12 + (c[1] - 12) * t;
    img.data[4 * i + 2] = 15 + (c[2] - 15) * t;
    img.data[4 * i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

export function mount(el) {
  let set = 'radial';
  const frame = h('div.fig__frame.fig__frame--stage');
  const grid = h('div.slices');
  const controls = h('div.fig__controls');
  frame.append(grid, controls);
  el.prepend(frame);
  const seg = segmented({ label: 'Show', options: Object.entries(SETS).map(([k, v]) => ({ value: k, label: v.label })), value: set, onChange: (v) => { set = v; build(); } });
  controls.append(seg.el, h('span.spacer'), h('span.legend', null,
    h('span', null, h('i', { style: { background: '#f59a3a' } }), 'ψ > 0'),
    h('span', null, h('i', { style: { background: '#3a9cff' } }), 'ψ < 0'),
    h('span', null, h('i', { style: { background: '#0b0c0f', outline: '1px solid #444' } }), 'node (ψ = 0)')));

  function build() {
    grid.innerHTML = '';
    const S = SETS[set];
    for (const [n, l, m] of S.items) {
      const half = radiusContaining(n, l, 0.995) * 1.05;
      const cv = h('canvas', { role: 'img', 'aria-label': `Cross-section of the ${orbitalName(n, l, m).text} orbital` });
      const nm = orbitalName(n, l, m);
      const rn = radialNodes(n, l), an = angularNodes(l);
      const item = h('div.slice', null, cv,
        h('div.slice__name', { html: nm.html }),
        h('div.slice__meta', null, `${rn} radial · ${an} angular`, h('br'), `${(2 * half * 0.0529177).toFixed(2)} nm across`));
      grid.append(item);
      requestAnimationFrame(() => render(cv, n, l, m, S.plane, half));
    }
  }
  build();
  let lastW = 0;
  new ResizeObserver(() => { const w = grid.clientWidth; if (Math.abs(w - lastW) > 40) { lastW = w; build(); } }).observe(grid);
}
