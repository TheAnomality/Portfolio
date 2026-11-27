// A clickable catalogue of every hydrogen orbital from n = 1 to 4.
import { h } from '../lib/dom.js';
import { sampleOrbital, orbitalName, radiusContaining } from '../lib/hydrogen.js';

const PTS = 2600;

function project(n, l, m, cv) {
  const { pos, sign } = sampleOrbital(n, l, m, PTS, 3);
  const g = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const S = 68 * dpr;
  cv.width = S; cv.height = S;
  g.fillStyle = '#0b0c0f';
  g.fillRect(0, 0, S, S);
  const scale = (S * 0.44) / radiusContaining(n, l, 0.97);
  // physics axes, viewed slightly from above and to the side (z up)
  const ay = 0.62, ax = 0.32;
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  g.globalCompositeOperation = 'lighter';
  const r = Math.max(0.7, 0.75 * dpr);
  for (let i = 0; i < PTS; i++) {
    const X = pos[3 * i], Y = pos[3 * i + 1], Z = pos[3 * i + 2];
    // rotate about vertical (z), then tilt about screen x
    const x1 = X * cy - Y * sy, y1 = X * sy + Y * cy;
    const sxp = x1, syp = Z * cx - y1 * sx;
    g.fillStyle = sign[i] > 0 ? 'rgba(245,154,58,0.55)' : 'rgba(58,156,255,0.55)';
    g.fillRect(S / 2 + sxp * scale - r / 2, S / 2 - syp * scale - r / 2, r, r);
  }
  g.globalCompositeOperation = 'source-over';
}

export function mount(el) {
  const frame = h('div.fig__frame.fig__frame--stage');
  const wrap = h('div.zoo-wrap');
  const zoo = h('div.zoo');
  wrap.append(zoo);
  frame.append(wrap);
  el.prepend(frame);

  const jobs = [];
  for (let n = 1; n <= 4; n++) {
    const row = h('div.zoo__row');
    const count = n * n;
    row.append(h('div.zoo__n', null, h('b', null, String(n)), `${count} orbital${count > 1 ? 's' : ''}`));
    const items = h('div.zoo__items');
    for (let l = 0; l < n; l++) {
      const group = h('div.zoo__group', { role: 'group', 'aria-label': `${n}${'spdf'[l]} orbitals` });
      items.append(group);
      for (let m = -l; m <= l; m++) {
        const nm = orbitalName(n, l, m);
        const cv = h('canvas', { width: 68, height: 68, 'aria-hidden': 'true' });
        const b = h('button.zoo__item', { type: 'button', title: `Show ${nm.text} in the explorer`, 'aria-label': `Show the ${nm.text} orbital in the explorer above` },
          cv, h('span', { html: nm.html }));
        b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('orbital:select', { detail: { n, l, m } })));
        group.append(b);
        jobs.push([n, l, m, cv]);
      }
    }
    row.append(items);
    zoo.append(row);
  }
  // draw progressively so the page stays responsive
  let i = 0;
  const step = (deadline) => {
    while (i < jobs.length && (!deadline || deadline.timeRemaining() > 4)) {
      const [n, l, m, cv] = jobs[i++];
      project(n, l, m, cv);
      if (!deadline) break;
    }
    if (i < jobs.length) (window.requestIdleCallback || ((f) => setTimeout(f, 16)))(step);
  };
  step();
}
