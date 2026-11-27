// Colour science helpers: spectral colours, OKLab interpolation, colormaps.

// --- CIE 1931 2° colour matching functions, multi-lobe Gaussian fit
// (Wyman, Sloan & Shirley, "Simple Analytic Approximations to the CIE XYZ
// Color Matching Functions", JCGT 2013).
function g(x, mu, s1, s2) {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
}
export function cieXYZ(nm) {
  const x = 1.056 * g(nm, 599.8, 37.9, 31.0) + 0.362 * g(nm, 442.0, 16.0, 26.7) - 0.065 * g(nm, 501.1, 20.4, 26.2);
  const y = 0.821 * g(nm, 568.8, 46.9, 40.5) + 0.286 * g(nm, 530.9, 16.3, 31.1);
  const z = 1.217 * g(nm, 437.0, 11.8, 36.0) + 0.681 * g(nm, 459.0, 26.0, 13.8);
  // The fit underestimates x̄ in the deep violet; tabulated CIE data hold x̄/z̄ ≈ 0.21
  // from 380 to 405 nm, which is what makes that light look violet rather than blue.
  const xc = nm < 420 ? Math.max(x, 0.21 * z * Math.min(1, (420 - nm) / 15)) : x;
  return [xc, y, z];
}

const gammaEnc = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const gammaDec = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function xyzToLinearRGB([X, Y, Z]) {
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.969266 * X + 1.8760108 * Y + 0.041556 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
  ];
}

/**
 * Display colour for monochromatic light of wavelength `nm`.
 * Out-of-gamut spectral colours are brought into sRGB by adding white, then
 * normalised so the brightest channel is 1. Brightness tapers at the edges of
 * vision so 390 nm and 720 nm look dim, as they do to the eye.
 * Returns gamma-encoded [r, g, b] in 0..1.
 */
const specCache = new Map();
export function wavelengthRGB(nm, { taper = true } = {}) {
  const key = Math.round(nm * 4) + (taper ? 't' : '');
  if (specCache.has(key)) return specCache.get(key);
  let [r, gg, b] = xyzToLinearRGB(cieXYZ(nm));
  const w = -Math.min(r, gg, b, 0);
  r += w; gg += w; b += w;
  const m = Math.max(r, gg, b) || 1;
  r /= m; gg /= m; b /= m;
  let f = 1;
  if (taper) {
    if (nm < 420) f = 0.3 + 0.7 * Math.max(0, (nm - 380) / 40);
    else if (nm > 680) f = 0.3 + 0.7 * Math.max(0, (750 - nm) / 70);
    if (nm < 380 || nm > 750) f = 0.3;
  }
  const out = [gammaEnc(r * f), gammaEnc(gg * f), gammaEnc(b * f)].map((c) => Math.min(1, Math.max(0, c)));
  specCache.set(key, out);
  return out;
}
export function wavelengthCSS(nm, alpha = 1, opts) {
  const [r, gg, b] = wavelengthRGB(nm, opts);
  return `rgba(${Math.round(r * 255)},${Math.round(gg * 255)},${Math.round(b * 255)},${alpha})`;
}
/** Colour used to tint UI elements for invisible light. */
export function photonCSS(nm, alpha = 1) {
  if (nm >= 380 && nm <= 750) return wavelengthCSS(nm, alpha);
  if (nm < 380) return `rgba(176,140,255,${alpha})`; // ultraviolet: drawn as pale violet
  return `rgba(214,96,80,${alpha})`; // infrared: drawn as dull red
}

/** Blackbody spectral radiance (relative), Planck's law. */
export function planck(nm, T) {
  const l = nm * 1e-9;
  const c1 = 2 * 6.62607015e-34 * 299792458 ** 2;
  const c2 = (6.62607015e-34 * 299792458) / 1.380649e-23;
  return c1 / (l ** 5 * (Math.exp(c2 / (l * T)) - 1));
}

// --- OKLab (Björn Ottosson) for perceptually even interpolation
export function hexToRGB(hex) {
  const s = hex.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function rgbToHex([r, g, b]) {
  const c = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function rgbToOklab([r, g, b]) {
  r = gammaDec(r); g = gammaDec(g); b = gammaDec(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gammaEnc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gammaEnc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gammaEnc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ].map((c) => Math.min(1, Math.max(0, c)));
}

/** Build a colormap function t∈[0,1] → [r,g,b] (0..1) from hex stops, interpolated in OKLab. */
export function colormap(stops) {
  const labs = stops.map((s) => rgbToOklab(hexToRGB(s)));
  const n = labs.length - 1;
  const lut = new Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const x = t * n, k = Math.min(n - 1, Math.floor(x)), f = x - k;
    const A = labs[k], B = labs[k + 1];
    lut[i] = oklabToRgb([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f]);
  }
  const fn = (t) => lut[Math.max(0, Math.min(255, Math.round(t * 255)))] || lut[0];
  fn.css = (t, a = 1) => {
    const [r, g, b] = fn(t);
    return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
  };
  fn.stops = stops;
  return fn;
}

// Sequential ramp for "more of a property" on paper (light → deep).
export const EMBER_LIGHT = colormap(['#f7efdc', '#f3d390', '#eb9d55', '#d25f3d', '#9d3046', '#57204e', '#2a1838']);
// Same ramp reversed for dark backgrounds (dark → bright).
export const EMBER_DARK = colormap(['#26201f', '#4d2440', '#8a2f4a', '#c4513f', '#e88a4c', '#f4c477', '#fbeec8']);
// Viridis-like perceptual ramp (used for half-lives).
export const VIRIDIS = colormap(['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725']);
// Density ramp for probability clouds on the dark stage.
export const DENSITY = colormap(['#08090b', '#1b1440', '#3b1f78', '#7a2f8e', '#c4486e', '#f08a4b', '#fbd36b', '#fffbe9']);

/** Category hues for element groups, harmonised in OKLCH. */
export const CATEGORY = {
  'Alkali metal': { hue: 55, label: 'Alkali metals' },
  'Alkaline earth metal': { hue: 92, label: 'Alkaline earth metals' },
  'Transition metal': { hue: 285, label: 'Transition metals' },
  'Post-transition metal': { hue: 158, label: 'Post-transition metals' },
  Metalloid: { hue: 196, label: 'Metalloids' },
  Nonmetal: { hue: 238, label: 'Reactive nonmetals' },
  Halogen: { hue: 125, label: 'Halogens' },
  'Noble gas': { hue: 322, label: 'Noble gases' },
  Lanthanide: { hue: 355, label: 'Lanthanides' },
  Actinide: { hue: 22, label: 'Actinides' },
};
export function categoryColor(cat, dark) {
  const c = CATEGORY[cat];
  if (!c) return dark ? 'oklch(0.32 0.01 80)' : 'oklch(0.9 0.01 80)';
  return dark ? `oklch(0.39 0.075 ${c.hue})` : `oklch(0.885 0.075 ${c.hue})`;
}
export function categoryAccent(cat, dark) {
  const c = CATEGORY[cat];
  if (!c) return '#888';
  return dark ? `oklch(0.75 0.12 ${c.hue})` : `oklch(0.55 0.13 ${c.hue})`;
}

export const BLOCK_COLORS = {
  s: { light: 'oklch(0.88 0.07 25)', dark: 'oklch(0.40 0.08 25)', accent: 'oklch(0.62 0.15 25)' },
  p: { light: 'oklch(0.89 0.06 230)', dark: 'oklch(0.40 0.07 230)', accent: 'oklch(0.6 0.13 230)' },
  d: { light: 'oklch(0.90 0.07 85)', dark: 'oklch(0.42 0.07 85)', accent: 'oklch(0.66 0.13 85)' },
  f: { light: 'oklch(0.89 0.06 150)', dark: 'oklch(0.40 0.07 150)', accent: 'oklch(0.6 0.12 150)' },
};
