// Emission and absorption spectra of the elements, from the NIST Atomic Spectra Database.
import { h, tooltip } from '../lib/dom.js';
import { setupCanvas } from '../lib/canvas.js';
import { segmented, select } from '../lib/controls.js';
import { getSpectra, getElements } from '../lib/data.js';
import { drawSpectrum, drawWavelengthAxis, lineAt } from '../lib/spectrum.js';
import { wavelengthCSS } from '../lib/color.js';
import { fix, int } from '../lib/format.js';

export async function mount(el, opts = {}) {
  const [spectra, E] = await Promise.all([getSpectra(), getElements()]);
  const featured = (opts.featured || 'H,He,Li,Na,Ne,Hg,Fe').split(',');
  let sym = opts.element || featured[0];
  let mode = 'emission', ion = 'I';
  const range = [380, 750];

  const frame = h('div.fig__frame.fig__frame--stage');
  const head = h('div.spec-head');
  const wrap = h('div.plot', { style: { padding: '0 1.1rem' } });
  const chips = h('div.spec-lines');
  const controls = h('div.fig__controls');
  frame.append(head, wrap, chips, controls);
  el.prepend(frame);
  const tip = tooltip(wrap);

  const cv = setupCanvas(wrap, { height: (w) => Math.max(110, Math.min(170, w * 0.17)) + 36, onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');

  const quick = h('div.quick', { role: 'group', 'aria-label': 'Featured elements' });
  for (const s of featured) {
    const b = h('button', { type: 'button', 'aria-pressed': String(s === sym) }, E.bySym.get(s)?.name || s);
    b.addEventListener('click', () => setElement(s));
    quick.append(b);
  }
  const options = E.list.filter((e) => spectra[e.sym]).map((e) => ({ value: e.sym, label: `${e.z} ${e.name}` }));
  const pick = select({ label: 'Any element', options, value: sym, onChange: (v) => setElement(v) });
  const modeCtl = segmented({ options: [{ value: 'emission', label: 'Emission' }, { value: 'absorption', label: 'Absorption' }], value: mode, ariaLabel: 'Spectrum type', onChange: (v) => { mode = v; draw(); } });
  const ionCtl = segmented({ options: [{ value: 'I', label: 'Neutral atom' }, { value: 'II', label: 'Ion (+1)' }], value: ion, ariaLabel: 'Ionisation stage', onChange: (v) => { ion = v; draw(); } });
  controls.append(quick, h('span.spacer'), pick.el, modeCtl.el, ionCtl.el);

  function setElement(s) {
    sym = s;
    pick.set(s);
    for (const b of quick.children) b.setAttribute('aria-pressed', String(b.textContent === E.bySym.get(s)?.name));
    if (!spectra[s][ion]) ion = spectra[s].I ? 'I' : 'II';
    ionCtl.set(ion);
    draw();
  }

  let box = null;
  function current() { return spectra[sym]?.[ion]?.l || []; }

  function draw() {
    const { ctx, w, h: hh } = cv;
    ctx.clearRect(0, 0, w, hh);
    const e = E.bySym.get(sym);
    const sp = spectra[sym] || {};
    ionCtl.disable('II', !sp.II);
    ionCtl.disable('I', !sp.I);
    const lines = current();
    const vis = lines.filter(([nm]) => nm >= range[0] && nm <= range[1]);
    head.innerHTML = `<span class="spec-head__sym">${sym}${ion === 'II' ? '<sup>+</sup>' : ''}</span><span class="spec-head__name">${e.name}${ion === 'II' ? ', singly ionised' : ''}</span>
      <span class="spec-head__meta">${vis.length} strongest visible lines shown<br>of ${int(sp[ion]?.n || 0)} catalogued between 200 and 1000 nm</span>`;
    box = { x: 0, y: 0, w, h: hh - 36 };
    if (!lines.length) {
      ctx.fillStyle = '#6e6b65';
      ctx.fillText('No line data for this stage', 10, 30);
      return;
    }
    drawSpectrum(ctx, box, lines, { mode, range, gamma: mode === 'emission' ? 0.75 : 0.7 });
    drawWavelengthAxis(ctx, box, range, { color: '#8d8a83' });
    cv.canvas.setAttribute('aria-label', `${mode} spectrum of ${e.name}${ion === 'II' ? ' ion' : ''} from 380 to 750 nanometres.`);
    const top = [...vis].sort((a, b) => b[1] - a[1]).slice(0, 6).sort((a, b) => a[0] - b[0]);
    chips.innerHTML = top.map(([nm]) => `<span class="spec-chip"><i style="background:${wavelengthCSS(nm)}"></i>${fix(nm, 2)} nm</span>`).join('');
  }

  cv.canvas.addEventListener('pointermove', (ev) => {
    if (!box) return;
    const r = cv.canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    const l = lineAt(current(), x, box, range, 6);
    if (!l) { tip.hide(); return; }
    const vis = current().filter(([nm]) => nm >= range[0] && nm <= range[1]);
    const max = Math.max(...vis.map((v) => v[1]));
    tip.show(`<b>${fix(l[0], 3)} nm</b><br>relative intensity ${fix((100 * l[1]) / max, 1)}%`, x, y);
  });
  cv.canvas.addEventListener('pointerleave', () => tip.hide());
  setElement(sym);
}
