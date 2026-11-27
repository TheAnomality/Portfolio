// Table salt: a lattice of Na⁺ and Cl⁻ ions, and the energy bookkeeping of an ionic bond.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { h, reducedMotion, onThemeChange } from '../lib/dom.js';
import { getElements } from '../lib/data.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { segmented } from '../lib/controls.js';
import { theme } from '../lib/plot.js';
import { fix } from '../lib/format.js';

const LATTICE_KJ = 787;            // NaCl lattice energy, kJ/mol (CRC Handbook)
const KJ_PER_EV = 96.485;
const D = 2.82;                     // Na–Cl distance, Å
const R_NA = 1.02, R_CL = 1.81;     // ionic radii, Å (Shannon)

export async function mount(el) {
  const E = await getElements();
  const na = E.bySym.get('Na'), cl = E.bySym.get('Cl');
  const steps = [
    { label: 'Separate Na and Cl atoms', d: 0 },
    { label: 'Pull an electron off sodium', d: +na.ie, note: `ionisation energy, ${fix(na.ie, 2)} eV` },
    { label: 'Give it to chlorine', d: -cl.ea, note: `electron affinity, ${fix(cl.ea, 2)} eV` },
    { label: 'Let the ions pack into a crystal', d: -LATTICE_KJ / KJ_PER_EV, note: `lattice energy, ${LATTICE_KJ} kJ/mol` },
  ];

  const frame = h('div.fig__frame');
  const split = h('div.fig-split');
  const left = h('div.plot.sc-3d', { style: { background: '#0a0b0e', position: 'relative' } });
  const right = h('div.plot');
  split.append(left, right);
  const controls = h('div.fig__controls');
  frame.append(split, controls);
  el.prepend(frame);

  // ---- 3D lattice
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor('#0a0b0e');
  left.append(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'A cube of the sodium chloride crystal: small sodium ions and large chloride ions alternating in all three directions.');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  camera.position.set(16, 12, 20);
  const controlsOC = new OrbitControls(camera, renderer.domElement);
  controlsOC.enableDamping = true;
  controlsOC.enablePan = false;
  controlsOC.autoRotate = !reducedMotion();
  controlsOC.autoRotateSpeed = 0.8;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.2));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(5, 10, 7); scene.add(dl);
  const N = 4;
  const naGeo = new THREE.SphereGeometry(1, 32, 16), clGeo = new THREE.SphereGeometry(1, 32, 16);
  const naMat = new THREE.MeshStandardMaterial({ color: '#9b8cff', roughness: 0.35 });
  const clMat = new THREE.MeshStandardMaterial({ color: '#57c27b', roughness: 0.45 });
  const naMesh = new THREE.InstancedMesh(naGeo, naMat, (N * N * N) / 2 + 1);
  const clMesh = new THREE.InstancedMesh(clGeo, clMat, (N * N * N) / 2 + 1);
  scene.add(naMesh, clMesh);
  let shrink = 1;
  function layout() {
    const m = new THREE.Matrix4();
    let ni = 0, ci = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
      const isNa = (i + j + k) % 2 === 0;
      const r = (isNa ? R_NA : R_CL) * shrink;
      m.makeScale(r, r, r).setPosition((i - (N - 1) / 2) * D, (j - (N - 1) / 2) * D, (k - (N - 1) / 2) * D);
      if (isNa) naMesh.setMatrixAt(ni++, m); else clMesh.setMatrixAt(ci++, m);
    }
    naMesh.count = ni; clMesh.count = ci;
    naMesh.instanceMatrix.needsUpdate = true; clMesh.instanceMatrix.needsUpdate = true;
  }
  layout();
  const legend = h('div.sc-legend', null, h('span', null, h('i', { style: { background: '#9b8cff' } }), 'Na⁺, 102 pm'), h('span', null, h('i', { style: { background: '#57c27b' } }), 'Cl⁻, 181 pm'));
  left.append(legend);
  function resize3d() {
    const w = left.clientWidth, hh = Math.max(280, Math.min(380, w * 0.85));
    renderer.setSize(w, hh, false);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = hh + 'px';
    camera.aspect = w / hh; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize3d).observe(left);
  resize3d();

  // ---- energy ladder
  const cv = setupCanvas(right, { height: (w) => Math.max(280, Math.min(380, w * 0.9)), onResize: () => drawLadder() });
  cv.canvas.setAttribute('role', 'img');
  cv.canvas.setAttribute('aria-label', `Energy steps in forming sodium chloride from atoms: plus ${fix(na.ie, 2)} eV to ionise sodium, minus ${fix(cl.ea, 2)} eV for chlorine to accept the electron, minus ${fix(LATTICE_KJ / KJ_PER_EV, 2)} eV as the ions form a crystal.`);
  function drawLadder() {
    const { ctx, w, h: hh } = cv;
    const t = theme();
    ctx.clearRect(0, 0, w, hh);
    let e = 0;
    const levels = steps.map((s) => (e += s.d));
    const lo = Math.min(...levels) - 0.6, hi = Math.max(...levels) + 0.8;
    const sy = (v) => 28 + ((hi - v) / (hi - lo)) * (hh - 64);
    const colW = (w - 40) / steps.length;
    ctx.font = FONT.sans(11);
    levels.forEach((v, i) => {
      const x0 = 20 + i * colW + 8, x1 = x0 + colW - 16;
      ctx.strokeStyle = t.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, sy(v)); ctx.lineTo(x1, sy(v)); ctx.stroke();
      if (i > 0) {
        const prev = levels[i - 1];
        const up = v > prev;
        ctx.strokeStyle = up ? '#e0523b' : '#1f7a4d';
        ctx.fillStyle = ctx.strokeStyle;
        const ax = x0 - 8;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(ax, sy(prev)); ctx.lineTo(ax, sy(v)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax, sy(v)); ctx.lineTo(ax - 4, sy(v) + (up ? 7 : -7)); ctx.lineTo(ax + 4, sy(v) + (up ? 7 : -7)); ctx.closePath(); ctx.fill();
        ctx.font = FONT.mono(11, 500);
        ctx.textAlign = 'left';
        ctx.fillText(`${up ? '+' : '−'}${fix(Math.abs(v - prev), 2)} eV`, ax + 6, (sy(v) + sy(prev)) / 2);
      }
      ctx.fillStyle = t.ink2;
      ctx.font = FONT.sans(10.5);
      ctx.textAlign = 'center';
      wrap(ctx, steps[i].label, (x0 + x1) / 2, sy(v) + 16, colW - 10, 13);
      ctx.fillStyle = t.ink3;
      ctx.font = FONT.mono(10.5);
      ctx.fillText(`${v > 0 ? '+' : v < 0 ? '−' : ''}${fix(Math.abs(v), 2)} eV`, (x0 + x1) / 2, sy(v) - 8);
    });
    ctx.fillStyle = t.ink3;
    ctx.font = FONT.sans(10.5);
    ctx.textAlign = 'left';
    ctx.fillText('energy per Na–Cl pair, relative to separate atoms', 20, 14);
  }
  function wrap(ctx, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '', yy = y;
    for (const wd of words) {
      const test = line ? `${line} ${wd}` : wd;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = wd; yy += lh; } else line = test;
    }
    ctx.fillText(line, x, yy);
  }

  const view = segmented({ label: 'Ions', options: [{ value: 1, label: 'True size' }, { value: 0.4, label: 'Shrunk, to see the lattice' }], value: 1, onChange: (v) => { shrink = v; layout(); } });
  controls.append(view.el);
  onThemeChange(drawLadder);
  drawLadder();

  let raf = 0, running = false;
  function loop() { if (!running) return; controlsOC.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); }
  renderer.render(scene, camera);
  return {
    resume() { if (running) return; running = true; raf = requestAnimationFrame(loop); },
    pause() { running = false; cancelAnimationFrame(raf); },
  };
}
