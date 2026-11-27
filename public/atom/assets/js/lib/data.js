// Data loaders. All data ships with the site (built from open sources by
// tools/build_data.py); live API calls are made only for element descriptions.

const cache = new Map();
function loadJSON(name) {
  if (!cache.has(name)) {
    const url = new URL(`../../../data/${name}`, import.meta.url);
    cache.set(name, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${name} (${r.status})`);
      return r.json();
    }));
  }
  return cache.get(name);
}

let elementsP;
export function getElements() {
  return (elementsP ??= loadJSON('elements.json').then((d) => {
    const list = d.elements;
    const bySym = new Map(list.map((e) => [e.sym, e]));
    const byZ = (z) => list[z - 1];
    return { list, bySym, byZ, meta: d.meta };
  }));
}

let nuclidesP;
export function getNuclides() {
  return (nuclidesP ??= loadJSON('nuclides.json').then((d) => {
    const rows = d.rows.map((r) => ({
      z: r[0], n: r[1], a: r[0] + r[1],
      hl: r[2],            // seconds; -1 stable; null unknown
      decay: r[3],         // [[mode, percent|null], ...]
      bea: r[4],           // binding energy per nucleon, keV
      mass: r[5] != null ? r[5] / 1e6 : null, // atomic mass, u
      abundance: r[6],     // %
      jp: r[7],
      discovery: r[8],
      radius: r[9],        // rms charge radius, fm
      hlText: r[10],
      estimated: !!r[11],
    }));
    const key = (z, n) => z * 1000 + n;
    const map = new Map(rows.map((r) => [key(r.z, r.n), r]));
    const byZ = new Map();
    for (const r of rows) {
      if (!byZ.has(r.z)) byZ.set(r.z, []);
      byZ.get(r.z).push(r);
    }
    let maxN = 0, maxZ = 0;
    for (const r of rows) { if (r.n > maxN) maxN = r.n; if (r.z > maxZ) maxZ = r.z; }
    return { rows, get: (z, n) => map.get(key(z, n)), byZ, maxN, maxZ, meta: d.meta };
  }));
}

let spectraP;
export function getSpectra() {
  return (spectraP ??= loadJSON('spectra.json').then((d) => d.spectra));
}

/** Primary decay mode category for colouring. */
export function decayClass(nuc) {
  if (!nuc) return 'unknown';
  if (nuc.hl === -1) return 'stable';
  const m = nuc.decay && nuc.decay[0] && nuc.decay[0][0];
  if (!m) return 'unknown';
  if (m === 'A') return 'alpha';
  if (m === 'B-' || m === '2B-' || m.startsWith('B-')) return m === 'B-N' || m === 'B-2N' ? 'bminus' : 'bminus';
  if (m === 'EC+B+' || m === 'EC' || m === 'B+' || m === '2EC' || m === '2B+' || m === 'ECP' || m === 'B+P' || m === 'ECSF') return 'bplus';
  if (m === 'SF') return 'sf';
  if (m === 'P' || m === '2P') return 'p';
  if (m === 'N' || m === '2N') return 'n';
  if (m === 'IT') return 'unknown';
  return 'unknown';
}

export const DECAY_LABEL = {
  'A': 'alpha decay (α)',
  'B-': 'beta-minus decay (β⁻)',
  '2B-': 'double beta-minus decay',
  'B-N': 'β⁻ decay followed by neutron emission',
  'B-2N': 'β⁻ decay followed by two-neutron emission',
  'B-3N': 'β⁻ decay followed by three-neutron emission',
  'B-4N': 'β⁻ decay followed by four-neutron emission',
  'B-A': 'β⁻ decay followed by alpha emission',
  'EC+B+': 'electron capture / positron emission (β⁺)',
  'EC': 'electron capture',
  'B+': 'positron emission (β⁺)',
  '2EC': 'double electron capture',
  '2B+': 'double positron emission',
  'ECP': 'electron capture followed by proton emission',
  'ECA': 'electron capture followed by alpha emission',
  'B+P': 'β⁺ decay followed by proton emission',
  'B+A': 'β⁺ decay followed by alpha emission',
  'ECSF': 'electron capture followed by fission',
  'SF': 'spontaneous fission',
  'P': 'proton emission',
  '2P': 'two-proton emission',
  'N': 'neutron emission',
  '2N': 'two-neutron emission',
  'IT': 'isomeric transition',
  '14C': 'carbon-14 cluster emission',
};

export const DECAY_SHORT = {
  'A': 'α', 'B-': 'β⁻', '2B-': '2β⁻', 'B-N': 'β⁻n', 'B-2N': 'β⁻2n', 'B-3N': 'β⁻3n', 'B-4N': 'β⁻4n', 'B-A': 'β⁻α',
  'EC+B+': 'EC/β⁺', 'EC': 'EC', 'B+': 'β⁺', '2EC': '2EC', '2B+': '2β⁺', 'ECP': 'ECp', 'ECA': 'ECα',
  'B+P': 'β⁺p', 'B+A': 'β⁺α', 'ECSF': 'ECSF', 'SF': 'SF', 'P': 'p', '2P': '2p', 'N': 'n', '2N': '2n', 'IT': 'IT', '14C': '¹⁴C',
};

/** Daughter (z, n) after a decay mode, or null. */
export function daughter(z, n, mode) {
  switch (mode) {
    case 'A': return [z - 2, n - 2];
    case 'B-': return [z + 1, n - 1];
    case '2B-': return [z + 2, n - 2];
    case 'B-N': return [z + 1, n - 2];
    case 'B-2N': return [z + 1, n - 3];
    case 'EC+B+': case 'EC': case 'B+': return [z - 1, n + 1];
    case '2EC': case '2B+': return [z - 2, n + 2];
    case 'P': return [z - 1, n];
    case '2P': return [z - 2, n];
    case 'N': return [z, n - 1];
    case '2N': return [z, n - 2];
    case 'ECP': case 'B+P': return [z - 2, n + 1];
    case '14C': return [z - 6, n - 8];
    default: return null;
  }
}
