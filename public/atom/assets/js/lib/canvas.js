// HiDPI canvas setup and a visibility-aware animation loop.

/**
 * Create a canvas that fills `container` horizontally. Height is either fixed,
 * derived from an aspect ratio, or a function of width.
 */
export function setupCanvas(container, { aspect, height, minHeight = 0, maxHeight = Infinity, onResize, maxDPR = 2 } = {}) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const state = { canvas, ctx, w: 0, h: 0, dpr: 1 };
  let lastW = -1;
  function resize(force, silent) {
    const w = Math.round(container.clientWidth);
    if (!force && w === lastW) return;
    lastW = w;
    let hh = typeof height === 'function' ? height(w) : height ?? (aspect ? w / aspect : container.clientHeight);
    hh = Math.round(Math.max(minHeight, Math.min(maxHeight, hh)));
    const dpr = Math.min(window.devicePixelRatio || 1, maxDPR);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(hh * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = hh + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.w = w; state.h = hh; state.dpr = dpr;
    if (!silent && onResize) onResize(w, hh);
  }
  const ro = new ResizeObserver(() => resize(false));
  ro.observe(container);
  resize(true, true); // callers draw once themselves after setup
  state.resize = () => resize(true);
  state.destroy = () => ro.disconnect();
  return state;
}

/** requestAnimationFrame loop; dt in seconds (clamped), t in seconds. */
export function createLoop(fn) {
  let raf = 0, running = false, last = 0, t = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    t += dt;
    fn(dt, t);
    raf = requestAnimationFrame(frame);
  }
  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() { running = false; cancelAnimationFrame(raf); },
    get running() { return running; },
  };
}

/** Pointer position relative to an element, in CSS pixels. */
export function localPoint(e, el) {
  const r = el.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return [p.clientX - r.left, p.clientY - r.top];
}

/** Nice round tick values for an axis. */
export function niceTicks(min, max, count = 5) {
  const span = max - min;
  if (span <= 0) return [min];
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

/** Draw text with a halo for legibility over busy backgrounds. */
export function haloText(ctx, text, x, y, fill, halo, width = 3) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = halo;
  ctx.lineWidth = width;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export const FONT = {
  sans: (size, weight = 400) => `${weight} ${size}px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif`,
  mono: (size, weight = 400) => `${weight} ${size}px "IBM Plex Mono", ui-monospace, Menlo, monospace`,
  serif: (size, weight = 400, style = 'normal') => `${style} ${weight} ${size}px "Newsreader", Georgia, serif`,
};
