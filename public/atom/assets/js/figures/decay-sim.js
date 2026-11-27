// Radioactive decay: random for each nucleus, predictable for many.
import { h, onThemeChange, reducedMotion, cssVar } from '../lib/dom.js';
import { getNuclides } from '../lib/data.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { segmented, button, select, slider } from '../lib/controls.js';
import { linear, drawAxes, theme } from '../lib/plot.js';
import { halfLife, int, fix } from '../lib/format.js';

const ISOTOPES = [
  { key: 'C-14', z: 6, n: 8, name: 'Carbon-14', note: 'made in the upper atmosphere by cosmic rays; the basis of radiocarbon dating' },
  { key: 'I-131', z: 53, n: 78, name: 'Iodine-131', note: 'a fission product, used to treat thyroid disease' },
  { key: 'Rn-222', z: 86, n: 136, name: 'Radon-222', note: 'a radioactive gas that seeps from uranium-bearing rock' },
  { key: 'n', z: 0, n: 1, name: 'Free neutron', note: 'stable inside many nuclei, but alone it decays into a proton, an electron and an antineutrino' },
  { key: 'U-238', z: 92, n: 146, name: 'Uranium-238', note: 'about as old as the Earth: half of the original amount is still here' },
  { key: 'Po-214', z: 84, n: 130, name: 'Polonium-214', note: 'one of the shortest-lived links in the uranium decay chain' },
];

export async function mount(el) {
  const N = await getNuclides();
  for (const iso of ISOTOPES) iso.hl = N.get(iso.z, iso.n)?.hl;
  let iso = ISOTOPES[0];
  let count = 400;
  let alive, decayAt, t = 0, playing = !reducedMotion(), history = [];
  const SECONDS_PER_HALFLIFE = 3.2; // real seconds of animation per half-life

  const frame = h('div.fig__frame');
  const split = h('div.fig-split');
  const left = h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '0' } });
  const gridWrap = h('div.plot');
  const plotWrap = h('div.plot', { style: { borderTop: '1px solid var(--rule)' } });
  left.append(gridWrap, plotWrap);
  const side = h('div.fig-side.ds-side');
  split.append(left, side);
  const controls = h('div.fig__controls');
  frame.append(split, controls);
  el.prepend(frame);

  const gcv = setupCanvas(gridWrap, { height: (w) => Math.max(180, Math.min(260, w * 0.42)), onResize: () => drawGrid() });
  const pcv = setupCanvas(plotWrap, { height: 170, onResize: () => drawPlot() });
  gcv.canvas.setAttribute('role', 'img');
  gcv.canvas.setAttribute('aria-label', 'A grid of radioactive nuclei; each one flips to its decay product at a random moment.');

  function reset() {
    alive = new Uint8Array(count).fill(1);
    decayAt = new Float32Array(count).fill(-1);
    t = 0; history = [[0, count]];
    drawGrid(); drawPlot(); renderSide();
  }

  function step(dtHalfLives) {
    // each nucleus survives a time step with probability 2^(-dt/t½)
    const p = 1 - Math.pow(2, -dtHalfLives);
    let n = 0;
    for (let i = 0; i < count; i++) {
      if (alive[i] && Math.random() < p) { alive[i] = 0; decayAt[i] = t + dtHalfLives; }
      n += alive[i];
    }
    t += dtHalfLives;
    history.push([t, n]);
  }

  function drawGrid() {
    const { ctx, w, h: hh } = gcv;
    const tt = theme();
    ctx.clearRect(0, 0, w, hh);
    const cols = Math.ceil(Math.sqrt(count * (w / hh)));
    const rows = Math.ceil(count / cols);
    const cell = Math.min((w - 20) / cols, (hh - 20) / rows);
    const x0 = (w - cell * cols) / 2, y0 = (hh - cell * rows) / 2;
    const r = Math.max(1.2, cell * 0.36);
    const parent = '#2f7cf6', child = cssVar('--rule-strong');
    for (let i = 0; i < count; i++) {
      const cx = x0 + (i % cols) * cell + cell / 2, cy = y0 + Math.floor(i / cols) * cell + cell / 2;
      const since = alive[i] ? -1 : t - decayAt[i];
      ctx.fillStyle = alive[i] ? parent : child;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      if (!alive[i] && since < 0.12) {
        ctx.strokeStyle = `rgba(242,201,76,${(1 - since / 0.12).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, r + 3 + (since / 0.12) * 6, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  function drawPlot() {
    const { ctx, w, h: hh } = pcv;
    const tt = theme();
    ctx.clearRect(0, 0, w, hh);
    const box = { x: 46, y: 18, w: w - 46 - 14, h: hh - 18 - 36 };
    const tmax = Math.max(5, Math.ceil(t));
    const sx = linear([0, tmax], [box.x, box.x + box.w]);
    const sy = linear([0, count], [box.y + box.h, box.y]);
    drawAxes(ctx, box, sx, sy, { xLabel: 'time (half-lives)', yLabel: 'nuclei left', xTicks: Array.from({ length: tmax + 1 }, (_, i) => i), yTicks: [0, count / 4, count / 2, count], fmtY: (v) => int(v) });
    ctx.strokeStyle = tt.ink3;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const x = (i / 200) * tmax; const y = count * Math.pow(2, -x); i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y)); }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#2f7cf6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
    ctx.stroke();
    ctx.font = FONT.sans(10.5);
    ctx.fillStyle = tt.ink3;
    ctx.textAlign = 'right';
    ctx.fillText('dashed: N₀ × (½)^(t / t½)', box.x + box.w, box.y + 8);
  }

  function renderSide() {
    const left2 = history[history.length - 1][1];
    const realT = t * iso.hl;
    side.innerHTML = `
      <div class="readout"><span class="k">${iso.name}</span></div>
      <div class="bignum">${halfLife(iso.hl)}<small>half-life</small></div>
      <p style="font:400 .84rem/1.5 var(--font-sans);color:var(--ink-2);margin:0">${iso.note[0].toUpperCase() + iso.note.slice(1)}.</p>
      <dl class="readouts" style="margin-top:1rem">
        <div class="readout"><dt>Elapsed</dt><dd>${t === 0 ? '0' : halfLife(realT)}</dd></div>
        <div class="readout"><dt>Remaining</dt><dd>${int(left2)} of ${int(count)}</dd></div>
        <div class="readout"><dt>Expected</dt><dd>${int(count * Math.pow(2, -t))}</dd></div>
      </dl>
      <p style="font:400 .78rem/1.5 var(--font-sans);color:var(--ink-3);margin:.9rem 0 0">No one can say when a given nucleus will decay; each has the same ${fix(100 * (1 - Math.pow(2, -1 / 10)), 1)}% chance in every tenth of a half-life. Yet the total follows the dashed curve, more closely the more nuclei there are.</p>`;
  }

  const isoCtl = select({ label: 'Isotope', options: ISOTOPES.map((i) => ({ value: i.key, label: i.name })), value: iso.key, onChange: (v) => { iso = ISOTOPES.find((i) => i.key === v); reset(); } });
  const countCtl = segmented({ label: 'Nuclei', options: [{ value: 100, label: '100' }, { value: 400, label: '400' }, { value: 2500, label: '2,500' }], value: count, onChange: (v) => { count = v; reset(); } });
  const play = button({ label: playing ? 'Pause' : 'Play', icon: playing ? 'pause' : 'play', onClick: () => setPlaying(!playing) });
  const resetBtn = button({ label: 'Reset', icon: 'reset', ghost: true, onClick: () => reset() });
  controls.append(isoCtl.el, countCtl.el, h('span.spacer'), play, resetBtn);

  function setPlaying(v) {
    playing = v;
    play.innerHTML = playing ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg><span>Pause</span>' : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg><span>Play</span>';
    if (playing && t >= 8) reset();
    if (playing) start();
  }

  let raf = 0, running = false, visible = false, last = 0, sideTimer = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing) {
      step(dt / SECONDS_PER_HALFLIFE);
      drawGrid(); drawPlot();
      sideTimer += dt;
      if (sideTimer > 0.2) { renderSide(); sideTimer = 0; }
      if (t >= 8) setPlaying(false);
    }
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!visible || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
  onThemeChange(() => { drawGrid(); drawPlot(); });
  reset();
  return {
    resume() { visible = true; start(); },
    pause() { visible = false; running = false; cancelAnimationFrame(raf); },
  };
}
