// Hydrogen energy levels: make the electron jump and watch the spectrum build up.
import { h, reducedMotion, liveRegion } from '../lib/dom.js';
import { setupCanvas, FONT } from '../lib/canvas.js';
import { button, segmented, toggle } from '../lib/controls.js';
import { hydrogenEnergy, vacToAir, SERIES, spectralRegion, C } from '../lib/physics.js';
import { photonCSS, wavelengthCSS } from '../lib/color.js';
import { fix, sig, sci } from '../lib/format.js';

const NMAX = 6;
const RANGE = [85, 8000];
const GREEK = ['α', 'β', 'γ', 'δ', 'ε', 'ζ'];

function transition(hi, lo) {
  const dE = hydrogenEnergy(hi) - hydrogenEnergy(lo);
  const vac = C.hc_eVnm / dE;
  return { hi, lo, dE, vac, air: vacToAir(vac), name: `${SERIES[lo]}-${GREEK[hi - lo - 1] || hi}` };
}

export function mount(el) {
  const reduce = reducedMotion();
  const announce = liveRegion(el);
  const frame = h('div.fig__frame.fig__frame--stage');
  const layout = h('div.fig-split');
  const wrap = h('div.plot', { style: { position: 'relative' } });
  const side = h('div.fig-side.el-side');
  layout.append(wrap, side);
  const controls = h('div.fig__controls');
  frame.append(layout, controls);
  el.prepend(frame);

  let level = 3;
  let anim = null;         // electron move animation
  const photons = [];      // flying photons
  const seen = new Map();  // key -> {t: transition, flash}
  let showAll = false;
  let last = null;

  const cv = setupCanvas(wrap, { height: (w) => Math.max(500, Math.min(620, w * 0.98)), onResize: () => draw() });
  cv.canvas.setAttribute('role', 'img');
  cv.canvas.setAttribute('aria-label', 'Energy levels of hydrogen with an electron that can jump between them, and the resulting spectrum.');

  function geom() {
    const w = cv.w, hh = cv.h;
    const strip = { x: 16, y: hh - 78, w: w - 32, h: 30 };
    const lad = { x: 64, y: 34, w: Math.min(260, w * 0.42), h: strip.y - 70 - 34 };
    const ey = (E) => lad.y + ((E - 0.9) / (-13.9 - 0.9)) * lad.h; // top = +0.9 eV, bottom = -13.9 eV
    const lx = Math.log10(RANGE[0]), rx = Math.log10(RANGE[1]);
    const sx = (nm) => strip.x + ((Math.log10(nm) - lx) / (rx - lx)) * strip.w;
    return { w, hh, strip, lad, ey, sx };
  }

  function info(t, kind) {
    const vis = t.air >= 380 && t.air <= 750;
    const region = spectralRegion(t.vac);
    const f = (t.dE * C.e) / C.h;
    const swatch = vis ? wavelengthCSS(t.air) : photonCSS(t.vac);
    side.innerHTML = `
      <div class="el-side__k">${kind === 'emit' ? 'Emission' : 'Absorption'}</div>
      <div class="el-side__t">n = ${t.hi} ${kind === 'emit' ? '→' : '←'} ${t.lo}</div>
      <div class="el-side__name">${t.name.replace('-', ' ')}</div>
      <div class="el-side__sw" style="background:${swatch}"></div>
      <dl class="readouts">
        <div class="readout"><dt>Photon energy</dt><dd>${fix(t.dE, 3)} eV</dd></div>
        <div class="readout"><dt>Wavelength</dt><dd>${t.vac < 200 || t.vac > 2000 ? sig(t.vac, 5) : fix(t.air, 2)} nm</dd></div>
        <div class="readout"><dt>Frequency</dt><dd>${sci(f, 3)} Hz</dd></div>
        <div class="readout"><dt>Region</dt><dd style="font-family:var(--font-sans);font-size:.9rem">${region}</dd></div>
      </dl>
      <p class="el-side__note">${vis ? 'You could see this one. ' : ''}${t.vac < 200 || t.vac > 2000 ? 'Vacuum wavelength.' : 'Wavelength in air, as spectroscopists quote it.'}</p>`;
    announce(`${kind === 'emit' ? 'Emitted' : 'Absorbed'} a photon of ${fix(t.dE, 2)} electronvolts, wavelength ${fix(t.vac < 200 || t.vac > 2000 ? t.vac : t.air, 1)} nanometres, ${region}.`);
  }

  function intro() {
    side.innerHTML = `<div class="el-side__k">How to use</div>
      <p class="el-side__p">The electron sits on level <b>n = ${level}</b>. Click a lower level to make it fall and emit a photon, or a higher one to make it absorb a photon and jump up.</p>
      <p class="el-side__p">Each emitted photon lands on the spectrum below at its own wavelength. Try <b>Cascade</b> to watch a highly excited atom tumble down.</p>`;
  }

  function jump(to, fromCascade = false) {
    if (to === level || anim) return false;
    const from = level;
    const kind = to < from ? 'emit' : 'absorb';
    const t = transition(Math.max(from, to), Math.min(from, to));
    last = { t, kind };
    anim = { from, to, t0: performance.now(), dur: reduce ? 1 : 520 };
    const g = geom();
    if (kind === 'emit') {
      photons.push({ t, t0: performance.now() + (reduce ? 0 : 120), dur: reduce ? 1 : 1100, x0: g.lad.x + g.lad.w + 6, y0: (g.ey(hydrogenEnergy(from)) + g.ey(hydrogenEnergy(to))) / 2, kind });
    } else {
      photons.push({ t, t0: performance.now() - 600, dur: reduce ? 1 : 600, kind, incoming: true });
    }
    level = to;
    info(t, kind);
    if (!fromCascade) levelSeg.set(level);
    start();
    return true;
  }

  let cascadeTimer = null;
  function cascade() {
    clearTimeout(cascadeTimer);
    const run = () => {
      if (level === 1) return;
      const to = 1 + Math.floor(Math.random() * (level - 1));
      jump(to, true);
      levelSeg.set(level);
      if (level > 1) cascadeTimer = setTimeout(run, reduce ? 300 : 1250);
    };
    if (level === 1 || level < NMAX) {
      jump(NMAX, true);
      levelSeg.set(level);
      cascadeTimer = setTimeout(run, reduce ? 300 : 1100);
    } else run();
  }

  // ---- drawing
  function draw(now = performance.now()) {
    const { ctx } = cv;
    const g = geom();
    ctx.clearRect(0, 0, g.w, g.hh);
    // ladder
    ctx.font = FONT.sans(11);
    for (let n = 1; n <= NMAX; n++) {
      const y = Math.round(g.ey(hydrogenEnergy(n))) + 0.5;
      const active = n === level && !anim;
      ctx.strokeStyle = active ? '#e9e7e2' : '#4c4f58';
      ctx.lineWidth = active ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(g.lad.x, y); ctx.lineTo(g.lad.x + g.lad.w, y); ctx.stroke();
      ctx.fillStyle = '#a3a097';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      if (n <= 4) ctx.fillText(`n = ${n}`, g.lad.x - 10, y);
      ctx.textAlign = 'left';
      if (n <= 3) ctx.fillText(`${fix(hydrogenEnergy(n), 2)} eV`, g.lad.x + g.lad.w + 8, y);
    }
    // ionisation limit
    const y0 = Math.round(g.ey(0)) + 0.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#6e6b65';
    ctx.beginPath(); ctx.moveTo(g.lad.x, y0); ctx.lineTo(g.lad.x + g.lad.w, y0); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#6e6b65';
    ctx.textAlign = 'right'; ctx.fillText('∞', g.lad.x - 10, y0 - 6);
    ctx.textAlign = 'left'; ctx.fillText('0 eV: electron free', g.lad.x + g.lad.w + 8, y0 - 6);

    // nucleus-free electron marker
    let ey = g.ey(hydrogenEnergy(level));
    if (anim) {
      const t = Math.min(1, (now - anim.t0) / anim.dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      ey = g.ey(hydrogenEnergy(anim.from)) + (g.ey(hydrogenEnergy(anim.to)) - g.ey(hydrogenEnergy(anim.from))) * e;
      if (t >= 1) anim = null;
    }
    const ex = g.lad.x + g.lad.w * 0.5;
    const grd = ctx.createRadialGradient(ex, ey, 0, ex, ey, 14);
    grd.addColorStop(0, 'rgba(111,178,255,0.9)');
    grd.addColorStop(1, 'rgba(111,178,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(ex, ey, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cfe4ff';
    ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, Math.PI * 2); ctx.fill();

    // spectrum strip
    const s = g.strip;
    ctx.fillStyle = '#050506';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    // visible band hint
    const vx0 = g.sx(380), vx1 = g.sx(750);
    for (let x = vx0; x < vx1; x += 2) {
      const nm = Math.pow(10, Math.log10(RANGE[0]) + ((x - s.x) / s.w) * (Math.log10(RANGE[1]) - Math.log10(RANGE[0])));
      ctx.fillStyle = wavelengthCSS(nm, 0.13);
      ctx.fillRect(x, s.y, 2.2, s.h);
    }
    const lines = [];
    if (showAll) for (let a = 2; a <= NMAX; a++) for (let b = 1; b < a; b++) lines.push(transition(a, b));
    for (const v of seen.values()) lines.push(v.t);
    for (const t of lines) {
      const nm = t.vac < 200 || t.vac > 2000 ? t.vac : t.air;
      const x = g.sx(nm);
      const vis = t.air >= 380 && t.air <= 750;
      const key = `${t.hi}-${t.lo}`;
      const flash = seen.get(key)?.flash ?? 0;
      const fl = Math.max(0, 1 - (now - flash) / 900);
      ctx.fillStyle = vis ? wavelengthCSS(t.air) : photonCSS(t.vac, 0.85);
      ctx.fillRect(x - 1.1 - fl * 1.5, s.y - fl * 6, 2.2 + fl * 3, s.h + fl * 12);
    }
    // axis + region labels
    ctx.font = FONT.sans(10);
    ctx.fillStyle = '#6e6b65';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const nm of [100, 200, 500, 1000, 2000, 5000]) {
      const x = g.sx(nm);
      ctx.fillRect(Math.round(x), s.y + s.h, 1, 4);
      ctx.fillText(nm >= 1000 ? `${nm / 1000} µm` : `${nm} nm`, x, s.y + s.h + 7);
    }
    ctx.font = FONT.sans(10.5, 500);
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#8d8a83';
    ctx.fillText('ultraviolet', (g.sx(90) + g.sx(380)) / 2, s.y - 6);
    ctx.fillText('visible', (vx0 + vx1) / 2, s.y - 6);
    ctx.fillText('infrared', (g.sx(750) + g.sx(8000)) / 2, s.y - 6);
    // series brackets
    ctx.font = FONT.sans(9.5);
    ctx.fillStyle = '#6e6b65';
    ctx.textBaseline = 'top';
    const series = [[1, 'Lyman'], [2, 'Balmer'], [3, 'Paschen'], [4, 'Brackett'], [5, 'Pfund']];
    for (const [lo, name] of series) {
      if (!showAll && ![...seen.values()].some((v) => v.t.lo === lo)) continue;
      const lim = C.hc_eVnm / (-hydrogenEnergy(lo));
      const first = transition(lo + 1, lo).vac;
      const xa = g.sx(lo === 1 ? lim : vacToAir(lim)), xb = g.sx(first > 2000 || first < 200 ? first : vacToAir(first));
      ctx.strokeStyle = '#4c4f58';
      ctx.beginPath(); ctx.moveTo(xa, s.y + s.h + 22); ctx.lineTo(xb, s.y + s.h + 22); ctx.stroke();
      ctx.fillText(name, (xa + xb) / 2, s.y + s.h + 25);
    }

    // photons
    for (let i = photons.length - 1; i >= 0; i--) {
      const p = photons[i];
      const t = (now - p.t0) / p.dur;
      if (t < 0) continue;
      const nm = p.t.vac < 200 || p.t.vac > 2000 ? p.t.vac : p.t.air;
      const col = p.t.air >= 380 && p.t.air <= 750 ? wavelengthCSS(p.t.air) : photonCSS(p.t.vac);
      if (p.incoming) {
        // incoming photon from the left edge towards the electron
        const yy = (g.ey(hydrogenEnergy(p.t.lo)) + g.ey(hydrogenEnergy(p.t.hi))) / 2;
        const tt = Math.min(1, t);
        const xEnd = g.lad.x + g.lad.w * 0.5;
        wavePacket(ctx, 0, yy, xEnd, yy, tt, col, p.t.vac);
        if (t >= 1) photons.splice(i, 1);
        continue;
      }
      const tt = Math.min(1, t);
      const x1 = g.sx(nm), y1 = s.y - 2;
      wavePacket(ctx, p.x0, p.y0, x1, y1, tt, col, p.t.vac);
      if (t >= 1) {
        photons.splice(i, 1);
        seen.set(`${p.t.hi}-${p.t.lo}`, { t: p.t, flash: now });
      }
    }
  }

  function wavePacket(ctx, x0, y0, x1, y1, t, col, vac) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    const head = t * len;
    const tail = Math.max(0, head - 70);
    const k = (2 * Math.PI) / Math.max(7, Math.min(22, 4 + Math.log10(vac) * 5));
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let d = tail; d <= head; d += 1.5) {
      const env = Math.sin(((d - tail) / Math.max(1, head - tail)) * Math.PI);
      const off = Math.sin(d * k) * 6 * env;
      const x = x0 + ux * d - uy * off, y = y0 + uy * d + ux * off;
      d === tail ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---- interaction
  cv.canvas.addEventListener('click', (e) => {
    const r = cv.canvas.getBoundingClientRect();
    const y = e.clientY - r.top, x = e.clientX - r.left;
    const g = geom();
    if (x < g.lad.x - 40 || x > g.lad.x + g.lad.w + 70 || y > g.strip.y - 30) return;
    let best = 1, bd = Infinity;
    for (let n = 1; n <= NMAX; n++) {
      const d = Math.abs(g.ey(hydrogenEnergy(n)) - y);
      if (d < bd) { bd = d; best = n; }
    }
    if (bd < 26) jump(best);
  });
  cv.canvas.style.cursor = 'pointer';

  const levelSeg = segmented({ label: 'Electron on level', options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })), value: level,
    onChange: (v) => { if (!jump(v)) levelSeg.set(level); } });
  const cascadeBtn = button({ label: 'Cascade', icon: 'play', onClick: cascade });
  const allCtl = toggle({ label: 'Show every line', checked: false, onChange: (v) => { showAll = v; start(); } });
  const clearBtn = button({ label: 'Clear', icon: 'reset', ghost: true, onClick: () => { seen.clear(); photons.length = 0; start(); } });
  controls.append(levelSeg.el, cascadeBtn, h('span.spacer'), allCtl.el, clearBtn);

  // ---- loop (runs only while something moves)
  let raf = 0, running = false, visible = false;
  function tick(now) {
    draw(now);
    const flashing = [...seen.values()].some((v) => now - v.flash < 900);
    if (anim || photons.length || flashing) raf = requestAnimationFrame(tick);
    else running = false;
  }
  function start() {
    if (!visible) { draw(); return; }
    if (running) return;
    running = true;
    raf = requestAnimationFrame(tick);
  }
  intro();
  draw();
  return {
    resume() { visible = true; start(); },
    pause() { visible = false; cancelAnimationFrame(raf); running = false; clearTimeout(cascadeTimer); },
  };
}
