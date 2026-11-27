import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { ShapeId } from '../content/site';
import { pointer, useStore } from '../lib/store';
import { scrollVelocity } from '../lib/smooth-scroll';
import { ATOM_RING_AXES, SHAPE_ORDER, buildParticles, hexToVec3 } from './shapes';
import * as S from './shaders';

const { damp, smoothstep, clamp } = THREE.MathUtils;

/** Background glow colours per shape (sRGB). */
const NEBULA: Record<ShapeId, [string, string]> = {
  singularity: ['#6d3cff', '#5ee7ff'],
  atom: ['#f0804f', '#3d7bff'],
  sakura: ['#ff4f86', '#ffde59'],
  galaxy: ['#4f4bff', '#5ee7ff'],
  portal: ['#9d7bff', '#ff6584'],
};

function pickParticleCount() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse || small) return 7000;
  return cores >= 8 ? 20000 : 14000;
}

/** How far shapes shift sideways: none on portrait screens, full on wide ones. */
const wideFactor = (aspect: number) => smoothstep(aspect, 0.95, 1.45);
/** Shrink shapes on narrow screens so they still fit. */
const fitFactor = (aspect: number) => clamp(aspect * 0.85, 0.5, 1);

function Particles({ count, reduced }: { count: number; reduced: boolean }) {
  const setSceneReady = useStore((s) => s.setSceneReady);
  const invalidate = useThree((s) => s.invalidate);

  const geometry = useMemo(() => {
    const data = buildParticles(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    data.positions.forEach((arr, i) => g.setAttribute(`aP${i}`, new THREE.BufferAttribute(arr, 4)));
    data.colors.forEach((arr, i) => g.setAttribute(`aC${i}`, new THREE.BufferAttribute(arr, 4)));
    g.setAttribute('aData', new THREE.BufferAttribute(data.data, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: S.particleVertex,
        fragmentShader: S.particleFragment,
        uniforms: {
          uTime: { value: 0 },
          uW: { value: new THREE.Vector4(1, 0, 0, 0) },
          uW4: { value: 0 },
          uSize: { value: 3.1 },
          uPixelRatio: { value: 1 },
          uMouse: { value: new THREE.Vector2(9, 9) },
          uMouseStrength: { value: 0 },
          uAspect: { value: 1 },
          uBurst: { value: 0 },
          uTurb: { value: 0 },
          uIntro: { value: 0 },
          uDim: { value: 1 },
          uRingAxis0: { value: new THREE.Vector3(...ATOM_RING_AXES[0]) },
          uRingAxis1: { value: new THREE.Vector3(...ATOM_RING_AXES[1]) },
          uRingAxis2: { value: new THREE.Vector3(...ATOM_RING_AXES[2]) },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const group = useRef<THREE.Group>(null);
  const sim = useRef({ weights: [1, 0, 0, 0, 0], time: 0, intro: 0, mouse: 0, turb: 0, frames: 0 });

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const s = sim.current;
    const store = useStore.getState();
    const target = store.scene;
    const u = material.uniforms;
    const aspect = state.size.width / state.size.height;

    const active = SHAPE_ORDER.indexOf(target.shape);
    let moving = false;
    for (let i = 0; i < 5; i++) {
      const goal = i === active ? 1 : 0;
      s.weights[i] = damp(s.weights[i], goal, reduced ? 40 : 1.9, dt);
      if (Math.abs(s.weights[i] - goal) > 0.002) moving = true;
    }
    if (!reduced) s.time += dt;
    if (store.introDone) s.intro = reduced ? 1 : Math.min(1, s.intro + dt / 2.8);

    u.uTime.value = s.time;
    u.uW.value.set(s.weights[0], s.weights[1], s.weights[2], s.weights[3]);
    u.uW4.value = s.weights[4];
    u.uIntro.value = 1 - Math.pow(1 - s.intro, 3);
    u.uPixelRatio.value = state.gl.getPixelRatio();
    u.uAspect.value = aspect;
    const narrow = 1 - wideFactor(aspect);
    u.uDim.value = damp(u.uDim.value, target.dim * (1 - 0.4 * narrow), 2.5, dt);

    s.mouse = damp(s.mouse, pointer.active && !reduced ? 1 : 0, 4, dt);
    u.uMouse.value.set(pointer.x, pointer.y);
    u.uMouseStrength.value = s.mouse;

    s.turb = damp(s.turb, Math.min(1, Math.abs(scrollVelocity()) / 40), 3, dt);
    u.uTurb.value = s.turb;

    const since = (performance.now() - store.burstAt) / 1000;
    u.uBurst.value = since < 0.12 ? Math.max(0, since / 0.12) : Math.pow(Math.max(0, 1 - (since - 0.12) / 1.3), 2);

    const g = group.current;
    if (g) {
      const wide = wideFactor(aspect);
      const k = reduced ? 40 : 2.1;
      g.position.x = damp(g.position.x, target.x * wide, k, dt);
      g.position.y = damp(g.position.y, target.y * wide + (target.mobileY ?? 0) * (1 - wide), k, dt);
      g.scale.setScalar(damp(g.scale.x, target.scale * fitFactor(aspect), k, dt));
      g.rotation.x = damp(g.rotation.x, -pointer.y * 0.12, 2.5, dt);
      g.rotation.y = damp(g.rotation.y, pointer.x * 0.2, 2.5, dt);
    }

    if (++s.frames === 2) setSceneReady();
    if (reduced && (moving || s.frames < 3)) invalidate();
  });

  return (
    <group ref={group}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}

function Stars() {
  const count = 1400;
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const data = new Float32Array(count * 2);
    const palette = ['#ffffff', '#d9ccff', '#a5f3ff', '#ffd1e0'].map(hexToVec3);
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < count; i++) {
      const r = 18 + rnd() * 26;
      const z = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - z * z);
      pos.set([Math.cos(a) * s * r, z * r, Math.sin(a) * s * r - 6], i * 3);
      const c = palette[Math.floor(rnd() * palette.length)];
      const b = 0.25 + Math.pow(rnd(), 3) * 0.75;
      col.set([c.x * b, c.y * b, c.z * b], i * 3);
      data.set([0.8 + Math.pow(rnd(), 4) * 2.4, rnd() * 10], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aData', new THREE.BufferAttribute(data, 2));
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: S.starsVertex,
        fragmentShader: S.starsFragment,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uDim: { value: 1 } },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const ref = useRef<THREE.Points>(null);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    material.uniforms.uDim.value = damp(material.uniforms.uDim.value, useStore.getState().scene.dim, 2, dt);
    const p = ref.current;
    if (p) {
      p.rotation.y += dt * 0.004;
      p.rotation.x = damp(p.rotation.x, -pointer.y * 0.03, 2, dt);
      p.position.x = damp(p.position.x, -pointer.x * 0.4, 2, dt);
    }
  });
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-0.5} />;
}

function Nebula() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: S.nebulaVertex,
        fragmentShader: S.nebulaFragment,
        uniforms: {
          uTime: { value: 0 },
          uColA: { value: hexToVec3(NEBULA.singularity[0]) },
          uColB: { value: hexToVec3(NEBULA.singularity[1]) },
          uCenter: { value: new THREE.Vector2(0.3, 0) },
          uAspect: { value: 1 },
          uDim: { value: 1 },
        },
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  const goals = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(NEBULA).map(([shape, [a, b]]) => [shape, [hexToVec3(a), hexToVec3(b)]]),
      ) as Record<ShapeId, [THREE.Vector3, THREE.Vector3]>,
    [],
  );
  const goalCenter = useMemo(() => new THREE.Vector2(), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const target = useStore.getState().scene;
    const u = material.uniforms;
    const aspect = state.size.width / state.size.height;
    const [a, b] = goals[target.shape];
    const k = 1 - Math.exp(-1.6 * dt);
    u.uColA.value.lerp(a, k);
    u.uColB.value.lerp(b, k);
    u.uTime.value = state.clock.elapsedTime;
    u.uAspect.value = aspect;
    u.uDim.value = damp(u.uDim.value, target.dim, 2, dt);
    const cam = state.camera as THREE.PerspectiveCamera;
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z;
    const wide = wideFactor(aspect);
    const y = target.y * wide + (target.mobileY ?? 0) * (1 - wide);
    goalCenter.set((target.x * wide) / (2 * halfH), y / (2 * halfH));
    u.uCenter.value.lerp(goalCenter, 1 - Math.exp(-2 * dt));
  });

  return (
    <mesh renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Re-render on demand when animation is off (reduced motion). */
function DemandInvalidator() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => useStore.subscribe(() => invalidate()), [invalidate]);
  return null;
}

export default function Scene({ reduced }: { reduced: boolean }) {
  const viewer = useStore((s) => s.viewer);
  const [count] = useState(pickParticleCount);
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, 1.75));

  return (
    <div className="fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        dpr={dpr}
        flat
        frameloop={viewer ? 'never' : reduced ? 'demand' : 'always'}
        gl={{ antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' }}
        camera={{ fov: 45, position: [0, 0, 8], near: 0.1, far: 100 }}
        onCreated={({ gl }) => gl.setClearColor('#05040a')}
      >
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(Math.min(window.devicePixelRatio || 1, 1.75))}
          onFallback={() => setDpr(1)}
        />
        <Nebula />
        <Stars />
        <Particles count={count} reduced={reduced} />
        {reduced && <DemandInvalidator />}
      </Canvas>
    </div>
  );
}
