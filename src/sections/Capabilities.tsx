import { useRef, type PointerEvent } from 'react';
import { motion, useAnimationFrame, useMotionValue, useScroll, useSpring, useTransform, useVelocity, wrap } from 'motion/react';
import { site, type Capability } from '../content/site';
import { useReducedMotion, useSceneSection } from '../lib/hooks';
import { EASE, Reveal, SplitReveal } from '../components/ui';

const ICONS = [
  // 3D cube
  <path key="0" d="M12 2.5l8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4L12 2.5zm0 0v9.5m0 0l8.5-4.6M12 12L3.5 7.4" />,
  // layout
  <path key="1" d="M3.5 4.5h17v15h-17zM3.5 9h17M9 9v10.5" />,
  // nodes
  <path key="2" d="M6 6.5a2.5 2.5 0 110-.01M18 6.5a2.5 2.5 0 110-.01M12 18.5a2.5 2.5 0 110-.01M7.8 8.2l3 7.6M16.2 8.2l-3 7.6M8.5 6.5h7" />,
  // motion
  <path key="3" d="M3 12c2.5-6 5.5-6 8 0s5.5 6 8 0M3 17c2.5-6 5.5-6 8 0M13 7c2.5-6 5.5-6 8 0" />,
];

function CapabilityCard({ cap, index }: { cap: Capability; index: number }) {
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <motion.article
      onPointerMove={onMove}
      className="spotlight glass flex min-h-[340px] flex-col rounded-[1.75rem] p-7 md:p-10"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 1, delay: (index % 2) * 0.1, ease: EASE }}
    >
      <div className="flex items-start justify-between">
        <span className="label accent-text">0{index + 1}</span>
        <svg viewBox="0 0 24 24" className="h-9 w-9 text-fg/70" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" aria-hidden="true">
          {ICONS[index % ICONS.length]}
        </svg>
      </div>
      <h3 className="mt-auto pt-16 font-display text-[1.7rem] font-medium leading-tight tracking-tight md:text-[2.1rem]">{cap.title}</h3>
      <p className="mt-3 max-w-md leading-relaxed text-muted">{cap.description}</p>
      <ul className="mt-6 flex flex-wrap gap-2">
        {cap.tools.map((t) => (
          <li key={t} className="chip">
            {t}
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

/** A ticker that speeds up (and reverses) with your scrolling. */
function MarqueeRow({ items, baseVelocity }: { items: string[]; baseVelocity: number }) {
  const reduced = useReducedMotion();
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const factor = useTransform(velocity, [0, 1000], [0, 4], { clamp: false });
  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`);
  const direction = useRef(1);

  useAnimationFrame((_, delta) => {
    if (reduced) return;
    let moveBy = direction.current * baseVelocity * (delta / 1000);
    const f = factor.get();
    if (f < 0) direction.current = -1;
    else if (f > 0) direction.current = 1;
    moveBy += direction.current * moveBy * f;
    baseX.set(baseX.get() + moveBy);
  });

  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <span key={item} className="flex items-center">
          <span className="px-6 font-display text-[clamp(2rem,5vw,4.5rem)] font-light tracking-tight text-fg/85">{item}</span>
          <span className="text-[clamp(1rem,2vw,1.6rem)] accent-text" aria-hidden="true">
            ✦
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden whitespace-nowrap py-3">
      <motion.div className="flex w-max" style={{ x }}>
        {row(false)}
        {row(true)}
      </motion.div>
    </div>
  );
}

export default function Capabilities() {
  const ref = useRef<HTMLElement>(null);
  useSceneSection(ref, { shape: 'galaxy', x: 0, y: 0, scale: 1.6, dim: 0.5, accent: '#9d7bff', accent2: '#5ee7ff' });
  const half = Math.ceil(site.marquee.length / 2);

  return (
    <section id="everything" ref={ref} aria-labelledby="everything-title" className="relative py-32 md:py-40">
      <div className="shell">
        <Reveal>
          <p className="label">(03) Everything</p>
        </Reveal>
        <h2 id="everything-title" className="mt-6 max-w-5xl font-display text-[clamp(2.6rem,7vw,6.8rem)] font-medium leading-[0.92] tracking-[-0.045em]">
          <SplitReveal text="One person." />
          <br />
          <span className="serif-accent font-normal tracking-normal">Every layer</span> of the stack.
        </h2>
        <div className="mt-16 grid gap-4 md:grid-cols-2">
          {site.capabilities.map((c, i) => (
            <CapabilityCard key={c.title} cap={c} index={i} />
          ))}
        </div>
      </div>
      <div className="mt-24 border-y border-line bg-void/40 py-4 backdrop-blur-sm" aria-label="Tools I use">
        <MarqueeRow items={site.marquee.slice(0, half)} baseVelocity={-2.2} />
        <MarqueeRow items={site.marquee.slice(half)} baseVelocity={2.2} />
      </div>
    </section>
  );
}
