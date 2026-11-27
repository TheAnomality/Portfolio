// Five models of the atom, and the evidence that overturned each.
import { h } from '../lib/dom.js';

const MODELS = [
  {
    key: 'dalton', year: '1808', who: 'John Dalton', name: 'Solid spheres',
    said: 'Each element is made of identical, indivisible atoms with a characteristic weight. Compounds are atoms joined in fixed whole-number ratios.',
    explained: 'Why compounds always contain their elements in the same proportions by mass: water is always eight grams of oxygen to one of hydrogen.',
    broke: 'In 1897 J. J. Thomson found the electron, a particle about two thousand times lighter than the lightest atom. Atoms have parts.',
    svg: `<defs><radialGradient id="dg" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#d9d4ca"/><stop offset="1" stop-color="#5d5850"/></radialGradient></defs><circle cx="60" cy="60" r="34" fill="url(#dg)"/>`,
  },
  {
    key: 'thomson', year: '1904', who: 'J. J. Thomson', name: 'Plum pudding',
    said: 'Negative electrons sit embedded in a diffuse sphere of positive charge, like plums in a pudding, arranged so the whole is neutral.',
    explained: 'Electrons can be knocked out of any kind of matter, yet ordinary atoms carry no overall charge.',
    broke: 'From 1909, alpha particles fired at thin gold foil occasionally bounced straight back. Charge spread thinly through a whole atom could never do that.',
    svg: `<circle cx="60" cy="60" r="38" fill="#e0523b" fill-opacity=".22" stroke="#e0523b" stroke-opacity=".45"/>${[[44, 42], [70, 38], [58, 58], [36, 66], [78, 64], [50, 82], [72, 84], [62, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#2f7cf6"/>`).join('')}`,
  },
  {
    key: 'rutherford', year: '1911', who: 'Ernest Rutherford', name: 'Nuclear atom',
    said: 'Nearly all the mass and all the positive charge are concentrated in a tiny nucleus at the centre, with electrons orbiting far outside it.',
    explained: 'The exact pattern of alpha-particle scattering, including the rare large deflections (Figure 2.2).',
    broke: 'An orbiting electron should radiate light, lose energy and spiral into the nucleus within a hundred-billionth of a second. Nor could the model explain why atoms emit sharp spectral lines.',
    svg: `<g fill="none" stroke="currentColor" stroke-opacity=".35"><ellipse cx="60" cy="60" rx="42" ry="15"/><ellipse cx="60" cy="60" rx="42" ry="15" transform="rotate(60 60 60)"/><ellipse cx="60" cy="60" rx="42" ry="15" transform="rotate(-60 60 60)"/></g><circle cx="60" cy="60" r="4" fill="#e0523b"/>${[0, 60, -60].map((rot, i) => `<g transform="rotate(${rot} 60 60)"><circle r="3.5" fill="#2f7cf6"><animateMotion dur="${3 + i * 1.3}s" repeatCount="indefinite" path="M18,60 a42,15 0 1,0 84,0 a42,15 0 1,0 -84,0"/></circle></g>`).join('')}`,
  },
  {
    key: 'bohr', year: '1913', who: 'Niels Bohr', name: 'Quantised orbits',
    said: 'Electrons can only occupy certain orbits, each with a fixed energy. An atom emits or absorbs light only when an electron jumps between orbits.',
    explained: 'Hydrogen’s spectrum, exactly, including the formula Johann Balmer had found by trial and error in 1885.',
    broke: 'It failed for every atom with more than one electron, gave no reason why only certain orbits were allowed, and could not explain chemical bonds.',
    svg: `<g fill="none" stroke="currentColor" stroke-opacity=".35"><circle cx="60" cy="60" r="12"/><circle cx="60" cy="60" r="26"/><circle cx="60" cy="60" r="42"/></g><circle cx="60" cy="60" r="3.5" fill="#e0523b"/><circle cx="60" cy="18" r="4" fill="#2f7cf6"/><path d="M60 24v8" stroke="#f2c94c" stroke-width="1.5"/><path d="M66 22c3 2 0 4 3 6s0 4 3 6" stroke="#f2c94c" fill="none" stroke-width="1.5"/>`,
  },
  {
    key: 'quantum', year: '1926', who: 'Erwin Schrödinger, Werner Heisenberg and others', name: 'Quantum clouds',
    said: 'Electrons are three-dimensional standing waves, orbitals, described by the Schrödinger equation. Only the probability of finding an electron at a place can be known.',
    explained: 'The spectra of all atoms, the periodic table, chemical bonding, and in principle all of chemistry.',
    broke: 'Nothing yet. Extended by quantum electrodynamics, it predicts the electron’s magnetism to about one part in a trillion, the most precise agreement between theory and experiment in all of science.',
    svg: `<defs><radialGradient id="qg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#6fb2ff" stop-opacity=".85"/><stop offset=".45" stop-color="#2f7cf6" stop-opacity=".35"/><stop offset="1" stop-color="#2f7cf6" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="60" r="44" fill="url(#qg)"/>${Array.from({ length: 70 }, (_, i) => { const a = i * 2.39996, r = 40 * Math.sqrt(((i * 7919) % 70) / 70); return `<circle cx="${(60 + r * Math.cos(a)).toFixed(1)}" cy="${(60 + r * Math.sin(a)).toFixed(1)}" r="1" fill="#cfe4ff" fill-opacity=".8"/>`; }).join('')}<circle cx="60" cy="60" r="2" fill="#e0523b"/>`,
  },
];

export function mount(el) {
  let current = 'rutherford';
  const frame = h('div.fig__frame');
  const tabs = h('div.mt-tabs', { role: 'tablist', 'aria-label': 'Models of the atom' });
  const panel = h('div.mt-panel', { role: 'tabpanel', tabindex: '0' });
  frame.append(tabs, panel);
  el.prepend(frame);
  const buttons = new Map();
  for (const m of MODELS) {
    const b = h('button.mt-tab', { type: 'button', role: 'tab', id: `mt-${m.key}`, 'aria-controls': 'mt-panel' },
      h('span.mt-year', null, m.year),
      h('span.mt-art', { html: `<svg viewBox="0 0 120 120" aria-hidden="true">${m.svg}</svg>` }),
      h('span.mt-name', null, m.name));
    b.addEventListener('click', () => select(m.key));
    b.addEventListener('keydown', (e) => {
      const i = MODELS.findIndex((x) => x.key === current);
      if (e.key === 'ArrowRight') { e.preventDefault(); select(MODELS[(i + 1) % MODELS.length].key, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); select(MODELS[(i - 1 + MODELS.length) % MODELS.length].key, true); }
    });
    buttons.set(m.key, b);
    tabs.append(b);
  }
  panel.id = 'mt-panel';
  function select(key, focus) {
    current = key;
    const m = MODELS.find((x) => x.key === key);
    for (const [k, b] of buttons) { b.setAttribute('aria-selected', String(k === key)); b.tabIndex = k === key ? 0 : -1; }
    if (focus) buttons.get(key).focus();
    panel.setAttribute('aria-labelledby', `mt-${key}`);
    panel.innerHTML = `
      <div class="mt-who">${m.year} · ${m.who}</div>
      <div class="mt-cols">
        <div><h4>The idea</h4><p>${m.said}</p></div>
        <div><h4>What it explained</h4><p>${m.explained}</p></div>
        <div><h4>${m.key === 'quantum' ? 'What broke it' : 'What broke it'}</h4><p>${m.broke}</p></div>
      </div>`;
  }
  select(current);
}
