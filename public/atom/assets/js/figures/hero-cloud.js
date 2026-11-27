// Home-page hero: Bohr's orbit dissolving into real hydrogen probability clouds.
import * as THREE from 'three';
import { sample } from '../lib/orbital-client.js';
import { radiusContaining, orbitalName } from '../lib/hydrogen.js';
import { reducedMotion } from '../lib/dom.js';

const SEQUENCE = [
  [3, 2, 0], [4, 3, -2], [4, 2, 2], [5, 3, 0], [3, 1, 0], [5, 2, -1], [6, 3, 3], [4, 1, 1],
];

const VERT = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute float aSignFrom;
  attribute float aSignTo;
  attribute float aRand;
  uniform float uMix;
  uniform float uSize;
  uniform float uPixelRatio;
  varying float vSign;
  varying float vFade;
  void main() {
    float m = clamp(uMix * 1.5 - aRand * 0.5, 0.0, 1.0);
    float e = m * m * (3.0 - 2.0 * m);
    vec3 p = mix(aFrom, aTo, e);
    // a gentle swirl while points travel
    float s = sin(3.14159 * e) * 0.6 * (aRand - 0.5);
    p.xz = mat2(cos(s), -sin(s), sin(s), cos(s)) * p.xz;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio / -mv.z;
    vSign = mix(aSignFrom, aSignTo, e);
    vFade = 1.0;
  }`;

const FRAG = /* glsl */ `
  uniform vec3 uPos;
  uniform vec3 uNeg;
  uniform vec3 uMono;
  uniform float uOpacity;
  varying float vSign;
  varying float vFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.05, d);
    vec3 phase = mix(uNeg, uPos, clamp(vSign * 0.5 + 0.5, 0.0, 1.0));
    vec3 col = mix(phase, uMono, smoothstep(1.0, 2.0, vSign));
    gl_FragColor = vec4(col, a * uOpacity * vFade);
  }`;

export async function mount(el) {
  const label = document.querySelector('[data-hero-label]');
  const reduce = reducedMotion();
  const small = window.innerWidth < 720;
  const COUNT = small ? 26000 : 56000;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.9, 6.4);
  camera.lookAt(0, 0, 0);

  const geo = new THREE.BufferGeometry();
  const aFrom = new Float32Array(COUNT * 3), aTo = new Float32Array(COUNT * 3);
  const sFrom = new Float32Array(COUNT), sTo = new Float32Array(COUNT), rnd = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) rnd[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(aFrom, 3));
  geo.setAttribute('aFrom', new THREE.BufferAttribute(aFrom, 3));
  geo.setAttribute('aTo', new THREE.BufferAttribute(aTo, 3));
  geo.setAttribute('aSignFrom', new THREE.BufferAttribute(sFrom, 1));
  geo.setAttribute('aSignTo', new THREE.BufferAttribute(sTo, 1));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uMix: { value: 0 },
      uSize: { value: small ? 15 : 13 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uPos: { value: new THREE.Color('#f59a3a') },
      uNeg: { value: new THREE.Color('#3a9cff') },
      uMono: { value: new THREE.Color('#8fc2ff') },
      uOpacity: { value: small ? 0.42 : 0.34 },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  // Bohr's picture: an electron on a sharp circular orbit (drawn as a thin ring of dots).
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), new THREE.MeshBasicMaterial({ color: '#e0523b' }));
  group.add(nucleus);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.15 + (Math.random() - 0.5) * 0.012;
    const tilt = 0.32;
    const x = r * Math.cos(a), y = r * Math.sin(a);
    aFrom[3 * i] = x; aFrom[3 * i + 1] = y * Math.sin(tilt); aFrom[3 * i + 2] = y * Math.cos(tilt);
    sFrom[i] = 2; // monochrome
  }
  aTo.set(aFrom); sTo.set(sFrom);

  function toScene(res, n, l) {
    const scale = 1.55 / radiusContaining(n, l, 0.97);
    const out = new Float32Array(COUNT * 3);
    const { pos } = res;
    for (let i = 0; i < COUNT; i++) {
      // physics (x, y, z) -> three (x, z, -y); z is "up" in textbooks
      out[3 * i] = pos[3 * i] * scale;
      out[3 * i + 1] = pos[3 * i + 2] * scale;
      out[3 * i + 2] = -pos[3 * i + 1] * scale;
    }
    return out;
  }

  let w = 0, h = 0;
  function resize() {
    w = el.clientWidth; h = el.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / Math.max(1, h);
    // keep the cloud a sensible size on tall, narrow screens
    camera.fov = camera.aspect < 0.8 ? 46 : 32;
    camera.updateProjectionMatrix();
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.length();
    const halfW = halfH * camera.aspect;
    group.position.x = w > 900 ? halfW * 0.42 : 0;
    group.position.y = w > 900 ? 0 : halfH * (camera.aspect < 0.8 ? 0.42 : 0.3);
    group.scale.setScalar(w > 900 ? 1 : 0.78);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  let idx = 0, mixT = 1, mixDur = 2.6, hold = 0, next = null, running = false, raf = 0, last = 0;
  let rotY = 0, tiltX = 0, targetTiltX = 0, targetTiltY = 0;

  function setLabel(n, l, m, bohr = false) {
    if (!label) return;
    if (bohr) {
      label.innerHTML = '<span class="hero-label__k">1913</span> Bohr’s picture: one electron on a sharp circular orbit';
      return;
    }
    const nm = orbitalName(n, l, m);
    label.innerHTML = `<span class="hero-label__k">Hydrogen</span> ${nm.html} &nbsp;·&nbsp; n = ${n}, ℓ = ${l}, m = ${m}<span class="hero-label__d">Each dot marks a place the electron could be found. <i style="color:#f59a3a">Amber</i> and <i style="color:#3a9cff">blue</i> are opposite signs of the wave.</span>`;
  }

  async function prefetch(i) {
    const [n, l, m] = SEQUENCE[i % SEQUENCE.length];
    const res = await sample(n, l, m, COUNT, 11 + i);
    return { pos: toScene(res, n, l), sign: res.sign, nlm: [n, l, m] };
  }

  let cloudShown = false;
  function startMorph(data) {
    cloudShown = true;
    aFrom.set(aTo); sFrom.set(sTo);
    // reading the current blended state would be more exact; starting from the last target is visually identical
    aTo.set(data.pos); sTo.set(data.sign);
    geo.attributes.aFrom.needsUpdate = true;
    geo.attributes.aTo.needsUpdate = true;
    geo.attributes.aSignFrom.needsUpdate = true;
    geo.attributes.aSignTo.needsUpdate = true;
    geo.attributes.position.needsUpdate = true;
    mixT = 0;
    setLabel(...data.nlm);
  }

  setLabel(0, 0, 0, true);
  geo.attributes.aFrom.needsUpdate = true;

  const first = await prefetch(0);
  next = prefetch(1);

  if (reduce) {
    startMorph(first);
    mixT = 1; mat.uniforms.uMix.value = 1;
    nucleus.scale.setScalar(0.02);
  } else {
    hold = -1.6; // show Bohr's orbit briefly before it dissolves
    setTimeout(() => { startMorph(first); }, 1600);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (mixT < 1) {
      mixT = Math.min(1, mixT + dt / mixDur);
      mat.uniforms.uMix.value = mixT;
      if (mixT >= 1) hold = 0;
    }
    // the nucleus is drawn for Bohr's picture only; at true scale it would be invisible
    if (cloudShown && nucleus.scale.x > 0.02) {
      const s = Math.max(0.02, nucleus.scale.x - dt * 0.9);
      nucleus.scale.setScalar(s);
    }
    if (mixT >= 1 && !reduce) {
      hold += dt;
      if (hold > 7.5 && next) {
        const p = next;
        next = null;
        hold = -100;
        p.then((data) => {
          idx++;
          startMorph(data);
          next = prefetch(idx + 1);
        });
      }
    }
    if (!reduce) rotY += dt * 0.12;
    tiltX += (targetTiltX - tiltX) * 0.04;
    group.rotation.set(0.12 + tiltX, rotY + targetTiltY * 0.6, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  const onMove = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    targetTiltX = ((e.clientY - r.top) / r.height - 0.5) * 0.35;
    targetTiltY = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
  };
  el.parentElement.addEventListener('pointermove', onMove);

  // render one frame immediately even before the loop starts
  renderer.render(scene, camera);

  return {
    resume() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    pause() { running = false; cancelAnimationFrame(raf); },
  };
}
