// Accessible form controls for figures.
import { h } from './dom.js';

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

function setPct(input) {
  const min = +input.min, max = +input.max, v = +input.value;
  input.style.setProperty('--pct', `${((v - min) / (max - min || 1)) * 100}%`);
}

/** Range slider with label and live value readout. */
export function slider({ label, min = 0, max = 1, step = 0.01, value = 0, format = (v) => v, onInput, width, ariaLabel }) {
  const id = nextId('rng');
  const out = h('output.control__value', { for: id });
  const input = h('input', { type: 'range', id, min, max, step, value, 'aria-label': ariaLabel || label });
  if (width) input.style.width = width;
  const el = h('div.control', null,
    label ? h('label.control__label', { for: id }, label) : null,
    input, out);
  const update = () => {
    setPct(input);
    const v = +input.value;
    out.innerHTML = format(v);
    input.setAttribute('aria-valuetext', out.textContent);
  };
  input.addEventListener('input', () => { update(); onInput && onInput(+input.value); });
  update();
  return {
    el, input,
    get value() { return +input.value; },
    set(v, fire = false) { input.value = v; update(); if (fire && onInput) onInput(+input.value); },
    setRange(mn, mx) { input.min = mn; input.max = mx; update(); },
  };
}

/** Segmented control (radio-like group of buttons). */
export function segmented({ label, options, value, onChange, ariaLabel }) {
  const group = h('div.seg', { role: 'radiogroup', 'aria-label': ariaLabel || label || 'Options' });
  const buttons = new Map();
  let current = value;
  for (const o of options) {
    const opt = typeof o === 'object' ? o : { value: o, label: String(o) };
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(opt.value === value), title: opt.title || null, html: opt.html || null }, opt.html ? null : opt.label);
    b.addEventListener('click', () => select(opt.value, true));
    b.addEventListener('keydown', (e) => {
      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      const vals = [...buttons.keys()];
      const i = vals.indexOf(current);
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const nv = vals[(i + d + vals.length) % vals.length];
      select(nv, true);
      buttons.get(nv).focus();
    });
    buttons.set(opt.value, b);
    group.appendChild(b);
  }
  function select(v, fire) {
    current = v;
    for (const [k, b] of buttons) {
      b.setAttribute('aria-checked', String(k === v));
      b.tabIndex = k === v ? 0 : -1;
    }
    if (fire && onChange) onChange(v);
  }
  select(value, false);
  const el = label ? h('div.control', null, h('span.control__label', null, label), group) : group;
  return {
    el, group,
    get value() { return current; },
    set: (v, fire = false) => select(v, fire),
    disable(v, flag) { const b = buttons.get(v); if (b) b.disabled = flag; },
    buttons,
  };
}

/** On/off switch. */
export function toggle({ label, checked = false, onChange }) {
  const input = h('input', { type: 'checkbox', role: 'switch' });
  input.checked = checked;
  input.addEventListener('change', () => onChange && onChange(input.checked));
  const el = h('label.switch', null, input, label);
  return {
    el, input,
    get value() { return input.checked; },
    set(v, fire = false) { input.checked = v; if (fire && onChange) onChange(v); },
  };
}

/** Native select, styled. */
export function select({ label, options, value, onChange, ariaLabel }) {
  const id = nextId('sel');
  const s = h('select.select', { id, 'aria-label': ariaLabel || label });
  for (const o of options) {
    if (o.group) {
      const og = h('optgroup', { label: o.group });
      for (const oo of o.options) og.appendChild(h('option', { value: oo.value }, oo.label));
      s.appendChild(og);
    } else {
      s.appendChild(h('option', { value: o.value }, o.label));
    }
  }
  s.value = value;
  s.addEventListener('change', () => onChange && onChange(s.value));
  const el = label ? h('div.control', null, h('label.control__label', { for: id }, label), s) : s;
  return { el, select: s, get value() { return s.value; }, set(v) { s.value = v; } };
}

/** Button with optional icon. */
export function button({ label, icon, onClick, primary = false, ghost = false, title }) {
  const b = h(`button.btn${primary ? '.btn--primary' : ''}${ghost ? '.btn--ghost' : ''}`, { type: 'button', title: title || null });
  if (icon) b.insertAdjacentHTML('beforeend', ICONS[icon] || '');
  if (label) b.append(h('span', null, label));
  b.addEventListener('click', onClick);
  return b;
}

export const ICONS = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>',
  reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  step: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5v11l7-5.5zM11 2.5h2v11h-2z" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  minus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  arrow: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fire: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.4" fill="currentColor"/><path d="M8 1.5v2.5M8 12v2.5M1.5 8H4M12 8h2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  expand: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
