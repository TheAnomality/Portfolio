// Binding energy per nucleon for every measured nucleus, with a mass-defect calculator.
import { h, onThemeChange, tooltip, isDark, cssVar } from '../lib/dom.js';
import { getNuclides, getElements, decayClass } from '../lib/data.js';
import { setupCanvas, FONT, haloText } from '../lib/canvas.js';
import { linear, drawAxes, theme } from '../lib/plot.js';
import { C } from '../lib/physics.js';
import { fix } from '../lib/format.js';

const QUICK = [[1, 1], [2, 2], [6, 6], [8, 8], [26, 30], [28, 34], [50, 70], [82, 126], [92, 143], [92, 146]];

export async function mount(el) {
  const [N, E] = await Promise.all([getNuclides(), getElements()]);
  const pts = N.rows.filter((r) => r.z >= 1 && r.a >= 2 && r.bea > 0 && !r.estimated);
  let selected = N.get(2, 2), hover = null;

  const frame = h('div.fig__frame');
  const split = h('div.fig-split');
  const left = h('div.plot');
  const side = h('div.fig-side.be-calc');
  split.append(left, side);
  const controls = h('div.fig__controls');
  frame.append(split, controls);
  el.prepend(frame);
  const tip = tooltip(left);

  const quick = h('div.row', { style: { gap: '.35rem' }, role: 'group', 'aria-label': 'Choose a nucleus' });
  for (const [z, n] of QUICK) {
    const r = N.get(z, n);
    if (!r) continue;
    const b = h('button.btn', { type: 'button', style: { padding: '.4rem .7rem' } }, `${E.byZ(z).sym}-${z + n}`);
    b.addEventListener('click', () => { selected = r; draw(); });
    quick.append(b);
  }
  controls.append(h('span.control__label', null, 'Nucleus'), quick);

  const cv = setupCanvas(left, { height: (w) => Math.max(300, Math.min(420, w * 0.66)), onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');
  cv.canvas.setAttribute('aria-label', 'Binding energy per nucleon against mass number. It rises steeply for light nuclei, peaks near iron and nickel at about 8.8 MeV, and falls slowly for heavy nuclei.');
  let layout = null;

  function draw() {
    const { ctx, w, h: hh } = cv;
    const t = theme();
    ctx.clearRect(0, 0, w, hh);
    const box = { x: 44, y: 22, w: w - 44 - 14, h: hh - 22 - 44 };
    const sx = linear([0, 300], [box.x, box.x + box.w]);
    const sy = linear([0, 9.4], [box.y + box.h, box.y]);
    drawAxes(ctx, box, sx, sy, { xLabel: 'mass number A (protons + neutrons)', yLabel: 'binding energy per nucleon (MeV)', yTicks: [0, 2, 4, 6, 8] });
    // fusion / fission shading
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#2f7cf6'; ctx.fillRect(box.x, box.y, sx(56) - box.x, box.h);
    ctx.fillStyle = '#e0523b'; ctx.fillRect(sx(62), box.y, box.x + box.w - sx(62), box.h);
    ctx.globalAlpha = 1;
    const dark = isDark();
    const stableCol = cssVar('--dm-stable');
    for (const r of pts) {
      if (r.hl === -1) continue;
      ctx.fillStyle = dark ? 'rgba(160,160,160,0.28)' : 'rgba(120,110,100,0.25)';
      ctx.fillRect(sx(r.a) - 1, sy(r.bea / 1000) - 1, 2, 2);
    }
    for (const r of pts) {
      if (r.hl !== -1) continue;
      ctx.fillStyle = stableCol;
      ctx.beginPath(); ctx.arc(sx(r.a), sy(r.bea / 1000), 2.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = FONT.sans(11, 500);
    ctx.textAlign = 'left';
    haloText(ctx, 'fusion releases energy →', sx(8), sy(4.2), '#2f7cf6', t.bg, 4);
    ctx.textAlign = 'right';
    haloText(ctx, '← fission releases energy', sx(292), sy(6.6), '#e0523b', t.bg, 4);
    ctx.textAlign = 'left';
    const lab = (z, n, text, dx = 6, dy = -6) => { const r = N.get(z, n); if (!r) return; haloText(ctx, text, sx(r.a) + dx, sy(r.bea / 1000) + dy, t.ink2, t.bg, 4); };
    ctx.font = FONT.sans(10.5);
    lab(2, 2, 'helium-4', 6, -4);
    lab(28, 34, 'nickel-62: the peak', 6, -10);
    lab(92, 146, 'uranium-238', -20, -10);
    lab(1, 1, 'deuterium', 6, 2);
    // legend
    ctx.textAlign = 'right';
    ctx.fillStyle = t.ink3;
    ctx.fillText('● stable   · radioactive', box.x + box.w, box.y + box.h - 8);
    for (const [r, R, col] of [[hover, 5, t.ink2], [selected, 6, '#e5603f']]) {
      if (!r) continue;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx(r.a), sy(r.bea / 1000), R, 0, Math.PI * 2); ctx.stroke();
    }
    layout = { sx, sy, box };
    renderSide(selected);
  }

  function renderSide(r) {
    const e = E.byZ(r.z);
    const parts = r.z * C.mH_u + r.n * C.mn_u;
    const dm = parts - r.mass;
    const BE = dm * C.uMeV;
    side.innerHTML = `
      <div class="readout"><span class="k">${e.name}-${r.a}: ${r.z} p + ${r.n} n</span></div>
      <div class="be-big">${fix(BE, BE < 100 ? 2 : 1)}<small>MeV binding energy</small></div>
      <div style="color:var(--ink-3)">${fix(BE / r.a, 3)} MeV per nucleon</div>
      <table>
        <tr><td>${r.z} hydrogen atoms</td><td class="n">${fix(r.z * C.mH_u, 6)} u</td></tr>
        <tr><td>${r.n} neutrons</td><td class="n">${fix(r.n * C.mn_u, 6)} u</td></tr>
        <tr><td>parts, added up</td><td class="n">${fix(parts, 6)} u</td></tr>
        <tr><td>the actual atom</td><td class="n">${fix(r.mass, 6)} u</td></tr>
        <tr class="total"><td>missing mass</td><td class="n">${fix(dm, 6)} u</td></tr>
      </table>
      <p style="margin:.5rem 0 0;color:var(--ink-2)">The assembled nucleus weighs ${fix((100 * dm) / parts, 2)}% less than its parts. Multiply the missing mass by <var>c</var>² (931.494 MeV per u) and you get the energy that binds it.</p>
      <p style="margin:.6rem 0 0;font-size:.76rem;color:var(--ink-3)">Masses from the Atomic Mass Evaluation (AME2020) via the IAEA. Hydrogen atoms are used instead of bare protons so the electrons’ masses cancel.</p>`;
  }

  function nearest(x, y) {
    let best = null, bd = 144;
    for (const r of pts) {
      const dx = layout.sx(r.a) - x, dy = layout.sy(r.bea / 1000) - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  cv.canvas.addEventListener('pointermove', (ev) => {
    if (!layout) return;
    const rc = cv.canvas.getBoundingClientRect();
    const x = ev.clientX - rc.left, y = ev.clientY - rc.top;
    const r = nearest(x, y);
    if (r !== hover) { hover = r; draw(); }
    if (r) tip.show(`<b>${E.byZ(r.z).name}-${r.a}</b><br>${fix(r.bea / 1000, 3)} MeV per nucleon<br>${r.hl === -1 ? 'stable' : 'radioactive'}`, x, y); else tip.hide();
  });
  cv.canvas.addEventListener('pointerleave', () => { hover = null; tip.hide(); draw(); });
  cv.canvas.addEventListener('click', () => { if (hover) { selected = hover; draw(); } });
  onThemeChange(draw);
  draw();
}
