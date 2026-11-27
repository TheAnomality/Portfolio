// de Broglie's argument: an electron wave must close on itself around the nucleus.
import { h, reducedMotion } from '../lib/dom.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { slider, button } from '../lib/controls.js';
import { hydrogenEnergy } from '../lib/physics.js';
import { fix } from '../lib/format.js';

const LAPS = 12;

export function mount(el) {
  const reduce = reducedMotion();
  let k = 2.62; // wavelengths around the orbit = sqrt(r / a0)
  const frame = h('div.fig__frame.fig__frame--stage');
  const split = h('div.fig-split');
  const left = h('div.plot');
  const side = h('div.fig-side.el-side');
  split.append(left, side);
  const controls = h('div.fig__controls');
  frame.append(split, controls);
  el.prepend(frame);

  const cv = setupCanvas(left, { height: (w) => Math.max(300, Math.min(420, w * 0.75)), onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');

  function net(kk) {
    // amplitude of the sum of LAPS successive laps, each shifted by 2πk
    const s = Math.sin(Math.PI * kk);
    if (Math.abs(s) < 1e-9) return 1;
    return Math.abs(Math.sin(Math.PI * kk * LAPS) / (LAPS * s));
  }

  function updateSide() {
    const r = k * k;
    const nearest = Math.round(k);
    const ok = Math.abs(k - nearest) < 0.015 && nearest >= 1;
    const amp = net(k);
    side.innerHTML = `
      <div class="el-side__k">${ok ? 'Allowed orbit' : 'Not allowed'}</div>
      <div class="el-side__t">${fix(k, 2)} <span style="font-size:1rem;color:var(--stage-ink-3)">wavelengths per lap</span></div>
      <dl class="readouts" style="margin-top:1rem">
        <div class="readout"><dt>Orbit radius</dt><dd>${fix(r, 2)} a₀</dd></div>
        <div class="readout"><dt>Wave left after ${LAPS} laps</dt><dd>${fix(amp * 100, 0)}%</dd></div>
        ${ok ? `<div class="readout"><dt>Energy</dt><dd>${fix(hydrogenEnergy(nearest, 1, false), 2)} eV</dd></div>` : ''}
      </dl>
      <p class="el-side__note">${ok
        ? `A whole number of wavelengths fits, so every lap reinforces the last. This is Bohr’s orbit n = ${nearest}, with radius ${nearest * nearest} a₀ = ${fix(nearest * nearest * 0.0529177, 3)} nm.`
        : 'The wave arrives back out of step with itself. Lap after lap, crests land on troughs and the wave cancels out. No stable state exists at this radius.'}</p>`;
  }

  function draw() {
    const { ctx, w, h: hh } = cv;
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, w, hh);
    const cx = w / 2, cy = hh / 2;
    const R = Math.min(w, hh) * 0.31;
    const A = R * 0.16;
    const osc = 1; // a snapshot of the wave at full amplitude
    // reference circle
    ctx.strokeStyle = '#2b2e36';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // individual laps (faint)
    const steps = 720;
    for (let j = LAPS - 1; j >= 0; j--) {
      ctx.strokeStyle = j === 0 ? 'rgba(111,178,255,0.55)' : `rgba(111,178,255,${(0.22 * (1 - j / LAPS)).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const th = (i / steps) * Math.PI * 2;
        const rr = R + A * Math.sin(k * (th + 2 * Math.PI * j)) * osc;
        const x = cx + rr * Math.cos(th - Math.PI / 2), y = cy + rr * Math.sin(th - Math.PI / 2);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // net wave (sum of laps)
    const amp = net(k);
    ctx.strokeStyle = amp > 0.9 ? '#fbd36b' : '#e9e7e2';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      let s = 0;
      for (let j = 0; j < LAPS; j++) s += Math.sin(k * (th + 2 * Math.PI * j));
      const rr = R + A * (s / LAPS) * osc;
      const x = cx + rr * Math.cos(th - Math.PI / 2), y = cy + rr * Math.sin(th - Math.PI / 2);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    // nucleus
    ctx.fillStyle = '#ff6a4d';
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    // start marker
    ctx.fillStyle = '#8d8a83';
    ctx.font = FONT.sans(10.5);
    ctx.textAlign = 'center';
    ctx.fillText('start of lap', cx, cy - R - A - 12);
    ctx.fillRect(cx - 0.5, cy - R - A - 6, 1, A * 2 + 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6e6b65';
    ctx.fillText('faint: individual laps   bright: what survives', 12, hh - 12);
  }

  const rCtl = slider({ label: 'Orbit size', min: 0.85, max: 5.3, step: 0.005, value: k, width: 'clamp(9rem, 30vw, 18rem)',
    format: (v) => `r = ${fix(v * v, 2)} a₀`, onInput: (v) => { k = v; updateSide(); draw(); } });
  const snaps = h('div.quick', { role: 'group', 'aria-label': 'Jump to a Bohr orbit' });
  for (let n = 1; n <= 5; n++) {
    const b = h('button', { type: 'button' }, `n = ${n}`);
    b.addEventListener('click', () => animateTo(n));
    snaps.append(b);
  }
  controls.append(rCtl.el, h('span.spacer'), h('span.control__label', null, 'Snap to'), snaps);

  let tween = null;
  let animateTo = function (target) {
    if (reduce) { k = target; rCtl.set(k); updateSide(); draw(); return; }
    tween = { from: k, to: target, t0: performance.now() };
  };

  function loop(now) {
    if (!tween) return;
    const p = Math.min(1, (now - tween.t0) / 700);
    const e = p * p * (3 - 2 * p);
    k = tween.from + (tween.to - tween.from) * e;
    rCtl.set(k);
    updateSide();
    draw();
    if (p >= 1) tween = null; else requestAnimationFrame(loop);
  }
  const _animateTo = animateTo;
  animateTo = (n) => { _animateTo(n); if (tween) requestAnimationFrame(loop); };
  updateSide();
  draw();
}
