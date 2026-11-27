// Physical constants (CODATA 2018 recommended values) and small helpers.

export const C = {
  h: 6.62607015e-34,          // Planck constant, J s (exact)
  hbar: 1.054571817e-34,      // J s
  c: 299792458,               // m/s (exact)
  e: 1.602176634e-19,         // elementary charge, C (exact)
  me: 9.1093837015e-31,       // electron mass, kg
  mp: 1.67262192369e-27,      // proton mass, kg
  mn: 1.67492749804e-27,      // neutron mass, kg
  u: 1.6605390666e-27,        // atomic mass unit, kg
  uMeV: 931.49410242,         // 1 u in MeV/c^2
  meMeV: 0.51099895,          // electron rest energy, MeV
  mpMeV: 938.27208816,
  mnMeV: 939.56542052,
  me_u: 5.48579909065e-4,     // electron mass in u
  mH_u: 1.00782503223,        // hydrogen-1 atom mass in u
  mn_u: 1.00866491595,        // neutron mass in u
  a0: 5.29177210903e-11,      // Bohr radius, m
  Ry: 13.605693122994,        // Rydberg energy, eV
  alpha: 7.2973525693e-3,     // fine-structure constant
  hc_eVnm: 1239.84198433,     // h c in eV nm
  ke2_MeVfm: 1.43996448,      // e^2 / (4 pi eps0), MeV fm
  NA: 6.02214076e23,          // Avogadro (exact)
  kB: 1.380649e-23,           // J/K (exact)
  re: 2.8179403262e-15,       // classical electron radius, m
};

/** Reduced-mass factor for hydrogen-1: mu/me */
export const H_REDUCED = 1 / (1 + C.me / C.mp);

/** Energy of hydrogen level n in eV (Bohr / Schrödinger, reduced-mass corrected). */
export function hydrogenEnergy(n, Z = 1, reduced = true) {
  return -C.Ry * Z * Z * (reduced ? H_REDUCED : 1) / (n * n);
}

/** Vacuum wavelength (nm) of a hydrogen transition n2 -> n1. */
export function hydrogenWavelengthVac(n1, n2) {
  const dE = Math.abs(hydrogenEnergy(n1) - hydrogenEnergy(n2));
  return C.hc_eVnm / dE;
}

/** Refractive index of standard air (Peck & Reeder 1972, as used by NIST ASD). sigma in 1/µm. */
export function airIndex(lambdaVacNm) {
  const s2 = Math.pow(1000 / lambdaVacNm, 2);
  return 1 + 1e-8 * (8060.51 + 2480990 / (132.274 - s2) + 17455.7 / (39.32957 - s2));
}
/** NIST convention: air wavelengths between 200 nm and 2000 nm, vacuum outside. */
export function vacToAir(lambdaVacNm) {
  if (lambdaVacNm < 200 || lambdaVacNm > 2000) return lambdaVacNm;
  return lambdaVacNm / airIndex(lambdaVacNm);
}

/** Classify a wavelength (vacuum, nm) by spectral region. */
export function spectralRegion(nm) {
  if (nm < 10) return 'X-ray';
  if (nm < 200) return 'far ultraviolet';
  if (nm < 380) return 'ultraviolet';
  if (nm <= 750) return 'visible';
  if (nm < 1400) return 'near infrared';
  if (nm < 3000) return 'infrared';
  return 'mid infrared';
}

export const SERIES = {
  1: 'Lyman', 2: 'Balmer', 3: 'Paschen', 4: 'Brackett', 5: 'Pfund', 6: 'Humphreys',
};

/** Photon frequency (Hz) from energy (eV). */
export const freqFromEV = (eV) => (eV * C.e) / C.h;

/** Nuclear radius estimate R = r0 A^(1/3) (fm), r0 ~ 1.2 fm. */
export const nuclearRadius = (A, r0 = 1.2) => r0 * Math.cbrt(A);
