// Spectra explorer: any element's lines from NIST, comparison, line list and a guessing game.
import { h, tooltip, isDark, onThemeChange } from '../lib/dom.js';
import { getSpectra, getElements } from '../lib/data.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { segmented, toggle, button } from '../lib/controls.js';
import { drawSpectrum, drawWavelengthAxis, lineAt } from '../lib/spectrum.js';
import { wavelengthCSS, photonCSS, categoryColor } from '../lib/color.js';
import { spectralRegion } from '../lib/physics.js';
import { fix, int } from '../lib/format.js';

const MYSTERY_POOL = ['H', 'He', 'Li', 'Na', 'Ne', 'Ar', 'Hg', 'Ca', 'K', 'Sr', 'Ba', 'Kr', 'Xe', 'Cu', 'Fe', 'Zn', 'Cd', 'Mg'];

export async function mount(root) {
  const [S, E] = await Promise.all([getSpectra(), getElements()]);
  const fromHash = decodeURIComponent(location.hash.slice(1));
  let sym = S[fromHash] ? fromHash : 'Ne';
  let cmp = null, ion = 'I', mode = 'emission', wide = false;

  // ---------- layout
  const picker = h('div.sp-picker', { role: 'group', 'aria-label': 'Choose an element' });
  const cells = new Map();
  for (const e of E.list) {
    const has = !!S[e.sym];
    const b = h('button.sp-cell', { type: 'button', style: { gridColumn: String(e.x), gridRow: String(e.y) }, disabled: !has || null, title: has ? e.name : `${e.name}: no line data`, 'aria-label': e.name }, e.sym);
    b.addEventListener('click', (ev) => { if (ev.shiftKey || compareMode) { setCompare(e.sym); } else setElement(e.sym); });
    cells.set(e.sym, b);
    picker.append(b);
  }
  let compareMode = false;

  const frame = h('div.fig__frame.fig__frame--stage');
  const head = h('div.spec-head');
  const wrap = h('div.plot', { style: { padding: '0 1.1rem' } });
  const cmpHead = h('div.spec-head', { style: { paddingTop: '.4rem' } });
  const wrap2 = h('div.plot', { style: { padding: '0 1.1rem' } });
  const controls = h('div.fig__controls');
  frame.append(head, wrap, cmpHead, wrap2, controls);
  const tip = tooltip(wrap);
  const tip2 = tooltip(wrap2);

  const listWrap = h('div.sp-list');
  const game = h('section.sp-game');
  root.append(h('div.sp-top', null, picker, h('p.pt-note', null, 'Select an element. Hold Shift, or switch on “Compare”, to add a second spectrum underneath. Elements in grey have no lines in the database.')), frame, listWrap, game);

  const cv = setupCanvas(wrap, { height: (w) => Math.max(120, Math.min(190, w * 0.17)) + 36, onResize: () => draw() });
  const cv2 = setupCanvas(wrap2, { height: (w) => Math.max(120, Math.min(190, w * 0.17)) + 36, onResize: () => draw() });

  const ionCtl = segmented({ options: [{ value: 'I', label: 'Neutral' }, { value: 'II', label: 'Ion (+1)' }], value: ion, ariaLabel: 'Ionisation stage', onChange: (v) => { ion = v; draw(); } });
  const modeCtl = segmented({ options: [{ value: 'emission', label: 'Emission' }, { value: 'absorption', label: 'Absorption' }], value: mode, ariaLabel: 'Spectrum type', onChange: (v) => { mode = v; draw(); } });
  const rangeCtl = segmented({ options: [{ value: false, label: 'Visible' }, { value: true, label: '200–1000 nm' }], value: wide, ariaLabel: 'Wavelength range', onChange: (v) => { wide = v; draw(); } });
  const cmpCtl = toggle({ label: 'Compare', checked: false, onChange: (v) => { compareMode = v; if (!v) setCompare(null); } });
  controls.append(ionCtl.el, modeCtl.el, rangeCtl.el, h('span.spacer'), cmpCtl.el);

  function setElement(s) {
    sym = s;
    history.replaceState(null, '', `#${s}`);
    draw();
  }
  function setCompare(s) {
    cmp = s === sym ? null : s;
    if (cmp) { compareMode = true; cmpCtl.set(true); }
    draw();
  }

  const range = () => (wide ? [200, 1000] : [380, 750]);
  const lines = (s) => S[s]?.[ion]?.l || S[s]?.I?.l || [];

  function paint(c, s, headEl) {
    const { ctx, w, h: hh } = c;
    ctx.clearRect(0, 0, w, hh);
    const e = E.bySym.get(s);
    const stage = S[s]?.[ion] ? ion : 'I';
    const ls = lines(s);
    const r = range();
    const box = { x: 0, y: 0, w, h: hh - 36 };
    const shown = ls.filter(([nm]) => nm >= r[0] && nm <= r[1]);
    headEl.innerHTML = `<span class="spec-head__sym">${s}${stage === 'II' ? '<sup>+</sup>' : ''}</span><span class="spec-head__name">${e.name}${stage === 'II' ? ', singly ionised' : ''}${stage !== ion ? ' (no ion data)' : ''}</span><span class="spec-head__meta">${shown.length} strongest lines in range<br>of ${int(S[s]?.[stage]?.n || 0)} catalogued 200–1000 nm</span>`;
    if (!wide) {
      drawSpectrum(ctx, box, ls, { mode, range: r, gamma: mode === 'emission' ? 0.75 : 0.7 });
    } else {
      // wide range: colour only the visible band, show UV and IR lines in neutral tones
      drawSpectrum(ctx, box, ls, { mode, range: r, gamma: mode === 'emission' ? 0.75 : 0.7, lineWidth: 1.1 });
      const sx = (nm) => box.x + ((nm - r[0]) / (r[1] - r[0])) * box.w;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = FONT.sans(10, 500);
      ctx.textAlign = 'center';
      ctx.fillText('ultraviolet', (sx(200) + sx(380)) / 2, 14);
      ctx.fillText('visible', (sx(380) + sx(750)) / 2, 14);
      ctx.fillText('infrared', (sx(750) + sx(1000)) / 2, 14);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.setLineDash([3, 3]);
      for (const nm of [380, 750]) { ctx.beginPath(); ctx.moveTo(sx(nm), 20); ctx.lineTo(sx(nm), box.h); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    drawWavelengthAxis(ctx, box, r, { color: '#8d8a83', step: wide ? 100 : 50 });
    c.canvas.setAttribute('aria-label', `${mode} spectrum of ${e.name}, ${r[0]} to ${r[1]} nanometres.`);
    return box;
  }

  let boxes = [];
  function draw() {
    const dark = isDark();
    for (const [s, b] of cells) {
      b.dataset.active = String(s === sym);
      b.dataset.compare = String(s === cmp);
      const e = E.bySym.get(s);
      b.style.setProperty('--c', categoryColor(e.cat, dark));
    }
    boxes = [paint(cv, sym, head)];
    const show2 = !!cmp;
    cmpHead.hidden = !show2; wrap2.hidden = !show2;
    if (show2) boxes.push(paint(cv2, cmp, cmpHead));
    renderList();
  }

  function renderList() {
    const r = range();
    const ls = lines(sym).filter(([nm]) => nm >= r[0] && nm <= r[1]);
    const max = Math.max(...ls.map((l) => l[1]), 1);
    const top = [...ls].sort((a, b) => b[1] - a[1]).slice(0, 24).sort((a, b) => a[0] - b[0]);
    const e = E.bySym.get(sym);
    listWrap.innerHTML = `<h2>Strongest ${wide ? '' : 'visible '}lines of ${e.name.toLowerCase()}${ion === 'II' && S[sym]?.II ? ' (ion)' : ''}</h2>
      <div class="table-scroll"><table class="datatable"><thead><tr><th></th><th class="n">Wavelength (nm, air)</th><th class="n">Relative intensity</th><th>Region</th></tr></thead><tbody>
      ${top.map(([nm, I]) => `<tr><td><i class="sp-sw" style="background:${nm >= 380 && nm <= 750 ? wavelengthCSS(nm) : photonCSS(nm)}"></i></td><td class="n">${fix(nm, 3)}</td><td class="n">${fix((100 * I) / max, 1)}%</td><td>${spectralRegion(nm)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="pt-note">Wavelengths and relative intensities from the NIST Atomic Spectra Database (Kramida, Ralchenko, Reader and the NIST ASD Team). Intensities depend on the light source and are comparable only within one spectrum.</p>`;
  }

  for (const [c, t, idx] of [[cv, tip, 0], [cv2, tip2, 1]]) {
    c.canvas.addEventListener('pointermove', (ev) => {
      const box = boxes[idx];
      if (!box) return;
      const rc = c.canvas.getBoundingClientRect();
      const x = ev.clientX - rc.left, y = ev.clientY - rc.top;
      const s = idx === 0 ? sym : cmp;
      const l = lineAt(lines(s), x, box, range(), 6);
      if (!l) { t.hide(); return; }
      t.show(`<b>${fix(l[0], 3)} nm</b><br>${spectralRegion(l[0])}`, x, y);
    });
    c.canvas.addEventListener('pointerleave', () => t.hide());
  }

  // ---------- mystery spectrum game
  const gcv = { el: h('div.plot') };
  let answer = null, score = 0, rounds = 0;
  game.innerHTML = '';
  const gh = h('div.sp-game__head', null, h('h2', null, 'Mystery spectrum'), h('p', null, 'An element’s visible emission spectrum. Which one is it? Use the explorer above to compare if you get stuck.'));
  const gframe = h('div.fig__frame.fig__frame--stage');
  const gwrap = h('div.plot', { style: { padding: '1rem 1.1rem 0' } });
  const choices = h('div.sp-choices');
  const gstatus = h('div.sp-status', { 'aria-live': 'polite' });
  const next = button({ label: 'New spectrum', icon: 'reset', onClick: () => newRound() });
  gframe.append(gwrap, h('div.fig__controls', null, choices, h('span.spacer'), gstatus, next));
  game.append(gh, gframe);
  const gc = setupCanvas(gwrap, { height: (w) => Math.max(100, Math.min(150, w * 0.13)) + 36, onResize: () => drawGame() });

  function newRound() {
    const pool = MYSTERY_POOL.filter((s) => S[s]?.I && s !== answer);
    answer = pool[Math.floor(Math.random() * pool.length)];
    const opts = new Set([answer]);
    while (opts.size < 4) opts.add(pool[Math.floor(Math.random() * pool.length)]);
    const shuffled = [...opts].sort(() => Math.random() - 0.5);
    choices.innerHTML = '';
    gstatus.textContent = rounds ? `${score} of ${rounds} correct` : '';
    for (const s of shuffled) {
      const b = h('button.btn', { type: 'button' }, E.bySym.get(s).name);
      b.addEventListener('click', () => {
        if (choices.dataset.done === 'true') return;
        choices.dataset.done = 'true';
        rounds++;
        const right = s === answer;
        if (right) score++;
        b.classList.add(right ? 'is-right' : 'is-wrong');
        if (!right) [...choices.children].find((x) => x.textContent === E.bySym.get(answer).name)?.classList.add('is-right');
        gstatus.textContent = `${right ? 'Correct.' : `It was ${E.bySym.get(answer).name.toLowerCase()}.`} ${score} of ${rounds} correct`;
      });
      choices.append(b);
    }
    choices.dataset.done = 'false';
    drawGame();
  }
  function drawGame() {
    if (!answer) return;
    const { ctx, w, h: hh } = gc;
    ctx.clearRect(0, 0, w, hh);
    const box = { x: 0, y: 0, w, h: hh - 36 };
    drawSpectrum(ctx, box, S[answer].I.l, { mode: 'emission', range: [380, 750], gamma: 0.75 });
    drawWavelengthAxis(ctx, box, [380, 750], { color: '#8d8a83' });
    gc.canvas.setAttribute('aria-label', 'Emission spectrum of a mystery element.');
  }

  onThemeChange(draw);
  draw();
  newRound();
}
