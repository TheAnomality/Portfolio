// Number formatting with proper typography (true minus signs, superscript exponents).

const MINUS = '−';
const nf = new Map();
function getNF(min, max) {
  const key = min + ':' + max;
  if (!nf.has(key)) nf.set(key, new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max }));
  return nf.get(key);
}

export function minus(s) { return String(s).replace(/-/g, MINUS); }

/** Fixed decimals with thousands separators. */
export function fix(x, digits = 2, minDigits = digits) {
  if (x == null || !isFinite(x)) return '—';
  return minus(getNF(minDigits, digits).format(x));
}

/** Significant figures, without scientific notation for moderate values. */
export function sig(x, n = 3) {
  if (x == null || !isFinite(x)) return '—';
  if (x === 0) return '0';
  const mag = Math.floor(Math.log10(Math.abs(x)));
  const decimals = Math.max(0, n - 1 - mag);
  return fix(x, decimals, decimals);
}

/** Scientific notation as HTML: 1.23 × 10<sup>−5</sup>. */
export function sci(x, n = 3, { html = true, threshold = [1e-3, 1e5] } = {}) {
  if (x == null || !isFinite(x)) return '—';
  if (x === 0) return '0';
  const ax = Math.abs(x);
  if (ax >= threshold[0] && ax < threshold[1]) return sig(x, n);
  let exp = Math.floor(Math.log10(ax));
  let m = Number((x / Math.pow(10, exp)).toPrecision(n));
  if (Math.abs(m) >= 10) { m = Number((m / 10).toPrecision(n)); exp += 1; }
  const ms = minus(String(m));
  const e = minus(String(exp));
  return html ? `${ms} × 10<sup>${e}</sup>` : `${ms} × 10^${e}`;
}

const SUPERS = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺' };
const SUBS = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
export const sup = (s) => String(s).split('').map((c) => SUPERS[c] ?? c).join('');
export const sub = (s) => String(s).split('').map((c) => SUBS[c] ?? c).join('');

/** Plain-text scientific notation using Unicode superscripts: 1.2 × 10⁻⁵ */
export function sciText(x, n = 3) {
  if (x == null || !isFinite(x)) return '—';
  if (x === 0) return '0';
  let exp = Math.floor(Math.log10(Math.abs(x)));
  let m = Number((x / Math.pow(10, exp)).toPrecision(n));
  if (Math.abs(m) >= 10) { m /= 10; exp += 1; }
  return `${minus(m)} × 10${sup(exp)}`;
}

const SI = [
  [1e-18, 'a'], [1e-15, 'f'], [1e-12, 'p'], [1e-9, 'n'], [1e-6, 'µ'], [1e-3, 'm'], [1, ''], [1e3, 'k'],
];
/** Format a length in metres with a sensible SI prefix: 5.29e-11 → "52.9 pm". */
export function length(m, n = 3) {
  if (!isFinite(m) || m <= 0) return '—';
  let best = SI[0];
  for (const p of SI) if (m >= p[0] * 0.9999) best = p;
  if (best[1] === 'k') best = [1, ''];
  return `${sig(m / best[0], n)} ${best[1]}m`;
}

const YEAR = 365.2422 * 86400;
/** Human-readable half-life from seconds. */
export function halfLife(s, { short = false } = {}) {
  if (s == null) return 'unknown';
  if (s < 0) return 'stable';
  const units = [
    [YEAR * 1e9, short ? 'Gy' : 'billion years'],
    [YEAR * 1e6, short ? 'My' : 'million years'],
    [YEAR, short ? 'y' : 'years'],
    [86400, short ? 'd' : 'days'],
    [3600, short ? 'h' : 'hours'],
    [60, short ? 'min' : 'minutes'],
    [1, 's'],
    [1e-3, 'ms'],
    [1e-6, 'µs'],
    [1e-9, 'ns'],
    [1e-12, 'ps'],
    [1e-15, 'fs'],
    [1e-18, 'as'],
  ];
  if (s >= YEAR * 1e12) return `${sciText(s / YEAR, 2)} ${short ? 'y' : 'years'}`;
  if (s < 1e-18) return `${sciText(s, 2)} s`;
  for (const [u, name] of units) {
    if (s >= u) {
      const v = s / u;
      let str = v >= 100 ? fix(v, 0) : sig(v, 3);
      if (!short && v < 1.995 && v >= 0.995 && name.endsWith('s') && name.length > 2) {
        return `${str} ${name.replace(/s$/, '')}`;
      }
      return `${str} ${name}`;
    }
  }
  return `${sciText(s, 2)} s`;
}

/** Energy in eV with prefix. */
export function energy(eV, n = 3) {
  const a = Math.abs(eV);
  if (a >= 1e6) return `${sig(eV / 1e6, n)} MeV`;
  if (a >= 1e3) return `${sig(eV / 1e3, n)} keV`;
  if (a >= 1 || a === 0) return `${sig(eV, n)} eV`;
  return `${sig(eV * 1e3, n)} meV`;
}

/** Ordinal: 1 → 1st */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Integer with separators: 1234567 → "1,234,567" */
export const int = (x) => (x == null || !isFinite(x) ? '—' : minus(Math.round(x).toLocaleString('en-US')));

/** Writes big numbers in words for intuition: 6.0e23 → "600 sextillion". */
export function words(x) {
  const names = [[1e33, 'decillion'], [1e30, 'nonillion'], [1e27, 'octillion'], [1e24, 'septillion'], [1e21, 'sextillion'],
    [1e18, 'quintillion'], [1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
  for (const [v, n] of names) if (x >= v) return `${sig(x / v, 2)} ${n}`;
  return sig(x, 2);
}
