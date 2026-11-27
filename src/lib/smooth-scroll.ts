import Lenis from 'lenis';
import { motionEnabled } from './motion';

let lenis: Lenis | null = null;

/** true when animations are off (device "Reduce motion" setting or the Motion button). */
export const prefersReducedMotion = () => typeof window !== 'undefined' && !motionEnabled();

/** Starts Lenis smooth scrolling (skipped while animations are off). */
export function startSmoothScroll(): () => void {
  if (prefersReducedMotion()) return () => {};
  lenis = new Lenis({
    autoRaf: true,
    lerp: 0.09,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.4,
    allowNestedScroll: true,
  });
  return () => {
    lenis?.destroy();
    lenis = null;
  };
}

export const getLenis = () => lenis;

/** Scroll velocity in px/frame (0 without Lenis). */
export const scrollVelocity = () => lenis?.velocity ?? 0;

export function scrollToTarget(target: string | HTMLElement | number, offset = 0) {
  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    return;
  }
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior });
    return;
  }
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior });
}

export function lockScroll(locked: boolean) {
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
  document.documentElement.style.overflow = locked ? 'hidden' : '';
}
