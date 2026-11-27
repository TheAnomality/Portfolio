// Rendering of line spectra (emission and absorption) on a 2D canvas.
import { wavelengthRGB, wavelengthCSS } from './color.js';
import { FONT } from './canvas.js';

/**
 * Draw a spectrum into box {x, y, w, h}.
 * lines: [[nm, intensity], ...] (any intensity scale; normalised to the max in range)
 * mode: 'emission' (bright lines on black) or 'absorption' (dark lines on a rainbow)
 */
export function drawSpectrum(ctx, box, lines, { mode = 'emission', range = [380, 750], gamma = 0.5, glow = true, minAlpha = 0.04, lineWidth = 1.4 } = {}) {
  const [a, b] = range;
  const sx = (nm) => box.x + ((nm - a) / (b - a)) * box.w;
  const inRange = lines.filter(([nm]) => nm >= a && nm <= b);
  const max = Math.max(1e-12, ...inRange.map((l) => l[1]));
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  if (mode === 'emission') {
    ctx.fillStyle = '#050506';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.globalCompositeOperation = 'lighter';
    // weakest first so strong lines stay on top
    const sorted = [...inRange].sort((p, q) => p[1] - q[1]);
    for (const [nm, I] of sorted) {
      const t = Math.pow(I / max, gamma);
      if (t < minAlpha) continue;
      const x = sx(nm);
      const [r, g, bl] = wavelengthRGB(nm);
      const col = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bl * 255)},`;
      if (glow && t > 0.35) {
        const gw = 6 + 10 * t;
        const grad = ctx.createLinearGradient(x - gw, 0, x + gw, 0);
        grad.addColorStop(0, col + '0)');
        grad.addColorStop(0.5, col + (0.35 * t).toFixed(3) + ')');
        grad.addColorStop(1, col + '0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - gw, box.y, gw * 2, box.h);
      }
      ctx.fillStyle = col + Math.min(1, 0.15 + t).toFixed(3) + ')';
      ctx.fillRect(x - lineWidth / 2, box.y, lineWidth, box.h);
      if (t > 0.6) {
        ctx.fillStyle = `rgba(255,255,255,${((t - 0.6) * 0.9).toFixed(3)})`;
        ctx.fillRect(x - lineWidth / 4, box.y, lineWidth / 2, box.h);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  } else {
    // continuous rainbow, then dark absorption lines
    const step = Math.max(1, Math.floor(box.w / 400));
    for (let px = 0; px < box.w; px += step) {
      const nm = a + ((px + step / 2) / box.w) * (b - a);
      ctx.fillStyle = wavelengthCSS(nm);
      ctx.fillRect(box.x + px, box.y, step + 0.5, box.h);
    }
    for (const [nm, I] of inRange) {
      const t = Math.pow(I / max, gamma);
      if (t < minAlpha) continue;
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.95, 0.2 + 0.8 * t).toFixed(3)})`;
      const w = lineWidth * (0.8 + 1.2 * t);
      ctx.fillRect(sx(nm) - w / 2, box.y, w, box.h);
    }
  }
  ctx.restore();
  return sx;
}

/** Wavelength axis under a spectrum. */
export function drawWavelengthAxis(ctx, box, range, { color = '#8d8a83', step = 50, unit = true, y } = {}) {
  const [a, b] = range;
  const sx = (nm) => box.x + ((nm - a) / (b - a)) * box.w;
  const yy = y ?? box.y + box.h + 6;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.font = FONT.sans(10.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.globalAlpha = 0.9;
  for (let nm = Math.ceil(a / step) * step; nm <= b; nm += step) {
    const x = Math.round(sx(nm)) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, yy - 4); ctx.lineTo(x, yy); ctx.stroke();
    ctx.textAlign = x > box.x + box.w - 14 ? 'right' : x < box.x + 14 ? 'left' : 'center';
    ctx.fillText(String(nm), x, yy + 3);
  }
  if (unit) { ctx.textAlign = 'right'; ctx.fillText('wavelength (nm)', box.x + box.w, yy + 16); }
  ctx.restore();
}

/** Find the strongest line within `tol` px of x. */
export function lineAt(lines, x, box, range, tol = 5) {
  const [a, b] = range;
  const nmAt = a + ((x - box.x) / box.w) * (b - a);
  const tolNm = (tol / box.w) * (b - a);
  let best = null;
  for (const l of lines) {
    if (Math.abs(l[0] - nmAt) <= tolNm && (!best || l[1] > best[1])) best = l;
  }
  return best;
}
