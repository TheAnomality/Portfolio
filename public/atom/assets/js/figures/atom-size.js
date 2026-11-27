// Why an atom has the size it has: confinement energy versus electric attraction.
import { h, onThemeChange } from '../lib/dom.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { slider } from '../lib/controls.js';
import { linear, drawAxes, theme } from '../lib/plot.js';
import { fix } from '../lib/format.js';

const RY = 13.605693;   // eV
const A0_PM = 52.9177;

const KE = (r) => RY / (r * r);        // ħ²/(2 m r²), r in a0
const PE = (r) => (-2 * RY) / r;       // −k e²/r
const TOT = (r) => KE(r) + PE(r);

export function mount(el) {
  let r = 0.45;
  const frame = h('div.fig__frame');
  const split = h('div.fig-split');
  const left = h('div.plot');
  const right = h('div.fig-side', { style: { display: 'flex', flexDirection: 'column', gap: '.8rem' } });
  split.append(left, right);
  const controls = h('div.fig__controls');
  frame.append(split, controls);
  el.prepend(frame);

  const viz = h('div.plot');
  const read = h('dl.readouts');
  right.append(viz, read);

  const cv = setupCanvas(left, { height: (w) => Math.max(280, Math.min(380, w * 0.62)), onResize: () => draw() });
  const vz = setupCanvas(viz, { height: 170, onResize: () => drawViz() });
  cv.canvas.setAttribute('role', 'img');
  cv.canvas.setAttribute('aria-label', 'Graph of kinetic, potential and total energy of an electron confined to radius r. The total has a minimum of −13.6 eV at one Bohr radius.');

  const COL = { ke: '#d39a1c', pe: '#2f7cf6', tot: '#e0523b' };

  function draw() {
    const { ctx, w, h: hh } = cv;
    const t = theme();
    ctx.clearRect(0, 0, w, hh);
    const box = { x: 50, y: 24, w: w - 50 - 16, h: hh - 24 - 46 };
    const sx = linear([0, 4], [box.x, box.x + box.w]);
    const sy = linear([-32, 32], [box.y + box.h, box.y]);
    drawAxes(ctx, box, sx, sy, { xLabel: 'how tightly the electron is confined, r (Bohr radii)', yLabel: 'energy (eV)', yTicks: [-30, -20, -10, 0, 10, 20, 30] });
    // zero line
    ctx.strokeStyle = t.ink3;
    ctx.beginPath(); ctx.moveTo(box.x, Math.round(sy(0)) + 0.5); ctx.lineTo(box.x + box.w, Math.round(sy(0)) + 0.5); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    const curve = (f, col, wdt) => {
      ctx.strokeStyle = col; ctx.lineWidth = wdt;
      ctx.beginPath();
      for (let i = 0; i <= 400; i++) {
        const rr = 0.12 + (i / 400) * 3.9;
        const y = sy(f(rr));
        i ? ctx.lineTo(sx(rr), y) : ctx.moveTo(sx(rr), y);
      }
      ctx.stroke();
    };
    curve(KE, COL.ke, 1.6);
    curve(PE, COL.pe, 1.6);
    curve(TOT, COL.tot, 2.6);
    ctx.restore();
    // minimum
    ctx.fillStyle = t.ink;
    ctx.beginPath(); ctx.arc(sx(1), sy(-RY), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = FONT.sans(11, 500);
    ctx.textAlign = 'left';
    ctx.fillText('lowest energy: −13.6 eV at r = 52.9 pm', sx(1) + 8, sy(-RY) + 16);
    // labels
    ctx.font = FONT.sans(11.5, 500);
    ctx.fillStyle = COL.ke; ctx.fillText('confinement (kinetic) energy ∝ 1/r²', sx(1.1), sy(16));
    ctx.fillStyle = COL.pe; ctx.fillText('electric attraction ∝ −1/r', sx(1.55), sy(-23));
    ctx.fillStyle = COL.tot; ctx.fillText('total', sx(3.2), sy(TOT(3.2)) - 9);
    // current r
    const x = sx(r);
    ctx.strokeStyle = t.ink2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x + 0.5, box.y); ctx.lineTo(x + 0.5, box.y + box.h); ctx.stroke();
    ctx.setLineDash([]);
    for (const [f, c] of [[KE, COL.ke], [PE, COL.pe], [TOT, COL.tot]]) {
      const y = sy(f(r));
      if (y < box.y || y > box.y + box.h) continue;
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    read.innerHTML = `
      <div class="readout"><dt>Radius</dt><dd>${fix(r * A0_PM, 0)} pm</dd></div>
      <div class="readout"><dt style="color:${COL.ke}">Kinetic</dt><dd>+${fix(KE(r), 1)} eV</dd></div>
      <div class="readout"><dt style="color:${COL.pe}">Potential</dt><dd>${fix(PE(r), 1)} eV</dd></div>
      <div class="readout"><dt style="color:${COL.tot}">Total</dt><dd>${fix(TOT(r), 1)} eV</dd></div>`;
  }

  function drawViz() {
    const { ctx, w, h: hh } = vz;
    const t = theme();
    ctx.clearRect(0, 0, w, hh);
    const cx = w / 2, cy = hh / 2;
    const pxPerA0 = Math.min(w, hh) / 2 / 4.2;
    const R = r * pxPerA0 * 1.6;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
    g.addColorStop(0, 'rgba(47,124,246,0.55)');
    g.addColorStop(0.55, 'rgba(47,124,246,0.22)');
    g.addColorStop(1, 'rgba(47,124,246,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = t.ink3;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.arc(cx, cy, pxPerA0 * 1.6, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e0523b';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.ink3;
    ctx.font = FONT.sans(10.5);
    ctx.textAlign = 'center';
    ctx.fillText('dashed ring: 1 Bohr radius', cx, hh - 6);
  }

  const rs = slider({ label: 'Squeeze the electron into', min: 0.2, max: 3.5, step: 0.01, value: r, width: 'clamp(9rem, 32vw, 20rem)',
    format: (v) => `${fix(v * A0_PM, 0)} pm`, onInput: (v) => { r = v; draw(); drawViz(); } });
  controls.append(rs.el);
  onThemeChange(() => { draw(); drawViz(); });
  draw();
  drawViz();
}
