// Electrons sent one at a time through two slits build up an interference pattern.
import { h, reducedMotion } from '../lib/dom.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { segmented, button, toggle } from '../lib/controls.js';
import { int } from '../lib/format.js';

const BINS = 140;

export function mount(el) {
  const reduce = reducedMotion();
  let mode = 'both';     // 'both' | 'one' | 'watched'
  let rate = 40;         // electrons per second
  let showTheory = false;
  const counts = new Float32Array(BINS);
  let dots = [];         // {y, x}
  let total = 0;

  const frame = h('div.fig__frame.fig__frame--stage');
  const wrap = h('div.plot');
  const controls = h('div.fig__controls');
  const controls2 = h('div.fig__controls');
  frame.append(wrap, controls, controls2);
  el.prepend(frame);
  const cv = setupCanvas(wrap, { height: (w) => Math.max(280, Math.min(400, w * 0.42)), onResize: () => { dots = dots.slice(-4000); } });
  cv.canvas.setAttribute('role', 'img');

  function geom() {
    const w = cv.w, hh = cv.h;
    return {
      w, hh,
      src: w * 0.06, bar: w * 0.34, scr: w * 0.66, hist0: w * 0.69, hist1: w * 0.97,
      cy: hh / 2, d: hh * 0.13, a: hh * 0.035, Y: hh * 0.46,
    };
  }

  // probability on the screen as a function of y in [-1, 1] (scaled screen coordinate)
  function intensity(u) {
    const fringe = Math.cos(Math.PI * u * 7.2) ** 2;           // slit separation
    const s = Math.PI * u * 1.25, env = s === 0 ? 1 : (Math.sin(s) / s) ** 2; // slit width
    const single = (u0) => { const z = Math.PI * (u - u0) * 1.25; return z === 0 ? 1 : (Math.sin(z) / z) ** 2; };
    if (mode === 'both') return fringe * env;
    if (mode === 'one') return single(0.11);
    return 0.5 * single(0.11) + 0.5 * single(-0.11);           // which-slit known: no fringes
  }

  function sample() {
    for (let tries = 0; tries < 1000; tries++) {
      const u = Math.random() * 2 - 1;
      if (Math.random() < intensity(u)) return u;
    }
    return 0;
  }

  let wave = []; // wavefront animation state
  function emit(n) {
    for (let i = 0; i < n; i++) {
      const u = sample();
      const bin = Math.min(BINS - 1, Math.floor(((u + 1) / 2) * BINS));
      counts[bin]++;
      total++;
      dots.push({ u, jx: Math.random(), born: performance.now() });
    }
    if (dots.length > 6000) dots.splice(0, dots.length - 6000);
  }

  function draw(now) {
    const { ctx } = cv;
    const g = geom();
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, g.w, g.hh);
    // wavefronts (only at low rates, as a hint of the wave passing through)
    if (!reduce) {
      ctx.save();
      const period = 1400;
      for (let k = 0; k < 4; k++) {
        const ph = ((now / period + k / 4) % 1);
        const r1 = ph * (g.bar - g.src);
        ctx.strokeStyle = `rgba(111,178,255,${(0.28 * (1 - ph)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(g.src, g.cy, r1, -0.6, 0.6); ctx.stroke();
        const r2 = ph * (g.scr - g.bar);
        const cycle = Math.floor(now / period + k / 4);
        const pick = ((cycle * 7 + 3) % 5) < 2 ? g.cy - g.d / 2 : g.cy + g.d / 2; // which slit this wave "went through"
        const slits = mode === 'one' ? [g.cy - g.d / 2] : mode === 'watched' ? [pick] : [g.cy - g.d / 2, g.cy + g.d / 2];
        ctx.strokeStyle = `rgba(111,178,255,${(0.22 * (1 - ph)).toFixed(3)})`;
        for (const sy of slits) { ctx.beginPath(); ctx.arc(g.bar, sy, r2, -1.2, 1.2); ctx.stroke(); }
      }
      ctx.restore();
    }
    // source
    ctx.fillStyle = '#2f7cf6';
    ctx.fillRect(g.src - 10, g.cy - 8, 10, 16);
    ctx.fillStyle = '#8d8a83';
    ctx.font = FONT.sans(10.5);
    ctx.textAlign = 'center';
    ctx.fillText('electron gun', g.src - 4, g.cy + 26);
    // barrier with slits
    ctx.fillStyle = '#4c4f58';
    const top = g.cy - g.d / 2 - g.a / 2, bot = g.cy + g.d / 2 + g.a / 2;
    ctx.fillRect(g.bar - 3, 0, 6, top);
    ctx.fillRect(g.bar - 3, g.cy - g.d / 2 + g.a / 2, 6, g.d - g.a);
    if (mode === 'one') ctx.fillRect(g.bar - 3, g.cy + g.d / 2 - g.a / 2, 6, g.a); // closed lower slit
    ctx.fillRect(g.bar - 3, bot, 6, g.hh - bot);
    if (mode === 'watched') {
      ctx.fillStyle = '#fbd36b';
      ctx.beginPath(); ctx.arc(g.bar + 16, g.cy - g.d / 2, 4, 0, Math.PI * 2); ctx.arc(g.bar + 16, g.cy + g.d / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8d8a83';
      ctx.fillText('detectors', g.bar + 16, g.cy + g.d / 2 + 18);
    }
    // screen
    ctx.fillStyle = '#15171c';
    ctx.fillRect(g.scr - 6, g.cy - g.Y, 12, g.Y * 2);
    ctx.fillStyle = '#8d8a83';
    ctx.fillText('screen', g.scr, g.cy + g.Y + 16);
    // dots
    for (const d of dots) {
      const age = (now - d.born) / 400;
      const y = g.cy + d.u * g.Y;
      const x = g.scr - 5 + d.jx * 10;
      if (age < 1) {
        ctx.fillStyle = `rgba(255,255,255,${(1 - age).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, 3.2 * (1 - age) + 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(170,210,255,0.85)';
      ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    }
    // histogram
    let max = 0;
    for (const c of counts) max = Math.max(max, c);
    const bw = (g.Y * 2) / BINS;
    const hw = g.hist1 - g.hist0;
    for (let i = 0; i < BINS; i++) {
      const len = max ? (counts[i] / max) * hw : 0;
      ctx.fillStyle = 'rgba(111,178,255,0.55)';
      ctx.fillRect(g.hist0, g.cy - g.Y + i * bw, len, Math.max(1, bw - 0.5));
    }
    if (showTheory) {
      let tmax = 0;
      const pts = [];
      for (let i = 0; i <= 300; i++) { const u = -1 + (2 * i) / 300; const v = intensity(u); pts.push([u, v]); tmax = Math.max(tmax, v); }
      ctx.strokeStyle = '#fbd36b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      pts.forEach(([u, v], i) => { const x = g.hist0 + (v / tmax) * hw, y = g.cy + u * g.Y; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    ctx.fillStyle = '#e9e7e2';
    ctx.font = FONT.mono(12, 500);
    ctx.textAlign = 'left';
    ctx.fillText(`${int(total)} electrons`, 12, 20);
    ctx.font = FONT.sans(10.5);
    ctx.fillStyle = '#8d8a83';
    ctx.textAlign = 'right';
    ctx.fillText('hits per position', g.hist1, g.cy - g.Y - 8);
  }

  const modeCtl = segmented({ label: 'Slits', options: [{ value: 'both', label: 'Both open' }, { value: 'one', label: 'One open' }, { value: 'watched', label: 'Both, but watched' }], value: mode,
    onChange: (v) => { mode = v; reset(); } });
  const rateCtl = segmented({ label: 'Rate', options: [{ value: 2, label: 'Slow' }, { value: 40, label: 'Medium' }, { value: 600, label: 'Fast' }], value: rate, onChange: (v) => { rate = v; } });
  const theory = toggle({ label: 'Show prediction', checked: false, onChange: (v) => { showTheory = v; } });
  const resetBtn = button({ label: 'Reset', icon: 'reset', ghost: true, onClick: () => reset() });
  controls.append(modeCtl.el, h('span.spacer'), resetBtn);
  controls2.append(rateCtl.el, theory.el);

  function reset() { counts.fill(0); dots = []; total = 0; }

  let raf = 0, running = false, last = 0, acc = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt * rate;
    const n = Math.floor(acc);
    acc -= n;
    if (n) emit(n);
    draw(now);
    raf = requestAnimationFrame(loop);
  }
  if (reduce) emit(1500);
  draw(performance.now());
  return {
    resume() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    pause() { running = false; cancelAnimationFrame(raf); },
  };
}
