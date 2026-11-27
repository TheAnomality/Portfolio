import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { site } from '../content/site';
import { HERO_SCENE, useStore } from '../lib/store';
import { useCoarsePointer, useReducedMotion, useSceneSection } from '../lib/hooks';
import { scrollToTarget } from '../lib/smooth-scroll';
import { ArrowDown, EASE, Magnetic, PlayIcon, RollText } from '../components/ui';

/** Giant name whose letters get bolder and take the accent colour near the pointer. */
function ProximityTitle({ text, play }: { text: string; play: boolean }) {
  const letters = useRef<(HTMLSpanElement | null)[]>([]);
  const coarse = useCoarsePointer();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (coarse || reduced) return;
    let raf = 0;
    let mx = -1e4;
    let my = -1e4;
    const update = () => {
      raf = 0;
      const els = letters.current.filter(Boolean) as HTMLSpanElement[];
      const rects = els.map((el) => el.getBoundingClientRect()); // read everything first…
      els.forEach((el, i) => {
        // …then write, so the browser lays out once per frame
        const r = rects[i];
        const d = Math.hypot(mx - (r.left + r.width / 2), (my - (r.top + r.height / 2)) * 1.4);
        const t = Math.max(0, 1 - d / 440);
        const k = t * t * (3 - 2 * t);
        el.style.fontVariationSettings = `'wght' ${Math.round(260 + k * 640)}`;
        el.style.setProperty('--p', `${(k * 100).toFixed(1)}%`);
      });
    };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [coarse, reduced]);

  return (
    <span aria-hidden="true" className="flex whitespace-nowrap">
      {text.split('').map((ch, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.06em] -mb-[0.06em]">
          <motion.span
            ref={(el) => {
              letters.current[i] = el;
            }}
            className="inline-block"
            style={{
              fontVariationSettings: "'wght' 260",
              color: 'color-mix(in oklab, var(--color-fg), var(--accent) var(--p, 0%))',
              transition: 'font-variation-settings 0.25s ease-out, color 0.25s',
            }}
            initial={{ y: '110%' }}
            animate={{ y: play ? '0%' : '110%' }}
            transition={{ duration: 1.2, delay: 0.25 + i * 0.055, ease: EASE }}
          >
            {ch}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function RoleCycler() {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % site.roles.length), 2300);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <p className="text-lg text-muted md:text-xl">
      A developer who does <span className="serif-accent accent-text text-[1.25em]">everything</span>
      <span className="sr-only">: {site.roles.join(', ')}.</span>
      <span aria-hidden="true" className="relative mt-1 block h-[1.5em] overflow-hidden font-display text-[1.15em] text-fg">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={i}
            className="absolute inset-x-0 top-0 whitespace-nowrap"
            initial={{ y: '100%', opacity: 0, filter: 'blur(8px)' }}
            animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: '-100%', opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            {site.roles[i]}
          </motion.span>
        </AnimatePresence>
      </span>
    </p>
  );
}

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  useSceneSection(ref, HERO_SCENE);
  const introDone = useStore((s) => s.introDone);
  const triggerBurst = useStore((s) => s.triggerBurst);
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 24 },
    animate: introDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    transition: { duration: 1, delay, ease: EASE },
  });

  return (
    <section
      id="top"
      ref={ref}
      aria-label="Introduction"
      className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden pb-8 pt-28"
      onPointerDown={(e) => {
        if (!(e.target as Element).closest('a, button')) triggerBurst();
      }}
    >
      <div className="shell relative">
        <motion.div className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-10" {...fade(0.1)}>
          <p className="label">Portfolio · ©{new Date().getFullYear()}</p>
          <p className="glass flex items-center gap-2.5 rounded-full px-4 py-2 text-xs text-fg/85">
            <span className="status-dot" aria-hidden="true" />
            {site.availability}
          </p>
        </motion.div>

        <h1 className="select-none leading-[0.82] tracking-[-0.045em]" aria-label={site.name}>
          <motion.span
            className="serif-accent block pl-[0.08em] text-[clamp(2.6rem,7.5vw,8rem)] leading-none tracking-normal text-fg/90"
            aria-hidden="true"
            {...fade(0.15)}
          >
            The
          </motion.span>
          <span className="block font-display text-[clamp(3rem,13.2vw,15.5rem)] uppercase">
            <ProximityTitle text={site.name.replace(/^The/i, '')} play={introDone} />
          </span>
        </h1>

        <div className="mt-8 grid items-end gap-8 md:mt-12 md:grid-cols-12">
          <motion.div className="md:col-span-6 lg:col-span-5" {...fade(0.9)}>
            <RoleCycler />
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted md:text-lg">{site.heroIntro}</p>
          </motion.div>
          <motion.div className="flex flex-wrap gap-3 md:col-span-6 md:justify-end lg:col-span-7" {...fade(1.05)}>
            <Magnetic>
              <a
                href="#work"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToTarget('#work');
                }}
                className="btn btn-primary"
                data-cursor="Explore"
              >
                <RollText>Explore my work</RollText>
                <ArrowDown />
              </a>
            </Magnetic>
            <Magnetic>
              <a
                href="#showreel"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToTarget('#showreel');
                }}
                className="btn btn-ghost"
              >
                <PlayIcon className="h-3.5 w-3.5" />
                <RollText>Watch the showreel</RollText>
              </a>
            </Magnetic>
          </motion.div>
        </div>

        <motion.div className="mt-12 flex items-end justify-between gap-6 md:mt-16" {...fade(1.25)}>
          <div className="flex items-center gap-4">
            <span className="relative block h-12 w-px overflow-hidden bg-line">
              <span className="absolute inset-0 animate-scroll-line bg-fg" />
            </span>
            <span className="label">Scroll</span>
          </div>
          <p className="label hidden text-right md:block">
            Click anywhere to <span className="accent-text">disturb the anomaly</span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
