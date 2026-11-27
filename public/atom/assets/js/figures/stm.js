// A scanning tunnelling microscope building an image of a quantum corral, line by line.
import { h, reducedMotion } from '../lib/dom.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { button, segmented } from '../lib/controls.js';
import { colormap } from '../lib/color.js';
import { fix } from '../lib/format.js';

const SPAN = 180;          // Å across the scan
const A_LAT = 2.55;        // Cu(111) surface lattice constant, Å
const R_CORRAL = 71.3;     // radius of the 48-atom iron ring, Å (Crommie, Lutz & Eigler 1993)
const KF = 0.21;           // Cu(111) surface-state Fermi wavevector, 1/Å
const KAPPA = 1.1;         // tunnelling decay constant, 1/Å (work function ≈ 4.6 eV)
const COPPER = colormap(['#140805', '#4a1d0c', '#9a4a1c', '#d98a3a', '#f6d08a', '#fff6dc']);

function j0(x) {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const n = 57568490574.0 + y * (-13362590354.0 + y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))));
    const d = 57568490411.0 + y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y))));
    return n / d;
  }
  const z = 8 / ax, y = z * z, xx = ax - 0.785398164;
  const p = 1 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
  const q = -0.1562499995e-1 + y * (0.1430488765e-3 + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
  return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
}

// Apparent height (Å) at surface point (x, y) in Å, origin at the corral centre.
const ADATOMS = Array.from({ length: 48 }, (_, i) => { const a = (i / 48) * Math.PI * 2; return [R_CORRAL * Math.cos(a), R_CORRAL * Math.sin(a)]; });
const G = [[0, 1], [Math.sqrt(3) / 2, -0.5], [-Math.sqrt(3) / 2, -0.5]].map(([gx, gy]) => [gx * (4 * Math.PI) / (Math.sqrt(3) * A_LAT), gy * (4 * Math.PI) / (Math.sqrt(3) * A_LAT)]);
function height(x, y) {
  let z = 0.03 * (Math.cos(G[0][0] * x + G[0][1] * y) + Math.cos(G[1][0] * x + G[1][1] * y) + Math.cos(G[2][0] * x + G[2][1] * y));
  const r = Math.hypot(x, y);
  // standing waves of surface electrons trapped inside the ring
  if (r < R_CORRAL - 3) z += 0.12 * Math.pow(j0(KF * r), 2) * 2.2;
  else z += 0.03 * Math.pow(j0(KF * (r - R_CORRAL)), 2) * Math.exp(-(r - R_CORRAL) / 30);
  for (const [ax, ay] of ADATOMS) {
    const d2 = (x - ax) * (x - ax) + (y - ay) * (y - ay);
    if (d2 < 100) z += 1.0 * Math.exp(-d2 / (2 * 2.1 * 2.1));
  }
  return z;
}

export function mount(el) {
  const reduce = reducedMotion();
  const RES = 220;
  const img = new ImageData(RES, RES);
  const H = new Float32Array(RES * RES);
  let row = 0, done = false, speed = 1.2;
  let minH = Infinity, maxH = -Infinity;
  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
    const x = -SPAN / 2 + (i / (RES - 1)) * SPAN, y = SPAN / 2 - (j / (RES - 1)) * SPAN;
    const v = height(x, y);
    H[j * RES + i] = v;
    minH = Math.min(minH, v); maxH = Math.max(maxH, v);
  }

  const frame = h('div.fig__frame.fig__frame--stage');
  const split = h('div.fig-split');
  const left = h('div.plot');
  const right = h('div.fig-side.el-side');
  split.append(left, right);
  const controls = h('div.fig__controls');
  frame.append(split, controls);
  el.prepend(frame);
  const side = h('div');
  const prof = h('div.plot', { style: { marginTop: '1rem' } });
  right.append(side, prof);
  const cv = setupCanvas(left, { height: (w) => Math.max(300, Math.min(480, w * 0.86)), onResize: () => draw() });
  const pc = setupCanvas(prof, { height: 130, onResize: () => drawProfile() });
  cv.canvas.setAttribute('role', 'img');
  cv.canvas.setAttribute('aria-label', 'Simulated STM image of 48 iron atoms in a ring on copper, with rippling electron waves inside.');
  const tmp = document.createElement('canvas');
  tmp.width = RES; tmp.height = RES;

  side.innerHTML = `
    <div class="el-side__k">How it works</div>
    <p class="el-side__p">A metal tip, sharpened to a single atom, hovers about half a nanometre above the surface. A small voltage makes electrons <b>tunnel</b> across the gap, a purely quantum effect. The current falls about ninefold for every extra 0.1 nm of gap, so it is exquisitely sensitive to height.</p>
    <p class="el-side__p">The tip scans line by line while a feedback loop raises and lowers it to keep the current constant. The recorded height becomes the image.</p>`;

  function paintRows(upTo) {
    for (let j = 0; j < upTo; j++) for (let i = 0; i < RES; i++) {
      const k = j * RES + i;
      const t = (H[k] - minH) / (maxH - minH);
      const shade = Math.pow(t, 0.7);
      const [r, g, b] = COPPER(shade);
      img.data[4 * k] = r * 255; img.data[4 * k + 1] = g * 255; img.data[4 * k + 2] = b * 255; img.data[4 * k + 3] = 255;
    }
    for (let j = upTo; j < RES; j++) for (let i = 0; i < RES; i++) { const k = j * RES + i; img.data[4 * k] = 10; img.data[4 * k + 1] = 11; img.data[4 * k + 2] = 14; img.data[4 * k + 3] = 255; }
  }

  function draw() {
    const { ctx, w, h: hh } = cv;
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, w, hh);
    const r = Math.floor(row);
    paintRows(Math.min(RES, r));
    tmp.getContext('2d').putImageData(img, 0, 0);
    const size = Math.min(w, hh) - 24;
    const ox = (w - size) / 2, oy = (hh - size) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, ox, oy, size, size);
    if (!done) {
      const y = oy + (r / RES) * size;
      ctx.strokeStyle = 'rgba(111,178,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + size, y); ctx.stroke();
      const tipX = ox + ((row % 1) * size);
      ctx.fillStyle = '#cfe4ff';
      ctx.beginPath(); ctx.moveTo(tipX, y - 2); ctx.lineTo(tipX - 6, y - 14); ctx.lineTo(tipX + 6, y - 14); ctx.closePath(); ctx.fill();
    }
    // scale bar: 5 nm
    const bar = (50 / SPAN) * size;
    ctx.strokeStyle = '#e9e7e2'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ox + 12, oy + size - 14); ctx.lineTo(ox + 12 + bar, oy + size - 14); ctx.stroke();
    ctx.fillStyle = '#e9e7e2'; ctx.font = FONT.mono(11, 500); ctx.textAlign = 'left';
    ctx.fillText('5 nm', ox + 18 + bar, oy + size - 10);
    drawProfile();
  }

  function drawProfile() {
    const { ctx, w, h: hh } = pc;
    ctx.clearRect(0, 0, w, hh);
    const j = Math.min(RES - 1, Math.floor(row));
    const base = hh - 22, scale = (hh - 60) / (maxH - minH);
    ctx.fillStyle = '#4a1d0c';
    ctx.beginPath(); ctx.moveTo(0, hh);
    for (let i = 0; i < RES; i++) ctx.lineTo((i / (RES - 1)) * w, base - (H[j * RES + i] - minH) * scale);
    ctx.lineTo(w, hh); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d98a3a'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < RES; i++) { const x = (i / (RES - 1)) * w, y = base - (H[j * RES + i] - minH) * scale; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    // tip path: constant gap above the surface
    ctx.strokeStyle = 'rgba(111,178,255,0.8)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let i = 0; i < RES; i++) { const x = (i / (RES - 1)) * w, y = base - (H[j * RES + i] - minH) * scale - 22; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#8d8a83'; ctx.font = FONT.sans(10.5); ctx.textAlign = 'left';
    ctx.fillText('this scan line: surface (orange) and tip path (dashed)', 0, 12);
    ctx.fillText(`height exaggerated · bumps are ${fix(maxH - minH, 1)} Å tall`, 0, 26);
  }

  const speedCtl = segmented({ label: 'Scan speed', options: [{ value: 0.4, label: 'Slow' }, { value: 1.2, label: 'Normal' }, { value: 4, label: 'Fast' }], value: speed, onChange: (v) => { speed = v; } });
  const again = button({ label: 'Scan again', icon: 'reset', onClick: () => { row = 0; done = false; start(); } });
  controls.append(speedCtl.el, h('span.spacer'), again);

  let raf = 0, running = false, visible = false;
  function loop() {
    if (!running) return;
    row += speed;
    if (row >= RES) { row = RES; done = true; }
    draw();
    if (done) { running = false; return; }
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!visible || running || done) { draw(); return; } running = true; raf = requestAnimationFrame(loop); }
  if (reduce) { row = RES; done = true; }
  draw();
  return {
    resume() { visible = true; start(); },
    pause() { visible = false; running = false; cancelAnimationFrame(raf); },
  };
}
