// Element detail panel: structure, properties, isotopes, spectrum and live
// descriptions from the Wikipedia and PubChem REST APIs.
import { h, isDark } from './dom.js';
import { configHTML, occupancy, madelungOccupancy, termHTML, weightHTML, bohrSVG, orbitalBoxesHTML, BLOCK_NAME, hasStandardWeight } from './elements.js';
import { categoryColor, CATEGORY } from './color.js';
import { fix, sig, halfLife, int, sci } from './format.js';
import { drawSpectrum } from './spectrum.js';
import { DECAY_SHORT } from './data.js';

const WIKI_TITLES = { Mercury: 'Mercury_(element)' };

function cacheGet(key) { try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function cacheSet(key, v) { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }

async function fetchJSON(url, key) {
  const hit = cacheGet(key);
  if (hit) return hit;
  // a plain GET (no custom headers) avoids a CORS preflight that some APIs reject
  const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  cacheSet(key, j);
  return j;
}

/** Wikipedia page summary (REST API, CORS-enabled). */
export function wikiSummary(name) {
  const title = WIKI_TITLES[name] || name;
  return fetchJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, `wiki:${title}`);
}

/** Text paragraphs from a PubChem PUG View element heading, with source names. */
export async function pubchemHeading(z, heading) {
  const j = await fetchJSON(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/element/${z}/JSON?heading=${encodeURIComponent(heading)}`, `pc:${z}:${heading}`);
  const refs = new Map((j.Record?.Reference || []).map((r) => [r.ReferenceNumber, r]));
  const out = [];
  const walk = (s) => {
    for (const sec of s.Section || []) {
      if (sec.TOCHeading === heading) {
        for (const info of sec.Information || []) {
          const text = (info.Value?.StringWithMarkup || []).map((m) => m.String).filter(Boolean);
          if (text.length) out.push({ text, source: refs.get(info.ReferenceNumber)?.SourceName || 'PubChem', url: refs.get(info.ReferenceNumber)?.URL });
        }
      }
      walk(sec);
    }
  };
  walk(j.Record || {});
  return out;
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const K = (v) => (v == null ? '—' : `${fix(v, v < 100 ? 2 : 1)} K <span class="muted">(${fix(v - 273.15, 1)} °C)</span>`);

export function renderElementDetail(body, el, { E, nuclides, spectra }) {
  const dark = isDark();
  const bg = categoryColor(el.cat, dark);
  const occ = occupancy(el);
  const mad = madelungOccupancy(el.z);
  const exception = el.z <= 103 && [...occ].some(([k, c]) => (mad.get(k) || 0) !== c);
  const madText = [...mad].filter(([, c]) => c).map(([k, c]) => `${k}<sup>${c}</sup>`).slice(-3).join(' ');
  const iso = nuclides ? (nuclides.byZ.get(el.z) || []) : [];
  const stable = iso.filter((r) => r.hl === -1);
  const natural = iso.filter((r) => r.abundance != null).sort((a, b) => b.abundance - a.abundance);
  const radioactive = iso.filter((r) => r.hl > 0).sort((a, b) => b.hl - a.hl).slice(0, 4);
  const lastShell = el.shells[el.shells.length - 1];

  body.innerHTML = `
    <div class="ed-head">
      <div class="ed-tile" style="background:${bg}"><span class="z">${el.z}</span><span class="s">${el.sym}</span><span class="w">${weightHTML(el)}</span></div>
      <div>
        <h2 class="ed-name" id="ed-title">${el.name}</h2>
        <div class="ed-sub">${CATEGORY[el.cat]?.label.replace(/s$/, '') || el.cat} · ${BLOCK_NAME[el.block]} · period ${el.period}${el.group ? ` · group ${el.group}` : ''}<br>${el.statePredicted ? 'Predicted ' : ''}${el.state} at room temperature${el.year ? ` · discovered ${el.year === 'Ancient' ? 'in antiquity' : el.year}` : ''}</div>
      </div>
    </div>

    <section class="ed-section">
      <h3>Electrons <a href="periodic.html">How filling works</a></h3>
      <div class="ed-atom">
        <div>${bohrSVG(el.shells, { size: 170, nucleusLabel: '' })}</div>
        <div>
          <div class="ed-cfg">${configHTML(el)}</div>
          <div class="ed-cfg-note">Shells: ${el.shells.join(', ')} · ${lastShell} in the outer shell${el.term ? ` · ground term ${termHTML(el.term)}` : ''}</div>
          ${exception ? `<div class="ed-cfg-note"><b>An exception.</b> The simple filling rule predicts …${madText}; the measured ground state differs because it lowers the atom’s total energy.</div>` : ''}
          ${el.cfgPredicted ? '<div class="ed-cfg-note">Predicted by theory: too few atoms of this element have ever been made to measure it.</div>' : `<div class="ed-cfg-note">Source: ${el.cfgSrc === 'NIST' ? 'NIST Atomic Spectra Database' : 'PubChem'}</div>`}
        </div>
      </div>
      <div style="margin-top:1rem">${orbitalBoxesHTML(occ, { only: el.valence.map(([n, l]) => `${n}${'spdf'[l]}`) })}</div>
      <p class="ed-cfg-note" style="margin-top:.6rem">The ring diagram counts electrons per shell; it is a bookkeeping picture, not their real shape. Real electrons occupy orbitals (<a href="orbitals.html">Chapter 4</a>).</p>
    </section>

    <section class="ed-section">
      <h3>Properties</h3>
      <table class="ed-props">
        <tr><th>${hasStandardWeight(el) ? 'Standard atomic weight' : 'Mass number of longest-lived isotope'}</th><td>${weightHTML(el)}</td></tr>
        <tr><th>Electronegativity (Pauling)</th><td>${el.en ?? '—'}</td></tr>
        <tr><th>First ionisation energy</th><td>${el.ie != null ? fix(el.ie, 3) + ' eV' : '—'}${el.ieNote ? ` <span class="muted">(${el.ieNote})</span>` : ''}</td></tr>
        <tr><th>Electron affinity</th><td>${el.ea != null ? fix(el.ea, 3) + ' eV' : '<span class="muted">no stable anion</span>'}</td></tr>
        <tr><th>Van der Waals radius</th><td>${el.radius != null ? el.radius + ' pm' : '—'}</td></tr>
        <tr><th>Melting point</th><td>${K(el.mp)}</td></tr>
        <tr><th>Boiling point</th><td>${K(el.bp)}</td></tr>
        <tr><th>Density</th><td>${el.density != null ? (el.state === 'gas' ? `${sig(el.density * 1000, 3)} g/L` : `${sig(el.density, 4)} g/cm³`) : '—'}</td></tr>
        <tr><th>Oxidation states</th><td>${esc(el.ox || '—').replace(/-/g, '−')}</td></tr>
        <tr><th>Earth’s crust</th><td>${el.crust != null ? `${sig(el.crust, 3)} mg/kg` : '—'}</td></tr>
        <tr><th>Seawater</th><td>${el.ocean != null ? `${sci(el.ocean, 2, { threshold: [1e-2, 1e5] })} mg/L` : '—'}</td></tr>
      </table>
      <p class="ed-src">Properties from PubChem; ionisation energy and configuration from NIST.</p>
    </section>

    <section class="ed-section">
      <h3>Isotopes <a href="nuclides.html#z=${el.z}">See on the nuclide chart</a></h3>
      ${iso.length ? `<p class="ed-cfg-note" style="margin:0 0 .8rem">${iso.length} known isotopes, from ${el.sym}-${Math.min(...iso.map((r) => r.a))} to ${el.sym}-${Math.max(...iso.map((r) => r.a))}. ${stable.length ? `${stable.length} ${stable.length === 1 ? 'is' : 'are'} stable.` : 'None is stable.'}</p>` : ''}
      <div class="ed-iso">
        ${natural.map((r) => `<div class="ed-iso__row"><b>${el.sym}-${r.a}</b><span class="ed-iso__bar"><i style="width:${Math.max(1, r.abundance)}%"></i></span><span class="ed-iso__v">${fix(r.abundance, r.abundance < 1 ? 4 : 2)}%${r.hl > 0 ? ' · ' + halfLife(r.hl, { short: true }) : ''}</span></div>`).join('')}
        ${radioactive.filter((r) => r.abundance == null).map((r) => `<div class="ed-iso__row"><b>${el.sym}-${r.a}</b><span class="ed-cfg-note" style="margin:0">${(r.decay || []).map((d) => DECAY_SHORT[d[0]] || d[0]).join(', ')}</span><span class="ed-iso__v">t½ ${halfLife(r.hl, { short: true })}</span></div>`).join('')}
      </div>
      <p class="ed-src">Natural abundances and half-lives from the IAEA LiveChart of Nuclides.</p>
    </section>

    <section class="ed-section" data-spec>
      <h3>Emission spectrum <a href="spectra.html#${el.sym}">Open in spectra tool</a></h3>
      <div class="ed-spec"></div>
      <p class="ed-src">Visible lines, 380–750 nm, from the NIST Atomic Spectra Database.</p>
    </section>

    <section class="ed-section ed-live">
      <h3>About ${el.name}</h3>
      <div data-wiki><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton" style="width:70%"></div></div>
      <div data-pc></div>
    </section>`;

  // spectrum
  const specBox = body.querySelector('.ed-spec');
  const lines = spectra?.[el.sym]?.I?.l;
  if (lines && lines.some(([nm]) => nm >= 380 && nm <= 750)) {
    const c = document.createElement('canvas');
    const w = specBox.clientWidth || 500, hh = 64, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = hh * dpr; c.style.width = '100%'; c.style.height = hh + 'px';
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    drawSpectrum(g, { x: 0, y: 0, w, h: hh }, lines, { range: [380, 750], gamma: 0.75 });
    specBox.append(c);
  } else {
    body.querySelector('[data-spec]').innerHTML = '<h3>Emission spectrum</h3><p class="ed-cfg-note">No measured visible spectrum is available for this element.</p>';
  }

  // live descriptions
  const wikiEl = body.querySelector('[data-wiki]');
  const pcEl = body.querySelector('[data-pc]');
  const token = Symbol();
  body.__token = token;
  wikiSummary(el.name).then((s) => {
    if (body.__token !== token) return;
    const img = s.thumbnail ? `<figure><img src="${esc(s.thumbnail.source)}" alt="${esc(s.title)}" loading="lazy"></figure>` : '';
    wikiEl.innerHTML = `${img}<p>${esc(s.extract || '')}</p>
      <p class="ed-src">From <a href="${esc(s.content_urls?.desktop?.page || 'https://en.wikipedia.org')}">Wikipedia</a>, licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Retrieved live.</p>`;
  }).catch(() => {
    if (body.__token !== token) return;
    wikiEl.innerHTML = `<p class="ed-cfg-note">Could not reach Wikipedia just now. <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(WIKI_TITLES[el.name] || el.name)}">Read about ${el.name} on Wikipedia</a>.</p>`;
  });
  Promise.all([pubchemHeading(el.z, 'History').catch(() => []), pubchemHeading(el.z, 'Uses').catch(() => [])]).then(([hist, uses]) => {
    if (body.__token !== token) return;
    const name = hist.find((x) => /CIAAW|IUPAC/.test(x.source)) || hist[0];
    const use = uses.find((x) => /Jefferson/.test(x.source)) || uses[0];
    let html = '';
    if (name) html += `<h4 class="ed-sub" style="margin:1.2rem 0 .3rem;font-weight:600;color:var(--ink-2)">Name and history</h4><p>${esc(name.text.join(' '))}</p><p class="ed-src">${esc(name.source)}, via <a href="https://pubchem.ncbi.nlm.nih.gov/element/${el.z}">PubChem</a>.</p>`;
    if (use) html += `<h4 class="ed-sub" style="margin:1.2rem 0 .3rem;font-weight:600;color:var(--ink-2)">Uses</h4><p>${esc(use.text.slice(0, 2).join(' '))}</p><p class="ed-src">${esc(use.source)}, via <a href="https://pubchem.ncbi.nlm.nih.gov/element/${el.z}">PubChem</a>.</p>`;
    pcEl.innerHTML = html;
  });
}
