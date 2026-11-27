// Shielding: the effective nuclear charge felt by an atom's outermost electron (Slater's rules).
import { h, onThemeChange, tooltip } from '../lib/dom.js';
import { getElements } from '../lib/data.js';
import { occupancy } from '../lib/elements.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { slider } from '../lib/controls.js';
import { linear, drawAxes, theme } from '../lib/plot.js';
import { fix } from '../lib/format.js';

// Slater groups in order: [1s] [2s2p] [3s3p] [3d] [4s4p] [4d] [4f] [5s5p] [5d] [5f] [6s6p] [6d] [7s7p]
const GROUPS = ['1s', '2sp', '3sp', '3d', '4sp', '4d', '4f', '5sp', '5d', '5f', '6sp', '6d', '7sp'];
const groupOf = (k) => (k === '1s' ? '1s' : k[1] === 's' || k[1] === 'p' ? `${k[0]}sp` : k);

/** Slater's rules for the outermost electron. Returns {zeff, parts, target}. */
export function slater(el) {
  const occ = occupancy(el);
  const counts = new Map();
  for (const [k, c] of occ) counts.set(groupOf(k), (counts.get(groupOf(k)) || 0) + c);
  // outermost electron: the last occupied group in Slater's ordering (4s4p comes after 3d, 4d after 4s4p)
  const occupied = GROUPS.filter((g) => counts.get(g));
  const target = occupied[occupied.length - 1];
  const n = +target[0];
  const parts = [];
  const same = (counts.get(target) || 1) - 1;
  if (target.endsWith('sp') || target === '1s') {
    const f = target === '1s' ? 0.3 : 0.35;
    if (same) parts.push({ label: `other ${n}s/${n}p electrons`, count: same, factor: f });
    let inner1 = 0, inner2 = 0;
    for (const [g, c] of counts) {
      if (g === target) continue;
      const gn = +g[0];
      if (gn === n - 1) inner1 += c;
      else if (gn <= n - 2) inner2 += c;
    }
    if (inner1) parts.push({ label: `shell n = ${n - 1}`, count: inner1, factor: 0.85 });
    if (inner2) parts.push({ label: `shells n ≤ ${n - 2}`, count: inner2, factor: 1.0 });
  } else {
    if (same) parts.push({ label: `other ${target} electrons`, count: same, factor: 0.35 });
    let before = 0;
    for (const g of GROUPS) { if (g === target) break; before += counts.get(g) || 0; }
    if (before) parts.push({ label: 'all groups inside', count: before, factor: 1.0 });
  }
  const S = parts.reduce((s, p) => s + p.count * p.factor, 0);
  return { zeff: el.z - S, S, parts, target: target.endsWith('sp') ? `${n}s/${n}p` : target };
}

export async function mount(el) {
  const E = await getElements();
  let Z = 11;
  const frame = h('div.fig__frame');
  const split = h('div.fig-split');
  const left = h('div.plot');
  const side = h('div.fig-side');
  split.append(left, side);
  const controls = h('div.fig__controls');
  frame.append(split, controls);
  el.prepend(frame);
  const tip = tooltip(left);

  const data = E.list.filter((e) => e.z <= 86).map((e) => ({ e, ...slater(e) }));
  const cv = setupCanvas(left, { height: (w) => Math.max(260, Math.min(360, w * 0.62)), onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');
  cv.canvas.setAttribute('aria-label', 'Effective nuclear charge felt by the outermost electron, for elements 1 to 86. It rises across each period and drops at the start of the next.');
  let layout = null;

  function draw() {
    const { ctx, w, h: hh } = cv;
    const t = theme();
    ctx.clearRect(0, 0, w, hh);
    const box = { x: 40, y: 24, w: w - 40 - 14, h: hh - 24 - 44 };
    const sx = linear([0.5, 86.5], [box.x, box.x + box.w]);
    const sy = linear([0, 8], [box.y + box.h, box.y]);
    const nobles = [2, 10, 18, 36, 54, 86];
    let prev = 0;
    nobles.forEach((z, i) => {
      if (i % 2 === 1) { ctx.globalAlpha = 0.06; ctx.fillStyle = t.ink; ctx.fillRect(sx(prev + 0.5), box.y, sx(z + 0.5) - sx(prev + 0.5), box.h); ctx.globalAlpha = 1; }
      prev = z;
    });
    drawAxes(ctx, box, sx, sy, { xLabel: 'atomic number', yLabel: 'effective charge felt by the outer electron', xTicks: [1, 10, 20, 30, 40, 50, 60, 70, 80, 86] });
    ctx.strokeStyle = t.ink2;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    data.forEach((d, i) => { const x = sx(d.e.z), y = sy(d.zeff); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    for (const d of data) {
      const isNoble = nobles.includes(d.e.z), isAlkali = [3, 11, 19, 37, 55].includes(d.e.z);
      ctx.fillStyle = isNoble ? '#7a4fd0' : isAlkali ? '#e0523b' : t.ink3;
      ctx.beginPath(); ctx.arc(sx(d.e.z), sy(d.zeff), isNoble || isAlkali ? 3.6 : 2.2, 0, Math.PI * 2); ctx.fill();
    }
    const cur = data.find((d) => d.e.z === Z);
    ctx.fillStyle = t.ink;
    ctx.beginPath(); ctx.arc(sx(Z), sy(cur.zeff), 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = FONT.sans(11.5, 600);
    ctx.textAlign = sx(Z) > box.x + box.w - 80 ? 'right' : 'left';
    ctx.fillText(`${cur.e.sym} ${fix(cur.zeff, 2)}`, sx(Z) + (ctx.textAlign === 'right' ? -10 : 10), sy(cur.zeff) - 8);
    ctx.font = FONT.sans(10.5);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7a4fd0';
    ctx.fillText('● noble gases', box.x + box.w - 4, box.y + box.h - 10);
    ctx.fillStyle = '#e0523b';
    ctx.fillText('● alkali metals', box.x + box.w - 90, box.y + box.h - 10);
    layout = { sx, box };
    renderSide(cur);
  }

  function renderSide(d) {
    const e = d.e;
    side.innerHTML = `
      <div class="readout"><span class="k">${e.name}, ${e.z} protons</span></div>
      <div class="zeff-big" style="margin-top:.4rem">${fix(d.zeff, 2)}<small>effective charge (+e)</small></div>
      <p style="font:400 .84rem/1.5 var(--font-sans);color:var(--ink-2);margin:.6rem 0 0">The outermost electron (${d.target}) feels the pull of ${e.z} protons, minus ${fix(d.S, 2)} units cancelled by the electrons between it and the nucleus.</p>
      <table class="zeff-break">
        ${d.parts.map((p) => `<tr><td>${p.label}</td><td class="n">${p.count} × ${p.factor.toFixed(2)}</td><td class="n">${fix(p.count * p.factor, 2)}</td></tr>`).join('')}
        <tr><td><b>total shielding</b></td><td></td><td class="n"><b>${fix(d.S, 2)}</b></td></tr>
      </table>
      <p style="font:400 .76rem/1.45 var(--font-sans);color:var(--ink-3);margin:.7rem 0 0">Shielding factors from Slater’s rules (1930), a simple approximation to full quantum calculations.</p>`;
  }

  const zCtl = slider({ label: 'Element', min: 1, max: 86, step: 1, value: Z, width: 'clamp(10rem, 36vw, 24rem)', format: (v) => `${E.byZ(v).sym} (${v})`, onInput: (v) => { Z = v; draw(); } });
  controls.append(zCtl.el);
  cv.canvas.addEventListener('pointermove', (ev) => {
    if (!layout) return;
    const r = cv.canvas.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const z = Math.max(1, Math.min(86, Math.round(layout.sx.invert(x))));
    const d = data[z - 1];
    tip.show(`<b>${d.e.name}</b>: Z<sub>eff</sub> ≈ ${fix(d.zeff, 2)}`, x, ev.clientY - r.top);
  });
  cv.canvas.addEventListener('pointerleave', () => tip.hide());
  cv.canvas.addEventListener('click', (ev) => {
    const r = cv.canvas.getBoundingClientRect();
    Z = Math.max(1, Math.min(86, Math.round(layout.sx.invert(ev.clientX - r.left))));
    zCtl.set(Z); draw();
  });
  onThemeChange(draw);
  draw();
}
