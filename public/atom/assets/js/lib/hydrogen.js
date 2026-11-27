// Exact hydrogen-atom wavefunctions (Z = 1, lengths in Bohr radii a0).
//   psi_nlm(r, θ, φ) = R_nl(r) · Y_lm(θ, φ)
// Real (chemists') orbitals are used so the shapes match textbook names.

const FACT = [1];
for (let i = 1; i <= 30; i++) FACT[i] = FACT[i - 1] * i;
export const factorial = (n) => FACT[n];

/** Generalised Laguerre polynomial L_k^(alpha)(x) by recurrence. */
export function laguerre(k, alpha, x) {
  if (k === 0) return 1;
  let L0 = 1, L1 = 1 + alpha - x;
  for (let i = 1; i < k; i++) {
    const L2 = ((2 * i + 1 + alpha - x) * L1 - (i + alpha) * L0) / (i + 1);
    L0 = L1; L1 = L2;
  }
  return L1;
}

const radialNorm = new Map();
/** Radial function R_nl(r); ∫ R² r² dr = 1. */
export function radial(n, l, r) {
  const key = n * 16 + l;
  let N = radialNorm.get(key);
  if (N === undefined) {
    N = Math.sqrt(Math.pow(2 / n, 3) * FACT[n - l - 1] / (2 * n * FACT[n + l]));
    radialNorm.set(key, N);
  }
  const rho = (2 * r) / n;
  return N * Math.exp(-rho / 2) * Math.pow(rho, l) * laguerre(n - l - 1, 2 * l + 1, rho);
}

/** Associated Legendre P_l^m(x) for m ≥ 0 (no Condon–Shortley phase). */
export function legendre(l, m, x) {
  let pmm = 1;
  if (m > 0) {
    const s = Math.sqrt(Math.max(0, (1 - x) * (1 + x)));
    let f = 1;
    for (let i = 1; i <= m; i++) { pmm *= f * s; f += 2; }
  }
  if (l === m) return pmm;
  let pmmp1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pmmp1;
  let pll = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = ((2 * ll - 1) * x * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pmmp1; pmmp1 = pll;
  }
  return pll;
}

const yNorm = new Map();
/** Real spherical harmonic Y_lm(θ, φ); m > 0 → cos(mφ), m < 0 → sin(|m|φ). */
export function realY(l, m, cosT, phi) {
  const am = Math.abs(m);
  const key = l * 32 + m + 16;
  let K = yNorm.get(key);
  if (K === undefined) {
    K = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (FACT[l - am] / FACT[l + am]));
    if (m !== 0) K *= Math.SQRT2;
    yNorm.set(key, K);
  }
  const P = legendre(l, am, cosT);
  if (m > 0) return K * P * Math.cos(am * phi);
  if (m < 0) return K * P * Math.sin(am * phi);
  return K * P;
}

/** psi at Cartesian point (physics axes: z is the quantisation axis). */
export function psi(n, l, m, x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r === 0) return l === 0 ? radial(n, l, 0) * realY(0, 0, 1, 0) : 0;
  return radial(n, l, r) * realY(l, m, z / r, Math.atan2(y, x));
}

export const energyEV = (n) => -13.605693122994 / (n * n);
export const radialNodes = (n, l) => n - l - 1;
export const angularNodes = (l) => l;
export const meanRadius = (n, l) => (3 * n * n - l * (l + 1)) / 2;

/** Most probable radius (maximum of r²R²), found numerically. */
export function mostProbableRadius(n, l) {
  let best = 0, bestR = 0;
  const rmax = extent(n);
  for (let i = 1; i <= 4000; i++) {
    const r = (i / 4000) * rmax;
    const R = radial(n, l, r);
    const p = r * r * R * R;
    if (p > best) { best = p; bestR = r; }
  }
  return bestR;
}

/** Radius beyond which essentially no probability remains. */
export const extent = (n) => n * (3 * n + 8);

/** Radius containing a fraction `q` of the probability. */
export function radiusContaining(n, l, q = 0.99) {
  const rmax = extent(n), N = 6000, dr = rmax / N;
  let acc = 0;
  for (let i = 1; i <= N; i++) {
    const r = i * dr, R = radial(n, l, r);
    acc += r * r * R * R * dr;
    if (acc >= q) return r;
  }
  return rmax;
}

const ORBITAL_SUFFIX = {
  1: { '-1': 'y', '0': 'z', '1': 'x' },
  2: { '-2': 'xy', '-1': 'yz', '0': 'z²', '1': 'xz', '2': 'x²−y²' },
  3: { '-3': 'y(3x²−y²)', '-2': 'xyz', '-1': 'yz²', '0': 'z³', '1': 'xz²', '2': 'z(x²−y²)', '3': 'x(x²−3y²)' },
};
/** Chemists' name for a real orbital, e.g. 3d with subscript z². */
export function orbitalName(n, l, m) {
  const letter = 'spdfghik'[l];
  const subTxt = l === 0 ? '' : (ORBITAL_SUFFIX[l]?.[String(m)] ?? `m=${m}`);
  return {
    text: `${n}${letter}${subTxt ? ' ' + subTxt : ''}`,
    html: `${n}${letter}${subTxt ? `<sub>${subTxt}</sub>` : ''}`,
    letter,
  };
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw `count` positions distributed as |psi|². Exact and efficient because psi
 * separates: r is drawn from r²R² by inverse CDF, direction from |Y|² by
 * rejection. Returns {pos: Float32Array(3N) in physics axes, sign: Float32Array(N)}.
 */
export function sampleOrbital(n, l, m, count, seed = 7) {
  const rand = rng(seed + n * 131 + l * 17 + (m + 8) * 3);
  // radial CDF
  const rmax = extent(n), NR = 6000;
  const rs = new Float64Array(NR + 1), cdf = new Float64Array(NR + 1);
  let acc = 0;
  for (let i = 1; i <= NR; i++) {
    const r = (i / NR) * rmax, R = radial(n, l, r);
    acc += r * r * R * R;
    rs[i] = r; cdf[i] = acc;
  }
  for (let i = 0; i <= NR; i++) cdf[i] /= acc;
  // angular maximum of |Y|²
  let ymax = 0;
  for (let i = 0; i <= 180; i++) {
    const ct = Math.cos((i / 180) * Math.PI);
    for (let j = 0; j < 360; j += 2) {
      const y = realY(l, m, ct, (j / 180) * Math.PI);
      if (y * y > ymax) ymax = y * y;
    }
  }
  ymax *= 1.02;
  const pos = new Float32Array(count * 3), sign = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    // radius
    const u = rand();
    let lo = 0, hi = NR;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid; else hi = mid; }
    const f = (u - cdf[lo]) / (cdf[hi] - cdf[lo] || 1);
    const r = rs[lo] + (rs[hi] - rs[lo]) * f;
    // direction
    let ct, ph, y;
    for (let tries = 0; tries < 10000; tries++) {
      ct = 2 * rand() - 1; ph = 2 * Math.PI * rand();
      y = realY(l, m, ct, ph);
      if (rand() * ymax <= y * y) break;
    }
    const st = Math.sqrt(1 - ct * ct);
    pos[3 * k] = r * st * Math.cos(ph);
    pos[3 * k + 1] = r * st * Math.sin(ph);
    pos[3 * k + 2] = r * ct;
    sign[k] = radial(n, l, r) * y >= 0 ? 1 : -1;
  }
  return { pos, sign };
}

/**
 * Isosurface of |psi|² enclosing a fraction `frac` of the probability, via
 * naive surface nets on an N³ grid. Returns positions, normals and per-vertex
 * phase sign (physics axes, units of a0), plus triangle indices.
 */
export function isosurface(n, l, m, { N = 72, frac = 0.9 } = {}) {
  const half = radiusContaining(n, l, 0.995) * 1.02;
  const hstep = (2 * half) / (N - 1);
  const F = new Float32Array(N * N * N);
  const idx = (i, j, k) => i + N * (j + N * k);
  let total = 0;
  for (let k = 0; k < N; k++) {
    const z = -half + k * hstep;
    for (let j = 0; j < N; j++) {
      const y = -half + j * hstep;
      for (let i = 0; i < N; i++) {
        const x = -half + i * hstep;
        const p = psi(n, l, m, x, y, z);
        const d = p * p;
        F[idx(i, j, k)] = d;
        total += d;
      }
    }
  }
  // iso level: density threshold enclosing `frac` of the probability on the grid
  const sorted = Float32Array.from(F).sort();
  let acc = 0, iso = 0;
  const target = total * frac;
  for (let i = sorted.length - 1; i >= 0; i--) {
    acc += sorted[i];
    if (acc >= target) { iso = sorted[i]; break; }
  }
  const cells = N - 1;
  const vIndex = new Int32Array(cells * cells * cells).fill(-1);
  const positions = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = new Float32Array(8);
  for (let k = 0; k < cells; k++) for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = F[idx(i + corner[c][0], j + corner[c][1], k + corner[c][2])] - iso;
      val[c] = v;
      if (v > 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edges) {
      const va = val[a], vb = val[b];
      if ((va > 0) === (vb > 0)) continue;
      const t = va / (va - vb);
      sx += corner[a][0] + t * (corner[b][0] - corner[a][0]);
      sy += corner[a][1] + t * (corner[b][1] - corner[a][1]);
      sz += corner[a][2] + t * (corner[b][2] - corner[a][2]);
      cnt++;
    }
    vIndex[i + cells * (j + cells * k)] = positions.length / 3;
    positions.push(-half + (i + sx / cnt) * hstep, -half + (j + sy / cnt) * hstep, -half + (k + sz / cnt) * hstep);
  }
  const indices = [];
  const cellIdx = (i, j, k) => vIndex[i + cells * (j + cells * k)];
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const inside = F[idx(i, j, k)] > iso;
    // x-edge
    if (i < cells && j > 0 && k > 0 && j < cells + 0 && k < cells + 0) {
      if (inside !== (F[idx(i + 1, j, k)] > iso)) {
        const a = cellIdx(i, j - 1, k - 1), b = cellIdx(i, j, k - 1), c = cellIdx(i, j, k), d = cellIdx(i, j - 1, k);
        if (a >= 0 && b >= 0 && c >= 0 && d >= 0) inside ? indices.push(a, b, c, a, c, d) : indices.push(a, c, b, a, d, c);
      }
    }
    // y-edge
    if (j < cells && i > 0 && k > 0 && i < cells && k < cells) {
      if (inside !== (F[idx(i, j + 1, k)] > iso)) {
        const a = cellIdx(i - 1, j, k - 1), b = cellIdx(i - 1, j, k), c = cellIdx(i, j, k), d = cellIdx(i, j, k - 1);
        if (a >= 0 && b >= 0 && c >= 0 && d >= 0) inside ? indices.push(a, b, c, a, c, d) : indices.push(a, c, b, a, d, c);
      }
    }
    // z-edge
    if (k < cells && i > 0 && j > 0 && i < cells && j < cells) {
      if (inside !== (F[idx(i, j, k + 1)] > iso)) {
        const a = cellIdx(i - 1, j - 1, k), b = cellIdx(i, j - 1, k), c = cellIdx(i, j, k), d = cellIdx(i - 1, j, k);
        if (a >= 0 && b >= 0 && c >= 0 && d >= 0) inside ? indices.push(a, b, c, a, c, d) : indices.push(a, c, b, a, d, c);
      }
    }
  }
  // normals from the analytic density gradient; sign of psi per vertex
  const nv = positions.length / 3;
  const normals = new Float32Array(nv * 3), sign = new Float32Array(nv);
  const e = hstep * 0.25;
  for (let v = 0; v < nv; v++) {
    const x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2];
    const d = (a, b, c) => { const p = psi(n, l, m, a, b, c); return p * p; };
    let gx = d(x + e, y, z) - d(x - e, y, z);
    let gy = d(x, y + e, z) - d(x, y - e, z);
    let gz = d(x, y, z + e) - d(x, y, z - e);
    const len = Math.hypot(gx, gy, gz) || 1;
    normals[3 * v] = -gx / len; normals[3 * v + 1] = -gy / len; normals[3 * v + 2] = -gz / len;
    sign[v] = psi(n, l, m, x, y, z) >= 0 ? 1 : -1;
  }
  return { positions: new Float32Array(positions), normals, sign, indices: new Uint32Array(indices), half, iso };
}

/** psi sampled on a plane through the nucleus. plane: 'xz' | 'xy' | 'yz'. */
export function psiPlane(n, l, m, { plane = 'xz', half, res = 200 } = {}) {
  half = half ?? radiusContaining(n, l, 0.995);
  const out = new Float32Array(res * res);
  for (let j = 0; j < res; j++) {
    const v = half - (2 * half * j) / (res - 1);
    for (let i = 0; i < res; i++) {
      const u = -half + (2 * half * i) / (res - 1);
      let x = 0, y = 0, z = 0;
      if (plane === 'xz') { x = u; z = v; }
      else if (plane === 'xy') { x = u; y = v; }
      else { y = u; z = v; }
      out[i + res * j] = psi(n, l, m, x, y, z);
    }
  }
  return { data: out, half, res };
}
