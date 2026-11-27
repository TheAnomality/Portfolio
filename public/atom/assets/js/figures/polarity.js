// Bond polarity from the difference in electronegativity between two elements.
import { h, onThemeChange, isDark } from '../lib/dom.js';
import { getElements } from '../lib/data.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { select } from '../lib/controls.js';
import { theme } from '../lib/plot.js';
import { categoryColor } from '../lib/color.js';
import { fix } from '../lib/format.js';

const PAIRS = [['H', 'H'], ['C', 'H'], ['H', 'Cl'], ['O', 'H'], ['C', 'O'], ['Na', 'Cl'], ['Li', 'F'], ['Cs', 'F']];

export async function mount(el) {
  const E = await getElements();
  let a = 'H', b = 'Cl';
  const frame = h('div.fig__frame');
  const wrap = h('div.plot');
  const read = h('div.fig__controls');
  const controls = h('div.fig__controls');
  frame.append(wrap, read, controls);
  el.prepend(frame);
  const cv = setupCanvas(wrap, { height: (w) => Math.max(230, Math.min(300, w * 0.3)), onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');

  const opts = E.list.filter((e) => e.en != null).map((e) => ({ value: e.sym, label: `${e.name} (${e.en})` }));
  const aCtl = select({ label: 'Atom', options: opts, value: a, onChange: (v) => { a = v; draw(); } });
  const bCtl = select({ label: 'bonded to', options: opts, value: b, onChange: (v) => { b = v; draw(); } });
  const quick = h('div.row', { style: { gap: '.35rem' } });
  for (const [p, q] of PAIRS) {
    const btn = h('button.btn', { type: 'button', style: { padding: '.38rem .65rem' } }, `${p}–${q}`);
    btn.addEventListener('click', () => { a = p; b = q; aCtl.set(p); bCtl.set(q); draw(); });
    quick.append(btn);
  }
  controls.append(aCtl.el, bCtl.el, h('span.spacer'), quick);

  function draw() {
    const { ctx, w, h: hh } = cv;
    const t = theme();
    const dark = isDark();
    ctx.clearRect(0, 0, w, hh);
    const A = E.bySym.get(a), B = E.bySym.get(b);
    const d = Math.abs(A.en - B.en);
    const ionic = 1 - Math.exp(-(d * d) / 4); // Pauling's empirical estimate of ionic character
    const pull = Math.sign(B.en - A.en); // +1: electrons pulled towards B
    // atoms and shared cloud
    const cy = hh * 0.42, sep = Math.min(w * 0.22, 170), cx = w / 2;
    const xa = cx - sep / 2, xb = cx + sep / 2;
    const shift = pull * Math.min(1, d / 2.6) * sep * 0.42;
    const g = ctx.createRadialGradient(cx + shift, cy, 4, cx + shift, cy, sep * 0.95);
    g.addColorStop(0, 'rgba(47,124,246,0.55)'); g.addColorStop(0.6, 'rgba(47,124,246,0.18)'); g.addColorStop(1, 'rgba(47,124,246,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx + shift * 0.6, cy, sep * 1.05, sep * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    const rA = 18 + 4 * Math.cbrt(A.z), rB = 18 + 4 * Math.cbrt(B.z);
    for (const [e, x, r] of [[A, xa, rA], [B, xb, rB]]) {
      ctx.fillStyle = categoryColor(e.cat, dark);
      ctx.strokeStyle = t.ink3;
      ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.ink;
      ctx.font = FONT.serif(18, 500);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(e.sym, x, cy + 1);
    }
    if (d > 0.05) {
      ctx.font = FONT.serif(18, 400, 'italic');
      ctx.fillStyle = t.ink2;
      const minus = pull > 0 ? xb : xa, plus = pull > 0 ? xa : xb;
      ctx.fillText(d > 1.8 ? '−' : 'δ−', minus, cy - 46);
      ctx.fillText(d > 1.8 ? '+' : 'δ+', plus, cy - 46);
    }
    // the continuum bar
    const bx = 30, bw = w - 60, by = hh - 58;
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#2f7cf6'); grad.addColorStop(0.5, '#a07ad8'); grad.addColorStop(1, '#e0523b');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bw, 6);
    const sxv = (v) => bx + (Math.min(v, 3.3) / 3.3) * bw;
    ctx.font = FONT.sans(10.5);
    ctx.fillStyle = t.ink3;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('evenly shared', bx, by + 12);
    ctx.textAlign = 'center';
    ctx.fillText('unevenly shared (polar)', sxv(1.1), by + 12);
    ctx.textAlign = 'right';
    ctx.fillText('handed over (ionic)', bx + bw, by + 12);
    ctx.fillStyle = t.ink;
    ctx.beginPath(); ctx.moveTo(sxv(d), by - 2); ctx.lineTo(sxv(d) - 6, by - 12); ctx.lineTo(sxv(d) + 6, by - 12); ctx.closePath(); ctx.fill();
    ctx.textBaseline = 'alphabetic';
    read.innerHTML = `<dl class="readouts">
      <div class="readout"><dt>${A.sym} electronegativity</dt><dd>${fix(A.en, 2)}</dd></div>
      <div class="readout"><dt>${B.sym} electronegativity</dt><dd>${fix(B.en, 2)}</dd></div>
      <div class="readout"><dt>Difference</dt><dd>${fix(d, 2)}</dd></div>
      <div class="readout"><dt>Ionic character (Pauling’s estimate)</dt><dd>${fix(100 * ionic, 0)}%</dd></div>
    </dl>`;
    cv.canvas.setAttribute('aria-label', `A ${A.name}–${B.name} bond. Electronegativity difference ${fix(d, 2)}: ${d < 0.4 ? 'nearly evenly shared electrons' : d < 1.8 ? 'a polar bond' : 'mostly ionic'}.`);
  }
  onThemeChange(draw);
  draw();
}
