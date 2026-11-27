// Periodic trends with annotations: ionisation energy, estimated radius, electronegativity.
import { h, onThemeChange, tooltip } from '../lib/dom.js';
import { getElements } from '../lib/data.js';
import { setupCanvas, FONT, haloText } from '../lib/canvas.js';
import { segmented } from '../lib/controls.js';
import { linear, drawAxes, theme } from '../lib/plot.js';
import { fix } from '../lib/format.js';
import { slater } from './zeff.js';

const NSTAR = [0, 1, 2, 3, 3.7, 4.0, 4.2];
const ZMAX = 56;

const MODES = {
  ie: {
    label: 'Ionisation energy', unit: 'eV', get: (e) => e.ie, max: 26,
    notes: [
      { z: 2, text: 'helium: hardest atom to ionise', dy: -10 },
      { z: 3, text: 'lithium: new shell, easy to strip', dy: 14, dx: 8 },
      { z: 5, text: 'boron: first 2p electron', dy: 16, dx: 6 },
      { z: 8, text: 'oxygen: first paired 2p electron', dy: 18, dx: 6 },
      { z: 10, text: 'neon', dy: -10 },
      { z: 18, text: 'argon', dy: -10 },
      { z: 36, text: 'krypton', dy: -10 },
      { z: 54, text: 'xenon', dy: -10 },
    ],
  },
  radius: {
    label: 'Size of the outer orbital (estimate)', unit: 'pm', max: 260,
    get: (e) => { const s = slater(e); const n = Math.max(...e.shells.map((c, i) => (c ? i + 1 : 0))); return (NSTAR[n] ** 2 * 52.9177) / s.zeff; },
    notes: [
      { z: 3, text: 'each new shell starts big', dy: -10 },
      { z: 10, text: 'shrinks across a period as the effective charge grows', dy: 30, dx: -60 },
    ],
  },
  en: {
    label: 'Electronegativity (Pauling)', unit: '', get: (e) => e.en, max: 4.4,
    notes: [
      { z: 9, text: 'fluorine: the greediest atom', dy: -10 },
      { z: 55, text: 'caesium', dy: -10 },
    ],
  },
};

export async function mount(el) {
  const E = await getElements();
  let mode = 'ie';
  const frame = h('div.fig__frame');
  const wrap = h('div.plot');
  const controls = h('div.fig__controls');
  const note = h('p.caption', { style: { margin: 0, padding: '0 1.1rem 1rem', maxWidth: 'none' } });
  frame.append(wrap, controls, note);
  el.prepend(frame);
  const tip = tooltip(wrap);
  const cv = setupCanvas(wrap, { height: (w) => Math.max(280, Math.min(400, w * 0.42)), onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');
  let layout = null;

  const NOTES = {
    ie: 'Ionisation energy is the energy needed to pull off the outermost electron. It climbs across each period as the nucleus gains protons, then collapses when a new shell begins. The small dips at boron and oxygen are fingerprints of sub-shells and of electron pairing.',
    radius: 'Estimated from the effective charge: radius ≈ n*² a₀ / Z_eff, with Slater’s effective quantum numbers. Atoms shrink across a period, even as they gain electrons, because each added proton pulls the whole cloud in more strongly than one more electron in the same shell pushes it out.',
    en: 'Electronegativity measures how strongly an atom pulls shared electrons in a bond (Pauling’s scale). It follows the same logic: high on the right, where the effective charge is large and the shell nearly full; low on the left. Noble gases are usually left out because they rarely bond.',
  };

  function draw() {
    const { ctx, w, h: hh } = cv;
    const t = theme();
    ctx.clearRect(0, 0, w, hh);
    const M = MODES[mode];
    note.textContent = NOTES[mode];
    const box = { x: 46, y: 26, w: w - 46 - 16, h: hh - 26 - 44 };
    const sx = linear([0.5, ZMAX + 0.5], [box.x, box.x + box.w]);
    const sy = linear([0, M.max], [box.y + box.h, box.y]);
    const nobles = [2, 10, 18, 36, 54];
    let prev = 0;
    ctx.font = FONT.sans(10);
    nobles.concat([ZMAX]).forEach((z, i) => {
      if (i % 2 === 1) { ctx.globalAlpha = 0.06; ctx.fillStyle = t.ink; ctx.fillRect(sx(prev + 0.5), box.y, sx(z + 0.5) - sx(prev + 0.5), box.h); ctx.globalAlpha = 1; }
      ctx.fillStyle = t.ink3;
      ctx.textAlign = 'center';
      if (z - prev > 3) ctx.fillText(`period ${i + 1}`, (sx(prev + 0.5) + sx(z + 0.5)) / 2, box.y + box.h - 8);
      prev = z;
    });
    drawAxes(ctx, box, sx, sy, { xLabel: 'atomic number', yLabel: `${M.label}${M.unit ? ` (${M.unit})` : ''}`, xTicks: [1, 10, 20, 30, 40, 50, 56] });
    const pts = E.list.filter((e) => e.z <= ZMAX).map((e) => [e, M.get(e)]).filter(([, v]) => v != null);
    ctx.strokeStyle = '#2f7cf6';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let pz = -9;
    for (const [e, v] of pts) { const x = sx(e.z), y = sy(v); e.z === pz + 1 ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pz = e.z; }
    ctx.stroke();
    for (const [e, v] of pts) {
      ctx.fillStyle = nobles.includes(e.z) ? '#7a4fd0' : [1, 3, 11, 19, 37, 55].includes(e.z) ? '#e0523b' : '#2f7cf6';
      ctx.beginPath(); ctx.arc(sx(e.z), sy(v), 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = FONT.sans(11);
    for (const n of M.notes) {
      const e = E.byZ(n.z), v = M.get(e);
      if (v == null) continue;
      const x = sx(n.z), y = sy(v);
      ctx.textAlign = 'left';
      haloText(ctx, n.text, x + (n.dx ?? 6), y + n.dy, t.ink2, t.bg, 4);
    }
    layout = { sx, box, M };
  }

  const seg = segmented({ label: 'Show', options: Object.entries(MODES).map(([k, v]) => ({ value: k, label: v.label.replace(' (estimate)', '').replace(' (Pauling)', '') })), value: mode, onChange: (v) => { mode = v; draw(); } });
  controls.append(seg.el);
  cv.canvas.addEventListener('pointermove', (ev) => {
    if (!layout) return;
    const r = cv.canvas.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const z = Math.max(1, Math.min(ZMAX, Math.round(layout.sx.invert(x))));
    const e = E.byZ(z), v = layout.M.get(e);
    tip.show(`<b>${e.name}</b> (${z})<br>${v != null ? `${fix(v, layout.M.unit === 'pm' ? 0 : 2)} ${layout.M.unit}` : 'no data'}`, x, ev.clientY - r.top);
  });
  cv.canvas.addEventListener('pointerleave', () => tip.hide());
  onThemeChange(draw);
  draw();
}
