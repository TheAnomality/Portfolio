// Sunlight's dark lines matched against laboratory spectra of the elements.
import { h, tooltip } from '../lib/dom.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { getSpectra } from '../lib/data.js';
import { wavelengthRGB, planck } from '../lib/color.js';
import { drawWavelengthAxis } from '../lib/spectrum.js';
import { fix } from '../lib/format.js';

const RANGE = [380, 700];
// Principal Fraunhofer lines (air wavelengths, nm). depth 0..1, width in nm.
const FRAUNHOFER = [
  { nm: 393.366, d: 0.95, w: 1.1, label: 'K', el: 'Ca⁺' },
  { nm: 396.847, d: 0.95, w: 1.0, label: 'H', el: 'Ca⁺' },
  { nm: 410.174, d: 0.6, w: 0.22, label: 'h', el: 'H' },
  { nm: 422.673, d: 0.7, w: 0.16, label: 'g', el: 'Ca' },
  { nm: 430.790, d: 0.72, w: 0.3, label: 'G', el: 'Fe, CH' },
  { nm: 434.047, d: 0.6, w: 0.22, label: 'G′', el: 'H' },
  { nm: 438.355, d: 0.55, w: 0.1, label: 'e', el: 'Fe' },
  { nm: 466.814, d: 0.4, w: 0.08, label: 'd', el: 'Fe' },
  { nm: 486.134, d: 0.72, w: 0.26, label: 'F', el: 'H' },
  { nm: 495.761, d: 0.42, w: 0.08, label: 'c', el: 'Fe' },
  { nm: 516.733, d: 0.6, w: 0.12, label: 'b₄', el: 'Mg' },
  { nm: 517.270, d: 0.7, w: 0.14, label: 'b₂', el: 'Mg' },
  { nm: 518.362, d: 0.75, w: 0.15, label: 'b₁', el: 'Mg' },
  { nm: 527.039, d: 0.5, w: 0.1, label: 'E₂', el: 'Fe' },
  { nm: 588.995, d: 0.82, w: 0.13, label: 'D₂', el: 'Na' },
  { nm: 589.592, d: 0.78, w: 0.13, label: 'D₁', el: 'Na' },
  { nm: 627.66, d: 0.32, w: 0.45, label: 'a', el: 'O₂ in Earth’s air' },
  { nm: 656.281, d: 0.82, w: 0.32, label: 'C', el: 'H' },
  { nm: 686.719, d: 0.62, w: 0.6, label: 'B', el: 'O₂ in Earth’s air' },
];

const OVERLAYS = [
  { key: 'H', label: 'Hydrogen', color: '#ff7a6b', src: ['H', 'I'], n: 5 },
  { key: 'Na', label: 'Sodium', color: '#ffd166', src: ['Na', 'I'], n: 2 },
  { key: 'Mg', label: 'Magnesium', color: '#7bd389', src: ['Mg', 'I'], n: 4 },
  { key: 'Ca', label: 'Calcium', color: '#c3a6ff', src: [['Ca', 'II', 2], ['Ca', 'I', 1]] },
  { key: 'Fe', label: 'Iron', color: '#7fb6ff', src: ['Fe', 'I'], n: 30 },
  { key: 'He', label: 'Helium', color: '#ffffff', src: ['He', 'I'], n: 1 },
];

export async function mount(el) {
  const spectra = await getSpectra();
  const active = new Set(['H']);

  // extra weaker iron lines to give the synthetic spectrum realistic texture
  const fe = (spectra.Fe?.I?.l || []).filter(([nm]) => nm > RANGE[0] && nm < RANGE[1]);
  const feMax = Math.max(...fe.map((l) => l[1]));
  const minor = fe.sort((a, b) => b[1] - a[1]).slice(0, 90)
    .map(([nm, I]) => ({ nm, d: 0.12 + 0.28 * Math.sqrt(I / feMax), w: 0.07, label: '', el: 'Fe' }));
  const absLines = [...FRAUNHOFER, ...minor];

  function overlayLines(o) {
    const out = [];
    const srcs = Array.isArray(o.src[0]) ? o.src : [[...o.src, o.n]];
    for (const [s, ion, n] of srcs) {
      const l = (spectra[s]?.[ion]?.l || []).filter(([nm]) => nm >= RANGE[0] && nm <= RANGE[1]);
      out.push(...l.sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]));
    }
    return out;
  }

  const frame = h('div.fig__frame.fig__frame--stage');
  const wrap = h('div.plot', { style: { padding: '0 1.1rem' } });
  const controls = h('div.fig__controls');
  const status = h('p.caption', { style: { margin: 0, padding: '0 1.1rem 1rem', maxWidth: 'none', color: 'var(--stage-ink-3)' } });
  frame.append(h('div', { style: { height: '14px' } }), wrap, controls, status);
  el.prepend(frame);
  const tip = tooltip(wrap);

  const chipWrap = h('div.quick', { role: 'group', 'aria-label': 'Overlay laboratory lines' });
  for (const o of OVERLAYS) {
    const b = h('button', { type: 'button', 'aria-pressed': String(active.has(o.key)) },
      h('span', { style: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: o.color, marginRight: '.4rem' } }), o.label);
    b.addEventListener('click', () => {
      active.has(o.key) ? active.delete(o.key) : active.add(o.key);
      b.setAttribute('aria-pressed', String(active.has(o.key)));
      draw();
    });
    chipWrap.append(b);
  }
  controls.append(h('span.control__label', null, 'Overlay lab lines'), chipWrap);

  const cv = setupCanvas(wrap, { height: (w) => Math.max(150, Math.min(220, w * 0.2)) + 70, onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');
  cv.canvas.setAttribute('aria-label', 'The visible spectrum of sunlight with dark absorption lines, and markers showing where laboratory lines of selected elements fall.');
  let box = null;

  // precompute the spectrum image at 1px resolution
  function spectrumImage(width, height) {
    const c = document.createElement('canvas');
    c.width = width; c.height = 1;
    const g = c.getContext('2d');
    const img = g.createImageData(width, 1);
    const bbMax = planck(500, 5772);
    for (let x = 0; x < width; x++) {
      const nm = RANGE[0] + ((x + 0.5) / width) * (RANGE[1] - RANGE[0]);
      let T = 1;
      for (const l of absLines) {
        const dx = (nm - l.nm) / (l.w / 2);
        if (Math.abs(dx) < 6) T *= 1 - l.d / (1 + dx * dx);
      }
      const bb = 0.72 + 0.28 * (planck(nm, 5772) / bbMax);
      const [r, gg, b] = wavelengthRGB(nm);
      img.data[4 * x] = r * 255 * T * bb;
      img.data[4 * x + 1] = gg * 255 * T * bb;
      img.data[4 * x + 2] = b * 255 * T * bb;
      img.data[4 * x + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  let cache = null;

  function draw() {
    const { ctx, w, h: hh } = cv;
    ctx.clearRect(0, 0, w, hh);
    box = { x: 0, y: 34, w, h: hh - 34 - 36 };
    const pxw = Math.round(w * cv.dpr);
    if (!cache || cache.width !== pxw) cache = spectrumImage(pxw, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cache, box.x, box.y, box.w, box.h);
    const sx = (nm) => box.x + ((nm - RANGE[0]) / (RANGE[1] - RANGE[0])) * box.w;
    // Fraunhofer letters
    ctx.font = FONT.serif(12, 500, 'italic');
    ctx.fillStyle = '#8d8a83';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const l of FRAUNHOFER) {
      if (l.label === 'b₄' || l.label === 'D₁' || l.label === 'G′' || l.label === 'h' || l.label === 'e' || l.label === 'c' || l.label === 'd') continue;
      ctx.fillText(l.label.replace(/[₁₂]/, ''), sx(l.nm), box.y + box.h + 30);
    }
    drawWavelengthAxis(ctx, box, RANGE, { color: '#6e6b65', step: 20, unit: false });
    // overlays
    let row = 0;
    const msgs = [];
    for (const o of OVERLAYS) {
      if (!active.has(o.key)) continue;
      const lines = overlayLines(o);
      ctx.strokeStyle = o.color;
      ctx.fillStyle = o.color;
      ctx.lineWidth = 1.5;
      const y0 = 4 + (row % 3) * 9;
      for (const nm of lines) {
        const x = sx(nm);
        ctx.globalAlpha = 0.95;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, box.y - 3); ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(x, y0, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      row++;
      if (o.key === 'He') msgs.push('Helium’s yellow line at 587.6 nm is missing from ordinary sunlight. In 1868 it was spotted shining in the Sun’s glowing edge during an eclipse, which is how helium was discovered, 27 years before anyone found it on Earth.');
    }
    status.textContent = msgs.join(' ') || 'Each marker is a line measured in a laboratory (NIST). Where markers sit on dark lines, that element is absorbing light in the Sun’s atmosphere. The lines labelled B and a come from oxygen in Earth’s own air.';
  }

  cv.canvas.addEventListener('pointermove', (ev) => {
    if (!box) return;
    const r = cv.canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    const nm = RANGE[0] + ((x - box.x) / box.w) * (RANGE[1] - RANGE[0]);
    let best = null;
    for (const l of FRAUNHOFER) if (Math.abs(l.nm - nm) < 1.2 && (!best || Math.abs(l.nm - nm) < Math.abs(best.nm - nm))) best = l;
    if (best) tip.show(`<b>${best.label} line</b> · ${fix(best.nm, 2)} nm<br>${best.el}`, x, y);
    else tip.show(`${fix(nm, 1)} nm`, x, y);
  });
  cv.canvas.addEventListener('pointerleave', () => tip.hide());
  draw();
}
