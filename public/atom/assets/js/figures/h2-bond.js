// The hydrogen molecule: overlapping 1s waves, the bonding and antibonding states,
// and the measured potential-energy curve.
import { h, onThemeChange } from '../lib/dom.js';
import { setupCanvas, FONT, haloText } from '../lib/canvas.js';
import { slider, segmented } from '../lib/controls.js';
import { linear, drawAxes, theme } from '../lib/plot.js';
import { DENSITY } from '../lib/color.js';
import { fix } from '../lib/format.js';

const A0 = 0.529177;              // Å
const DE = 4.7472, RE = 0.74144, AM = 1.9444; // H₂ ground state Morse parameters (eV, Å, 1/Å)
const morse = (r) => DE * (Math.pow(1 - Math.exp(-AM * (r - RE)), 2) - 1);
// Sato's "anti-Morse" approximation for the repulsive state
const antiMorse = (r) => (DE / 2) * (Math.exp(-2 * AM * (r - RE)) + 2 * Math.exp(-AM * (r - RE)));

export function mount(el) {
  let R = 0.74, state = 'bonding', view = 'density';
  const frame = h('div.fig__frame');
  const split = h('div.fig-split');
  const left = h('div.plot', { style: { background: '#08090b' } });
  const right = h('div.plot');
  split.append(left, right);
  const read = h('div.fig__controls');
  const controls = h('div.fig__controls');
  frame.append(split, read, controls);
  el.prepend(frame);
  const dv = setupCanvas(left, { height: (w) => Math.max(240, Math.min(340, w * 0.62)), onResize: () => drawDensity() });
  const ec = setupCanvas(right, { height: (w) => Math.max(240, Math.min(340, w * 0.75)), onResize: () => drawCurve() });
  dv.canvas.setAttribute('role', 'img');
  ec.canvas.setAttribute('role', 'img');
  ec.canvas.setAttribute('aria-label', 'Potential energy of two hydrogen atoms against their separation. The bonding curve has a minimum of −4.75 eV at 0.74 Å.');

  function drawDensity() {
    const { ctx, w, h: hh } = dv;
    const Ra = R / A0; // separation in Bohr radii
    const halfX = 4.2, halfZ = halfX * (hh / w);
    const resX = Math.min(260, Math.round(w * 0.6)), resZ = Math.round(resX * (hh / w));
    const img = ctx.createImageData(resX, resZ);
    const S = Math.exp(-Ra) * (1 + Ra + (Ra * Ra) / 3); // overlap of two 1s orbitals
    const sign = state === 'bonding' ? 1 : -1;
    const norm = 1 / (2 * (1 + sign * S));
    let vals = new Float32Array(resX * resZ), max = 0, min = 0;
    for (let j = 0; j < resZ; j++) {
      const z = halfZ - (2 * halfZ * j) / (resZ - 1);
      for (let i = 0; i < resX; i++) {
        const x = -halfX + (2 * halfX * i) / (resX - 1);
        const a = Math.exp(-Math.hypot(x + Ra / 2, z)) / Math.sqrt(Math.PI);
        const b = Math.exp(-Math.hypot(x - Ra / 2, z)) / Math.sqrt(Math.PI);
        const psi2 = norm * Math.pow(a + sign * b, 2);
        const v = view === 'density' ? psi2 : psi2 - 0.5 * (a * a + b * b);
        vals[j * resX + i] = v;
        if (v > max) max = v;
        if (v < min) min = v;
      }
    }
    for (let k = 0; k < vals.length; k++) {
      let r, g, b;
      if (view === 'density') {
        [r, g, b] = DENSITY(Math.pow(vals[k] / max, 0.5));
      } else {
        const v = vals[k];
        const m = Math.max(max, -min);
        const t = Math.pow(Math.abs(v) / m, 0.6);
        const c = v >= 0 ? [111, 178, 255] : [255, 122, 107];
        r = (8 + (c[0] - 8) * t) / 255; g = (9 + (c[1] - 9) * t) / 255; b = (11 + (c[2] - 11) * t) / 255;
      }
      img.data[4 * k] = r * 255; img.data[4 * k + 1] = g * 255; img.data[4 * k + 2] = b * 255; img.data[4 * k + 3] = 255;
    }
    const tmp = document.createElement('canvas');
    tmp.width = resX; tmp.height = resZ;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, 0, 0, w, hh);
    const sx = (x) => ((x + halfX) / (2 * halfX)) * w;
    for (const x of [-Ra / 2, Ra / 2]) {
      ctx.fillStyle = '#ff6a4d';
      ctx.beginPath(); ctx.arc(sx(x), hh / 2, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = FONT.sans(11, 500);
    ctx.fillStyle = '#e9e7e2';
    ctx.textAlign = 'left';
    ctx.fillText(view === 'density' ? (state === 'bonding' ? 'Bonding: waves in phase' : 'Antibonding: waves out of phase') : 'Where the electrons moved, compared with two separate atoms', 12, 20);
    if (view === 'difference') {
      ctx.font = FONT.sans(10.5);
      ctx.fillStyle = '#6fb2ff'; ctx.fillText('blue: more electron density', 12, hh - 28);
      ctx.fillStyle = '#ff7a6b'; ctx.fillText('red: less', 12, hh - 12);
    }
    // 1 Å scale bar
    const bar = (1 / A0 / (2 * halfX)) * w;
    ctx.strokeStyle = '#a3a097'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(w - 14 - bar, hh - 16); ctx.lineTo(w - 14, hh - 16); ctx.stroke();
    ctx.fillStyle = '#a3a097'; ctx.textAlign = 'right'; ctx.fillText('1 Å = 100 pm', w - 14, hh - 22);
    dv.canvas.setAttribute('aria-label', `Electron density of the ${state} state of two hydrogen atoms ${fix(R * 100, 0)} picometres apart.`);
  }

  function drawCurve() {
    const { ctx, w, h: hh } = ec;
    const t = theme();
    ctx.clearRect(0, 0, w, hh);
    const box = { x: 44, y: 22, w: w - 44 - 14, h: hh - 22 - 44 };
    const sx = linear([0.3, 3.2], [box.x, box.x + box.w]);
    const sy = linear([-5.5, 5], [box.y + box.h, box.y]);
    drawAxes(ctx, box, sx, sy, { xLabel: 'distance between nuclei (Å)', yLabel: 'energy (eV)', yTicks: [-4, -2, 0, 2, 4] });
    ctx.strokeStyle = t.ink3;
    ctx.beginPath(); ctx.moveTo(box.x, Math.round(sy(0)) + 0.5); ctx.lineTo(box.x + box.w, Math.round(sy(0)) + 0.5); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    const curve = (f, col, wd, dash) => {
      ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (let i = 0; i <= 300; i++) { const r = 0.3 + (i / 300) * 2.9; const y = sy(f(r)); i ? ctx.lineTo(sx(r), y) : ctx.moveTo(sx(r), y); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    curve(morse, '#2f7cf6', state === 'bonding' ? 2.6 : 1.4);
    curve(antiMorse, '#e0523b', state === 'antibonding' ? 2.6 : 1.4, [5, 4]);
    ctx.restore();
    ctx.font = FONT.sans(11, 500);
    ctx.textAlign = 'left';
    haloText(ctx, 'bonding', sx(1.6), sy(morse(1.6)) + 16, '#2f7cf6', t.bg, 4);
    haloText(ctx, 'antibonding (approx.)', sx(0.95), sy(antiMorse(0.95)) - 8, '#e0523b', t.bg, 4);
    ctx.fillStyle = t.ink2;
    ctx.fillText('bond length 74 pm', sx(RE) + 6, sy(-DE) + 16);
    const f = state === 'bonding' ? morse : antiMorse;
    const E = f(R);
    if (E < 5.2) {
      ctx.fillStyle = t.ink;
      ctx.beginPath(); ctx.arc(sx(R), sy(E), 6, 0, Math.PI * 2); ctx.fill();
    }
    read.innerHTML = `<dl class="readouts">
      <div class="readout"><dt>Separation</dt><dd>${fix(R * 100, 0)} pm</dd></div>
      <div class="readout"><dt>Energy vs. separate atoms</dt><dd>${E > 0 ? '+' : ''}${fix(E, 2)} eV</dd></div>
      <div class="readout"><dt>Verdict</dt><dd style="font-family:var(--font-sans);font-size:.92rem">${state === 'antibonding' ? 'pushes apart at every distance' : R < 0.55 ? 'nuclei too close: repulsion wins' : Math.abs(R - RE) < 0.06 ? 'the bond: lowest energy' : R > 2 ? 'barely interacting' : 'attracting'}</dd></div>
    </dl>`;
  }

  const rCtl = slider({ label: 'Pull the atoms apart', min: 0.4, max: 3, step: 0.01, value: R, width: 'clamp(9rem, 30vw, 18rem)', format: (v) => `${fix(v * 100, 0)} pm`, onInput: (v) => { R = v; drawDensity(); drawCurve(); } });
  const sCtl = segmented({ label: 'State', options: [{ value: 'bonding', label: 'Bonding' }, { value: 'antibonding', label: 'Antibonding' }], value: state, onChange: (v) => { state = v; drawDensity(); drawCurve(); } });
  const vCtl = segmented({ label: 'Show', options: [{ value: 'density', label: 'Electron density' }, { value: 'difference', label: 'What changed' }], value: view, onChange: (v) => { view = v; drawDensity(); } });
  controls.append(rCtl.el, sCtl.el, vCtl.el);
  onThemeChange(drawCurve);
  drawDensity();
  drawCurve();
}
