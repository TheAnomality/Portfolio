import { useRef, type ReactNode } from 'react';
import { motion, useInView, useMotionValue, useSpring } from 'motion/react';
import { useCoarsePointer, useCountUp } from '../lib/hooks';

export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.76, 0, 0.24, 1];

/** Pulls its child towards the pointer, then springs back. */
export function Magnetic({ children, strength = 0.3, className = '' }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const coarse = useCoarsePointer();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.5 });
  return (
    <motion.div
      ref={ref}
      className={`inline-block ${className}`}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        if (coarse || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Letters slide up out of a mask. `play` forces the animation (used by the
 * hero after the preloader); otherwise it plays when scrolled into view.
 * (The in-view check sits on the wrapper: the letters start hidden inside
 * their masks, so they would never count as "visible" themselves.)
 */
export function SplitReveal({
  text,
  className = '',
  letterClassName = '',
  delay = 0,
  stagger = 0.035,
  play,
}: {
  text: string;
  className?: string;
  letterClassName?: string;
  delay?: number;
  stagger?: number;
  play?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const visible = play ?? inView;
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-block whitespace-nowrap">
        {text.split('').map((ch, i) => (
          <span key={i} className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
            <motion.span
              className={`inline-block origin-bottom-left ${letterClassName}`}
              initial={{ y: '115%', rotate: 6 }}
              animate={visible ? { y: '0%', rotate: 0 } : { y: '115%', rotate: 6 }}
              transition={{ duration: 1, delay: delay + i * stagger, ease: EASE }}
            >
              {ch === ' ' ? '\u00A0' : ch}
            </motion.span>
          </span>
        ))}
      </span>
    </span>
  );
}

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 36,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: 1, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** A number that counts up the first time it is seen. */
export function CountUp({ value, prefix = '', suffix = '', className = '' }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const n = useCountUp(value, inView);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {n.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}

/** Little animated singularity used as the logo. */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="lm-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#05040a" />
          <stop offset="62%" stopColor="#05040a" />
          <stop offset="78%" stopColor="#c9b8ff" />
          <stop offset="100%" stopColor="#9d7bff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lm-disk" x1="0" x2="1">
          <stop offset="0%" stopColor="#5ee7ff" />
          <stop offset="50%" stopColor="#9d7bff" />
          <stop offset="100%" stopColor="#ff6584" />
        </linearGradient>
      </defs>
      <g className="spin-slow">
        <ellipse cx="20" cy="20" rx="17" ry="5.5" fill="none" stroke="url(#lm-disk)" strokeWidth="1.6" transform="rotate(-18 20 20)" />
      </g>
      <circle cx="20" cy="20" r="9" fill="url(#lm-core)" />
      <circle cx="20" cy="20" r="6.4" fill="#05040a" stroke="#ece9f6" strokeOpacity="0.85" strokeWidth="1" />
    </svg>
  );
}

export function ArrowUpRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4.5 11.5l7-7M5.5 4.5h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M8 3v10M3.5 8.5L8 13l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlayIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M5 3.2v9.6a.6.6 0 00.9.5l7.6-4.8a.6.6 0 000-1L5.9 2.7a.6.6 0 00-.9.5z" />
    </svg>
  );
}

export function PauseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <rect x="3.5" y="3" width="3" height="10" rx="1" />
      <rect x="9.5" y="3" width="3" height="10" rx="1" />
    </svg>
  );
}

/** Text that rolls to a copy of itself on hover (pair with the .roll CSS). */
export function RollText({ children }: { children: string }) {
  return (
    <span className="roll">
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
    </span>
  );
}
