// How empty is an atom? Scale the nucleus up to everyday size and see how big the atom becomes.
import { h } from '../lib/dom.js';
import { getElements, getNuclides } from '../lib/data.js';
import { select, segmented } from '../lib/controls.js';
import { fix, sig, length as fmtLen } from '../lib/format.js';

const MODELS = [
  { value: 'pepper', label: 'a peppercorn', size: 0.004 },
  { value: 'marble', label: 'a marble', size: 0.015 },
  { value: 'ball', label: 'a football', size: 0.22 },
];

export async function mount(el) {
  const [E, N] = await Promise.all([getElements(), getNuclides()]);
  let sym = 'Au', model = 'marble';
  const frame = h('div.fig__frame');
  const body = h('div.es-body');
  const controls = h('div.fig__controls');
  frame.append(body, controls);
  el.prepend(frame);

  const usable = E.list.filter((e) => e.radius && (N.byZ.get(e.z) || []).some((r) => r.hl === -1 || r.hl > 3e7));
  const elCtl = select({ label: 'Element', options: usable.map((e) => ({ value: e.sym, label: e.name })), value: sym, onChange: (v) => { sym = v; render(); } });
  const mCtl = segmented({ label: 'Nucleus as big as', options: MODELS.map((m) => ({ value: m.value, label: m.label.replace(/^a /, '') })), value: model, onChange: (v) => { model = v; render(); } });
  controls.append(elCtl.el, mCtl.el);

  function render() {
    const e = E.bySym.get(sym);
    const iso = (N.byZ.get(e.z) || []).filter((r) => r.hl === -1 || r.hl > 3e7);
    const main = iso.slice().sort((a, b) => (b.abundance || 0) - (a.abundance || 0) || (b.hl === -1 ? 1 : 0) - (a.hl === -1 ? 1 : 0))[0];
    const measured = main.radius != null;
    const Rn = measured ? Math.sqrt(5 / 3) * main.radius : 1.2 * Math.cbrt(main.a); // fm
    const Ra = e.radius * 1000; // pm -> fm
    const ratio = Ra / Rn;
    const m = MODELS.find((x) => x.value === model);
    const atomD = m.size * ratio;
    const electronsMass = e.z * 5.48579909e-4;
    const fracNucleus = 1 - electronsMass / main.mass;
    const vol = Math.pow(ratio, 3);
    const pitches = atomD / 105;
    body.innerHTML = `
      <div class="es-big"><span>${fmtLen(atomD, 3)}</span><small>across</small></div>
      <p class="es-line">If a ${e.name.toLowerCase()}-${main.a} nucleus were the size of ${m.label} (${fmtLen(m.size, 2)}), the whole atom would be ${fmtLen(atomD, 2)} wide${pitches > 0.5 ? `, about ${sig(pitches, 2)} football pitch${pitches >= 1.5 ? 'es' : ''} end to end` : ''}.</p>
      <dl class="readouts">
        <div class="readout"><dt>Atom radius</dt><dd>${e.radius} pm</dd></div>
        <div class="readout"><dt>Nucleus radius</dt><dd>${fix(Rn, 2)} fm${measured ? '' : '*'}</dd></div>
        <div class="readout"><dt>Width ratio</dt><dd>1 : ${sig(ratio, 2)}</dd></div>
        <div class="readout"><dt>Volume ratio</dt><dd>1 : ${sig(vol / Math.pow(10, Math.floor(Math.log10(vol))), 2)} × 10<sup>${Math.floor(Math.log10(vol))}</sup></dd></div>
        <div class="readout"><dt>Mass in nucleus</dt><dd>${fix(100 * fracNucleus, 2)}%</dd></div>
      </dl>
      <p class="es-note">Atom radius: van der Waals radius from PubChem, the distance at which neighbouring atoms bump into one another. Nucleus radius: measured charge radius from the IAEA, converted to the radius of a uniform sphere${measured ? '' : '; *this nucleus has no measured radius, so 1.2 × A^⅓ fm is used'}. The electron cloud has no sharp edge, so other definitions give ratios up to a few times different.</p>`;
  }
  render();
}
