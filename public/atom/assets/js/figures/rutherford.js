// Rutherford's gold-foil experiment: compare what the plum-pudding and nuclear atoms predict.
import { h, reducedMotion, liveRegion } from '../lib/dom.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { segmented, button, slider } from '../lib/controls.js';
import { int, fix } from '../lib/format.js';

const KE2 = 1.43996;            // MeV fm
const N_AU = 5.9e28;            // gold atoms per m³
const FOIL = 1.0e-6;            // foil thickness, m (1 µm)
const BINS = 90;                // 2° bins, 0..180°
const SIGMA_MS = 0.7;           // multiple small-angle scattering, degrees (rms)

export function mount(el) {
  const reduce = reducedMotion();
  const announce = liveRegion(el);
  let model = 'nuclear', energy = 5, rate = 1500;
  const counts = new Float64Array(BINS);
  let fired = 0, over10 = 0, over90 = 0;
  const flashes = [];

  const frame = h('div.fig__frame.fig__frame--stage');
  const grid = h('div.ru-grid');
  const left = h('div.plot');
  const right = h('div.plot.ru-zoom');
  grid.append(left, right);
  const stats = h('div.fig__controls.ru-stats');
  const controls = h('div.fig__controls');
  frame.append(grid, stats, controls);
  el.prepend(frame);

  const cv = setupCanvas(left, { height: (w) => Math.max(320, Math.min(460, w * 0.86)), onResize: () => drawSetup() });
  const zc = setupCanvas(right, { height: (w) => Math.max(320, Math.min(460, w * 0.86)), onResize: () => {} });
  cv.canvas.setAttribute('role', 'img');
  cv.canvas.setAttribute('aria-label', 'Alpha particles fired at a gold foil and the angles at which they are detected.');
  zc.canvas.setAttribute('role', 'img');
  zc.canvas.setAttribute('aria-label', 'Close-up of alpha particle paths near a single gold nucleus.');

  // ---- physics
  const dHeadOn = () => (KE2 * 2 * 79) / energy;            // fm, closest approach in a head-on collision
  const nTpi = () => N_AU * FOIL * Math.PI * 1e-30;           // per fm²
  function sampleAngle() {
    const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const ms = Math.abs(gauss() * SIGMA_MS);
    if (model === 'thomson') return ms * (1.0 + 0.15 * Math.random());
    // distance to the nearest nucleus' path: P(b < x) = 1 − exp(−n t π x²)
    const b = Math.sqrt(-Math.log(Math.random()) / nTpi());
    const theta = (2 * Math.atan(dHeadOn() / (2 * b)) * 180) / Math.PI;
    return theta > 3 * SIGMA_MS ? theta : Math.hypot(theta, ms);
  }
  function expectedFraction(t1, t2) {
    // Rutherford: fraction scattered between t1 and t2 degrees
    const cot2 = (t) => { const x = Math.tan((t * Math.PI) / 360); return x > 0 ? 1 / (x * x) : Infinity; };
    const k = nTpi() * Math.pow(dHeadOn() / 2, 2);
    return k * (cot2(Math.max(t1, 0.5)) - cot2(t2));
  }

  function fire(n) {
    for (let i = 0; i < n; i++) {
      const th = Math.min(179.9, sampleAngle());
      counts[Math.floor(th / 2)]++;
      fired++;
      if (th > 10) over10++;
      if (th > 90) { over90++; announce(`An alpha particle bounced back at ${fix(th, 0)} degrees.`); }
      if (flashes.length < 400 || th > 5) flashes.push({ th, side: Math.random() < 0.5 ? 1 : -1, t0: performance.now(), big: th > 10 });
    }
    if (flashes.length > 900) flashes.splice(0, flashes.length - 900);
  }

  // ---- left: apparatus seen from above
  function drawSetup(now = performance.now()) {
    const { ctx, w, h: hh } = cv;
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, w, hh);
    const cx = w * 0.56, cy = hh * 0.5, R = Math.min(w * 0.4, hh * 0.42);
    // detector ring
    ctx.strokeStyle = '#2b2e36';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    // angle ticks
    ctx.font = FONT.sans(10);
    ctx.fillStyle = '#6e6b65';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const a of [0, 30, 60, 90, 120, 150]) {
      for (const sgn of a === 0 ? [1] : [1, -1]) {
        const r = (sgn * a * Math.PI) / 180;
        ctx.fillText(`${a}°`, cx + Math.cos(r) * (R + 22), cy - Math.sin(r) * (R + 22));
      }
    }
    // histogram bars outside the ring (log scale)
    let maxc = 1;
    for (const c of counts) maxc = Math.max(maxc, c);
    const L = Math.log10(maxc + 1);
    for (let i = 0; i < BINS; i++) {
      if (!counts[i]) continue;
      const len = (Math.log10(counts[i] + 1) / L) * R * 0.42;
      const a = ((i * 2 + 1) * Math.PI) / 180;
      ctx.strokeStyle = i * 2 >= 90 ? '#ff7a6b' : i * 2 >= 10 ? '#f2c94c' : '#6fb2ff';
      ctx.lineWidth = Math.max(2, (R * Math.PI) / 180 * 1.6);
      for (const sgn of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (R - 8), cy - sgn * Math.sin(a) * (R - 8));
        ctx.lineTo(cx + Math.cos(a) * (R - 8 - len), cy - sgn * Math.sin(a) * (R - 8 - len));
        ctx.stroke();
      }
    }
    // source and beam
    ctx.fillStyle = '#3a3d46';
    ctx.fillRect(10, cy - 20, 44, 40);
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(48, cy - 3, 8, 6);
    ctx.fillStyle = '#8d8a83';
    ctx.textAlign = 'left';
    ctx.fillText('radium source', 10, cy + 34);
    const grad = ctx.createLinearGradient(56, 0, cx, 0);
    grad.addColorStop(0, 'rgba(242,201,76,0.5)'); grad.addColorStop(1, 'rgba(242,201,76,0.12)');
    ctx.fillStyle = grad;
    ctx.fillRect(56, cy - 2, cx - 56, 4);
    // foil
    ctx.fillStyle = '#d4a93c';
    ctx.fillRect(cx - 1.5, cy - R * 0.32, 3, R * 0.64);
    ctx.fillStyle = '#8d8a83';
    ctx.textAlign = 'center';
    ctx.fillText('gold foil', cx, cy - R * 0.32 - 10);
    // flashes on the detector
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      const age = (now - f.t0) / (f.big ? 2200 : 500);
      if (age > 1) { if (!f.big || age > 1) flashes.splice(i, 1); continue; }
      const a = (f.th * Math.PI) / 180;
      const x = cx + Math.cos(a) * R, y = cy - f.side * Math.sin(a) * R;
      ctx.fillStyle = f.th > 90 ? `rgba(255,122,107,${1 - age})` : f.big ? `rgba(242,201,76,${1 - age})` : `rgba(160,205,255,${0.8 * (1 - age)})`;
      ctx.beginPath(); ctx.arc(x, y, f.big ? 5 : 2.5, 0, Math.PI * 2); ctx.fill();
      if (f.big) {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
      }
    }
    ctx.fillStyle = '#8d8a83';
    ctx.textAlign = 'right';
    ctx.font = FONT.sans(10.5);
    ctx.fillText('bars: hits per 2° (log scale)', w - 10, hh - 10);
  }

  // ---- right: close-up of one gold nucleus
  const tracks = [];
  const VIEW = 260; // fm half-width shown
  function spawnTrack() {
    const b = (Math.random() * 2 - 1) * VIEW * 0.9;
    tracks.push({ x: -VIEW * 1.1, y: b, vx: 1, vy: 0, pts: [], born: performance.now(), done: false });
    if (tracks.length > 26) tracks.shift();
  }
  function stepTracks(dt) {
    const d = dHeadOn();
    const T = 7 * dt; // fm of travel (at the initial speed) per frame
    for (const t of tracks) {
      if (t.done) continue;
      let done = 0;
      while (done < T) {
        const r = Math.hypot(t.x, t.y);
        const hstep = Math.min(T - done, Math.max(0.05, 0.02 * r), 1.5);
        if (model === 'nuclear') {
          // repulsive Coulomb force, with the initial speed set to 1: a = (d / 2) / r²
          const a = (d / 2) / (r * r);
          t.vx += (a * t.x / r) * hstep; t.vy += (a * t.y / r) * hstep;
        }
        t.x += t.vx * hstep; t.y += t.vy * hstep;
        done += hstep;
        if (Math.abs(t.x) > VIEW * 1.25 || Math.abs(t.y) > VIEW * 1.25) { t.done = true; break; }
      }
      t.pts.push([t.x, t.y]);
    }
  }
  function drawZoom() {
    const { ctx, w, h: hh } = zc;
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, w, hh);
    const s = Math.min(w, hh) / (2 * VIEW);
    const cx = w / 2, cy = hh / 2;
    if (model === 'thomson') {
      // a uniform positive sphere far larger than this view
      ctx.fillStyle = 'rgba(224,82,59,0.12)';
      ctx.fillRect(0, 0, w, hh);
      ctx.fillStyle = '#c9c5bc';
      ctx.font = FONT.sans(11);
      ctx.textAlign = 'center';
      ctx.fillText('positive charge spread thinly through the whole atom', cx, 22);
    } else {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
      g.addColorStop(0, '#ffb39f'); g.addColorStop(1, 'rgba(224,82,59,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0523b';
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(2.5, 7 * s), 0, Math.PI * 2); ctx.fill();
      // closest-approach circle for a head-on hit
      ctx.strokeStyle = 'rgba(242,201,76,0.35)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(cx, cy, dHeadOn() * s, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const t of tracks) {
      if (t.pts.length < 2) continue;
      const age = (performance.now() - t.born) / 6000;
      ctx.strokeStyle = `rgba(242,201,76,${Math.max(0.08, 0.85 - age)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      t.pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * s, cy + y * s) : ctx.moveTo(cx + x * s, cy + y * s)));
      ctx.stroke();
      const [hx, hy] = t.pts[t.pts.length - 1];
      if (!t.done) { ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(cx + hx * s, cy + hy * s, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // scale bar and labels
    ctx.strokeStyle = '#8d8a83'; ctx.lineWidth = 1.2;
    const bar = 100 * s;
    ctx.beginPath(); ctx.moveTo(14, hh - 24); ctx.lineTo(14, hh - 20); ctx.lineTo(14 + bar, hh - 20); ctx.lineTo(14 + bar, hh - 24); ctx.stroke();
    ctx.fillStyle = '#c9c5bc'; ctx.font = FONT.mono(11); ctx.textAlign = 'left';
    ctx.fillText('100 fm', 20 + bar, hh - 17);
    ctx.font = FONT.sans(11, 600); ctx.fillStyle = '#e9e7e2';
    ctx.fillText('Close-up of one atom’s centre', 14, 22);
    if (model === 'nuclear') {
      ctx.font = FONT.sans(10.5); ctx.fillStyle = '#8d8a83';
      ctx.fillText(`dashed: closest a head-on α gets, ${fix(dHeadOn(), 0)} fm`, 14, 40);
      ctx.fillText('gold nucleus radius ≈ 7 fm; the atom is 140,000 fm', 14, 56);
    }
  }

  function renderStats() {
    const exp90 = expectedFraction(90, 180);
    stats.innerHTML = `<dl class="readouts">
      <div class="readout"><dt>Fired</dt><dd>${int(fired)}</dd></div>
      <div class="readout"><dt>Deflected over 10°</dt><dd>${int(over10)}</dd></div>
      <div class="readout"><dt>Bounced back (over 90°)</dt><dd>${int(over90)}</dd></div>
      <div class="readout"><dt>${model === 'nuclear' ? 'Rutherford predicts' : 'Thomson predicts'}</dt><dd>${model === 'nuclear' ? `1 in ${int(1 / exp90)} past 90°` : 'none past a few °'}</dd></div>
    </dl>`;
  }

  const modelCtl = segmented({ label: 'Atom model', options: [{ value: 'thomson', label: 'Plum pudding (Thomson)' }, { value: 'nuclear', label: 'Nuclear (Rutherford)' }], value: model,
    onChange: (v) => { model = v; reset(); } });
  const eCtl = slider({ label: 'α energy', min: 2, max: 9, step: 0.1, value: energy, format: (v) => `${fix(v, 1)} MeV`, onInput: (v) => { energy = v; reset(); } });
  const rateCtl = segmented({ label: 'Rate', options: [{ value: 200, label: 'Slow' }, { value: 1500, label: 'Fast' }, { value: 12000, label: 'Very fast' }], value: rate, onChange: (v) => { rate = v; } });
  const resetBtn = button({ label: 'Reset', icon: 'reset', ghost: true, onClick: () => reset() });
  controls.append(modelCtl.el, eCtl.el, rateCtl.el, h('span.spacer'), resetBtn);

  function reset() {
    counts.fill(0); fired = 0; over10 = 0; over90 = 0; flashes.length = 0; tracks.length = 0;
    renderStats(); drawSetup(); drawZoom();
  }

  let raf = 0, running = false, last = 0, acc = 0, spawnAcc = 0, statT = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt * rate;
    const n = Math.floor(acc); acc -= n;
    if (n) fire(n);
    spawnAcc += dt;
    if (spawnAcc > 0.35) { spawnAcc = 0; spawnTrack(); }
    stepTracks(dt * 60);
    drawSetup(now); drawZoom();
    statT += dt;
    if (statT > 0.25) { renderStats(); statT = 0; }
    raf = requestAnimationFrame(loop);
  }
  if (reduce) { fire(20000); for (let i = 0; i < 16; i++) { spawnTrack(); } for (let k = 0; k < 120; k++) stepTracks(1); }
  renderStats(); drawSetup(); drawZoom();
  return {
    resume() { if (running || reduce) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    pause() { running = false; cancelAnimationFrame(raf); },
  };
}
