/**
 * Particle layouts for the morphing background.
 *
 * Every particle has a position in each of the five shapes. The vertex shader
 * blends between them, so a morph is just a change of weights. Positions are
 * stored as vec4: xyz plus a "kind" in w that tells the shader how that
 * particle moves inside the shape (e.g. disk vs. jet in the singularity).
 * Colours are vec4: rgb (sRGB, 0..1, brightness baked in) plus a size factor.
 */
import { Vector3 } from 'three';
import type { ShapeId } from '../content/site';

export const SHAPE_ORDER: ShapeId[] = ['singularity', 'atom', 'sakura', 'galaxy', 'portal'];

type RGB = readonly [number, number, number];
const TAU = Math.PI * 2;

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
/** sRGB hex → Vector3 with the raw 0..1 values (no colour-space conversion). */
export const hexToVec3 = (hex: string) => new Vector3(...hexToRgb(hex));

const mixRgb = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const C = {
  white: hexToRgb('#fff6ff'),
  lilac: hexToRgb('#d9ccff'),
  violet: hexToRgb('#9d7bff'),
  deepViolet: hexToRgb('#5b3df5'),
  indigo: hexToRgb('#2f2a9e'),
  cyan: hexToRgb('#5ee7ff'),
  pink: hexToRgb('#ff6584'),
  hotPink: hexToRgb('#ff3d7f'),
  softPink: hexToRgb('#ffa8c2'),
  blush: hexToRgb('#ffe3ec'),
  orange: hexToRgb('#f0804f'),
  cream: hexToRgb('#ffe2cf'),
  electron: hexToRgb('#8fd0ff'),
  amber: hexToRgb('#ffb35c'),
  yellow: hexToRgb('#ffde59'),
  blue: hexToRgb('#3d7bff'),
};

/** Deterministic PRNG so the shapes look the same on every visit. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Out {
  /** writes position (xyz + kind) and colour (rgb*brightness + size) for particle i */
  set: (x: number, y: number, z: number, kind: number, c: RGB, brightness: number, size: number) => void;
}

function makeRng(seed: number) {
  const rnd = mulberry32(seed);
  const gauss = () => {
    const u = Math.max(rnd(), 1e-9);
    const v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  const inSphere = (r: number): [number, number, number] => {
    // uniform direction, radius biased to fill the ball
    const z = rnd() * 2 - 1;
    const a = rnd() * TAU;
    const s = Math.sqrt(1 - z * z);
    const rr = r * Math.cbrt(rnd());
    return [Math.cos(a) * s * rr, Math.sin(a) * s * rr, z * rr];
  };
  return { rnd, gauss, inSphere };
}

/* ── 0. Singularity: a black hole with a lensed photon ring, accretion disk and jets ── */
function singularity(out: Out, rng: ReturnType<typeof makeRng>) {
  const { rnd, gauss } = rng;
  const u = rnd();
  if (u < 0.6) {
    // accretion disk (flat in XZ, the shader spins and tilts it)
    const t = Math.pow(rnd(), 1.8);
    const r = 1.08 + t * 2.7;
    const a = rnd() * TAU;
    const y = gauss() * 0.03 * (0.5 + r * 0.3);
    let c = t < 0.35 ? mixRgb(C.white, C.lilac, t / 0.35) : mixRgb(C.lilac, C.deepViolet, clamp01((t - 0.35) / 0.65));
    const tint = rnd();
    if (tint < 0.12) c = mixRgb(c, C.pink, 0.7);
    else if (tint < 0.2) c = mixRgb(c, C.cyan, 0.6);
    out.set(Math.cos(a) * r, y, Math.sin(a) * r, 0, c, 1.15 - t * 0.5, 1.2 - t * 0.4);
  } else if (u < 0.72) {
    // photon ring, always facing the camera
    const r = 1.0 + gauss() * 0.022;
    const a = rnd() * TAU;
    out.set(Math.cos(a) * r, Math.sin(a) * r, 0, 1, mixRgb(C.white, C.lilac, rnd() * 0.5), 1.0, 0.95);
  } else if (u < 0.8) {
    // relativistic jets
    const s = rnd() < 0.5 ? -1 : 1;
    const h = 1.0 + Math.pow(rnd(), 1.5) * 3.2;
    const spread = 0.025 + h * 0.035;
    out.set(gauss() * spread, s * h, gauss() * spread, 2, mixRgb(C.cyan, C.violet, h / 4.2), 0.85 - (h / 4.2) * 0.5, 0.85);
  } else {
    // faint halo of dust
    const r = 2.8 + Math.pow(rnd(), 0.7) * 4.5;
    const z = rnd() * 2 - 1;
    const a = rnd() * TAU;
    const s = Math.sqrt(1 - z * z);
    out.set(Math.cos(a) * s * r, z * r * 0.7, Math.sin(a) * s * r, 3, rnd() < 0.5 ? C.violet : C.blue, 0.22, 0.7);
  }
}

/* ── 1. Atom: nucleus of protons and neutrons, three orbits with electrons ── */
const RING_RADIUS = 2.15;
const RING_TILT = (74 * Math.PI) / 180;

/** Rotation for orbit k: tilt around X, then turn around Z by k·60°. */
function ringTransform(k: number, x: number, y: number, z: number): [number, number, number] {
  // tilt about X
  const ct = Math.cos(RING_TILT), st = Math.sin(RING_TILT);
  const y1 = y * ct - z * st;
  const z1 = y * st + z * ct;
  // turn about Z
  const a = (k * Math.PI) / 3 + 0.25;
  const ca = Math.cos(a), sa = Math.sin(a);
  return [x * ca - y1 * sa, x * sa + y1 * ca, z1];
}

/** Axis each orbit spins around (the shader rotates orbit particles about it). */
export const ATOM_RING_AXES: [number, number, number][] = [0, 1, 2].map((k) => ringTransform(k, 0, 0, 1));

const NUCLEONS = (() => {
  const rnd = mulberry32(7);
  const list: [number, number, number][] = [];
  // 26 nucleons packed in a ball: golden-spiral directions at varying radii
  const n = 26;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * Math.PI * (3 - Math.sqrt(5));
    const rad = 0.18 + rnd() * 0.24;
    list.push([Math.cos(a) * r * rad, y * rad, Math.sin(a) * r * rad]);
  }
  return list;
})();

function atom(out: Out, rng: ReturnType<typeof makeRng>) {
  const { rnd, gauss, inSphere } = rng;
  const u = rnd();
  if (u < 0.17) {
    const i = Math.floor(rnd() * NUCLEONS.length);
    const [cx, cy, cz] = NUCLEONS[i];
    const [ox, oy, oz] = inSphere(0.12);
    const proton = i % 2 === 0;
    out.set(cx + ox, cy + oy, cz + oz, 0, proton ? C.orange : C.cream, proton ? 1.05 : 0.8, 1.15);
  } else if (u < 0.86) {
    const k = Math.floor(rnd() * 3);
    if (rnd() < 0.055) {
      // electrons: two small bright clumps per orbit
      const phase = k * 1.3 + (rnd() < 0.5 ? 0 : Math.PI);
      const [ox, oy, oz] = inSphere(0.055);
      const [x, y, z] = ringTransform(k, Math.cos(phase) * RING_RADIUS + ox, Math.sin(phase) * RING_RADIUS + oy, oz);
      out.set(x, y, z, k + 1, mixRgb(C.electron, C.white, rnd() * 0.4), 1.0, 1.2);
    } else {
      const a = rnd() * TAU;
      const r = RING_RADIUS + gauss() * 0.02;
      const [x, y, z] = ringTransform(k, Math.cos(a) * r, Math.sin(a) * r, gauss() * 0.02);
      out.set(x, y, z, k + 1, mixRgb(C.cream, C.amber, rnd() * 0.5), 0.68, 0.85);
    }
  } else {
    // a faint probability cloud (amber and blue, like the Atom site's orbitals)
    const r = 0.5 + Math.abs(gauss()) * 0.75;
    const z = rnd() * 2 - 1;
    const a = rnd() * TAU;
    const s = Math.sqrt(1 - z * z);
    out.set(Math.cos(a) * s * r, z * r, Math.sin(a) * s * r, 4, rnd() < 0.5 ? C.amber : C.blue, 0.22, 0.75);
  }
}

/* ── 2. Sakura: five notched petals, stamens, falling petals ── */
const PETAL_LENGTH = 2.05;
const PETAL_HALF_ANGLE = 0.6;

function sakura(out: Out, rng: ReturnType<typeof makeRng>, clusterRng: () => number, clusters: number[][]) {
  const { rnd, gauss } = rng;
  const u = rnd();
  if (u < 0.7) {
    const k = Math.floor(rnd() * 5);
    const base = (k * TAU) / 5 + Math.PI / 2;
    // local angle inside the petal and a radius under its outline
    const phi = (rnd() * 2 - 1) * PETAL_HALF_ANGLE;
    const q = phi / PETAL_HALF_ANGLE;
    let rMax = PETAL_LENGTH * Math.pow(Math.cos((q * Math.PI) / 2), 0.55);
    rMax *= 1 - 0.17 * Math.exp(-Math.pow(q / 0.16, 2)); // the notch at the tip
    const r = rMax * Math.sqrt(rnd());
    const t = r / PETAL_LENGTH;
    const a = base + phi * (0.55 + 0.45 * t); // petals narrow towards the centre
    const z = 0.42 * t * t - 0.06 * Math.abs(q) + gauss() * 0.012;
    const c = t < 0.3 ? mixRgb(C.hotPink, C.softPink, t / 0.3) : mixRgb(C.softPink, C.blush, clamp01((t - 0.3) / 0.7));
    out.set(Math.cos(a) * r, Math.sin(a) * r, z, 0, c, 0.62 + t * 0.28, 1.0);
  } else if (u < 0.79) {
    // stamens: thin filaments with yellow anthers
    const j = Math.floor(rnd() * 20);
    const ang = (j / 20) * TAU + Math.sin(j * 12.9898) * 0.12;
    const len = 0.42 + ((Math.sin(j * 78.233) + 1) / 2) * 0.22;
    const tip = rnd() < 0.42;
    const s = tip ? 1 : rnd() * 0.92;
    const jitter = tip ? 0.035 : 0.006;
    out.set(
      Math.cos(ang) * len * s + gauss() * jitter,
      Math.sin(ang) * len * s + gauss() * jitter,
      0.06 + s * 0.22 + gauss() * jitter,
      1,
      tip ? C.yellow : mixRgb(C.blush, C.softPink, s),
      tip ? 1.1 : 0.55,
      tip ? 1.35 : 0.7,
    );
  } else if (u < 0.92) {
    // falling petals: 30 tiny petals that drift as a unit (shared phase in w)
    const ci = Math.floor(clusterRng() * clusters.length);
    const [cx, cy, cz, rot, phase] = clusters[ci];
    const lx = gauss() * 0.075;
    const ly = gauss() * 0.045;
    const x = cx + lx * Math.cos(rot) - ly * Math.sin(rot);
    const y = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
    out.set(x, y, cz + gauss() * 0.01, 2 + phase, mixRgb(C.softPink, C.blush, rnd() * 0.5), 0.8, 0.95);
  } else {
    const r = 2.4 + Math.pow(rnd(), 0.6) * 3.6;
    const z = rnd() * 2 - 1;
    const a = rnd() * TAU;
    const s = Math.sqrt(1 - z * z);
    out.set(Math.cos(a) * s * r, z * r * 0.8, Math.sin(a) * s * r * 0.6, 3, rnd() < 0.7 ? C.pink : C.yellow, 0.25, 0.7);
  }
}

/* ── 3. Galaxy: three-armed spiral with a bright bulge ── */
function galaxy(out: Out, rng: ReturnType<typeof makeRng>) {
  const { rnd, gauss } = rng;
  if (rnd() < 0.15) {
    const r = Math.abs(gauss()) * 0.34;
    const z = rnd() * 2 - 1;
    const a = rnd() * TAU;
    const s = Math.sqrt(1 - z * z);
    out.set(Math.cos(a) * s * r, z * r * 0.55, Math.sin(a) * s * r, 1, mixRgb(C.white, C.softPink, rnd() * 0.35), 1.0, 1.0);
    return;
  }
  const t = Math.pow(rnd(), 0.9);
  const r = 0.3 + t * 3.3;
  const arm = Math.floor(rnd() * 3);
  const a = (arm * TAU) / 3 + r * 1.5 + gauss() * (0.34 / (0.6 + r * 0.5));
  const x = Math.cos(a) * r + gauss() * 0.07;
  const z = Math.sin(a) * r + gauss() * 0.07;
  const y = gauss() * 0.06 * (1.3 - t);
  let c = t < 0.4 ? mixRgb(C.lilac, C.violet, t / 0.4) : mixRgb(C.violet, C.cyan, (t - 0.4) / 0.6);
  let b = 0.95 - t * 0.35;
  let size = 0.9;
  const spark = rnd();
  if (spark < 0.07) {
    c = C.pink;
    b = 1.0;
    size = 1.3;
  } else if (spark < 0.1) {
    c = C.white;
    b = 1.1;
    size = 1.6;
  }
  out.set(x, y, z, 0, c, b, size);
}

/* ── 4. Portal: a glowing ring with a swirling vortex inside ── */
function portal(out: Out, rng: ReturnType<typeof makeRng>) {
  const { rnd, gauss } = rng;
  const u = rnd();
  if (u < 0.58) {
    const a = rnd() * TAU;
    const R = 2.0 + gauss() * 0.08;
    const zOff = gauss() * 0.08;
    // three-stop gradient around the ring
    const p = (a / TAU) * 3;
    const stops = [C.violet, C.pink, C.cyan, C.violet];
    const i = Math.floor(p);
    const c = mixRgb(stops[i], stops[i + 1], p - i);
    out.set(Math.cos(a) * R, Math.sin(a) * R, zOff, 0, c, 0.95, 0.95);
  } else if (u < 0.88) {
    const r = Math.pow(rnd(), 0.65) * 1.85;
    const a = rnd() * TAU + r * 2.2;
    const t = r / 1.85;
    out.set(Math.cos(a) * r, Math.sin(a) * r, gauss() * 0.04, 1, mixRgb(C.white, C.deepViolet, t), 0.35 + (1 - t) * 0.5, 0.75);
  } else {
    const a = rnd() * TAU;
    const r = 2.3 + Math.pow(rnd(), 0.8) * 2.4;
    out.set(Math.cos(a) * r, Math.sin(a) * r, gauss() * 0.5, 2, rnd() < 0.5 ? C.pink : C.violet, 0.35, 0.8);
  }
}

export interface ParticleData {
  count: number;
  positions: Float32Array[]; // 5 × count × 4
  colors: Float32Array[]; // 5 × count × 4
  data: Float32Array; // count × 4: random, size, phase, easing
}

export function buildParticles(count: number): ParticleData {
  const positions = SHAPE_ORDER.map(() => new Float32Array(count * 4));
  const colors = SHAPE_ORDER.map(() => new Float32Array(count * 4));
  const data = new Float32Array(count * 4);

  const generators = [singularity, atom, null, galaxy, portal] as const;
  const clusterRng = mulberry32(99);
  const clusters = Array.from({ length: 30 }, () => [
    (clusterRng() * 2 - 1) * 4.8,
    (clusterRng() * 2 - 1) * 4.2,
    -2.2 + clusterRng() * 3.6,
    clusterRng() * TAU,
    Math.min(0.98, clusterRng()),
  ]);

  SHAPE_ORDER.forEach((_, s) => {
    const rng = makeRng(1000 + s * 7919);
    const pos = positions[s];
    const col = colors[s];
    let i = 0;
    const out: Out = {
      set(x, y, z, kind, c, brightness, size) {
        const o = i * 4;
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = z;
        pos[o + 3] = kind;
        col[o] = c[0] * brightness;
        col[o + 1] = c[1] * brightness;
        col[o + 2] = c[2] * brightness;
        col[o + 3] = size;
      },
    };
    for (i = 0; i < count; i++) {
      if (s === 2) sakura(out, rng, clusterRng, clusters);
      else generators[s]!(out, rng);
    }
  });

  const rnd = mulberry32(4242);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    data[o] = rnd();
    data[o + 1] = 0.6 + Math.pow(rnd(), 2) * 0.9;
    data[o + 2] = rnd() * TAU;
    data[o + 3] = rnd();
  }

  return { count, positions, colors, data };
}
