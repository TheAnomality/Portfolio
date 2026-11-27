import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../lib/store';
import { lockScroll, prefersReducedMotion } from '../lib/smooth-scroll';
import { EASE_IN_OUT } from './ui';

const PHASES = ['Bending spacetime', 'Calibrating orbitals', 'Planting sakura', 'Loading everything'];

/**
 * Counts to 100 while fonts and the 3D scene load. Two orbs (one for each
 * project's colour) spiral together and merge into the violet anomaly.
 */
export default function Preloader() {
  const sceneReady = useStore((s) => s.sceneReady);
  const setIntroDone = useStore((s) => s.setIntroDone);
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [merged, setMerged] = useState(false);
  const ready = useRef({ fonts: false, scene: false });
  const orbA = useRef<HTMLDivElement>(null);
  const orbB = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ready.current.scene = sceneReady;
  }, [sceneReady]);

  useEffect(() => {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    lockScroll(true);
    let done = false;
    document.fonts?.ready.then(() => (ready.current.fonts = true));
    const fontTimeout = window.setTimeout(() => (ready.current.fonts = true), 3500);

    const reduced = prefersReducedMotion();
    const t0 = performance.now();
    let shown = 0;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - t0;
      const { fonts, scene } = ready.current;
      // Never finish faster than ~1.5 s (feels intentional), never hang past 8 s.
      let goal = 20 + (fonts ? 35 : 0) + (scene ? 45 : 0);
      if (elapsed > 8000) goal = 100;
      const cap = reduced ? 100 : Math.min(100, (elapsed / 1500) * 100);
      shown += (Math.min(goal, cap) - shown) * (reduced ? 1 : 0.08);
      if (Math.min(goal, cap) >= 100 && shown > 99.4) shown = 100;
      setProgress(shown);

      // Spiral the orbs together as loading progresses.
      const p = shown / 100;
      const radius = (1 - p) * 92 + 4;
      const angle = elapsed / 380 + p * 5;
      const ax = Math.cos(angle) * radius;
      const ay = Math.sin(angle) * radius * 0.45;
      if (orbA.current) orbA.current.style.transform = `translate(${ax}px, ${ay}px)`;
      if (orbB.current) orbB.current.style.transform = `translate(${-ax}px, ${-ay}px)`;

      if (shown >= 100 && !done) {
        done = true;
        setMerged(true);
        window.setTimeout(() => {
          setVisible(false);
          setIntroDone();
          lockScroll(false);
        }, reduced ? 50 : 650);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fontTimeout);
      lockScroll(false);
    };
  }, [setIntroDone]);

  const phase = PHASES[Math.min(PHASES.length - 1, Math.floor((progress / 100) * PHASES.length))];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="preloader"
          className="fixed inset-0 z-[100] flex flex-col bg-void"
          exit={{ clipPath: 'inset(0% 0% 100% 0%)' }}
          initial={{ clipPath: 'inset(0% 0% 0% 0%)' }}
          transition={{ duration: 1.05, ease: EASE_IN_OUT }}
          role="progressbar"
          aria-label="Loading the portfolio"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div className="relative flex flex-1 items-center justify-center">
            <div className="relative h-40 w-64">
              <div className="absolute left-1/2 top-1/2 -ml-3 -mt-3">
                <div
                  ref={orbA}
                  className="h-6 w-6 rounded-full bg-cyan shadow-[0_0_30px_8px_rgba(94,231,255,0.55)] transition-opacity duration-300"
                  style={{ opacity: merged ? 0 : 1 }}
                />
              </div>
              <div className="absolute left-1/2 top-1/2 -ml-3 -mt-3">
                <div
                  ref={orbB}
                  className="h-6 w-6 rounded-full bg-pink shadow-[0_0_30px_8px_rgba(255,101,132,0.55)] transition-opacity duration-300"
                  style={{ opacity: merged ? 0 : 1 }}
                />
              </div>
              <motion.div
                className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet"
                initial={{ scale: 0, opacity: 0 }}
                animate={merged ? { scale: [0, 1.4, 60], opacity: [0, 1, 0] } : { scale: 0, opacity: 0 }}
                transition={{ duration: 0.9, times: [0, 0.35, 1], ease: 'easeIn' }}
                style={{ boxShadow: '0 0 60px 20px rgba(157,123,255,0.7)' }}
              />
            </div>
          </div>

          <div className="shell flex items-end justify-between gap-6 pb-8">
            <div className="space-y-2">
              <p className="label">TheAnomality · Portfolio ©{new Date().getFullYear()}</p>
              <p className="label text-fg/80" aria-live="polite">
                {phase}
                <span className="animate-pulse">…</span>
              </p>
            </div>
            <p className="font-display text-[clamp(3.5rem,12vw,9rem)] font-light leading-none tabular-nums tracking-tight">
              {String(Math.round(progress)).padStart(3, '0')}
            </p>
          </div>
          <div className="h-px w-full bg-line">
            <div className="h-full bg-gradient-to-r from-cyan via-violet to-pink" style={{ width: `${progress}%` }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
