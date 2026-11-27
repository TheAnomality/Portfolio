// Electrons added one at a time: orbital filling and the periodic table taking shape.
import { h, isDark, onThemeChange, reducedMotion, liveRegion } from '../lib/dom.js';
import { getElements } from '../lib/data.js';
import { MADELUNG, subshellName, occupancy, madelungOccupancy, configHTML, hundFill, BLOCK_NAME } from '../lib/elements.js';
import { BLOCK_COLORS } from '../lib/color.js';
import { slider, button } from '../lib/controls.js';

export async function mount(el) {
  const E = await getElements();
  const announce = liveRegion(el);
  let Z = 26, playing = false, timer = null;

  const frame = h('div.fig__frame');
  const split = h('div.fig-split.auf');
  const ladder = h('div.auf-ladder');
  const right = h('div.fig-side.auf-right');
  split.append(ladder, right);
  const controls = h('div.fig__controls');
  frame.append(split, controls);
  el.prepend(frame);

  // ---- ladder of subshells in filling order
  const rows = new Map();
  ladder.append(h('div.auf-ladder__head', null, h('span', null, 'Filling order'), h('span', null, 'lower energy ↓ fills first')));
  const list = h('div.auf-list');
  [...MADELUNG].reverse().forEach(([n, l]) => {
    const key = subshellName(n, l);
    const boxes = h('div.auf-boxes');
    for (let i = 0; i < 2 * l + 1; i++) boxes.append(h('span.obox', null, h('i.up'), h('i.dn')));
    const row = h('div.auf-row', { dataset: { block: 'spdf'[l], nl: n + l } }, h('span.auf-lab', null, key), boxes, h('span.auf-count'));
    rows.set(key, row);
    list.append(row);
  });
  ladder.append(list);

  // ---- mini periodic table
  const mini = h('div.auf-mini', { 'aria-hidden': 'true' });
  const cells = new Map();
  for (const e of E.list) {
    const c = h('span.auf-cell', { style: { gridColumn: String(e.x), gridRow: String(e.y) } }, e.sym);
    cells.set(e.z, c);
    mini.append(c);
  }
  const info = h('div.auf-info');
  right.append(mini, info);

  function render(prevZ) {
    const dark = isDark();
    const e = E.byZ(Z);
    const occ = occupancy(e);
    const mad = madelungOccupancy(Z);
    const exception = Z <= 103 && ([...occ].some(([k, c]) => (mad.get(k) || 0) !== c) || [...mad].some(([k, c]) => (occ.get(k) || 0) !== c));
    // which subshell gained the newest electron (compared with Z-1)
    let newest = null;
    if (prevZ === Z - 1 && Z > 1) {
      const before = occupancy(E.byZ(Z - 1));
      for (const [k, c] of occ) if (c > (before.get(k) || 0)) newest = k;
    }
    for (const [key, row] of rows) {
      const l = 'spdf'.indexOf(key[1]);
      const c = occ.get(key) || 0;
      const fill = hundFill(l, c);
      row.querySelectorAll('.obox').forEach((b, i) => {
        b.querySelector('.up').textContent = fill[i][0] ? '↑' : '';
        b.querySelector('.dn').textContent = fill[i][1] ? '↓' : '';
      });
      row.querySelector('.auf-count').textContent = c ? `${c}/${2 * (2 * l + 1)}` : '';
      row.dataset.filled = c === 2 * (2 * l + 1) ? 'full' : c ? 'part' : 'empty';
      row.dataset.newest = String(key === newest);
      row.dataset.diff = String(exception && (mad.get(key) || 0) !== c);
      row.style.setProperty('--blk', BLOCK_COLORS[key[1]][dark ? 'dark' : 'light']);
    }
    for (const [z, c] of cells) {
      const ee = E.byZ(z);
      c.style.background = z <= Z ? BLOCK_COLORS[ee.block][dark ? 'dark' : 'light'] : 'transparent';
      c.dataset.state = z === Z ? 'current' : z < Z ? 'done' : 'todo';
    }
    const lastKey = [...occ.keys()].pop();
    info.innerHTML = `
      <div class="auf-info__z">${Z}</div>
      <div><div class="auf-info__name">${e.name}</div>
      <div class="auf-info__cfg">${configHTML(e)}</div>
      <div class="auf-info__shells">Electrons per shell: ${e.shells.join(' · ')}</div></div>
      <p class="auf-info__note">${exception
        ? `<b>An exception.</b> The filling rule predicts ${[...mad].slice(-2).map(([k, c]) => `${k}<sup>${c}</sup>`).join(' ')}, but the measured ground state is ${e.valence.slice(-2).map(([n, l, c]) => `${n}${'spdf'[l]}<sup>${c}</sup>`).join(' ')}. Nearby subshells are so close in energy that electron repulsion tips the balance.`
        : `${BLOCK_NAME[e.block]}: ${Z === 1 ? 'the first electron enters 1s.' : `outer electrons in ${e.valence.map(([n, l]) => `${n}${'spdf'[l]}`).join(', ')}.`} ${e.cfgPredicted ? 'Configuration predicted by theory.' : ''}`}</p>`;
    announce(`${e.name}, ${Z} electrons`);
  }

  const zCtl = slider({ label: 'Electrons (Z)', min: 1, max: 118, step: 1, value: Z, width: 'clamp(10rem, 34vw, 22rem)', format: (v) => String(v),
    onInput: (v) => { const p = Z; Z = v; render(p); } });
  const stepBack = button({ label: '', icon: 'minus', title: 'Remove an electron', onClick: () => { if (Z > 1) { const p = Z; Z--; zCtl.set(Z); render(p); } } });
  const stepFwd = button({ label: '', icon: 'plus', title: 'Add an electron', onClick: () => { if (Z < 118) { const p = Z; Z++; zCtl.set(Z); render(p); } } });
  stepBack.setAttribute('aria-label', 'Remove an electron');
  stepFwd.setAttribute('aria-label', 'Add an electron');
  const play = button({ label: 'Build from hydrogen', icon: 'play', primary: true, onClick: () => toggle() });
  controls.append(zCtl.el, stepBack, stepFwd, h('span.spacer'), play);

  function toggle() {
    playing = !playing;
    play.querySelector('span').textContent = playing ? 'Pause' : 'Build from hydrogen';
    clearInterval(timer);
    if (playing) {
      if (Z >= 118) { Z = 0; }
      timer = setInterval(() => {
        if (Z >= 118) { toggle(); return; }
        const p = Z; Z++; zCtl.set(Z); render(p);
      }, reducedMotion() ? 900 : 420);
    }
  }
  onThemeChange(() => render(Z));
  render(Z);
  return { pause() { if (playing) toggle(); } };
}
