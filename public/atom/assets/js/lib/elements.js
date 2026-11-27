// Element-level helpers: configurations, shells, term symbols, diagrams.
import { sup } from './format.js';

export const L = 'spdfghi';
export const CAPACITY = (l) => 2 * (2 * l + 1);

/** Subshells in Madelung (n + l, then n) filling order up to 7p. */
export const MADELUNG = (() => {
  const out = [];
  for (let s = 1; s <= 8; s++) {
    for (let n = 1; n <= s; n++) {
      const l = s - n;
      if (l < n && l <= 3 && n <= 7) out.push([n, l]);
    }
  }
  return out; // 1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p
})();

export const subshellName = (n, l) => `${n}${L[l]}`;

/** Occupancy predicted by the Madelung rule alone: Map("3d" → count). */
export function madelungOccupancy(z) {
  const occ = new Map();
  let left = z;
  for (const [n, l] of MADELUNG) {
    if (left <= 0) break;
    const c = Math.min(left, CAPACITY(l));
    occ.set(subshellName(n, l), c);
    left -= c;
  }
  return occ;
}

const NOBLE = {
  He: [[1, 0, 2]],
  Ne: [[1, 0, 2], [2, 0, 2], [2, 1, 6]],
  Ar: [[1, 0, 2], [2, 0, 2], [2, 1, 6], [3, 0, 2], [3, 1, 6]],
  Kr: [[1, 0, 2], [2, 0, 2], [2, 1, 6], [3, 0, 2], [3, 1, 6], [3, 2, 10], [4, 0, 2], [4, 1, 6]],
  Xe: [[1, 0, 2], [2, 0, 2], [2, 1, 6], [3, 0, 2], [3, 1, 6], [3, 2, 10], [4, 0, 2], [4, 1, 6], [4, 2, 10], [5, 0, 2], [5, 1, 6]],
  Rn: [[1, 0, 2], [2, 0, 2], [2, 1, 6], [3, 0, 2], [3, 1, 6], [3, 2, 10], [4, 0, 2], [4, 1, 6], [4, 2, 10], [5, 0, 2], [5, 1, 6], [4, 3, 14], [5, 2, 10], [6, 0, 2], [6, 1, 6]],
};

/** Actual ground-state occupancy of an element: Map("3d" → count), ordered by n, l. */
export function occupancy(el) {
  const m = new Map();
  for (const [n, l, c] of NOBLE[el.core] || []) m.set(subshellName(n, l), c);
  for (const [n, l, c] of el.valence) m.set(subshellName(n, l), c);
  return sortOcc(m);
}

export function sortOcc(m) {
  return new Map([...m.entries()].filter(([, c]) => c > 0).sort((a, b) => {
    const [na, la] = [+a[0][0], L.indexOf(a[0][1])];
    const [nb, lb] = [+b[0][0], L.indexOf(b[0][1])];
    return na - nb || la - lb;
  }));
}

/** Electron configuration in noble-gas notation as HTML. */
export function configHTML(el) {
  const core = el.core ? `<span class="cfg-core">[${el.core}]</span> ` : '';
  const body = el.valence.map(([n, l, c]) => `${n}${L[l]}<sup>${c}</sup>`).join(' ');
  return core + body;
}
export function configText(el) {
  const core = el.core ? `[${el.core}] ` : '';
  return core + el.valence.map(([n, l, c]) => `${n}${L[l]}${sup(c)}`).join(' ');
}
export function occHTML(occ) {
  return [...occ.entries()].map(([k, c]) => `${k}<sup>${c}</sup>`).join(' ');
}

/** Occupancy of an ion. Cations lose electrons from the highest n first
 * (then highest l), the textbook rule that empties 4s before 3d. Anions add
 * electrons in Madelung order. */
export function ionOccupancy(el, electrons) {
  const occ = new Map(occupancy(el));
  let diff = el.z - electrons; // positive = cation
  if (diff > 0) {
    while (diff > 0 && occ.size) {
      let best = null;
      for (const k of occ.keys()) {
        const n = +k[0], l = L.indexOf(k[1]);
        if (!best || n > best[0] || (n === best[0] && l > best[1])) best = [n, l, k];
      }
      const c = occ.get(best[2]);
      if (c <= 1) occ.delete(best[2]); else occ.set(best[2], c - 1);
      diff--;
    }
  } else if (diff < 0) {
    let add = -diff;
    for (const [n, l] of MADELUNG) {
      if (add <= 0) break;
      const k = subshellName(n, l);
      const c = occ.get(k) || 0;
      const room = CAPACITY(l) - c;
      if (room > 0) {
        const put = Math.min(room, add);
        occ.set(k, c + put);
        add -= put;
      }
    }
  }
  return sortOcc(occ);
}

export function shellsFromOcc(occ) {
  const s = [];
  for (const [k, c] of occ) {
    const n = +k[0];
    s[n - 1] = (s[n - 1] || 0) + c;
  }
  for (let i = 0; i < s.length; i++) s[i] = s[i] || 0;
  return s;
}

/** NIST term symbol → HTML, e.g. "3P*<0>" → ³P°₀ */
export function termHTML(t) {
  if (!t) return '';
  const m = /^(\d+)([SPDFGHIKLMNOQ])(\*)?<?([\d/]+)>?$/.exec(t);
  if (!m) return t.replace(/</g, '<sub>').replace(/>/g, '</sub>').replace(/\*/g, '°');
  const [, mult, Ls, odd, J] = m;
  return `<sup>${mult}</sup>${Ls}${odd ? '<sup>o</sup>' : ''}<sub>${J}</sub>`;
}

/** Standard atomic weight, or [A] of the longest-lived isotope for elements without one. */
export function weightHTML(el) {
  const hasStd = el.stableIsotopes > 0 || [83, 90, 91, 92].includes(el.z);
  if (hasStd) return el.weight;
  return el.longestLived ? `[${el.longestLived}]` : el.weight;
}
export function hasStandardWeight(el) {
  return el.stableIsotopes > 0 || [83, 90, 91, 92].includes(el.z);
}

export const BLOCK_NAME = { s: 's-block', p: 'p-block', d: 'd-block', f: 'f-block' };

/** SVG markup of a Bohr-style shell diagram (schematic). */
export function bohrSVG(shells, { size = 220, nucleusLabel = '', electronColor = 'var(--electron)', ringColor = 'currentColor', animate = true } = {}) {
  const cx = size / 2, cy = size / 2;
  const n = shells.length;
  const rN = Math.max(9, size * 0.07);
  const rMax = size / 2 - 6;
  const step = (rMax - rN - 6) / Math.max(1, n);
  let out = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Shell diagram: ${shells.join(', ')} electrons" class="bohr">`;
  shells.forEach((count, i) => {
    const r = rN + 6 + step * (i + 1) - step * 0.15;
    out += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="none" stroke="${ringColor}" stroke-opacity=".28" stroke-width="1"/>`;
    const dur = (6 + i * 4.5).toFixed(1);
    out += `<g${animate ? ` class="bohr-ring" style="transform-origin:${cx}px ${cy}px;animation-duration:${dur}s"` : ''}>`;
    const er = Math.max(1.8, Math.min(4, size * 0.016));
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 - Math.PI / 2 + i * 0.35;
      out += `<circle cx="${(cx + r * Math.cos(a)).toFixed(2)}" cy="${(cy + r * Math.sin(a)).toFixed(2)}" r="${er}" fill="${electronColor}"/>`;
    }
    out += '</g>';
  });
  out += `<circle cx="${cx}" cy="${cy}" r="${rN}" fill="var(--proton)"/>`;
  if (nucleusLabel) out += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="IBM Plex Sans, sans-serif" font-size="${Math.round(rN * 0.85)}" font-weight="600" fill="#fff">${nucleusLabel}</text>`;
  out += '</svg>';
  return out;
}

/** Hund's-rule filling of a subshell's orbitals: array of [up, down] per orbital. */
export function hundFill(l, count) {
  const k = 2 * l + 1;
  const boxes = Array.from({ length: k }, () => [false, false]);
  for (let i = 0; i < count; i++) {
    if (i < k) boxes[i][0] = true; else boxes[i - k][1] = true;
  }
  return boxes;
}

/** HTML orbital box diagram for an occupancy map. */
export function orbitalBoxesHTML(occ, { only } = {}) {
  let html = '<div class="obox-row">';
  for (const [k, c] of occ) {
    if (only && !only.includes(k)) continue;
    const l = L.indexOf(k[1]);
    const boxes = hundFill(l, c);
    html += `<div class="obox-group" title="${k}: ${c} electron${c === 1 ? '' : 's'}"><div class="obox-cells">`;
    for (const [u, d] of boxes) {
      html += `<span class="obox">${u ? '<i class="up">↑</i>' : ''}${d ? '<i class="dn">↓</i>' : ''}</span>`;
    }
    html += `</div><div class="obox-label">${k}</div></div>`;
  }
  return html + '</div>';
}
