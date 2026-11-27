// Energy between two protons: electric repulsion versus the short-range nuclear force.
import { h, onThemeChange, tooltip } from '../lib/dom.js';
import { setupCanvas, FONT, haloText } from '../lib/canvas.js';
import { linear, drawAxes, theme } from '../lib/plot.js';
import { segmented } from '../lib/controls.js';
import { fix } from '../lib/format.js';

// Malfliet–Tjon form: short-range repulsion plus Yukawa attraction (MT-V parameters).
const VR = 1438.72, MR = 3.11, VA = 570.32, MA = 1.55;
const nuclear = (r) => (VR * Math.exp(-MR * r) - VA * Math.exp(-MA * r)) / r; // MeV, r in fm
const coulomb = (r) => 1.43996 / r;

export function mount(el) {
  let show = 'both';
  const frame = h('div.fig__frame');
  const wrap = h('div.plot');
  const controls = h('div.fig__controls');
  frame.append(wrap, controls);
  el.prepend(frame);
  const tip = tooltip(wrap);
  const cv = setupCanvas(wrap, { height: (w) => Math.max(280, Math.min(380, w * 0.42)), onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');
  cv.canvas.setAttribute('aria-label', 'Potential energy of two protons against distance. The nuclear force creates a deep well near one femtometre; beyond about three femtometres only electric repulsion remains.');
  let layout = null, hx = null;

  const COL = { nuc: '#7a4fd0', cou: '#e0523b', tot: '#1f7a4d' };

  function draw() {
    const { ctx, w, h: hh } = cv;
    const t = theme();
    ctx.clearRect(0, 0, w, hh);
    const box = { x: 48, y: 22, w: w - 48 - 16, h: hh - 22 - 46 };
    const sx = linear([0, 6], [box.x, box.x + box.w]);
    const sy = linear(show === 'coulomb' ? [-1, 5] : [-70, 50], [box.y + box.h, box.y]);
    drawAxes(ctx, box, sx, sy, { xLabel: 'distance between the protons (femtometres, 10⁻¹⁵ m)', yLabel: 'potential energy (MeV)', yTicks: show === 'coulomb' ? [0, 1, 2, 3, 4, 5] : [-60, -40, -20, 0, 20, 40] });
    ctx.strokeStyle = t.ink3;
    ctx.beginPath(); ctx.moveTo(box.x, Math.round(sy(0)) + 0.5); ctx.lineTo(box.x + box.w, Math.round(sy(0)) + 0.5); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    const curve = (f, col, wd, dash) => {
      ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (let i = 0; i <= 500; i++) { const r = 0.15 + (i / 500) * 5.85; const y = sy(f(r)); i ? ctx.lineTo(sx(r), y) : ctx.moveTo(sx(r), y); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (show !== 'coulomb') curve(nuclear, COL.nuc, 1.6, [5, 4]);
    curve(coulomb, COL.cou, 1.6, show === 'coulomb' ? [] : [5, 4]);
    if (show !== 'coulomb') curve((r) => nuclear(r) + coulomb(r), COL.tot, 2.6);
    ctx.restore();
    ctx.font = FONT.sans(11, 500);
    ctx.textAlign = 'left';
    if (show === 'coulomb') {
      haloText(ctx, 'electric repulsion: 1.44 MeV at 1 fm, falling as 1/r', sx(1.05), sy(1.44) - 10, COL.cou, t.bg, 4);
      haloText(ctx, '(at atomic distances, 0.1 nm, it is 100,000 times weaker)', sx(1.05), sy(1.44) + 8, t.ink3, t.bg, 4);
    } else {
      haloText(ctx, 'repulsive core', sx(0.32), sy(38), t.ink2, t.bg, 4);
      haloText(ctx, 'deep attraction near 1 fm', sx(1.05), sy(-52), COL.tot, t.bg, 4);
      haloText(ctx, 'beyond ~3 fm the nuclear force vanishes; only electric repulsion is left', sx(2.6), sy(9), t.ink2, t.bg, 4);
      ctx.fillStyle = COL.nuc; ctx.fillText('- - nuclear force alone', box.x + box.w - 190, box.y + box.h - 30);
      ctx.fillStyle = COL.cou; ctx.fillText('- - electric repulsion alone', box.x + box.w - 190, box.y + box.h - 14);
    }
    if (hx != null) {
      const r = sx.invert(hx);
      if (r > 0.15 && r < 6) {
        ctx.strokeStyle = t.ink3; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(hx + 0.5, box.y); ctx.lineTo(hx + 0.5, box.y + box.h); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    layout = { sx, box };
  }
  const seg = segmented({ label: 'Show', options: [{ value: 'both', label: 'Both forces' }, { value: 'coulomb', label: 'Electric force alone' }], value: show, onChange: (v) => { show = v; draw(); } });
  controls.append(seg.el);
  cv.canvas.addEventListener('pointermove', (ev) => {
    if (!layout) return;
    const rc = cv.canvas.getBoundingClientRect();
    const x = ev.clientX - rc.left;
    const r = layout.sx.invert(x);
    if (r < 0.15 || r > 6) { tip.hide(); hx = null; draw(); return; }
    hx = x; draw();
    tip.show(`<b>${fix(r, 2)} fm</b><br>electric: +${fix(coulomb(r), 2)} MeV<br>nuclear: ${fix(nuclear(r), 2)} MeV<br>total: ${fix(nuclear(r) + coulomb(r), 2)} MeV`, x, ev.clientY - rc.top);
  });
  cv.canvas.addEventListener('pointerleave', () => { hx = null; tip.hide(); draw(); });
  onThemeChange(draw);
  draw();
}
