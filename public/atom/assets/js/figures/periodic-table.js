// The periodic table tool: property maps, state at any temperature, trends, details.
import { h, isDark, onThemeChange, tooltip } from '../lib/dom.js';
import { getElements, getNuclides, getSpectra } from '../lib/data.js';
import { categoryColor, CATEGORY, BLOCK_COLORS, EMBER_LIGHT, EMBER_DARK } from '../lib/color.js';
import { configHTML, weightHTML, BLOCK_NAME } from '../lib/elements.js';
import { segmented, select, slider } from '../lib/controls.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { linear, log, drawAxes, theme } from '../lib/plot.js';
import { fix, sig, minus } from '../lib/format.js';
import { renderElementDetail } from '../lib/element-detail.js';

const PROPS = {
  weight: { label: 'Atomic weight', get: (e) => (e.stableIsotopes > 0 || [83, 90, 91, 92].includes(e.z) ? parseFloat(e.weight) : null), fmt: (v) => sig(v, 4), unit: '' },
  en: { label: 'Electronegativity', get: (e) => e.en, fmt: (v) => fix(v, 2), unit: '(Pauling)' },
  ie: { label: 'Ionisation energy', get: (e) => e.ie, fmt: (v) => fix(v, 2), unit: 'eV' },
  ea: { label: 'Electron affinity', get: (e) => e.ea, fmt: (v) => fix(v, 2), unit: 'eV' },
  radius: { label: 'Atomic radius (van der Waals)', get: (e) => e.radius, fmt: (v) => fix(v, 0), unit: 'pm' },
  mp: { label: 'Melting point', get: (e) => e.mp, fmt: (v) => fix(v, 0), unit: 'K' },
  bp: { label: 'Boiling point', get: (e) => e.bp, fmt: (v) => fix(v, 0), unit: 'K' },
  density: { label: 'Density', get: (e) => e.density, fmt: (v) => sig(v, 3), unit: 'g/cm³', log: true },
  crust: { label: 'Abundance in Earth’s crust', get: (e) => e.crust, fmt: (v) => sig(v, 2), unit: 'mg/kg', log: true },
  ocean: { label: 'Abundance in seawater', get: (e) => e.ocean, fmt: (v) => sig(v, 2), unit: 'mg/L', log: true },
  year: { label: 'Year of discovery', get: (e) => (e.year === 'Ancient' ? 1650 : parseInt(e.year) || null), fmt: (v) => (v <= 1650 ? 'ancient' : String(v)), unit: '' },
  stable: { label: 'Number of stable isotopes', get: (e) => e.stableIsotopes, fmt: (v) => String(v), unit: '' },
};

const STATE_COLORS = {
  solid: { light: 'oklch(0.83 0.02 250)', dark: 'oklch(0.36 0.02 250)', label: 'Solid' },
  liquid: { light: 'oklch(0.74 0.11 235)', dark: 'oklch(0.48 0.11 235)', label: 'Liquid' },
  gas: { light: 'oklch(0.88 0.09 75)', dark: 'oklch(0.5 0.09 70)', label: 'Gas' },
  unknown: { light: 'oklch(0.93 0.005 80)', dark: 'oklch(0.25 0.005 80)', label: 'Unknown' },
};

function relLum(css) {
  // crude: parse oklch L or rgb() for text contrast decisions
  const m = /oklch\(([\d.]+)/.exec(css);
  if (m) return parseFloat(m[1]);
  const r = /rgba?\((\d+),(\d+),(\d+)/.exec(css);
  if (r) return (0.2126 * r[1] + 0.7152 * r[2] + 0.0722 * r[3]) / 255;
  return 0.8;
}

export async function mount(root) {
  const E = await getElements();
  let nuclides = null, spectra = null;
  const extra = Promise.all([getNuclides(), getSpectra()]).then(([n, s]) => { nuclides = n; spectra = s; });

  let mode = 'category', prop = 'en', temp = 298, hover = null, selected = null, query = '';
  const touch = window.matchMedia('(hover: none)').matches;
  const hiddenCats = new Set();

  // ---------- toolbar
  const toolbar = h('div.pt-toolbar');
  const modeCtl = segmented({ label: 'Colour by', options: [
    { value: 'category', label: 'Category' }, { value: 'block', label: 'Block' }, { value: 'state', label: 'State' }, { value: 'prop', label: 'Property' },
  ], value: mode, onChange: (v) => { mode = v; update(); } });
  const propCtl = select({ options: Object.entries(PROPS).map(([k, v]) => ({ value: k, label: v.label })), value: prop, ariaLabel: 'Property', onChange: (v) => { prop = v; if (mode !== 'prop') { mode = 'prop'; modeCtl.set('prop'); } update(); } });
  const tempCtl = slider({ label: 'Temperature', min: 0, max: 6000, step: 1, value: temp, width: 'clamp(8rem, 20vw, 14rem)',
    format: (v) => `${fix(v, 0)} K <span class="muted">(${minus(fix(v - 273.15, 0))} °C)</span>`, onInput: (v) => { temp = v; update(); } });
  const search = h('label.pt-search', null,
    h('span.sr-only', null, 'Find an element'),
    h('input', { type: 'search', placeholder: 'Find: name, symbol or number', autocomplete: 'off' }));
  search.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.6 10.6 14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>');
  const searchInput = search.querySelector('input');
  searchInput.addEventListener('input', () => { query = searchInput.value.trim().toLowerCase(); update(); });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const m = matches();
      if (m.length) open(m[0]);
    }
  });
  toolbar.append(modeCtl.el, propCtl.el, tempCtl.el, h('span.spacer'), search);
  const legend = h('div.pt-legend', { 'aria-live': 'polite' });

  // ---------- table
  const scroll = h('div.pt-scroll');
  const grid = h('div.ptable', { role: 'group', 'aria-label': 'Periodic table of the elements' });
  scroll.append(grid);
  const card = h('div.pt-card', { 'aria-hidden': 'true' });
  grid.append(card);
  // group numbers above row 1 are folded into the first row cells' title; label f-block rows
  grid.append(h('div.pcell.pcell--label', { style: { gridColumn: '1 / 3', gridRow: '9' } }, 'f-block, period 6'));
  grid.append(h('div.pcell.pcell--label', { style: { gridColumn: '1 / 3', gridRow: '10' } }, 'f-block, period 7'));

  const cells = new Map();
  for (const e of E.list) {
    const b = h('button.pcell', { type: 'button', style: { gridColumn: String(e.x), gridRow: String(e.y) }, 'aria-label': `${e.name}, element ${e.z}`, dataset: { z: e.z } },
      h('span.z', null, String(e.z)), h('span.s', null, e.sym), h('span.nm', null, e.name), h('span.v'));
    b.addEventListener('mouseenter', () => setHover(e));
    b.addEventListener('focus', () => setHover(e));
    b.addEventListener('click', () => open(e));
    b.addEventListener('keydown', (ev) => navKey(ev, e));
    cells.set(e.z, b);
    grid.append(b);
  }
  grid.addEventListener('mouseleave', () => setHover(null));

  const note = h('p.pt-note', null, 'Group 3 follows the 2021 IUPAC recommendation, with lutetium and lawrencium below yttrium; the f-block rows hold lanthanum to ytterbium and actinium to nobelium. Values for the heaviest elements are often predictions.');

  // ---------- trend chart
  const trend = h('section.pt-trend');
  const trendTitle = h('h2');
  const trendWrap = h('div.plot');
  trend.append(trendTitle, trendWrap);
  const tip = tooltip(trendWrap);

  root.append(toolbar, legend, scroll, note, trend);
  const cv = setupCanvas(trendWrap, { height: (w) => Math.max(240, Math.min(320, w * 0.28)), onResize: () => drawTrend() });

  // ---------- drawer
  const backdrop = h('div.drawer-backdrop', { hidden: true });
  const drawer = h('aside.drawer', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ed-title', hidden: true });
  const bar = h('div.drawer__bar');
  const prevBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Previous element', html: '<svg viewBox="0 0 16 16"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
  const nextBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Next element', html: '<svg viewBox="0 0 16 16"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
  const closeBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Close', html: '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' });
  const barTitle = h('span.sans', { style: { fontSize: '.85rem', color: 'var(--ink-3)' } });
  bar.append(prevBtn, nextBtn, barTitle, h('span.spacer'), closeBtn);
  const body = h('div.drawer__body');
  drawer.append(bar, body);
  document.body.append(backdrop, drawer);
  prevBtn.addEventListener('click', () => selected && open(E.byZ(selected.z === 1 ? 118 : selected.z - 1)));
  nextBtn.addEventListener('click', () => selected && open(E.byZ(selected.z === 118 ? 1 : selected.z + 1)));
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (drawer.dataset.open !== 'true') return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft' && !e.target.closest('input,select')) prevBtn.click();
    if (e.key === 'ArrowRight' && !e.target.closest('input,select')) nextBtn.click();
  });

  let lastFocus = null;
  async function open(e) {
    if (!drawer.hidden && selected?.z === e.z) return;
    if (drawer.hidden) lastFocus = document.activeElement;
    selected = e;
    for (const [z, c] of cells) c.dataset.selected = String(z === e.z);
    backdrop.hidden = false; drawer.hidden = false;
    requestAnimationFrame(() => { backdrop.dataset.open = 'true'; drawer.dataset.open = 'true'; });
    barTitle.textContent = `${e.z} of 118`;
    body.innerHTML = '<div class="skeleton" style="height:6rem"></div>';
    await extra.catch(() => {});
    if (selected !== e) return;
    renderElementDetail(body, e, { E, nuclides, spectra });
    drawer.scrollTop = 0;
    history.replaceState(null, '', `#${e.sym}`);
    closeBtn.focus({ preventScroll: true });
  }
  function close() {
    drawer.dataset.open = 'false'; backdrop.dataset.open = 'false';
    setTimeout(() => { drawer.hidden = true; backdrop.hidden = true; }, 280);
    for (const c of cells.values()) c.dataset.selected = 'false';
    selected = null;
    history.replaceState(null, '', location.pathname + location.search);
    lastFocus?.focus?.({ preventScroll: true });
  }

  // ---------- keyboard navigation across the grid
  function navKey(ev, e) {
    const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    let x = e.x, y = e.y;
    for (let i = 0; i < 20; i++) {
      x += d[0]; y += d[1];
      if (y === 8) y += d[1];
      if (x < 1 || x > 18 || y < 1 || y > 10) return;
      const t = E.list.find((q) => q.x === x && q.y === y);
      if (t) { cells.get(t.z).focus(); return; }
    }
  }

  // ---------- colouring
  function stateAt(e, T) {
    if (e.mp == null && e.bp == null) return 'unknown';
    if (e.mp != null && T < e.mp) return 'solid';
    if (e.bp != null && T >= e.bp) return 'gas';
    if (e.mp != null && T >= e.mp) return 'liquid';
    return 'unknown';
  }

  function propRange(p) {
    const vals = E.list.map((e) => PROPS[p].get(e)).filter((v) => v != null && (!PROPS[p].log || v > 0));
    return [Math.min(...vals), Math.max(...vals)];
  }

  function colorFor(e, dark) {
    if (mode === 'category') return categoryColor(e.cat, dark);
    if (mode === 'block') return BLOCK_COLORS[e.block][dark ? 'dark' : 'light'];
    if (mode === 'state') return STATE_COLORS[stateAt(e, temp)][dark ? 'dark' : 'light'];
    const P = PROPS[prop];
    const v = P.get(e);
    if (v == null || (P.log && v <= 0)) return dark ? 'oklch(0.24 0.005 80)' : 'oklch(0.94 0.005 80)';
    const [a, b] = propRange(prop);
    const t = P.log ? (Math.log10(v) - Math.log10(a)) / (Math.log10(b) - Math.log10(a)) : (v - a) / (b - a || 1);
    return (dark ? EMBER_DARK : EMBER_LIGHT).css(Math.max(0, Math.min(1, t)));
  }

  function matches() {
    if (!query) return [];
    return E.list.filter((e) => e.name.toLowerCase().startsWith(query) || e.sym.toLowerCase() === query || String(e.z) === query);
  }

  function update() {
    const dark = isDark();
    tempCtl.el.style.display = mode === 'state' ? '' : 'none';
    propCtl.el.style.opacity = mode === 'prop' ? '1' : '.55';
    const found = new Set(matches().map((e) => e.z));
    for (const e of E.list) {
      const c = cells.get(e.z);
      const bg = colorFor(e, dark);
      c.style.setProperty('--cell-bg', bg);
      const L = relLum(bg);
      c.style.setProperty('--cell-ink', L > 0.62 ? '#1a1915' : '#f4f1ea');
      const dimCat = mode === 'category' && hiddenCats.has(e.cat);
      c.dataset.dim = String((query && !found.has(e.z)) || dimCat);
      c.querySelector('.v').textContent = mode === 'prop' ? (PROPS[prop].get(e) != null ? PROPS[prop].fmt(PROPS[prop].get(e)) : '—') : mode === 'state' ? '' : '';
      const extraLabel = mode === 'prop' && PROPS[prop].get(e) != null ? `, ${PROPS[prop].label} ${PROPS[prop].fmt(PROPS[prop].get(e))} ${PROPS[prop].unit}` : mode === 'state' ? `, ${stateAt(e, temp)} at ${temp} K` : `, ${e.cat}`;
      c.setAttribute('aria-label', `${e.name}, element ${e.z}${extraLabel}`);
    }
    drawLegend(dark);
    setHover(hover);
    drawTrend();
  }

  function drawLegend(dark) {
    legend.innerHTML = '';
    if (mode === 'category') {
      for (const [cat, info] of Object.entries(CATEGORY)) {
        const b = h('button', { type: 'button', 'aria-pressed': String(!hiddenCats.has(cat)), title: 'Click to highlight or hide' },
          h('i', { style: { background: categoryColor(cat, dark) } }), info.label);
        b.addEventListener('click', () => { hiddenCats.has(cat) ? hiddenCats.delete(cat) : hiddenCats.add(cat); update(); });
        legend.append(b);
      }
    } else if (mode === 'block') {
      for (const k of ['s', 'p', 'd', 'f']) legend.append(h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '.4rem' } }, h('i', { style: { background: BLOCK_COLORS[k][dark ? 'dark' : 'light'] } }), `${BLOCK_NAME[k]}: last electron enters an ${k} orbital`));
    } else if (mode === 'state') {
      const counts = { solid: 0, liquid: 0, gas: 0, unknown: 0 };
      for (const e of E.list) counts[stateAt(e, temp)]++;
      for (const [k, v] of Object.entries(STATE_COLORS)) legend.append(h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '.4rem' } }, h('i', { style: { background: v[dark ? 'dark' : 'light'] } }), `${v.label} (${counts[k]})`));
      legend.append(h('span.muted', null, `at ${fix(temp, 0)} K and standard pressure`));
    } else {
      const P = PROPS[prop];
      const [a, b] = propRange(prop);
      const cmap = dark ? EMBER_DARK : EMBER_LIGHT;
      const stops = Array.from({ length: 12 }, (_, i) => cmap.css(i / 11)).join(',');
      legend.append(h('span.pt-ramp', null, h('span.mono', null, P.fmt(a)), h('span.pt-ramp__bar', { style: { background: `linear-gradient(90deg, ${stops})` } }), h('span.mono', null, `${P.fmt(b)} ${P.unit}`)),
        h('span.muted', null, `${P.label}${P.log ? ', logarithmic scale' : ''}. Grey: no data.`));
    }
  }

  function setHover(e) {
    hover = e;
    const show = e || selected || E.byZ(26);
    const dark = isDark();
    const bg = colorFor(show, dark);
    card.style.setProperty('--cell-bg', bg);
    card.style.setProperty('--cell-ink', relLum(bg) > 0.62 ? '#1a1915' : '#f4f1ea');
    const P = PROPS[prop];
    const val = mode === 'prop' ? `${P.label}: ${P.get(show) != null ? `${P.fmt(P.get(show))} ${P.unit}` : 'no data'}`
      : mode === 'state' ? `${stateAt(show, temp)} at ${fix(temp, 0)} K · melts ${show.mp != null ? fix(show.mp, 0) + ' K' : '?'} · boils ${show.bp != null ? fix(show.bp, 0) + ' K' : '?'}`
      : mode === 'block' ? `${BLOCK_NAME[show.block]}` : CATEGORY[show.cat]?.label.replace(/s$/, '');
    card.innerHTML = `
      <div class="pt-card__tile"><span class="z">${show.z}</span><span class="s">${show.sym}</span><span class="w">${weightHTML(show)}</span></div>
      <div>
        <div class="pt-card__name">${show.name}</div>
        <div class="pt-card__cfg">${configHTML(show)}</div>
        <div class="pt-card__val"${mode === 'prop' ? '' : ' style="font-family:var(--font-sans);font-weight:500"'}>${val}</div>
        <div class="pt-card__hint">${touch ? 'Tap any element for its full profile' : e ? 'Click for the full profile' : 'Hover over an element; click for details'}</div>
      </div>`;
    drawTrend();
  }

  // ---------- trend chart
  let trendLayout = null;
  function drawTrend() {
    const { ctx, w, h: hh } = cv;
    const t = theme();
    ctx.clearRect(0, 0, w, hh);
    const p = mode === 'prop' ? prop : 'ie';
    const P = PROPS[p];
    trendTitle.textContent = `${P.label} across the table${mode === 'prop' ? '' : ' (choose a property to change this)'}`;
    const pts = E.list.map((e) => [e.z, P.get(e), e]).filter(([, v]) => v != null && (!P.log || v > 0));
    const [a, b] = propRange(p);
    const box = { x: 54, y: 20, w: w - 54 - 14, h: hh - 20 - 40 };
    const sx = linear([0.5, 118.5], [box.x, box.x + box.w]);
    const sy = P.log ? log([a / 1.5, b * 1.5], [box.y + box.h, box.y]) : linear([Math.min(0, a), b * 1.08], [box.y + box.h, box.y]);
    // period boundaries
    ctx.fillStyle = t.ink3;
    ctx.font = FONT.sans(10);
    ctx.textAlign = 'center';
    const nobles = [2, 10, 18, 36, 54, 86, 118];
    let prev = 0;
    nobles.forEach((z, i) => {
      if (i % 2 === 1) { ctx.globalAlpha = 0.06; ctx.fillStyle = t.ink; ctx.fillRect(sx(prev + 0.5), box.y, sx(z + 0.5) - sx(prev + 0.5), box.h); ctx.globalAlpha = 1; }
      ctx.fillStyle = t.ink3;
      ctx.fillText(`period ${i + 1}`, (sx(prev + 0.5) + sx(z + 0.5)) / 2, box.y - 6);
      prev = z;
    });
    drawAxes(ctx, box, sx, sy, { xLabel: 'atomic number', xTicks: [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 118], fmtY: (v) => P.fmt(v) });
    // line with gaps for missing data
    ctx.strokeStyle = t.ink3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let pz = -1;
    for (const [z, v] of pts) { const x = sx(z), y = sy(v); z === pz + 1 ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pz = z; }
    ctx.stroke();
    const dark = isDark();
    for (const [z, v, e] of pts) {
      ctx.fillStyle = mode === 'prop' ? colorFor(e, dark) : categoryColor(e.cat, dark);
      ctx.strokeStyle = t.ink2;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(sx(z), sy(v), 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    const focus = hover || selected;
    if (focus) {
      const v = P.get(focus);
      ctx.strokeStyle = t.ink;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(sx(focus.z) + 0.5, box.y); ctx.lineTo(sx(focus.z) + 0.5, box.y + box.h); ctx.stroke();
      ctx.setLineDash([]);
      if (v != null) {
        ctx.fillStyle = t.ink;
        ctx.beginPath(); ctx.arc(sx(focus.z), sy(v), 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.font = FONT.sans(11.5, 600);
        ctx.textAlign = sx(focus.z) > box.x + box.w - 90 ? 'right' : 'left';
        ctx.fillText(`${focus.sym} ${P.fmt(v)} ${P.unit}`, sx(focus.z) + (ctx.textAlign === 'right' ? -9 : 9), sy(v) - 9);
      }
    }
    trendLayout = { sx, sy, box, pts, P };
  }
  cv.canvas.addEventListener('pointermove', (ev) => {
    if (!trendLayout) return;
    const r = cv.canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    const z = Math.round(trendLayout.sx.invert(x));
    const e = E.byZ(Math.max(1, Math.min(118, z)));
    if (x < trendLayout.box.x || x > trendLayout.box.x + trendLayout.box.w) { tip.hide(); return; }
    setHover(e);
    const v = trendLayout.P.get(e);
    tip.show(`<b>${e.name}</b> (${e.z})<br>${v != null ? `${trendLayout.P.fmt(v)} ${trendLayout.P.unit}` : 'no data'}`, x, y);
  });
  cv.canvas.addEventListener('pointerleave', () => { tip.hide(); setHover(null); });
  cv.canvas.addEventListener('click', () => hover && open(hover));

  onThemeChange(() => update());
  update();

  // deep link: table.html#Fe or #26
  const tag = decodeURIComponent(location.hash.slice(1));
  if (tag) {
    const e = E.bySym.get(tag) || (Number.isInteger(+tag) && E.byZ(+tag)) || E.list.find((q) => q.name.toLowerCase() === tag.toLowerCase());
    if (e) open(e);
  }
}
