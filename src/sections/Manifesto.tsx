import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { site } from '../content/site';
import { HERO_SCENE } from '../lib/store';
import { useSceneSection } from '../lib/hooks';

/** "*word*" in the manifesto becomes an accented word. */
function parse(text: string) {
  return text.split(/\s+/).map((raw) => {
    const accent = /^\*.*\*[.,!?;:]?$/.test(raw);
    return { text: raw.replace(/\*/g, ''), accent };
  });
}

function Word({ children, progress, range, accent }: { children: string; progress: MotionValue<number>; range: [number, number]; accent: boolean }) {
  const opacity = useTransform(progress, range, [0.13, 1]);
  const blur = useTransform(progress, range, ['blur(6px)', 'blur(0px)']);
  return (
    <motion.span style={{ opacity, filter: blur }} className={accent ? 'serif-accent accent-text' : undefined}>
      {children}{' '}
    </motion.span>
  );
}

export default function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  useSceneSection(ref, { ...HERO_SCENE, x: 0, y: 0, scale: 1.45, dim: 0.38 });
  const textRef = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: textRef, offset: ['start 0.85', 'end 0.5'] });
  const words = parse(site.manifesto);

  return (
    <section ref={ref} aria-label="Manifesto" className="relative py-[20vh]">
      <div className="shell">
        <p className="label mb-10">(00) Manifesto</p>
        <p
          ref={textRef}
          className="max-w-6xl font-display text-[clamp(1.75rem,4.4vw,4.3rem)] font-light leading-[1.14] tracking-[-0.025em]"
        >
          {words.map((w, i) => (
            <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} accent={w.accent}>
              {w.text}
            </Word>
          ))}
        </p>
      </div>
    </section>
  );
}
