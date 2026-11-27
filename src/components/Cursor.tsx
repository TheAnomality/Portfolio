import { useEffect, useRef, useState } from 'react';
import { useCoarsePointer, useReducedMotion } from '../lib/hooks';
import { useStore } from '../lib/store';

const INTERACTIVE = 'a, button, [role="button"], [data-cursor], label, summary, select';

/**
 * A dot that follows the pointer exactly and a ring that trails it. Over
 * links it grows; elements with data-cursor="Label" show that label.
 * Disabled on touch screens, for reduced motion and while the viewer is open.
 */
export default function Cursor() {
  const coarse = useCoarsePointer();
  const reduced = useReducedMotion();
  const viewer = useStore((s) => s.viewer);
  const enabled = !coarse && !reduced && !viewer;

  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const [text, setText] = useState(false);
  const [visible, setVisible] = useState(false);
  const [down, setDown] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add('has-custom-cursor');
    let x = -100;
    let y = -100;
    let rx = -100;
    let ry = -100;
    let raf = 0;
    let shown = false;

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      x = e.clientX;
      y = e.clientY;
      if (!shown) {
        shown = true;
        rx = x;
        ry = y;
        setVisible(true);
      }
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    };
    const loop = () => {
      rx += (x - rx) * 0.17;
      ry += (y - ry) * 0.17;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    const over = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(INTERACTIVE);
      const field = (e.target as Element | null)?.closest?.('input, textarea, [contenteditable="true"]');
      setText(!!field);
      setHover(!!el);
      setLabel(el?.getAttribute('data-cursor') ?? null);
    };
    const leave = () => {
      shown = false;
      setVisible(false);
    };
    const press = () => setDown(true);
    const release = () => setDown(false);

    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerover', over, { passive: true });
    root.addEventListener('pointerleave', leave);
    window.addEventListener('pointerdown', press, { passive: true });
    window.addEventListener('pointerup', release, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      root.classList.remove('has-custom-cursor');
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', over);
      root.removeEventListener('pointerleave', leave);
      window.removeEventListener('pointerdown', press);
      window.removeEventListener('pointerup', release);
    };
  }, [enabled]);

  if (!enabled) return null;

  const size = label ? 88 : hover ? 56 : 34;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[95]" style={{ opacity: visible && !text ? 1 : 0 }}>
      <div
        ref={ring}
        className="fixed left-0 top-0 flex items-center justify-center rounded-full"
        style={{ willChange: 'transform' }}
      >
        <div
          className="flex items-center justify-center rounded-full border transition-[width,height,background-color,border-color,scale] duration-300 ease-out"
          style={{
            width: size,
            height: size,
            scale: down ? 0.85 : 1,
            background: label ? 'var(--accent)' : 'transparent',
            borderColor: label ? 'transparent' : hover ? 'rgb(236 233 246 / 0.7)' : 'rgb(236 233 246 / 0.28)',
          }}
        >
          {label && <span className="px-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-white">{label}</span>}
        </div>
      </div>
      <div
        ref={dot}
        className="fixed left-0 top-0 h-[6px] w-[6px] rounded-full bg-white mix-blend-difference transition-opacity duration-200"
        style={{ opacity: label ? 0 : 1, willChange: 'transform' }}
      />
    </div>
  );
}
