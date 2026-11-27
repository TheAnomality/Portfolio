// Chart of nuclides: every known nucleus by proton number Z and neutron number N.
import { h, isDark, onThemeChange, tooltip, cssVar } from '../lib/dom.js';
import { getNuclides, getElements, decayClass, DECAY_LABEL, DECAY_SHORT, daughter } from '../lib/data.js';
import { segmented, button } from '../lib/controls.js';
import { FONT } from '../lib/canvas.js';
import { VIRIDIS, EMBER_LIGHT, EMBER_DARK } from '../lib/color.js';
import { halfLife, fix, int, sig } from '../lib/format.js';

const MAGIC = [2, 8, 20, 28, 50, 82, 126];
const DM_VARS = { stable: '--dm-stable', bminus: '--dm-bminus', bplus: '--dm-bplus', alpha: '--dm-alpha', sf: '--dm-sf', p: '--dm-p', n: '--dm-n', unknown: '--dm-unknown' };
const DM_LABEL = { stable: 'Stable', bminus: 'β⁻ decay', bplus: 'β⁺ / electron capture', alpha: 'α decay', sf: 'Spontaneous fission', p: 'Proton emission', n: 'Neutron emission', unknown: 'Unknown' };

export function decayChain(N, z, n, max = 40) {
  const out = [];
  let cur = N.get(z, n);
  const seen = new Set();
  while (cur && out.length < max && !seen.has(cur.z * 1000 + cur.n)) {
    seen.add(cur.z * 1000 + cur.n);
    const mode = cur.hl === -1 ? null : cur.decay?.[0]?.[0];
    out.push({ nuc: cur, mode });
    if (!mode) break;
    const d = daughter(cur.z, cur.n, mode);
    if (!d) break;
    cur = N.get(d[0], d[1]);
  }
  return out;
}

export async function mount(el, opts = {}) {
  const [N, E] = await Promise.all([getNuclides(), getElements()]);
  const full = opts.full !== undefined;
  let mode = 'decay';
  let selected = null, hover = null, chain = [];

  // ---------- DOM
  const frame = h(`div.fig__frame.nc${opts.stack !== undefined ? '.nc--stack' : ''}`);
  const top = h('div.fig__controls.nc-top');
  const stageWrap = h('div.nc-stage');
  const canvas = h('canvas', { role: 'img', 'aria-label': 'Chart of nuclides. Proton number increases upwards, neutron number to the right.' });
  stageWrap.append(canvas);
  const legend = h('div.nc-legend.legend');
  const panel = h('div.nc-panel', { 'aria-live': 'polite' });
  const body = h('div.nc-body');
  body.append(stageWrap, panel);
  frame.append(top, body, h('div.fig__controls', null, legend));
  el.prepend(frame);
  const tip = tooltip(stageWrap);

  const modeCtl = segmented({ label: 'Colour by', options: [{ value: 'decay', label: 'Decay mode' }, { value: 'hl', label: 'Half-life' }, { value: 'bea', label: 'Binding energy' }], value: mode, onChange: (v) => { mode = v; drawLegend(); draw(); } });
  const search = h('input.nc-search', { type: 'search', placeholder: 'Find a nuclide, e.g. U-238', 'aria-label': 'Find a nuclide', autocomplete: 'off' });
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') find(search.value); });
  const zin = button({ label: '', icon: 'plus', title: 'Zoom in', onClick: () => zoomAt(W / 2, H / 2, 1.6) });
  const zout = button({ label: '', icon: 'minus', title: 'Zoom out', onClick: () => zoomAt(W / 2, H / 2, 1 / 1.6) });
  const reset = button({ label: 'Whole chart', icon: 'expand', onClick: () => fitAll(true) });
  zin.setAttribute('aria-label', 'Zoom in'); zout.setAttribute('aria-label', 'Zoom out');
  top.append(modeCtl.el, h('span.spacer'), search, zin, zout, reset);

  // ---------- view state
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let scale = 4, ox = 0, oy = 0; // screen = (N * scale + ox, H - ((Z + 1) * scale) + oy)
  const maxN = N.maxN + 2, maxZ = N.maxZ + 2;
  const sxN = (n) => n * scale + ox;
  const syZ = (z) => H - (z + 1) * scale - oy;

  function resize() {
    const w = stageWrap.clientWidth;
    const hh = full ? Math.max(420, window.innerHeight - 230) : Math.max(380, Math.min(640, w * 0.62, window.innerHeight * 0.72));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = hh + 'px';
    const first = W === 0;
    W = w; H = hh;
    if (first) fitAll(false); else draw();
  }
  new ResizeObserver(() => { if (Math.abs(stageWrap.clientWidth - W) > 2) resize(); }).observe(stageWrap);

  function fitAll(animate) {
    const s = Math.min((W - 40) / maxN, (H - 30) / maxZ);
    animateView(s, 30, 20, animate);
  }
  function focus(z, n, cellPx = 34, animate = true) {
    const s = cellPx;
    const tox = W / 2 - (n + 0.5) * s;
    const toy = -(H / 2 - (H - (z + 0.5) * s));
    animateView(s, tox, toy, animate);
  }
  let anim = null;
  function animateView(s, x, y, animate) {
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { scale = s; ox = x; oy = y; draw(); return; }
    const from = { scale, ox, oy }, t0 = performance.now();
    cancelAnimationFrame(anim);
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / 600), e = t * t * (3 - 2 * t);
      // interpolate scale geometrically for a smooth zoom
      scale = from.scale * Math.pow(s / from.scale, e);
      ox = from.ox + (x - from.ox) * e; oy = from.oy + (y - from.oy) * e;
      draw();
      if (t < 1) anim = requestAnimationFrame(step);
    };
    step();
  }
  function zoomAt(px, py, f) {
    const ns = Math.max(1.5, Math.min(90, scale * f));
    // keep the chart point under (px, py) fixed while the scale changes
    const nc = (px - ox) / scale, zc = (H - py - oy) / scale;
    scale = ns;
    ox = px - nc * ns;
    oy = H - py - zc * ns;
    draw();
  }

  // ---------- colours
  let colors = {};
  function readColors() {
    for (const [k, v] of Object.entries(DM_VARS)) colors[k] = cssVar(v);
    colors.bg = cssVar('--bg-elev');
    colors.ink = cssVar('--ink'); colors.ink2 = cssVar('--ink-2'); colors.ink3 = cssVar('--ink-3'); colors.rule = cssVar('--rule');
  }
  function cellColor(r, dark) {
    if (mode === 'decay') return colors[decayClass(r)];
    if (mode === 'hl') {
      if (r.hl === -1) return colors.stable;
      if (r.hl == null) return colors.unknown;
      const t = (Math.log10(Math.max(r.hl, 1e-22)) + 22) / (Math.log10(1e18) + 22);
      return VIRIDIS.css(Math.max(0, Math.min(1, t)));
    }
    if (r.bea == null || r.bea <= 0) return colors.unknown;
    const t = (r.bea / 1000 - 5) / (8.8 - 5);
    return (dark ? EMBER_DARK : EMBER_LIGHT).css(Math.max(0, Math.min(1, t)));
  }

  // ---------- draw
  function draw() {
    if (!W) return;
    const dark = isDark();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);
    // magic numbers
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.045)';
    for (const m of MAGIC) {
      if (m <= maxN) ctx.fillRect(sxN(m), 0, scale, H);
      if (m <= maxZ) ctx.fillRect(0, syZ(m), W, scale);
    }
    const gap = scale > 6 ? Math.min(1.5, scale * 0.06) : 0;
    for (const r of N.rows) {
      const x = sxN(r.n), y = syZ(r.z);
      if (x > W || y > H || x + scale < 0 || y + scale < 0) continue;
      ctx.fillStyle = cellColor(r, dark);
      ctx.fillRect(x + gap / 2, y + gap / 2, scale - gap, scale - gap);
    }
    // labels when zoomed in
    if (scale >= 26) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const r of N.rows) {
        const x = sxN(r.n), y = syZ(r.z);
        if (x > W || y > H || x + scale < 0 || y + scale < 0) continue;
        const bg = cellColor(r, dark);
        const light = isLight(bg);
        ctx.fillStyle = light ? '#1a1915' : '#f4f1ea';
        const sym = r.z === 0 ? 'n' : E.byZ(r.z)?.sym;
        ctx.font = FONT.sans(Math.max(9, Math.min(14, scale * 0.3)), 600);
        ctx.fillText(`${sym}${r.a}`, x + scale / 2, y + scale * (scale > 44 ? 0.36 : 0.5));
        if (scale > 44) {
          ctx.font = FONT.sans(Math.max(8.5, Math.min(11, scale * 0.2)));
          ctx.fillText(r.hl === -1 ? (r.abundance != null ? `${sig(r.abundance, 3)}%` : 'stable') : halfLife(r.hl, { short: true }), x + scale / 2, y + scale * 0.68);
        }
      }
    }
    // decay chain overlay
    if (chain.length > 1) {
      const lw = Math.max(1.5, Math.min(3, scale * 0.08));
      for (const [col, w2] of [[dark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)', lw + 3], [dark ? '#ffffff' : '#111', lw]]) {
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w2;
        for (let i = 0; i < chain.length - 1; i++) {
          const a = chain[i].nuc, b = chain[i + 1].nuc;
          arrow(sxN(a.n) + scale / 2, syZ(a.z) + scale / 2, sxN(b.n) + scale / 2, syZ(b.z) + scale / 2);
        }
      }
    }
    // selection / hover outlines
    for (const [r, col, wdt] of [[hover, colors.ink2, 1.5], [selected, '#e5603f', 2.5]]) {
      if (!r) continue;
      ctx.strokeStyle = col;
      ctx.lineWidth = wdt;
      ctx.strokeRect(sxN(r.n) - 1, syZ(r.z) - 1, scale + 2, scale + 2);
    }
    drawAxes();
  }

  function arrow(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len;
    const hs = Math.max(4, Math.min(9, scale * 0.25));
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hs, y1 - uy * hs); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ux * hs - uy * hs * 0.6, y1 - uy * hs + ux * hs * 0.6); ctx.lineTo(x1 - ux * hs + uy * hs * 0.6, y1 - uy * hs - ux * hs * 0.6); ctx.closePath(); ctx.fill();
  }

  function isLight(css) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
    if (m) return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 > 0.55;
    if (css.startsWith('#')) { const v = parseInt(css.slice(1), 16); return (0.2126 * (v >> 16) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255 > 0.55; }
    return true;
  }

  function drawAxes() {
    ctx.font = FONT.sans(10.5);
    ctx.fillStyle = colors.ink3;
    // magic number labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const m of MAGIC) {
      const x = sxN(m) + scale / 2;
      if (x > 8 && x < W - 8 && scale > 2.5) ctx.fillText(String(m), x, H - 3);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const m of MAGIC) {
      const y = syZ(m) + scale / 2;
      if (y > 12 && y < H - 16 && scale > 2.5) ctx.fillText(String(m), 3, y);
    }
    // element symbols at the left end of each row when zoomed
    if (scale >= 9) {
      ctx.textAlign = 'right';
      ctx.font = FONT.sans(Math.min(13, scale * 0.45), 600);
      for (const [z, list] of N.byZ) {
        if (z === 0) continue;
        const n0 = Math.min(...list.map((r) => r.n));
        const x = sxN(n0) - 4, y = syZ(z) + scale / 2;
        if (x < 10 || x > W || y < 0 || y > H) continue;
        ctx.fillStyle = colors.ink2;
        ctx.fillText(E.byZ(z).sym, x, y);
      }
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = colors.ink3;
    ctx.font = FONT.sans(11, 500);
    ctx.fillText('neutrons (N) →', W - 8, H - 16);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('↑ protons (Z)', 22, 8);
  }

  function drawLegend() {
    const dark = isDark();
    legend.innerHTML = '';
    if (mode === 'decay') {
      for (const k of ['stable', 'bminus', 'bplus', 'alpha', 'sf', 'p', 'n', 'unknown']) legend.append(h('span', null, h('i', { style: { background: colors[k] } }), DM_LABEL[k]));
      legend.append(h('span', { style: { opacity: '.8' } }, 'Grey bands: magic numbers'));
    } else if (mode === 'hl') {
      const stops = Array.from({ length: 10 }, (_, i) => VIRIDIS.css(i / 9)).join(',');
      legend.append(h('span', null, h('i', { style: { background: colors.stable } }), 'Stable'),
        h('span', null, 'Half-life: 10⁻²² s', h('i', { style: { width: '160px', background: `linear-gradient(90deg,${stops})` } }), '10¹⁸ s (30 billion years)'));
    } else {
      const cm = dark ? EMBER_DARK : EMBER_LIGHT;
      const stops = Array.from({ length: 10 }, (_, i) => cm.css(i / 9)).join(',');
      legend.append(h('span', null, 'Binding energy per nucleon: 5 MeV', h('i', { style: { width: '160px', background: `linear-gradient(90deg,${stops})` } }), '8.8 MeV'));
    }
  }

  // ---------- interaction
  function cellAt(px, py) {
    const n = Math.floor((px - ox) / scale);
    const z = Math.floor((H - py - oy) / scale) - 0;
    return N.get(z, n) || null;
  }
  const pointers = new Map();
  let dragStart = null, moved = false, pinch0 = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    moved = false;
    if (pointers.size === 1) dragStart = { x: e.offsetX, y: e.offsetY, ox, oy };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), scale, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pointers.size === 2 && pinch0) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const target = Math.max(1.5, Math.min(90, pinch0.scale * (d / pinch0.d)));
      zoomAt(pinch0.cx, pinch0.cy, target / scale);
      moved = true;
      return;
    }
    if (dragStart && pointers.size === 1) {
      const dx = e.offsetX - dragStart.x, dy = e.offsetY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (moved) { ox = dragStart.ox + dx; oy = dragStart.oy - dy; tip.hide(); draw(); return; }
    }
    const r = cellAt(e.offsetX, e.offsetY);
    if (r !== hover) { hover = r; draw(); }
    if (r) tip.show(tipHTML(r), e.offsetX, e.offsetY); else tip.hide();
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch0 = null;
    if (pointers.size === 0) {
      if (!moved) { const r = cellAt(e.offsetX, e.offsetY); if (r) select(r); }
      dragStart = null;
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { hover = null; tip.hide(); draw(); });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  canvas.addEventListener('dblclick', (e) => zoomAt(e.offsetX, e.offsetY, 2));

  function nucName(r) {
    if (r.z === 0) return 'Free neutron';
    const e = E.byZ(r.z);
    return `${e.name}-${r.a}`;
  }
  function tipHTML(r) {
    const life = r.hl === -1 ? 'stable' : r.hl == null ? 'half-life unknown' : `half-life ${halfLife(r.hl)}`;
    const modes = (r.decay || []).map((d) => DECAY_SHORT[d[0]] || d[0]).join(', ');
    return `<b>${nucName(r)}</b><br>${r.z} protons, ${r.n} neutrons<br>${life}${modes ? ` · ${modes}` : ''}${r.abundance != null ? `<br>${sig(r.abundance, 3)}% of natural ${E.byZ(r.z).name.toLowerCase()}` : ''}`;
  }

  function select(r, zoom = false) {
    selected = r;
    chain = decayChain(N, r.z, r.n);
    renderPanel(r);
    if (zoom && opts.fitchain !== undefined && chain.length > 1) fitChain();
    else if (zoom) focus(r.z, r.n, Math.max(scale, 30));
    else draw();
  }
  function fitChain() {
    const zs = chain.map((c) => c.nuc.z), ns = chain.map((c) => c.nuc.n);
    const z0 = Math.min(...zs) - 1, z1 = Math.max(...zs) + 1, n0 = Math.min(...ns) - 1, n1 = Math.max(...ns) + 1.5;
    const s = Math.min(W / (n1 - n0), H / (z1 - z0), 60);
    const tox = W / 2 - ((n0 + n1) / 2 + 0.5) * s;
    const toy = H / 2 - ((z0 + z1) / 2 + 0.5) * s;
    animateView(s, tox, toy, false);
  }

  function renderPanel(r) {
    const e = r.z ? E.byZ(r.z) : null;
    const massDefect = r.bea != null ? (r.bea * r.a) / 1000 : null;
    const modes = (r.decay || []).map((d) => `<li>${DECAY_LABEL[d[0]] || d[0]}${d[1] != null ? ` <span class="mono">${sig(d[1], 3)}%</span>` : ''}</li>`).join('');
    const last = chain[chain.length - 1]?.nuc;
    panel.innerHTML = `
      <div class="nc-panel__k">${r.z} protons · ${r.n} neutrons</div>
      <div class="nc-panel__t">${nucName(r)}</div>
      <dl class="readouts" style="margin-top:.8rem">
        <div class="readout"><dt>Half-life</dt><dd>${r.hl === -1 ? 'stable' : r.hl == null ? 'unknown' : halfLife(r.hl)}</dd></div>
        ${r.abundance != null ? `<div class="readout"><dt>Natural abundance</dt><dd>${sig(r.abundance, 4)}%</dd></div>` : ''}
        ${r.mass != null ? `<div class="readout"><dt>Atomic mass</dt><dd>${fix(r.mass, 6)} u</dd></div>` : ''}
        ${massDefect != null && r.a > 1 ? `<div class="readout"><dt>Binding energy</dt><dd>${fix(massDefect, 2)} MeV</dd></div>` : ''}
        ${r.bea ? `<div class="readout"><dt>Per nucleon</dt><dd>${fix(r.bea / 1000, 3)} MeV</dd></div>` : ''}
        ${r.jp ? `<div class="readout"><dt>Spin, parity</dt><dd>${r.jp}</dd></div>` : ''}
        ${r.discovery ? `<div class="readout"><dt>Discovered</dt><dd>${r.discovery}</dd></div>` : ''}
      </dl>
      ${modes ? `<div class="nc-panel__h">Decays by</div><ul class="nc-modes">${modes}</ul>` : ''}
      ${chain.length > 1 ? `<div class="nc-panel__h">Decay chain (main branch)</div><ol class="nc-chain">${chain.map((c) => `<li><b>${c.nuc.z ? E.byZ(c.nuc.z).sym : 'n'}-${c.nuc.a}</b> <span>${c.mode ? `${DECAY_SHORT[c.mode] || c.mode} · ${halfLife(c.nuc.hl, { short: true })}` : c.nuc.hl === -1 ? 'stable' : ''}</span></li>`).join('')}</ol>
        <p class="nc-note">${chain.length - 1} decays to ${last && last.hl === -1 ? `stable ${nucName(last)}` : nucName(last)}.</p>` : ''}
      ${r.estimated ? '<p class="nc-note">Mass estimated from systematics, not yet measured.</p>' : ''}
      ${e ? `<p class="nc-note"><a href="table.html#${e.sym}">${e.name} in the periodic table</a></p>` : ''}`;
  }

  function find(q) {
    const s = q.trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return;
    let m = /^([a-z]+)-?(\d+)$/.exec(s) || /^(\d+)-?([a-z]+)$/.exec(s);
    let sym, a;
    if (m) { if (/^\d/.test(m[1])) { a = +m[1]; sym = m[2]; } else { sym = m[1]; a = +m[2]; } }
    else sym = s;
    const el2 = E.list.find((e) => e.sym.toLowerCase() === sym || e.name.toLowerCase() === sym);
    if (!el2) { search.setCustomValidity('Not found'); search.reportValidity(); setTimeout(() => search.setCustomValidity(''), 1500); return; }
    const list = N.byZ.get(el2.z) || [];
    let r = a ? list.find((x) => x.a === a) : (list.filter((x) => x.hl === -1).sort((p, q2) => (q2.abundance || 0) - (p.abundance || 0))[0] || list.slice().sort((p, q2) => (q2.hl || 0) - (p.hl || 0))[0]);
    if (!r) r = list[0];
    if (r) select(r, true);
  }

  // ---------- init
  readColors();
  drawLegend();
  resize();
  onThemeChange(() => { readColors(); drawLegend(); draw(); });
  panel.innerHTML = `<div class="nc-panel__k">How to read it</div><p class="nc-note" style="margin-top:.4rem">Each square is one nucleus: protons up, neutrons across. The dark diagonal band is the <b>valley of stability</b>. Hover for details; select a square to see its decay chain. Scroll or pinch to zoom, drag to pan, or search for a nuclide.</p>`;

  // deep links: #U-238, #z=26
  const hash = decodeURIComponent(location.hash.slice(1));
  const start = opts.select || (hash && !hash.startsWith('z=') ? hash : null);
  if (hash.startsWith('z=')) {
    const z = +hash.slice(2);
    const list = N.byZ.get(z);
    if (list) { const r = list.find((x) => x.hl === -1) || list[Math.floor(list.length / 2)]; select(r); focus(z, r.n, 30, false); }
  } else if (start) {
    setTimeout(() => find(start), 50);
  }
  return {};
}
