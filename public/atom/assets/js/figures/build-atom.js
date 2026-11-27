// Build an atom from protons, neutrons and electrons, checked against real nuclear data.
import { h, isDark, onThemeChange, reducedMotion, liveRegion, cssVar } from '../lib/dom.js';
import { getElements, getNuclides, decayClass, DECAY_LABEL, DECAY_SHORT } from '../lib/data.js';
import { ionOccupancy, shellsFromOcc, orbitalBoxesHTML, occHTML } from '../lib/elements.js';
import { categoryColor } from '../lib/color.js';
import { button } from '../lib/controls.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { halfLife, sig, fix } from '../lib/format.js';
import { rng } from '../lib/hydrogen.js';

const GOALS = [
  { text: 'Make a hydrogen atom', test: (s) => s.p === 1 && s.n === 0 && s.e === 1 },
  { text: 'Make carbon-14, the radiocarbon dating isotope', test: (s) => s.p === 6 && s.n === 8 },
  { text: 'Make an alpha particle: a helium nucleus with no electrons', test: (s) => s.p === 2 && s.n === 2 && s.e === 0 },
  { text: 'Make a fluoride ion, F⁻', test: (s) => s.p === 9 && s.n === 10 && s.e === 10 },
  { text: 'Make the heaviest stable isotope of oxygen', test: (s) => s.p === 8 && s.n === 10 },
  { text: 'Make a nucleus that has never been observed', test: (s, N) => s.p + s.n > 1 && !N.get(s.p, s.n) },
];

function nucleonLayout(count, seed) {
  // Vogel's sunflower packing, then shuffled proton/neutron assignment
  const pts = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(i + 0.5);
    pts.push([r * Math.cos(i * ga), r * Math.sin(i * ga), i]);
  }
  return pts;
}

export async function mount(el) {
  const [E, N] = await Promise.all([getElements(), getNuclides()]);
  const announce = liveRegion(el);
  const state = { p: 6, n: 6, e: 6 };
  const done = new Set();

  const frame = h('div.fig__frame.ba');
  const grid = h('div.ba-grid');
  const stage = h('div.ba-stage');
  const card = h('div.ba-card');
  grid.append(stage, card);
  frame.append(grid);
  el.prepend(frame);

  const cv = setupCanvas(stage, { height: (w) => Math.max(340, Math.min(520, w * 0.9)), onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');

  // particle controls
  const ctrls = h('div.ba-ctrls');
  const makeCtl = (key, label, cls, max) => {
    const val = h('output.ba-count');
    const minus = button({ label: '', icon: 'minus', onClick: () => change(key, -1) });
    const plus = button({ label: '', icon: 'plus', onClick: () => change(key, +1) });
    minus.setAttribute('aria-label', `Remove a ${label.toLowerCase()}`);
    plus.setAttribute('aria-label', `Add a ${label.toLowerCase()}`);
    const row = h('div.ba-ctl', null, h(`span.dot.${cls}`), h('span.ba-label', null, label), minus, val, plus);
    ctrls.append(row);
    return { val, minus, plus, max };
  };
  const ctl = {
    p: makeCtl('p', 'Protons', 'dot--p', 118),
    n: makeCtl('n', 'Neutrons', 'dot--n', 180),
    e: makeCtl('e', 'Electrons', 'dot--e', 119),
  };
  const goalsEl = h('ol.ba-goals');
  const resetBtn = button({ label: 'Empty', icon: 'reset', ghost: true, onClick: () => { state.p = 0; state.n = 0; state.e = 0; update(); } });
  stage.append(h('div.ba-overlay', null, ctrls));
  const info = h('div.ba-info');
  card.append(info, h('div.ba-goals-wrap', null, h('div.ba-h', null, 'Challenges'), goalsEl), h('div.row', { style: { marginTop: '.6rem' } }, resetBtn));

  function change(key, d) {
    const max = key === 'e' ? state.p + 1 : ctl[key].max;
    state[key] = Math.max(0, Math.min(max, state[key] + d));
    if (key === 'p' && state.e > state.p + 1) state.e = state.p + 1;
    update();
  }

  document.addEventListener('keydown', (e) => {
    if (!el.isConnected || e.target.closest('input,select,textarea')) return;
    const map = { p: ['p', 1], P: ['p', -1], n: ['n', 1], N: ['n', -1], e: ['e', 1], E: ['e', -1] };
    if (map[e.key] && el.matches(':hover, :focus-within')) { change(...map[e.key]); }
  });

  let layout = nucleonLayout(state.p + state.n);
  let roles = [];
  function assignRoles() {
    const total = state.p + state.n;
    layout = nucleonLayout(total);
    // interleave protons and neutrons evenly with a deterministic shuffle
    const r = rng(total * 7 + state.p);
    roles = Array.from({ length: total }, (_, i) => (i < state.p ? 'p' : 'n'));
    for (let i = roles.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [roles[i], roles[j]] = [roles[j], roles[i]]; }
  }

  function nucleusStatus() {
    const { p, n } = state;
    if (p + n === 0) return { cls: 'none', text: 'Empty: add some particles.' };
    if (p === 0) {
      if (n === 1) { const r = N.get(0, 1); return { cls: 'radio', text: `A lone neutron. It is not an element, and outside a nucleus it decays into a proton, an electron and an antineutrino with a half-life of ${halfLife(r.hl)}.`, nuc: r }; }
      return { cls: 'unbound', text: 'Neutrons alone do not stick together. Clusters of two or more neutrons fall apart almost instantly (inside neutron stars, gravity does the binding).' };
    }
    const r = N.get(p, n);
    if (!r) {
      const iso = N.byZ.get(p) || [];
      const nmin = Math.min(...iso.map((x) => x.n)), nmax = Math.max(...iso.map((x) => x.n));
      const side = n < nmin ? 'too few neutrons' : n > nmax ? 'too many neutrons' : 'an unmeasured combination';
      return { cls: 'unbound', text: `Never observed. With ${side}, this nucleus would ${n < nmin || n > nmax ? 'fall apart almost instantly, or has yet to be made' : 'be expected to exist, but no one has measured it yet'}. Known ${E.byZ(p).name.toLowerCase()} isotopes have ${nmin} to ${nmax} neutrons.` };
    }
    if (r.hl === -1) return { cls: 'stable', text: `Stable${r.abundance != null ? `: makes up ${sig(r.abundance, 3)}% of natural ${E.byZ(p).name.toLowerCase()}` : ''}.`, nuc: r };
    const modes = (r.decay || []).map((d) => DECAY_LABEL[d[0]] || d[0]);
    return { cls: 'radio', text: `Radioactive. Half-life ${r.hl != null ? halfLife(r.hl) : 'unknown'}${modes.length ? `; decays by ${modes.slice(0, 2).join(' or ')}` : ''}.${r.abundance != null ? ` Found in nature (${sig(r.abundance, 3)}%).` : ''}`, nuc: r };
  }

  function update() {
    for (const k of ['p', 'n', 'e']) {
      ctl[k].val.textContent = String(state[k]);
      ctl[k].minus.disabled = state[k] === 0;
      ctl[k].plus.disabled = state[k] >= (k === 'e' ? state.p + 1 : ctl[k].max);
    }
    assignRoles();
    renderInfo();
    renderGoals();
    draw();
  }

  function renderInfo() {
    const { p, n, e } = state;
    const el2 = p ? E.byZ(p) : null;
    const A = p + n, charge = p - e;
    const st = nucleusStatus();
    const dark = isDark();
    const chargeStr = charge === 0 ? '' : `${Math.abs(charge) > 1 ? Math.abs(charge) : ''}${charge > 0 ? '+' : '−'}`;
    let ionNote = '';
    if (p && charge > 0) ionNote = `A positive ion (cation): ${charge} electron${charge > 1 ? 's' : ''} short.`;
    else if (p && charge < 0) ionNote = el2.ea != null ? 'A negative ion (anion): one extra electron, held because this element has a positive electron affinity.' : `A negative ion that cannot last: ${el2.name.toLowerCase()} has no stable anion, so the extra electron would fly off.`;
    else if (p) ionNote = 'A neutral atom: electrons balance protons.';
    let cfg = '';
    if (p && e > 0) {
      const occ = ionOccupancy(el2, e);
      cfg = `<div class="ba-h">Electron configuration</div><div class="ba-cfg">${occHTML(occ)}</div>${orbitalBoxesHTML(occ, { only: [...occ.keys()].slice(-3) })}`;
    }
    info.innerHTML = `
      <div class="ba-head">
        <div class="ba-tile" style="background:${el2 ? categoryColor(el2.cat, dark) : 'var(--bg-sunk)'}">
          <span class="ba-iso"><sup>${A || ''}</sup><sub>${p || ''}</sub></span><span class="ba-sym">${el2 ? el2.sym : p === 0 && n ? 'n' : '?'}</span><span class="ba-chg">${chargeStr}</span>
        </div>
        <div>
          <div class="ba-name">${el2 ? `${el2.name}${A ? `-${A}` : ''}` : n ? (n === 1 ? 'Free neutron' : `${n} neutrons`) : 'Nothing yet'}</div>
          <div class="ba-sub">${p} proton${p === 1 ? '' : 's'} · ${n} neutron${n === 1 ? '' : 's'} · ${e} electron${e === 1 ? '' : 's'}</div>
          <div class="ba-sub">${ionNote}</div>
        </div>
      </div>
      <div class="ba-status ba-status--${st.cls}">${st.text}</div>
      <div class="ba-mini-wrap"><canvas class="ba-mini" width="240" height="160" aria-label="Neighbourhood on the chart of nuclides"></canvas><p class="ba-mini-note">Neighbourhood on the <a href="nuclides.html${p ? `#${el2.sym}-${A}` : ''}">chart of nuclides</a>: black squares are stable.</p></div>
      ${cfg}`;
    drawMini(info.querySelector('.ba-mini'));
    announce(`${el2 ? el2.name : 'No element'}, mass number ${A}, charge ${charge}. ${st.text}`);
  }

  function drawMini(c) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth || 240, H = 160;
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const cell = 14, cols = Math.floor(W / cell), rows = Math.floor(H / cell);
    const n0 = state.n - Math.floor(cols / 2), z0 = state.p - Math.floor(rows / 2);
    const col = (cls) => cssVar({ stable: '--dm-stable', bminus: '--dm-bminus', bplus: '--dm-bplus', alpha: '--dm-alpha', sf: '--dm-sf', p: '--dm-p', n: '--dm-n', unknown: '--dm-unknown' }[cls]);
    g.fillStyle = cssVar('--bg-sunk');
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const nn = n0 + i, zz = z0 + (rows - 1 - j);
      const r = N.get(zz, nn);
      if (!r) continue;
      g.fillStyle = col(decayClass(r));
      g.fillRect(i * cell + 1, j * cell + 1, cell - 2, cell - 2);
    }
    const ci = state.n - n0, cj = rows - 1 - (state.p - z0);
    g.strokeStyle = '#e5603f';
    g.lineWidth = 2.5;
    g.strokeRect(ci * cell - 0.5, cj * cell - 0.5, cell + 1, cell + 1);
    g.fillStyle = cssVar('--ink-3');
    g.font = FONT.sans(9.5);
    g.fillText('neutrons →', W - 58, H - 4);
    g.save(); g.translate(9, 58); g.rotate(-Math.PI / 2); g.fillText('protons →', 0, 0); g.restore();
  }

  function renderGoals() {
    goalsEl.innerHTML = '';
    GOALS.forEach((g, i) => {
      if (g.test(state, N)) done.add(i);
      goalsEl.append(h('li', { dataset: { done: String(done.has(i)) } }, g.text));
    });
  }

  // ---------- drawing the atom
  let t = 0;
  function draw() {
    const { ctx, w, h: hh } = cv;
    ctx.fillStyle = '#0a0b0e';
    ctx.fillRect(0, 0, w, hh);
    const cx = w / 2, cy = hh * 0.55;
    const total = state.p + state.n;
    const occ = state.p && state.e ? ionOccupancy(E.byZ(state.p), state.e) : null;
    const shells = occ ? shellsFromOcc(occ) : state.e ? [state.e] : [];
    const maxR = Math.min(w, hh * 0.95) * 0.44;
    const nucR = Math.max(10, Math.min(maxR * 0.34, 7 * Math.sqrt(total + 1)));
    const pr = total ? Math.max(2.4, Math.min(11, nucR / Math.sqrt(total + 0.5) * 0.98)) : 0;
    // shells (schematic)
    const nS = shells.length;
    shells.forEach((count, i) => {
      const r = nucR + 16 + ((maxR - nucR - 16) * (i + 1)) / Math.max(nS, 1);
      ctx.strokeStyle = 'rgba(111,178,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      const speed = reducedMotion() ? 0 : 0.5 / (i + 1);
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + t * speed + i;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
        g.addColorStop(0, 'rgba(111,178,255,0.9)'); g.addColorStop(1, 'rgba(111,178,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d6e8ff'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
      }
    });
    // nucleus
    const spacing = pr * 1.75;
    const order = layout.map((p, i) => [p, roles[i]]).sort((a, b) => a[0][1] - b[0][1]);
    for (const [[x, y, i], role] of order) {
      const jx = reducedMotion() ? 0 : Math.sin(t * 3 + i * 1.7) * pr * 0.06, jy = reducedMotion() ? 0 : Math.cos(t * 2.6 + i * 2.3) * pr * 0.06;
      const px = cx + x * spacing + jx, py = cy + y * spacing + jy;
      const base = role === 'p' ? [224, 82, 59] : [140, 148, 164];
      const g = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
      g.addColorStop(0, `rgb(${base.map((c) => Math.min(255, c + 70)).join(',')})`);
      g.addColorStop(1, `rgb(${base.map((c) => Math.round(c * 0.55)).join(',')})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#6e6b65';
    ctx.font = FONT.sans(10.5);
    ctx.textAlign = 'left';
    ctx.fillText(w < 520 ? 'Not to scale: real nuclei are far smaller.' : 'Not to scale: a real nucleus is tens of thousands of times smaller than the atom.', 12, hh - 12);
    cv.canvas.setAttribute('aria-label', `Atom with ${state.p} protons, ${state.n} neutrons and ${state.e} electrons.`);
  }

  let raf = 0, running = false;
  function loop() { if (!running) return; t += 1 / 60; draw(); raf = requestAnimationFrame(loop); }
  onThemeChange(() => update());
  update();
  return {
    resume() { if (running || reducedMotion()) return; running = true; raf = requestAnimationFrame(loop); },
    pause() { running = false; cancelAnimationFrame(raf); },
  };
}
