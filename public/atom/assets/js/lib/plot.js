// Minimal 2D-canvas charting: scales, axes and gridlines in the site's style.
import { cssVar } from './dom.js';
import { niceTicks, FONT } from './canvas.js';
import { minus } from './format.js';

export function theme(stage = false) {
  if (stage) {
    return { ink: '#e9e7e2', ink2: '#a3a097', ink3: '#6e6b65', rule: '#262830', bg: '#0b0c0f', accent: '#f0804f' };
  }
  return {
    ink: cssVar('--ink'), ink2: cssVar('--ink-2'), ink3: cssVar('--ink-3'), rule: cssVar('--rule'),
    bg: cssVar('--bg-elev'), accent: cssVar('--accent'),
  };
}

export function linear([d0, d1], [r0, r1]) {
  const k = (r1 - r0) / (d1 - d0 || 1);
  const f = (v) => r0 + (v - d0) * k;
  f.invert = (p) => d0 + (p - r0) / k;
  f.domain = [d0, d1];
  return f;
}
export function log([d0, d1], [r0, r1]) {
  const l0 = Math.log10(d0), l1 = Math.log10(d1);
  const k = (r1 - r0) / (l1 - l0 || 1);
  const f = (v) => r0 + (Math.log10(Math.max(v, 1e-300)) - l0) * k;
  f.invert = (p) => Math.pow(10, l0 + (p - r0) / k);
  f.domain = [d0, d1];
  f.log = true;
  return f;
}

/** Draw axes into ctx. box = {x, y, w, h} (plot area). */
export function drawAxes(ctx, box, sx, sy, o = {}) {
  const t = o.colors || theme(o.stage);
  const xt = o.xTicks || (sx.log ? logTicks(sx.domain) : niceTicks(sx.domain[0], sx.domain[1], o.xCount || 6));
  const yt = o.yTicks || (sy.log ? logTicks(sy.domain) : niceTicks(sy.domain[0], sy.domain[1], o.yCount || 5));
  const fx = o.fmtX || ((v) => minus(+v.toPrecision(6)));
  const fy = o.fmtY || ((v) => minus(+v.toPrecision(6)));
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = FONT.sans(11);
  // grid
  if (o.grid !== false) {
    ctx.strokeStyle = t.rule;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (const v of yt) { const y = Math.round(sy(v)) + 0.5; if (y < box.y - 1 || y > box.y + box.h + 1) continue; ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); }
    if (o.xGrid) for (const v of xt) { const x = Math.round(sx(v)) + 0.5; ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // x axis
  ctx.strokeStyle = t.ink3;
  ctx.beginPath();
  const yAxis = Math.round(box.y + box.h) + 0.5;
  ctx.moveTo(box.x, yAxis); ctx.lineTo(box.x + box.w, yAxis);
  ctx.stroke();
  ctx.fillStyle = t.ink3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const v of xt) {
    const x = sx(v);
    if (x < box.x - 2 || x > box.x + box.w + 2) continue;
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, yAxis); ctx.lineTo(Math.round(x) + 0.5, yAxis + 4); ctx.stroke();
    const label = sx.log ? logLabel(v) : fx(v);
    drawRich(ctx, label, x, yAxis + 7, 'center');
  }
  // y labels
  if (o.yLabels !== false) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of yt) {
      const y = sy(v);
      if (y < box.y - 2 || y > box.y + box.h + 2) continue;
      drawRich(ctx, sy.log ? logLabel(v) : fy(v), box.x - 7, y, 'right');
    }
  }
  // axis titles
  ctx.fillStyle = t.ink2;
  ctx.font = FONT.sans(11.5, 500);
  if (o.xLabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(o.xLabel, box.x + box.w, yAxis + 24); }
  if (o.yLabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(o.yLabel, box.x - (o.yLabelInset ?? 0), box.y - 10); }
  ctx.restore();
  return { xt, yt };
}

export function logTicks([a, b]) {
  const out = [];
  for (let e = Math.ceil(Math.log10(a) - 1e-9); e <= Math.floor(Math.log10(b) + 1e-9); e++) out.push(Math.pow(10, e));
  if (out.length > 9) { const step = Math.ceil(out.length / 8); return out.filter((_, i) => i % step === 0); }
  return out;
}
function logLabel(v) {
  const e = Math.round(Math.log10(v));
  if (e >= 0 && e <= 3) return String(Math.pow(10, e));
  if (e === -1) return '0.1';
  return `10^${e}`;
}
/** Draw text where "10^-5" renders with a raised exponent. */
export function drawRich(ctx, text, x, y, align = 'left') {
  const m = /^(.*?)10\^(-?\d+)(.*)$/.exec(text);
  if (!m) { ctx.textAlign = align; ctx.fillText(text, x, y); return; }
  const base = m[1] + '10', exp = minus(m[2]);
  const font = ctx.font;
  const size = parseFloat(/(\d+(\.\d+)?)px/.exec(font)?.[1] || 11);
  const wb = ctx.measureText(base).width;
  ctx.font = font.replace(/(\d+(\.\d+)?)px/, `${size * 0.75}px`);
  const we = ctx.measureText(exp).width;
  ctx.font = font;
  const total = wb + we;
  let x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  ctx.fillText(base, x0, y);
  ctx.font = font.replace(/(\d+(\.\d+)?)px/, `${size * 0.75}px`);
  const baseline = ctx.textBaseline;
  ctx.fillText(exp, x0 + wb, y - size * (baseline === 'top' ? 0.18 : 0.42));
  ctx.font = font;
  ctx.textAlign = align;
}
