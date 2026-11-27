// A superposition of two hydrogen states: the charge cloud sloshes at ΔE/h,
// which is exactly the frequency of the light emitted in the transition.
import { h, reducedMotion } from '../lib/dom.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { segmented, button } from '../lib/controls.js';
import { psiPlane, radial, realY, orbitalName, radiusContaining } from '../lib/hydrogen.js';
import { DENSITY } from '../lib/color.js';
import { hydrogenEnergy, vacToAir, C } from '../lib/physics.js';
import { fix, sci } from '../lib/format.js';

const PAIRS = [
  { a: [1, 0, 0], b: [2, 1, 0], label: '1s + 2p' },
  { a: [1, 0, 0], b: [2, 0, 0], label: '1s + 2s' },
  { a: [2, 1, 0], b: [3, 2, 0], label: '2p + 3d' },
  { a: [2, 0, 0], b: [3, 1, 0], label: '2s + 3p' },
  { a: [1, 0, 0], b: [3, 2, 0], label: '1s + 3d' },
];

/** <a|z|b> in units of a0, by separated numerical integration. */
function dipole(a, b) {
  const [n1, l1, m1] = a, [n2, l2, m2] = b;
  const rmax = Math.max(n1, n2) * (3 * Math.max(n1, n2) + 8), N = 6000, dr = rmax / N;
  let rad = 0;
  for (let i = 1; i <= N; i++) { const r = i * dr; rad += radial(n1, l1, r) * radial(n2, l2, r) * r * r * r * dr; }
  let ang = 0;
  const NT = 300, NP = 120;
  for (let i = 0; i < NT; i++) {
    const th = ((i + 0.5) / NT) * Math.PI, ct = Math.cos(th), st = Math.sin(th);
    for (let j = 0; j < NP; j++) {
      const ph = ((j + 0.5) / NP) * 2 * Math.PI;
      ang += realY(l1, m1, ct, ph) * realY(l2, m2, ct, ph) * ct * st * (Math.PI / NT) * ((2 * Math.PI) / NP);
    }
  }
  return rad * ang;
}

export function mount(el) {
  const reduce = reducedMotion();
  let pair = 0, playing = !reduce, phase = 0;
  const frame = h('div.fig__frame.fig__frame--stage');
  const split = h('div.fig-split');
  const left = h('div.plot', { style: { position: 'relative' } });
  const side = h('div.fig-side.el-side');
  split.append(left, side);
  const controls = h('div.fig__controls');
  frame.append(split, controls);
  el.prepend(frame);

  const traceWrap = h('div', { style: { marginTop: '1rem' } });
  const sideText = h('div');
  side.append(sideText, traceWrap);

  const cv = setupCanvas(left, { height: (w) => Math.max(300, Math.min(460, w * 0.8)), onResize: () => { prepare(); } });
  const tr = setupCanvas(traceWrap, { height: 80 });
  cv.canvas.setAttribute('role', 'img');

  let grid = null;
  const history = [];

  function prepare() {
    const P = PAIRS[pair];
    const half = Math.max(radiusContaining(P.a[0], P.a[1], 0.98), radiusContaining(P.b[0], P.b[1], 0.98)) * 0.95;
    const res = Math.min(240, Math.round(Math.min(cv.w, cv.h) * 0.75));
    const A = psiPlane(...P.a, { plane: 'xz', half, res }).data;
    const B = psiPlane(...P.b, { plane: 'xz', half, res }).data;
    let max = 0;
    for (let i = 0; i < A.length; i++) max = Math.max(max, 0.5 * A[i] * A[i] + 0.5 * B[i] * B[i] + Math.abs(A[i] * B[i]));
    const d = dipole(P.a, P.b);
    const dE = Math.abs(hydrogenEnergy(P.b[0]) - hydrogenEnergy(P.a[0]));
    const vac = C.hc_eVnm / dE;
    grid = { A, B, res, max, half, d, dE, vac, img: new ImageData(res, res), tmp: Object.assign(document.createElement('canvas'), { width: res, height: res }) };
    const allowed = Math.abs(d) > 1e-3;
    const na = orbitalName(...P.a).html, nb = orbitalName(...P.b).html;
    const f = (dE * C.e) / C.h;
    const wl = vac < 200 || vac > 2000 ? vac : vacToAir(vac);
    sideText.innerHTML = `
      <div class="el-side__k">${allowed ? 'Allowed transition' : 'Forbidden transition'}</div>
      <div class="el-side__t" style="font-size:1.7rem">${na} + ${nb}</div>
      <dl class="readouts" style="margin-top:1rem">
        <div class="readout"><dt>Slosh frequency</dt><dd>${sci(f, 3)} Hz</dd></div>
        <div class="readout"><dt>One cycle</dt><dd>${fix((1 / f) * 1e15, 3)} fs</dd></div>
        <div class="readout"><dt>Dipole swing</dt><dd>${allowed ? fix(Math.abs(d), 3) + ' a₀' : '0'}</dd></div>
        <div class="readout"><dt>Light emitted</dt><dd>${allowed ? fix(wl, 1) + ' nm' : 'none'}</dd></div>
      </dl>
      <p class="el-side__note">${allowed
        ? `The cloud’s centre of charge swings up and down. A swinging charge is an antenna, so the atom radiates at exactly this frequency: ${fix(wl, 1)} nm${wl > 380 && wl < 750 ? ', the red line of hydrogen' : ', in the ultraviolet'}.`
        : P.b[1] === 0
          ? 'The cloud breathes in and out but its centre never moves, so it cannot radiate. Hydrogen’s 2s state survives about 0.12 seconds, some 76 million times longer than 2p, because it has to decay in a more roundabout way.'
          : 'The cloud changes shape symmetrically, top and bottom together. With no net swing of charge there is no dipole antenna, so this jump (Δℓ = 2) does not happen by emitting a single photon.'}</p>`;
    cv.canvas.setAttribute('aria-label', `Electron density of a superposition of ${orbitalName(...P.a).text} and ${orbitalName(...P.b).text} states.`);
    history.length = 0;
    draw();
  }

  function draw() {
    if (!grid) return;
    const { ctx, w, h: hh } = cv;
    const { A, B, res, max, img, tmp } = grid;
    const c = Math.cos(phase);
    const data = img.data;
    for (let i = 0; i < A.length; i++) {
      const rho = 0.5 * A[i] * A[i] + 0.5 * B[i] * B[i] + A[i] * B[i] * c;
      const [r, g, b] = DENSITY(Math.pow(Math.max(0, rho) / max, 0.4));
      data[4 * i] = r * 255; data[4 * i + 1] = g * 255; data[4 * i + 2] = b * 255; data[4 * i + 3] = 255;
    }
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, w, hh);
    const size = Math.min(w, hh) - 24;
    const ox = (w - size) / 2, oy = (hh - size) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, ox, oy, size, size);
    // nucleus and dipole arrow
    const cx = ox + size / 2, cy = oy + size / 2;
    const dz = grid.d * c; // a0
    const pxPerA0 = size / (2 * grid.half);
    ctx.fillStyle = '#ff6a4d';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    if (Math.abs(grid.d) > 1e-3) {
      const len = dz * pxPerA0 * 3; // exaggerated x3 for visibility
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - len); ctx.stroke();
      if (Math.abs(len) > 6) {
        const s = Math.sign(len);
        ctx.beginPath(); ctx.moveTo(cx, cy - len - s * 2); ctx.lineTo(cx - 5, cy - len + s * 7); ctx.lineTo(cx + 5, cy - len + s * 7); ctx.closePath(); ctx.fill();
      }
    }
    ctx.font = FONT.sans(10.5);
    ctx.fillStyle = '#8d8a83';
    ctx.textAlign = 'left';
    ctx.fillText('z', cx + 6, oy + 14);
    ctx.fillText(`${(2 * grid.half).toFixed(0)} a₀ across`, ox + 8, oy + size - 10);
    ctx.textAlign = 'right';
    ctx.fillText(reduce ? 'paused (reduced motion)' : 'time slowed ~10¹⁵ ×', ox + size - 8, oy + size - 10);

    // trace of the dipole moment
    history.push(grid.d * c);
    if (history.length > 240) history.shift();
    const t = tr.ctx;
    t.clearRect(0, 0, tr.w, tr.h);
    t.strokeStyle = '#2b2e36';
    t.beginPath(); t.moveTo(0, tr.h / 2 + 0.5); t.lineTo(tr.w, tr.h / 2 + 0.5); t.stroke();
    t.strokeStyle = Math.abs(grid.d) > 1e-3 ? '#fbd36b' : '#6e6b65';
    t.lineWidth = 1.6;
    t.beginPath();
    const scale = (tr.h / 2 - 6) / 1.6;
    history.forEach((v, i) => {
      const x = tr.w - (history.length - 1 - i) * (tr.w / 240), y = tr.h / 2 - v * scale;
      i ? t.lineTo(x, y) : t.moveTo(x, y);
    });
    t.stroke();
    t.font = FONT.sans(10);
    t.fillStyle = '#6e6b65';
    t.fillText('centre of charge, up/down', 0, 10);
  }

  const seg = segmented({ label: 'Superpose', options: PAIRS.map((p, i) => ({ value: i, label: p.label })), value: pair, onChange: (v) => { pair = v; prepare(); } });
  const play = button({ label: playing ? 'Pause' : 'Play', icon: playing ? 'pause' : 'play', onClick: () => {
    playing = !playing;
    play.innerHTML = '';
    play.insertAdjacentHTML('beforeend', playing ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>');
    play.append(h('span', null, playing ? 'Pause' : 'Play'));
    if (playing) start();
  } });
  controls.append(seg.el, h('span.spacer'), play);

  let raf = 0, running = false, visible = false, lastT = 0;
  function frameFn(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    if (playing) { phase += dt * Math.PI * 1.1; draw(); }
    raf = requestAnimationFrame(frameFn);
  }
  function start() { if (!visible || running) return; running = true; lastT = performance.now(); raf = requestAnimationFrame(frameFn); }
  prepare();
  return {
    resume() { visible = true; start(); },
    pause() { visible = false; running = false; cancelAnimationFrame(raf); },
  };
}
