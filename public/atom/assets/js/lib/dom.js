// Small DOM helpers shared by all figures.

/**
 * Create an element. h('div.cls#id', {attr: v, on: {click}}, ...children)
 */
export function h(tag, props, ...children) {
  let [name, ...rest] = tag.split(/(?=[.#])/);
  const el = document.createElementNS(
    props && props.svg ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml',
    name || 'div'
  );
  for (const r of rest) {
    if (r[0] === '.') el.classList.add(r.slice(1));
    else if (r[0] === '#') el.id = r.slice(1);
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false || k === 'svg') continue;
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

export function cssVar(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function onThemeChange(fn) {
  document.addEventListener('themechange', fn);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', fn);
  return () => {
    document.removeEventListener('themechange', fn);
    mq.removeEventListener?.('change', fn);
  };
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

/** Debounce to the next animation frame. */
export function rafThrottle(fn) {
  let queued = false, lastArgs;
  return (...args) => {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(...lastArgs); });
  };
}

/** Simple floating tooltip bound to a container (position: relative). */
export function tooltip(container) {
  const tip = h('div.tip', { role: 'tooltip' });
  container.appendChild(tip);
  return {
    el: tip,
    show(html, x, y) {
      tip.innerHTML = html;
      tip.dataset.show = 'true';
      const cw = container.clientWidth, ch = container.clientHeight;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let left = x + 14, top = y + 14;
      if (left + tw > cw - 6) left = x - tw - 14;
      if (top + th > ch - 6) top = y - th - 14;
      tip.style.left = Math.max(6, left) + 'px';
      tip.style.top = Math.max(6, top) + 'px';
    },
    hide() { tip.dataset.show = 'false'; },
  };
}

/** Announce text to screen readers via a polite live region inside `root`. */
export function liveRegion(root) {
  const el = h('div.sr-only', { 'aria-live': 'polite' });
  root.appendChild(el);
  let t;
  return (text) => { clearTimeout(t); t = setTimeout(() => { el.textContent = text; }, 250); };
}
