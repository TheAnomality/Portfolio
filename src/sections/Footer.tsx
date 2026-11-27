import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { site } from '../content/site';
import { useSceneSection } from '../lib/hooks';
import { scrollToTarget } from '../lib/smooth-scroll';
import { useStore } from '../lib/store';
import { RollText } from '../components/ui';

export default function Footer() {
  const ref = useRef<HTMLElement>(null);
  useSceneSection(ref, { shape: 'portal', x: 0, y: 0.6, scale: 0.85, dim: 0.5, accent: '#9d7bff', accent2: '#ff6584' });
  const openViewer = useStore((s) => s.openViewer);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const y = useTransform(scrollYProgress, [0, 1], ['40%', '0%']);

  return (
    <footer ref={ref} className="relative z-10 overflow-hidden border-t border-line pt-20">
      <div className="shell">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="max-w-sm font-display text-2xl font-light leading-snug tracking-tight">
              Built from scratch with React, Three.js, Motion and a lot of <span className="serif-accent accent-text">curiosity</span>.
            </p>
          </div>
          <div>
            <p className="label">Projects</p>
            <ul className="mt-4 space-y-2">
              {site.projects.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => openViewer(p.id)} className="text-fg/85 transition-colors hover:text-fg">
                    <RollText>{p.title}</RollText>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label">Elsewhere</p>
            <ul className="mt-4 space-y-2">
              {site.socials.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-fg/85 transition-colors hover:text-fg">
                    <RollText>{s.label}</RollText>
                  </a>
                </li>
              ))}
              {site.email && (
                <li>
                  <a href={`mailto:${site.email}`} className="text-fg/85 hover:text-fg">
                    {site.email}
                  </a>
                </li>
              )}
              <li>
                <button type="button" onClick={() => scrollToTarget(0)} className="text-fg/85 transition-colors hover:text-fg">
                  <RollText>Back to top ↑</RollText>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <motion.p
        aria-hidden="true"
        style={{ y }}
        className="mt-20 select-none whitespace-nowrap text-center font-display text-[10.6vw] font-semibold leading-[0.8] tracking-[-0.035em] text-outline"
      >
        {site.name}
      </motion.p>

      <div className="shell flex flex-wrap items-center justify-between gap-4 border-t border-line py-6 font-mono text-xs text-dim">
        <span>
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </span>
        <span>React · Three.js · Motion · HyperFrames · Deployed on Vercel</span>
      </div>
    </footer>
  );
}
