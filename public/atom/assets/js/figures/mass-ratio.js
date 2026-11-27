// One proton (or neutron) balances 1,836 (or 1,839) electrons.
import { h, onThemeChange } from '../lib/dom.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { segmented } from '../lib/controls.js';
import { theme } from '../lib/plot.js';
import { C } from '../lib/physics.js';
import { fix } from '../lib/format.js';

export function mount(el) {
  let which = 'p';
  const frame = h('div.fig__frame');
  const wrap = h('div.plot');
  const controls = h('div.fig__controls');
  frame.append(wrap, controls);
  el.prepend(frame);
  const cv = setupCanvas(wrap, { height: (w) => Math.max(240, Math.min(320, w * 0.34)), onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');

  function draw() {
    const { ctx, w, h: hh } = cv;
    const t = theme();
    ctx.clearRect(0, 0, w, hh);
    const ratio = which === 'p' ? C.mp / C.me : C.mn / C.me;
    const count = Math.round(ratio);
    const leftW = Math.min(240, w * 0.26);
    const cx = leftW / 2, cy = hh / 2 - 8;
    ctx.fillStyle = which === 'p' ? '#e0523b' : '#8c94a4';
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(46, leftW * 0.22), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.ink;
    ctx.font = FONT.sans(13, 600);
    ctx.textAlign = 'center';
    ctx.fillText(`1 ${which === 'p' ? 'proton' : 'neutron'}`, cx, cy + 74);
    ctx.font = FONT.serif(30);
    ctx.fillStyle = t.ink3;
    ctx.fillText('=', leftW + 6, cy + 10);
    // grid of electrons
    const gx = leftW + 30, gw = w - gx - 16, gh = hh - 64;
    const cols = Math.round(Math.sqrt(count * (gw / gh)));
    const rows = Math.ceil(count / cols);
    const cell = Math.min(gw / cols, gh / rows);
    const r = Math.max(0.7, cell * 0.36);
    ctx.fillStyle = '#2f7cf6';
    for (let i = 0; i < count; i++) {
      const x = gx + (i % cols) * cell + cell / 2, y = 14 + Math.floor(i / cols) * cell + cell / 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = t.ink;
    ctx.font = FONT.sans(13, 600);
    ctx.fillText(`${fix(ratio, 2)} electrons`, gx + (cols * cell) / 2, 14 + rows * cell + 26);
    cv.canvas.setAttribute('aria-label', `One ${which === 'p' ? 'proton' : 'neutron'} has the same mass as ${fix(ratio, 0)} electrons, drawn as a grid of dots.`);
  }
  const seg = segmented({ label: 'Weigh', options: [{ value: 'p', label: 'Proton' }, { value: 'n', label: 'Neutron' }], value: which, onChange: (v) => { which = v; draw(); } });
  controls.append(seg.el);
  onThemeChange(draw);
  draw();
}
