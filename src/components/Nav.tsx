import { useEffect, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react';
import { site } from '../content/site';
import { useStore } from '../lib/store';
import { scrollToTarget } from '../lib/smooth-scroll';
import { setMotion, useMotionState } from '../lib/motion';
import { EASE, LogoMark, Magnetic, RollText } from './ui';

export const NAV_LINKS = [
  { id: 'work', label: 'Work' },
  { id: 'showreel', label: 'Showreel' },
  { id: 'everything', label: 'Everything' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
];

function useActiveSection() {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = NAV_LINKS.map((l) => document.getElementById(l.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    els.forEach((el) => io.observe(el));
    const top = new IntersectionObserver(([e]) => e.isIntersecting && setActive(null), { rootMargin: '-45% 0px -45% 0px' });
    const hero = document.getElementById('top');
    if (hero) top.observe(hero);
    return () => {
      io.disconnect();
      top.disconnect();
    };
  }, []);
  return active;
}

/** Turns all animation on or off (overrides the device's Reduce motion setting). */
function MotionToggle({ compact = false }: { compact?: boolean }) {
  const { enabled } = useMotionState();
  return (
    <button
      type="button"
      onClick={() => setMotion(!enabled)}
      aria-pressed={enabled}
      aria-label={enabled ? 'Animations on. Turn them off' : 'Animations off. Turn them on'}
      title={enabled ? 'Turn animations off' : 'Turn animations on'}
      data-cursor={enabled ? 'Calm' : 'Animate'}
      className={`glass relative z-10 flex h-11 items-center gap-2 rounded-full text-sm text-fg/85 transition-colors hover:text-fg ${compact ? 'w-11 justify-center' : 'px-4'}`}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        {enabled ? (
          <path d="M8 1.5l1.6 4.2L14 7.3l-4.4 1.6L8 13.5 6.4 8.9 2 7.3l4.4-1.6L8 1.5z" strokeLinejoin="round" fill="var(--accent)" stroke="var(--accent)" />
        ) : (
          <>
            <path d="M8 1.5l1.6 4.2L14 7.3l-4.4 1.6L8 13.5 6.4 8.9 2 7.3l4.4-1.6L8 1.5z" strokeLinejoin="round" />
            <path d="M2.5 13.5l11-11" strokeLinecap="round" />
          </>
        )}
      </svg>
      {!compact && <span>Motion {enabled ? 'on' : 'off'}</span>}
    </button>
  );
}

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });
  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[55] h-[2px] origin-left"
      style={{ scaleX, background: 'linear-gradient(90deg, var(--accent-2), var(--accent))' }}
    />
  );
}

export default function Nav() {
  const introDone = useStore((s) => s.introDone);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const active = useActiveSection();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(y > prev && y > 240);
    setScrolled(y > 40);
  });

  // While the mobile menu is open, the page behind it is inert and Esc closes it.
  useEffect(() => {
    const targets = [document.getElementById('main'), document.querySelector('footer')];
    targets.forEach((el) => el && (el.inert = open));
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const go = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    scrollToTarget(id === 'top' ? 0 : `#${id}`);
  };

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: hidden && !open ? -110 : 0, opacity: introDone ? 1 : 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <div
          className={`pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500 ${scrolled ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'linear-gradient(to bottom, rgb(5 4 10 / 0.85), rgb(5 4 10 / 0))' }}
        />
        <div className="shell flex h-20 items-center justify-between gap-4">
          <a href="#top" onClick={go('top')} className="group flex items-center gap-3" aria-label={`${site.name}, back to top`}>
            <LogoMark className="h-9 w-9 transition-transform duration-700 group-hover:rotate-180" />
            <span className="font-display text-[0.95rem] font-medium tracking-tight">{site.name}</span>
          </a>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="glass flex items-center gap-0.5 rounded-full px-1.5 py-1.5">
              {NAV_LINKS.map((l) => (
                <li key={l.id}>
                  <a
                    href={`#${l.id}`}
                    onClick={go(l.id)}
                    aria-current={active === l.id ? 'true' : undefined}
                    className={`relative block rounded-full px-4 py-2 text-sm transition-colors duration-300 ${
                      active === l.id ? 'text-fg' : 'text-muted hover:text-fg'
                    }`}
                  >
                    {active === l.id && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 -z-10 rounded-full bg-white/[0.08]"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <RollText>{l.label}</RollText>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:block">
              <MotionToggle />
            </div>
            <div className="lg:hidden">
              <MotionToggle compact />
            </div>
            <div className="hidden sm:block">
              <Magnetic>
                <a href="#contact" onClick={go('contact')} className="btn btn-primary h-11 text-sm" data-cursor="Say hi">
                  <RollText>Let’s talk</RollText>
                </a>
              </Magnetic>
            </div>
            <button
              type="button"
              className="glass relative z-10 flex h-11 items-center gap-2 rounded-full px-4 text-sm md:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((o) => !o)}
            >
              <span className="relative block h-2.5 w-4" aria-hidden="true">
                <span className={`absolute left-0 h-px w-4 bg-current transition-transform duration-300 ${open ? 'top-1 rotate-45' : 'top-0'}`} />
                <span className={`absolute left-0 h-px w-4 bg-current transition-transform duration-300 ${open ? 'top-1 -rotate-45' : 'top-2'}`} />
              </span>
              {open ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 flex flex-col bg-void/95 backdrop-blur-xl md:hidden"
            initial={{ clipPath: 'circle(0% at 90% 40px)' }}
            animate={{ clipPath: 'circle(150% at 90% 40px)' }}
            exit={{ clipPath: 'circle(0% at 90% 40px)' }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <nav aria-label="Mobile" className="shell flex flex-1 flex-col justify-center gap-1">
              {NAV_LINKS.map((l, i) => (
                <motion.a
                  key={l.id}
                  href={`#${l.id}`}
                  onClick={go(l.id)}
                  className="flex items-baseline gap-4 py-2 font-display text-[2.6rem] font-medium tracking-tight"
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.12 + i * 0.06, duration: 0.7, ease: EASE }}
                >
                  <span className="label accent-text">0{i + 1}</span>
                  {l.label}
                </motion.a>
              ))}
            </nav>
            <div className="shell flex flex-wrap gap-3 pb-10">
              {site.socials.map((s) => (
                <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="chip">
                  {s.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
