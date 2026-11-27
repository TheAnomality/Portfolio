// Powers of ten: a continuous zoom from an ant to a quark, every object at true scale.
import { h, reducedMotion, liveRegion } from '../lib/dom.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { slider, button } from '../lib/controls.js';
import { length as fmtLen, sig, int } from '../lib/format.js';

const LOG_MAX = -1.75;   // 1.8 cm frame
const LOG_MIN = -18.2;
const H_ATOM = 1.06e-10;     // hydrogen atom, twice the Bohr radius
const PROTON = 1.68e-15;     // twice the proton charge radius

// Objects laid side by side, largest first; the camera glides along the row.
const ROW = [
  { key: 'ant', size: 5e-3, label: 'Ant', draw: drawAnt },
  { key: 'salt', size: 3e-4, label: 'Grain of salt', draw: drawSalt },
  { key: 'hair', size: 8e-5, label: 'Human hair (width)', draw: drawHair },
  { key: 'rbc', size: 7.5e-6, label: 'Red blood cell', draw: drawRBC },
  { key: 'bact', size: 2e-6, label: 'E. coli bacterium', draw: drawBacterium },
  { key: 'virus', size: 1e-7, label: 'Influenza virus', draw: drawVirus },
  { key: 'dna', size: 2e-9, label: 'DNA double helix (width)', draw: drawDNA },
  { key: 'water', size: 2.8e-10, label: 'Water molecule', draw: drawWater },
  { key: 'atom', size: H_ATOM, label: 'Hydrogen atom', draw: drawAtom },
];
const FRAME_FILL = 0.42;
(() => {
  let x = 0;
  ROW.forEach((o, i) => {
    if (i > 0) x += 0.5 * ROW[i - 1].size + 0.95 * o.size;
    o.x = x;
  });
})();
// Nuclei shown beside hydrogen's proton, for comparison (diameters from charge radii × 2√(5/3))
const NUCLEI = [
  { label: 'Helium-4 nucleus', size: 2 * Math.sqrt(5 / 3) * 1.6755e-15, A: 4, Z: 2 },
  { label: 'Carbon-12 nucleus', size: 2 * Math.sqrt(5 / 3) * 2.4702e-15, A: 12, Z: 6 },
  { label: 'Uranium-238 nucleus', size: 2 * Math.sqrt(5 / 3) * 5.8571e-15, A: 238, Z: 92 },
];

const QUARK_D = [0.02 * PROTON, 0.32 * PROTON]; // the down quark, relative to the proton centre
function deepShift(W) {
  const a = Math.log10(1.2e-15), b = Math.log10(1.5e-16);
  const t = Math.min(1, Math.max(0, (a - Math.log10(W)) / (a - b)));
  return t * t * (3 - 2 * t);
}
function centerFor(W) {
  for (let i = 0; i < ROW.length - 1; i++) {
    const a = ROW[i], b = ROW[i + 1];
    const Wa = a.size / FRAME_FILL, Wb = b.size / FRAME_FILL;
    if (W <= Wa && W >= Wb) {
      const t = (Math.log(Wa) - Math.log(W)) / (Math.log(Wa) - Math.log(Wb));
      const e = t * t * (3 - 2 * t);
      return a.x + (b.x - a.x) * e;
    }
  }
  return W > ROW[0].size / FRAME_FILL ? ROW[0].x : ROW[ROW.length - 1].x;
}

export function mount(el) {
  const reduce = reducedMotion();
  const announce = liveRegion(el);
  let logW = LOG_MAX;
  const frame = h('div.fig__frame.fig__frame--stage');
  const wrap = h('div.plot');
  const controls = h('div.fig__controls');
  frame.append(wrap, controls);
  el.prepend(frame);
  const cv = setupCanvas(wrap, { height: (w) => Math.max(340, Math.min(560, w * 0.58)), onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');

  const zoom = slider({ label: 'Zoom', min: -LOG_MAX, max: -LOG_MIN, step: 0.001, value: -logW, width: 'clamp(10rem, 40vw, 26rem)',
    format: (v) => fmtLen(Math.pow(10, -v), 2), ariaLabel: 'Width of the field of view', onInput: (v) => { stopDive(); logW = -v; draw(); } });
  const diveBtn = button({ label: 'Dive', icon: 'play', primary: true, onClick: () => (diving ? stopDive() : startDive()) });
  const resetBtn = button({ label: 'Back out', icon: 'reset', ghost: true, onClick: () => { stopDive(); animateTo(LOG_MAX); } });
  controls.append(zoom.el, h('span.spacer'), diveBtn, resetBtn);

  function caption(W) {
    if (W < 1e-17) return 'Quarks and electrons have no measured size. Experiments only tell us they are smaller than 10⁻¹⁸ m, if they have a size at all.';
    if (W < 4e-15) return 'Inside the proton: three quarks, two “up” and one “down”, bound by gluons. Their masses add up to only about 1% of the proton’s.';
    if (W < 4e-14) return 'Hydrogen’s nucleus is a single proton. Beside it, for comparison, the nuclei of helium, carbon and uranium.';
    if (W < 6e-11) {
      const k = W / PROTON;
      return `Inside the atom there is only the thin haze of the electron cloud. The nucleus is still ${k > 1000 ? int(Math.round(k / 100) * 100) : int(k)} times smaller than this frame.`;
    }
    if (W < 2.4e-9) return 'Molecules are atoms bound together by shared electrons. A water molecule is about 0.28 nm across.';
    return '';
  }

  function draw() {
    const { ctx, w, h: hh } = cv;
    const W = Math.pow(10, logW);
    const pxPerM = w / W;
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, w, hh);
    const f = deepShift(W);
    const xc = centerFor(W) + f * QUARK_D[0];
    const yc = f * QUARK_D[1];
    const cy = hh * 0.47 - yc * pxPerM;
    const toX = (x) => w / 2 + (x - xc) * pxPerM;
    // row objects
    for (const o of ROW) {
      const px = o.size * pxPerM;
      if (o.key === 'atom' && px > w * 20) {
        // deep inside the atom the 1s cloud is nearly uniform: a faint haze fills the view
        ctx.fillStyle = `rgba(111,178,255,${(0.6 * 0.24).toFixed(3)})`;
        ctx.fillRect(0, 0, w, hh);
        continue;
      }
      if (px < 1 || px > w * 40) continue;
      const x = toX(o.x);
      if (x + px * 3 < 0 || x - px * 3 > w) continue;
      let alpha = 1;
      if (px > w * 2 && o.key !== 'atom' && o.key !== 'hair') alpha = Math.max(0, 1 - (px - w * 2) / (w * 6));
      if (o.key === 'atom') alpha = px > w * 3 ? Math.max(0.22, 1 - Math.log10(px / (w * 3)) * 0.25) : 1;
      if (alpha <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      o.draw(ctx, x, cy, px, W);
      ctx.restore();
      if (px > 34 && px < w * 0.95) label(ctx, o.label, fmtLen(o.size, 2), x, cy + Math.min(px * (o.key === 'dna' ? 0.9 : 0.62), hh * 0.38) + 18);
    }
    // deep zoom: the proton at the atom's centre, nuclei beside it, quarks inside
    const ax = toX(ROW[ROW.length - 1].x);
    const pPx = PROTON * pxPerM;
    if (pPx > 0.6) {
      drawProton(ctx, ax, cy, pPx, W);
      if (pPx > 34 && pPx < w * 0.9) label(ctx, 'Proton (hydrogen nucleus)', fmtLen(PROTON, 2), ax, cy + pPx * 0.62 + 18);
      let off = PROTON * 1.4;
      for (const nuc of NUCLEI) {
        off += nuc.size * 0.5;
        const nx = ax + off * pxPerM, npx = nuc.size * pxPerM;
        if (npx > 2 && nx - npx < w) {
          drawNucleus(ctx, nx, cy, npx, nuc);
          if (npx > 30 && npx < w * 0.9) label(ctx, nuc.label, fmtLen(nuc.size, 2), nx, cy + npx * 0.62 + 18);
        }
        off += nuc.size * 0.5 + PROTON * 0.6;
      }
    }
    // scale bar
    const target = W * 0.18;
    const p10 = Math.pow(10, Math.floor(Math.log10(target)));
    const len = [1, 2, 5].map((k) => k * p10).filter((v) => v <= target).pop() || p10;
    const bar = len * pxPerM;
    ctx.strokeStyle = '#a3a097';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(18, hh - 26); ctx.lineTo(18, hh - 20); ctx.lineTo(18 + bar, hh - 20); ctx.lineTo(18 + bar, hh - 26); ctx.stroke();
    ctx.fillStyle = '#e9e7e2';
    ctx.font = FONT.mono(12, 500);
    ctx.textAlign = 'left';
    ctx.fillText(fmtLen(len, 1), 18 + bar + 8, hh - 18);
    // readouts
    ctx.font = FONT.sans(11);
    ctx.fillStyle = '#8d8a83';
    ctx.textAlign = 'right';
    ctx.fillText(`field of view ${fmtLen(W, 3)}`, w - 16, 22);
    const nAtoms = W / H_ATOM;
    ctx.fillText(nAtoms >= 1 ? `≈ ${nAtoms >= 1e4 ? sig(nAtoms, 2).replace(/,/g, ',') : int(nAtoms)} hydrogen atoms across` : `${sig(1 / nAtoms, 2)} of these frames fit across one hydrogen atom`, w - 16, 40);
    const cap = caption(W);
    if (cap) wrapText(ctx, cap, 18, 26, Math.min(420, w - 36), '#c9c5bc');
    cv.canvas.setAttribute('aria-label', `Field of view ${fmtLen(W, 2)} wide. ${cap}`);
  }

  function label(ctx, name, size, x, y) {
    ctx.textAlign = 'center';
    ctx.font = FONT.sans(12, 600);
    ctx.fillStyle = '#e9e7e2';
    ctx.fillText(name, x, y);
    ctx.font = FONT.mono(11);
    ctx.fillStyle = '#8d8a83';
    ctx.fillText(size, x, y + 16);
  }
  function wrapText(ctx, text, x, y, maxW, col) {
    ctx.font = FONT.serif(15.5, 400, 'italic');
    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    const words = text.split(' ');
    let line = '', yy = y;
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = wd; yy += 21; } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  }

  // ---- dive animation
  let diving = false, raf = 0, last = 0, tween = null;
  function startDive() {
    if (logW <= LOG_MIN + 0.05) logW = LOG_MAX;
    diving = true;
    setDiveLabel();
    last = performance.now();
    raf = requestAnimationFrame(diveStep);
  }
  function stopDive() { diving = false; cancelAnimationFrame(raf); setDiveLabel(); }
  function setDiveLabel() {
    diveBtn.innerHTML = diving ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg><span>Pause</span>' : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg><span>Dive</span>';
  }
  function diveStep(now) {
    if (!diving) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const W = Math.pow(10, logW);
    // slow down where something new appears, speed through the empty atom
    const empty = W < 5e-11 && W > 5e-14;
    logW -= dt * (reduce ? 3 : empty ? 0.9 : 0.42);
    if (logW <= LOG_MIN) { logW = LOG_MIN; stopDive(); announce('Reached the scale of quarks.'); }
    zoom.set(-logW);
    draw();
    if (diving) raf = requestAnimationFrame(diveStep);
  }
  function animateTo(target) {
    const from = logW, t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 1200), e = t * t * (3 - 2 * t);
      logW = from + (target - from) * e;
      zoom.set(-logW); draw();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // wheel zoom only while the figure is mostly in view, so page scrolling still works
  cv.canvas.addEventListener('wheel', (e) => {
    const r = cv.canvas.getBoundingClientRect();
    const visible = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    if (visible < r.height * 0.75) return;
    const next = logW - e.deltaY * 0.0022;
    if ((next > LOG_MAX && e.deltaY < 0) || (next < LOG_MIN && e.deltaY > 0)) return;
    e.preventDefault();
    stopDive();
    logW = Math.max(LOG_MIN, Math.min(LOG_MAX, next));
    zoom.set(-logW);
    draw();
  }, { passive: false });

  draw();
  return { pause() { if (diving) stopDive(); } };
}

/* ---------------- drawings (line art on the dark stage) ---------------- */
const INK = '#d8d4cb';

function drawAnt(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK; ctx.fillStyle = '#2a211c'; ctx.lineWidth = Math.max(1, s * 0.012);
  const seg = (cx, rx, ry) => { ctx.beginPath(); ctx.ellipse(cx, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
  // legs
  ctx.beginPath();
  for (const k of [-1, 1]) for (const [lx, a] of [[-0.06, 0.9], [0.02, 0.5], [0.1, 0.2]]) {
    ctx.moveTo(lx * s, 0);
    ctx.quadraticCurveTo((lx - 0.08) * s, k * 0.12 * s, (lx - 0.2 + a * 0.15) * s, k * 0.24 * s);
  }
  ctx.stroke();
  seg(-0.3 * s, 0.2 * s, 0.11 * s);  // abdomen
  seg(0.02 * s, 0.12 * s, 0.06 * s); // thorax
  seg(0.24 * s, 0.09 * s, 0.075 * s); // head
  ctx.beginPath();
  ctx.moveTo(0.3 * s, -0.04 * s); ctx.quadraticCurveTo(0.4 * s, -0.2 * s, 0.48 * s, -0.16 * s);
  ctx.moveTo(0.3 * s, 0.04 * s); ctx.quadraticCurveTo(0.4 * s, 0.2 * s, 0.48 * s, 0.16 * s);
  ctx.stroke();
  ctx.restore();
}
function drawSalt(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  const a = s * 0.5, d = s * 0.22;
  ctx.lineWidth = Math.max(1, s * 0.01);
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#e8eef3'; ctx.globalAlpha *= 0.9;
  ctx.beginPath(); ctx.moveTo(-a, -a + d); ctx.lineTo(a - d, -a + d); ctx.lineTo(a - d, a); ctx.lineTo(-a, a); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(-a, -a + d); ctx.lineTo(-a + d, -a); ctx.lineTo(a, -a); ctx.lineTo(a - d, -a + d); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c9d3dc';
  ctx.beginPath(); ctx.moveTo(a - d, -a + d); ctx.lineTo(a, -a); ctx.lineTo(a, a - d); ctx.lineTo(a - d, a); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawHair(ctx, x, y, s, W) {
  ctx.save();
  const hh = ctx.canvas.height;
  ctx.fillStyle = '#4a3427';
  ctx.strokeStyle = '#7a5a45';
  ctx.lineWidth = Math.max(1, s * 0.012);
  ctx.fillRect(x - s / 2, -10, s, hh * 2);
  // cuticle scales
  for (let k = -20; k < 60; k++) {
    const yy = y + k * s * 0.35;
    ctx.beginPath(); ctx.moveTo(x - s / 2, yy); ctx.quadraticCurveTo(x, yy - s * 0.18, x + s / 2, yy + s * 0.05); ctx.stroke();
  }
  ctx.restore();
}
function drawRBC(ctx, x, y, s) {
  const r = s / 2;
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, '#b8343a'); g.addColorStop(0.45, '#9c2129'); g.addColorStop(0.8, '#c7353c'); g.addColorStop(1, '#8a1c22');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,190,0.35)'; ctx.lineWidth = Math.max(1, s * 0.01);
  ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.stroke();
}
function drawBacterium(ctx, x, y, s) {
  const w2 = s / 2, r = s * 0.13;
  ctx.save();
  ctx.strokeStyle = '#7fd1a8'; ctx.lineWidth = Math.max(1, s * 0.006);
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.moveTo(-w2 + x + k * 0.05 * s, y + (k % 2 ? r : -r));
    for (let t = 0; t <= 1; t += 0.05) ctx.lineTo(x - w2 - t * s * 0.5, y + (k - 2) * r * 0.9 + Math.sin(t * 12 + k) * r * 0.4 + (k % 2 ? r : -r));
    ctx.stroke();
  }
  ctx.fillStyle = '#2f6b4f'; ctx.strokeStyle = '#9be0bd'; ctx.lineWidth = Math.max(1, s * 0.01);
  ctx.beginPath(); ctx.roundRect(x - w2, y - r, s, 2 * r, r); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawVirus(ctx, x, y, s) {
  const r = s * 0.38;
  ctx.save();
  ctx.strokeStyle = '#c9a3ff'; ctx.lineWidth = Math.max(1, s * 0.012);
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const x1 = x + Math.cos(a) * r, y1 = y + Math.sin(a) * r, x2 = x + Math.cos(a) * s * 0.5, y2 = y + Math.sin(a) * s * 0.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.fillStyle = '#c9a3ff'; ctx.beginPath(); ctx.arc(x2, y2, s * 0.02, 0, Math.PI * 2); ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#6d4fa0'); g.addColorStop(1, '#2e2148');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawDNA(ctx, x, y, s) {
  // width s, drawn along x for a few turns
  const L = s * 6, amp = s / 2, pitch = s * 1.7;
  ctx.save();
  ctx.lineWidth = Math.max(1, s * 0.07);
  for (let k = 0; k <= 60; k++) {
    const t = k / 60, xx = x - L / 2 + t * L;
    const a = Math.sin((t * L * 2 * Math.PI) / pitch), b = Math.sin((t * L * 2 * Math.PI) / pitch + Math.PI * 0.75);
    if (k % 3 === 0) { ctx.strokeStyle = 'rgba(242,201,76,0.6)'; ctx.beginPath(); ctx.moveTo(xx, y + a * amp); ctx.lineTo(xx, y + b * amp); ctx.stroke(); }
  }
  for (const [ph, col] of [[0, '#6fb2ff'], [Math.PI * 0.75, '#ff8f6b']]) {
    ctx.strokeStyle = col;
    ctx.beginPath();
    for (let k = 0; k <= 200; k++) { const t = k / 200, xx = x - L / 2 + t * L; const yy = y + Math.sin((t * L * 2 * Math.PI) / pitch + ph) * amp; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
    ctx.stroke();
  }
  ctx.restore();
}
function drawWater(ctx, x, y, s) {
  // O–H 95.8 pm, angle 104.5°; spheres scaled to the molecule's ~280 pm size
  const k = s / 280e-12 * 1e-12;
  const oh = 95.8 * k, half = (104.5 / 2) * Math.PI / 180;
  const hx = Math.sin(half) * oh, hy = Math.cos(half) * oh;
  const ball = (bx, by, r, c1, c2) => {
    const g = ctx.createRadialGradient(bx - r * 0.35, by - r * 0.35, r * 0.1, bx, by, r);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
  };
  const oy = y - hy * 0.35;
  ctx.strokeStyle = '#9a968c'; ctx.lineWidth = Math.max(1, 14 * k);
  ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x - hx, oy + hy); ctx.moveTo(x, oy); ctx.lineTo(x + hx, oy + hy); ctx.stroke();
  ball(x - hx, oy + hy, 32 * k, '#ffffff', '#9aa3ad');
  ball(x + hx, oy + hy, 32 * k, '#ffffff', '#9aa3ad');
  ball(x, oy, 60 * k, '#ff8a7a', '#b0281e');
}
function drawAtom(ctx, x, y, s, W) {
  // hydrogen 1s: radial density ∝ exp(-2r/a0); s = 2 a0
  const a0 = s / 2;
  const R = a0 * 4.5;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  for (let i = 0; i <= 10; i++) {
    const r = (i / 10) * 4.5;
    g.addColorStop(i / 10, `rgba(111,178,255,${(0.6 * Math.exp(-2 * r)).toFixed(4)})`);
  }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  // speckle: a few sampled electron positions
  ctx.fillStyle = 'rgba(190,220,255,0.7)';
  const n = 140;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    // inverse CDF approximation for r: gamma(3) distribution with scale a0/2
    const r = -(a0 / 2) * Math.log(rnd() * rnd() * rnd() + 1e-12);
    const ang = rnd() * Math.PI * 2, ct = rnd() * 2 - 1, st = Math.sqrt(1 - ct * ct);
    const px = x + r * st * Math.cos(ang), py = y + r * ct;
    if (Math.abs(px - x) < 4000 && Math.abs(py - y) < 4000) ctx.fillRect(px - 0.8, py - 0.8, 1.6, 1.6);
  }
}
function drawProton(ctx, x, y, s, W) {
  const r = s / 2;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.5);
  g.addColorStop(0, 'rgba(224,82,59,0.95)'); g.addColorStop(0.55, 'rgba(224,82,59,0.55)'); g.addColorStop(1, 'rgba(224,82,59,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, Math.PI * 2); ctx.fill();
  if (s > 60) {
    const q = [[-0.28, -0.22, 'u', '#ffd166'], [0.3, -0.12, 'u', '#ffd166'], [0.02, 0.32, 'd', '#7fd1ff']];
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.min(2.5, Math.max(1, s * 0.006));
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const [x1, y1] = q[i], [x2, y2] = q[j];
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.02) {
        const px = x + (x1 + (x2 - x1) * t) * s, py = y + (y1 + (y2 - y1) * t) * s;
        const nx = -(y2 - y1), ny = x2 - x1, ln = Math.hypot(nx, ny);
        const off = Math.sin(t * Math.PI * 10) * Math.min(s * 0.02, 14);
        t ? ctx.lineTo(px + (nx / ln) * off, py + (ny / ln) * off) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    for (const [qx, qy, name, col] of q) {
      const qxp = x + qx * s, qyp = y + qy * s;
      const qr = Math.min(6, Math.max(2.5, s * 0.012));
      const g2 = ctx.createRadialGradient(qxp, qyp, 0, qxp, qyp, qr * 4);
      g2.addColorStop(0, col); g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(qxp, qyp, qr * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(qxp, qyp, qr, 0, Math.PI * 2); ctx.fill();
      if (s > 140) {
        ctx.font = FONT.sans(13, 600); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
        const full = s > 3000 ? (name === 'u' ? 'up quark' : 'down quark: no measured size') : name;
        ctx.fillText(full, qxp + 10, qyp - 8);
      }
    }
  }
}
function drawNucleus(ctx, x, y, s, nuc) {
  const n = nuc.A;
  const r = s / 2;
  const pr = r / Math.sqrt(n) * 0.95;
  const ga = Math.PI * (3 - Math.sqrt(5));
  let protonsLeft = nuc.Z;
  for (let i = 0; i < n; i++) {
    const rr = Math.sqrt((i + 0.5) / n) * (r - pr);
    const px = x + rr * Math.cos(i * ga), py = y + rr * Math.sin(i * ga);
    const isP = (i * nuc.Z) % n < nuc.Z && protonsLeft-- > 0;
    ctx.fillStyle = isP ? '#e0523b' : '#8c94a4';
    ctx.beginPath(); ctx.arc(px, py, Math.max(0.6, pr), 0, Math.PI * 2); ctx.fill();
  }
}
