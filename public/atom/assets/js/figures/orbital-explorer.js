// Interactive 3D hydrogen orbital explorer: point cloud, isosurface and slice views.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { h, reducedMotion, liveRegion } from '../lib/dom.js';
import { segmented, toggle, slider } from '../lib/controls.js';
import * as H from '../lib/hydrogen.js';
import { sample, surface } from '../lib/orbital-client.js';
import { fix, sig } from '../lib/format.js';

const A0_NM = 0.0529177;
const POS = new THREE.Color('#f59a3a');
const NEG = new THREE.Color('#3a9cff');

const VERT = /* glsl */ `
  attribute vec3 aFrom; attribute vec3 aTo; attribute float aSFrom; attribute float aSTo; attribute float aRand;
  uniform float uMix; uniform float uSize; uniform float uPR;
  varying float vSign;
  void main() {
    float m = clamp(uMix * 1.4 - aRand * 0.4, 0.0, 1.0);
    float e = m * m * (3.0 - 2.0 * m);
    vec3 p = mix(aFrom, aTo, e);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, uSize * uPR / -mv.z);
    vSign = mix(aSFrom, aSTo, e);
  }`;
const FRAG = /* glsl */ `
  uniform vec3 uPos; uniform vec3 uNeg; uniform float uOpacity;
  varying float vSign;
  void main() {
    vec2 c = gl_PointCoord - 0.5; float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(mix(uNeg, uPos, clamp(vSign * 0.5 + 0.5, 0.0, 1.0)), a * uOpacity);
  }`;

function parseHash() {
  const m = /orbital=(\d),(\d),(-?\d)/.exec(location.search + location.hash);
  if (!m) return null;
  const [n, l, mm] = [+m[1], +m[2], +m[3]];
  if (n >= 1 && n <= 7 && l < n && Math.abs(mm) <= l) return [n, l, mm];
  return null;
}

function textSprite(text, color = '#8d8a83') {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'italic 40px Newsreader, Georgia, serif';
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  return s;
}

export async function mount(el, opts = {}) {
  const fromUrl = parseHash();
  let n = fromUrl ? fromUrl[0] : +(opts.n || 3);
  let l = fromUrl ? fromUrl[1] : +(opts.l || 2);
  let m = fromUrl ? fromUrl[2] : +(opts.m || 0);
  let view = 'cloud', plane = 'xz';
  const small = window.innerWidth < 700;
  let count = small ? 45000 : 90000;
  const announce = liveRegion(el);

  // ---------- DOM
  const frame = h('div.fig__frame.fig__frame--stage');
  const stage = h('div.orb-stage');
  const title = h('div.orb-title');
  const busy = h('div.orb-busy', null, 'Computing…');
  const scaleBar = h('div.orb-scale', null, h('i'), h('span'));
  const hint = h('div.fig__hint', null, small ? 'Drag to rotate · pinch to zoom' : 'Drag to rotate · scroll to zoom');
  const sliceCanvas = h('canvas.orb-slice', { 'aria-hidden': 'true' });
  stage.append(sliceCanvas, title, busy, scaleBar, hint);
  frame.appendChild(stage);

  const rowA = h('div.fig__controls');
  const rowB = h('div.fig__controls');
  const readouts = h('dl.readouts.orb-readouts');
  frame.append(rowA, rowB, h('div.fig__controls', null, readouts));
  el.prepend(frame);

  // ---------- Three
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor('#0b0c0f');
  stage.prepend(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.autoRotate = !reducedMotion();
  controls.autoRotateSpeed = 0.6;

  // points
  const MAXC = 200000;
  const geo = new THREE.BufferGeometry();
  const aFrom = new Float32Array(MAXC * 3), aTo = new Float32Array(MAXC * 3);
  const sFrom = new Float32Array(MAXC), sTo = new Float32Array(MAXC), rnd = new Float32Array(MAXC);
  for (let i = 0; i < MAXC; i++) rnd[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(aTo, 3));
  geo.setAttribute('aFrom', new THREE.BufferAttribute(aFrom, 3));
  geo.setAttribute('aTo', new THREE.BufferAttribute(aTo, 3));
  geo.setAttribute('aSFrom', new THREE.BufferAttribute(sFrom, 1));
  geo.setAttribute('aSTo', new THREE.BufferAttribute(sTo, 1));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
  geo.setDrawRange(0, 0);
  const pmat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMix: { value: 1 }, uSize: { value: 1 }, uPR: { value: renderer.getPixelRatio() }, uPos: { value: POS }, uNeg: { value: NEG }, uOpacity: { value: 0.4 } },
  });
  const points = new THREE.Points(geo, pmat);
  points.frustumCulled = false;
  scene.add(points);

  // isosurface
  const smat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.0, side: THREE.DoubleSide, transparent: true, opacity: 0.94 });
  let mesh = null;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1410, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9bb8ff, 0.7);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  // axes + nucleus
  const axes = new THREE.Group();
  scene.add(axes);
  const axisMat = new THREE.LineBasicMaterial({ color: 0x5a5d66, transparent: true, opacity: 0.55 });
  const labels = { x: textSprite('x'), y: textSprite('y'), z: textSprite('z') };
  for (const s of Object.values(labels)) axes.add(s);
  let axisLines = null;
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff6a4d' }));
  scene.add(nucleus);

  function layoutAxes(L) {
    if (axisLines) { axes.remove(axisLines); axisLines.geometry.dispose(); }
    const g = new THREE.BufferGeometry();
    // physics x -> three x; physics y -> three -z; physics z -> three y
    g.setAttribute('position', new THREE.Float32BufferAttribute([-L, 0, 0, L, 0, 0, 0, 0, L, 0, 0, -L, 0, -L, 0, 0, L, 0], 3));
    axisLines = new THREE.LineSegments(g, axisMat);
    axes.add(axisLines);
    const s = L * 0.075;
    labels.x.position.set(L * 1.06, 0, 0); labels.y.position.set(0, 0, -L * 1.06); labels.z.position.set(0, L * 1.06, 0);
    for (const sp of Object.values(labels)) sp.scale.set(s, s, s);
  }

  // ---------- sizing
  let W = 0, Hh = 0;
  function resize() {
    W = stage.clientWidth; Hh = stage.clientHeight;
    renderer.setSize(W, Hh, false);
    renderer.domElement.style.width = W + 'px';
    renderer.domElement.style.height = Hh + 'px';
    camera.aspect = W / Math.max(1, Hh);
    camera.updateProjectionMatrix();
    drawSlice();
    updateScaleBar();
    needsRender = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  // ---------- state + data
  let extent = 10, reqId = 0, needsRender = true, running = false, raf = 0, mixT = 1, firstLoad = true;

  function setTitle() {
    const nm = H.orbitalName(n, l, m);
    title.innerHTML = `<div class="orb-title__name">${nm.html}</div><div class="orb-title__qn">n = ${n} &nbsp; ℓ = ${l} &nbsp; m = ${m}</div>`;
    renderer.domElement.setAttribute('aria-label', `Hydrogen ${nm.text} orbital, shown as a ${view === 'cloud' ? 'probability cloud' : view === 'surface' ? '90% probability surface' : 'cross-section'}.`);
  }

  function setReadouts() {
    const E = H.energyEV(n);
    const rmp = H.mostProbableRadius(n, l);
    const items = [
      ['Energy', `${fix(E, 3)} eV`],
      ['Radial nodes', String(H.radialNodes(n, l))],
      ['Angular nodes', String(H.angularNodes(l))],
      ['Most likely r', `${sig(rmp, 3)} a₀`],
      ['Mean r', `${sig(H.meanRadius(n, l), 3)} a₀ = ${sig(H.meanRadius(n, l) * A0_NM, 2)} nm`],
    ];
    readouts.innerHTML = items.map(([k, v]) => `<div class="readout"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  function fitCamera(animate) {
    const dist = extent * (camera.aspect < 1 ? 4.6 : 3.55);
    const dir = camera.position.clone().normalize();
    if (dir.lengthSq() === 0 || firstLoad) dir.set(0.55, 0.42, 1).normalize();
    const target = dir.multiplyScalar(dist);
    if (animate && !reducedMotion()) {
      const start = camera.position.clone();
      const t0 = performance.now();
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / 700);
        const e = t * t * (3 - 2 * t);
        camera.position.lerpVectors(start, target, e);
        needsRender = true;
        updateScaleBar();
        if (t < 1) requestAnimationFrame(step);
      };
      step();
    } else {
      camera.position.copy(target);
    }
    controls.minDistance = extent * 0.6;
    controls.maxDistance = extent * 9;
    nucleus.scale.setScalar(extent * 0.007);
    pmat.uniforms.uSize.value = extent * (small ? 9.5 : 8.0);
    layoutAxes(extent * 0.98);
  }

  async function loadCloud(morph) {
    const id = ++reqId;
    busy.dataset.show = 'true';
    const res = await sample(n, l, m, count, 7);
    if (id !== reqId) return;
    busy.dataset.show = 'false';
    const N = count;
    if (morph) {
      // start from current target
      aFrom.set(aTo.subarray(0, N * 3));
      sFrom.set(sTo.subarray(0, N));
    }
    for (let i = 0; i < N; i++) {
      aTo[3 * i] = res.pos[3 * i];
      aTo[3 * i + 1] = res.pos[3 * i + 2];
      aTo[3 * i + 2] = -res.pos[3 * i + 1];
      sTo[i] = res.sign[i];
    }
    if (!morph) { aFrom.set(aTo.subarray(0, N * 3)); sFrom.set(sTo.subarray(0, N)); }
    for (const k of ['aFrom', 'aTo', 'aSFrom', 'aSTo', 'position']) geo.attributes[k].needsUpdate = true;
    geo.setDrawRange(0, N);
    pmat.uniforms.uOpacity.value = Math.min(0.9, Math.max(0.12, 0.5 * Math.sqrt(60000 / N)));
    mixT = morph && !reducedMotion() ? 0 : 1;
    pmat.uniforms.uMix.value = mixT;
    needsRender = true;
  }

  async function loadSurface() {
    const id = ++reqId;
    busy.dataset.show = 'true';
    const res = await surface(n, l, m, small ? 60 : 76, 0.9);
    if (id !== reqId) return;
    busy.dataset.show = 'false';
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
    const g = new THREE.BufferGeometry();
    const nv = res.positions.length / 3;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      pos[3 * i] = res.positions[3 * i]; pos[3 * i + 1] = res.positions[3 * i + 2]; pos[3 * i + 2] = -res.positions[3 * i + 1];
      nor[3 * i] = res.normals[3 * i]; nor[3 * i + 1] = res.normals[3 * i + 2]; nor[3 * i + 2] = -res.normals[3 * i + 1];
      const c = res.sign[i] > 0 ? POS : NEG;
      col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(res.indices, 1));
    mesh = new THREE.Mesh(g, smat);
    scene.add(mesh);
    needsRender = true;
  }

  function drawSlice() {
    if (view !== 'slice') return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = stage.clientWidth, ch = stage.clientHeight;
    sliceCanvas.width = Math.round(cw * dpr); sliceCanvas.height = Math.round(ch * dpr);
    sliceCanvas.style.width = cw + 'px'; sliceCanvas.style.height = ch + 'px';
    const g = sliceCanvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b0c0f';
    g.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    const size = Math.min(cw, ch) * 0.92;
    const res = Math.min(320, Math.round(size * dpr * 0.6));
    const half = H.radiusContaining(n, l, 0.995) * 1.05;
    const { data } = H.psiPlane(n, l, m, { plane, half, res });
    let max = 0;
    for (const v of data) if (v * v > max) max = v * v;
    const img = g.createImageData(res, res);
    for (let i = 0; i < res * res; i++) {
      const v = data[i];
      const t = Math.pow((v * v) / (max || 1), 0.42);
      const c = v >= 0 ? [245, 154, 58] : [58, 156, 255];
      img.data[4 * i] = 11 + (c[0] - 11) * t;
      img.data[4 * i + 1] = 12 + (c[1] - 12) * t;
      img.data[4 * i + 2] = 15 + (c[2] - 15) * t;
      img.data[4 * i + 3] = 255;
    }
    const tmp = document.createElement('canvas');
    tmp.width = res; tmp.height = res;
    tmp.getContext('2d').putImageData(img, 0, 0);
    const px = size * dpr;
    const ox = (sliceCanvas.width - px) / 2, oy = (sliceCanvas.height - px) / 2;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(tmp, ox, oy, px, px);
    // axes
    const [hl, vl] = plane === 'xz' ? ['x', 'z'] : plane === 'xy' ? ['x', 'y'] : ['y', 'z'];
    g.strokeStyle = 'rgba(160,160,170,.28)';
    g.lineWidth = dpr;
    g.beginPath();
    g.moveTo(ox, oy + px / 2); g.lineTo(ox + px, oy + px / 2);
    g.moveTo(ox + px / 2, oy); g.lineTo(ox + px / 2, oy + px);
    g.stroke();
    g.fillStyle = 'rgba(200,198,190,.75)';
    g.font = `italic ${15 * dpr}px Newsreader, Georgia, serif`;
    g.fillText(hl, ox + px - 14 * dpr, oy + px / 2 - 8 * dpr);
    g.fillText(vl, ox + px / 2 + 8 * dpr, oy + 16 * dpr);
    g.fillStyle = '#ff6a4d';
    g.beginPath(); g.arc(ox + px / 2, oy + px / 2, 2.2 * dpr, 0, Math.PI * 2); g.fill();
    sliceScale = { pxPerA0: size / (2 * half) };
    updateScaleBar();
  }
  let sliceScale = null;

  function updateScaleBar() {
    let pxPer;
    if (view === 'slice' && sliceScale) pxPer = sliceScale.pxPerA0;
    else {
      const d = camera.position.length();
      const visH = 2 * d * Math.tan((camera.fov * Math.PI) / 360);
      pxPer = Hh / visH;
    }
    if (!isFinite(pxPer) || pxPer <= 0) return;
    const target = 110 / pxPer;
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
    let len = steps[0];
    for (const s of steps) if (s <= target) len = s;
    scaleBar.querySelector('i').style.width = `${len * pxPer}px`;
    scaleBar.querySelector('span').textContent = `${len} a₀ = ${sig(len * A0_NM, 2)} nm`;
  }

  async function update(changed) {
    setTitle();
    setReadouts();
    const newExtent = H.radiusContaining(n, l, 0.99);
    const extentChanged = Math.abs(newExtent - extent) / extent > 0.02;
    extent = newExtent;
    if (extentChanged || firstLoad) fitCamera(!firstLoad);
    points.visible = view === 'cloud';
    if (mesh) mesh.visible = view === 'surface';
    renderer.domElement.style.visibility = view === 'slice' ? 'hidden' : 'visible';
    sliceCanvas.style.display = view === 'slice' ? 'block' : 'none';
    hint.style.display = view === 'slice' ? 'none' : '';
    planeCtl.el.style.display = view === 'slice' ? '' : 'none';
    countCtl.el.style.display = view === 'cloud' ? '' : 'none';
    rotateCtl.el.style.display = view === 'slice' ? 'none' : '';
    if (view === 'cloud') await loadCloud(!firstLoad && changed !== 'count');
    else if (view === 'surface') await loadSurface();
    else drawSlice();
    updateScaleBar();
    firstLoad = false;
    announce(`${H.orbitalName(n, l, m).text} orbital`);
  }

  // ---------- controls
  const nCtl = segmented({ label: 'n', options: [1, 2, 3, 4, 5, 6, 7].map((v) => ({ value: v, label: String(v) })), value: n, ariaLabel: 'Principal quantum number n',
    onChange: (v) => { n = v; if (l >= n) l = n - 1; if (Math.abs(m) > l) m = 0; buildL(); buildM(); update('n'); } });
  const lWrap = h('div.control', null, h('span.control__label.control__label--math', null, 'ℓ'));
  const mWrap = h('div.control', null, h('span.control__label.control__label--math', null, 'm'));
  let lCtl, mCtl;
  function buildL() {
    lCtl?.el.remove();
    lCtl = segmented({ options: Array.from({ length: n }, (_, i) => ({ value: i, label: 'spdfghi'[i], title: `ℓ = ${i}` })), value: l, ariaLabel: 'Angular momentum quantum number ℓ',
      onChange: (v) => { l = v; if (Math.abs(m) > l) m = 0; buildM(); update('l'); } });
    lWrap.appendChild(lCtl.el);
  }
  function buildM() {
    mCtl?.el.remove();
    const opts = [];
    for (let mm = -l; mm <= l; mm++) {
      const name = H.orbitalName(n, l, mm);
      const sub = name.text.split(' ')[1];
      opts.push({ value: mm, label: l === 0 ? '0' : l <= 3 ? sub : String(mm), title: `m = ${mm}` });
    }
    mCtl = segmented({ options: opts, value: m, ariaLabel: 'Magnetic quantum number m', onChange: (v) => { m = v; update('m'); } });
    mWrap.appendChild(mCtl.el);
  }
  buildL(); buildM();
  nCtl.el.querySelector('.control__label')?.classList.add('control__label--math');
  rowA.append(nCtl.el, lWrap, mWrap);

  const viewCtl = segmented({ label: 'View', options: [{ value: 'cloud', label: 'Cloud' }, { value: 'surface', label: 'Surface' }, { value: 'slice', label: 'Slice' }], value: view,
    onChange: (v) => { view = v; update('view'); } });
  const planeCtl = segmented({ label: 'Plane', options: [{ value: 'xz', label: 'xz' }, { value: 'xy', label: 'xy' }, { value: 'yz', label: 'yz' }], value: plane,
    onChange: (v) => { plane = v; drawSlice(); } });
  const countCtl = slider({ label: 'Dots', min: 10000, max: 200000, step: 10000, value: count, format: (v) => `${Math.round(v / 1000)}k`,
    onInput: (v) => { count = v; clearTimeout(countCtl._t); countCtl._t = setTimeout(() => update('count'), 180); } });
  const rotateCtl = toggle({ label: 'Auto-rotate', checked: controls.autoRotate, onChange: (v) => { controls.autoRotate = v; } });
  const axesCtl = toggle({ label: 'Axes', checked: true, onChange: (v) => { axes.visible = v; needsRender = true; } });
  rowB.append(viewCtl.el, planeCtl.el, countCtl.el, h('span.spacer'), rotateCtl.el, axesCtl.el);

  controls.addEventListener('change', () => { needsRender = true; updateScaleBar(); });

  document.addEventListener('orbital:select', (e) => {
    const d = e.detail;
    n = d.n; l = d.l; m = d.m;
    nCtl.set(n); buildL(); buildM();
    update('m');
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  });

  function frameLoop(now) {
    if (!running) return;
    if (mixT < 1) {
      mixT = Math.min(1, mixT + 1 / 60 / 1.1);
      pmat.uniforms.uMix.value = mixT;
      needsRender = true;
    }
    controls.update();
    if (controls.autoRotate && view !== 'slice') needsRender = true;
    if (needsRender && view !== 'slice') {
      renderer.render(scene, camera);
      needsRender = false;
    }
    raf = requestAnimationFrame(frameLoop);
  }

  resize();
  await update('init');
  renderer.render(scene, camera);

  return {
    resume() { if (running) return; running = true; raf = requestAnimationFrame(frameLoop); },
    pause() { running = false; cancelAnimationFrame(raf); },
  };
}
