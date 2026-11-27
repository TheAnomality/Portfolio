// Radial probability distributions P(r) = r² R(r)² for hydrogen orbitals.
import { h, tooltip, onThemeChange } from '../lib/dom.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { segmented } from '../lib/controls.js';
import { linear, drawAxes, theme } from '../lib/plot.js';
import { radial, radialNodes } from '../lib/hydrogen.js';
import { fix } from '../lib/format.js';

const PRESETS = {
  s: { label: '1s · 2s · 3s', curves: [[1, 0], [2, 0], [3, 0]], note: 'Each step up in n pushes the electron farther out and adds one spherical node, a radius where it is never found.' },
  n3: { label: '3s · 3p · 3d', curves: [[3, 0], [3, 1], [3, 2]], note: 'Same n, same energy in hydrogen. But the 3s electron has a small inner bump close to the nucleus. In atoms with more electrons that inner bump matters: it lets 3s electrons dodge the shielding of inner electrons.' },
  pen: { label: '4s vs 3d', curves: [[3, 2], [4, 0]], note: 'On average the 4s electron sits farther out than 3d, yet part of its wave reaches deep inside. This penetration is one reason 4s fills before 3d in potassium and calcium (Chapter 5).' },
  big: { label: '1s → 4f', curves: [[1, 0], [2, 1], [3, 2], [4, 3]], note: 'With ℓ = n − 1 there are no radial nodes, and the most likely radius is exactly n² Bohr radii: 1, 4, 9, 16. These are Bohr’s orbit radii, reappearing inside quantum mechanics.' },
};
const COLORS = ['#e0523b', '#2f7cf6', '#d39a1c', '#3aa676'];

export function mount(el) {
  let preset = 'pen';
  const frame = h('div.fig__frame');
  const wrap = h('div.plot');
  const note = h('p.caption', { style: { margin: '0', padding: '0 1rem 1rem', maxWidth: 'none' } });
  frame.append(wrap);
  const controls = h('div.fig__controls');
  frame.append(controls, note);
  el.prepend(frame);
  const tip = tooltip(wrap);

  const seg = segmented({ label: 'Compare', options: Object.entries(PRESETS).map(([k, v]) => ({ value: k, label: v.label })), value: preset, onChange: (v) => { preset = v; draw(); } });
  controls.append(seg.el);

  const cv = setupCanvas(wrap, { height: (w) => Math.max(260, Math.min(380, w * 0.46)), onResize: () => draw() });
  let hoverX = null;
  let layout = null;

  function curveData(n, l, rmax) {
    const N = 600, pts = [];
    for (let i = 0; i <= N; i++) {
      const r = (i / N) * rmax, R = radial(n, l, r);
      pts.push([r, r * r * R * R]);
    }
    return pts;
  }

  function draw() {
    const { ctx, w, h: hh } = cv;
    const t = theme();
    ctx.clearRect(0, 0, w, hh);
    const P = PRESETS[preset];
    note.textContent = P.note;
    const maxN = Math.max(...P.curves.map((c) => c[0]));
    const rmax = maxN <= 1 ? 8 : maxN === 2 ? 16 : maxN === 3 ? 28 : 40;
    const box = { x: 46, y: 26, w: w - 46 - 18, h: hh - 26 - 44 };
    const data = P.curves.map(([n, l]) => curveData(n, l, rmax));
    const ymax = Math.max(...data.flat().map((p) => p[1])) * 1.12;
    const sx = linear([0, rmax], [box.x, box.x + box.w]);
    const sy = linear([0, ymax], [box.y + box.h, box.y]);
    drawAxes(ctx, box, sx, sy, { xLabel: 'distance from nucleus, r (Bohr radii, a₀ = 52.9 pm)', yLabel: 'probability per unit radius', fmtY: () => '', yLabels: false });
    layout = { sx, sy, box, data, P };
    P.curves.forEach(([n, l], i) => {
      const pts = data[i];
      const col = COLORS[i];
      ctx.save();
      // fill
      ctx.beginPath();
      ctx.moveTo(sx(0), sy(0));
      for (const [r, p] of pts) ctx.lineTo(sx(r), sy(p));
      ctx.lineTo(sx(rmax), sy(0));
      ctx.closePath();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = col;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      pts.forEach(([r, p], k) => (k ? ctx.lineTo(sx(r), sy(p)) : ctx.moveTo(sx(r), sy(p))));
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
      // nodes: interior zeros of R
      let prev = radial(n, l, 1e-6);
      for (let k = 1; k <= 4000; k++) {
        const r = (k / 4000) * rmax, R = radial(n, l, r);
        if (R * prev < 0) {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(sx(r), sy(0), 3.2, 0, Math.PI * 2); ctx.fill();
        }
        prev = R;
      }
      // label at peak
      let best = pts[0];
      for (const p of pts) if (p[1] > best[1]) best = p;
      ctx.font = FONT.serif(15, 500);
      ctx.fillStyle = col;
      ctx.textAlign = 'center';
      ctx.fillText(`${n}${'spdf'[l]}`, sx(best[0]), sy(best[1]) - 8);
      ctx.restore();
    });
    // legend for node markers
    ctx.font = FONT.sans(11);
    ctx.fillStyle = t.ink3;
    ctx.textAlign = 'right';
    ctx.fillText('● on the axis = radial node', box.x + box.w, box.y - 10);
    if (hoverX != null) {
      const r = sx.invert(hoverX);
      if (r >= 0 && r <= rmax) {
        ctx.strokeStyle = t.ink3;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(hoverX + 0.5, box.y); ctx.lineTo(hoverX + 0.5, box.y + box.h); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function cumulative(n, l, r) {
    const N = 800; let s = 0; const dr = r / N;
    for (let i = 1; i <= N; i++) { const x = i * dr, R = radial(n, l, x); s += x * x * R * R * dr; }
    return s;
  }

  cv.canvas.addEventListener('pointermove', (e) => {
    if (!layout) return;
    const rect = cv.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const r = layout.sx.invert(x);
    if (r < 0 || r > layout.sx.domain[1]) { tip.hide(); hoverX = null; draw(); return; }
    hoverX = x;
    draw();
    const rows = layout.P.curves.map(([n, l], i) =>
      `<span style="color:${COLORS[i]}">●</span> ${n}${'spdf'[l]}: ${fix(100 * cumulative(n, l, r), 1)}% inside`).join('<br>');
    tip.show(`<b>r = ${fix(r, 1)} a₀</b> (${fix(r * 52.9177, 0)} pm)<br>${rows}`, x, y);
  });
  cv.canvas.addEventListener('pointerleave', () => { hoverX = null; tip.hide(); draw(); });
  onThemeChange(draw);
  draw();
}
