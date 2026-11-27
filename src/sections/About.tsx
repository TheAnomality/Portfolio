import { useRef } from 'react';
import { site } from '../content/site';
import { useSceneSection } from '../lib/hooks';
import { CountUp, Reveal, SplitReveal } from '../components/ui';

export default function About() {
  const ref = useRef<HTMLElement>(null);
  useSceneSection(ref, { shape: 'galaxy', x: 2.7, y: 0, scale: 0.95, dim: 0.75, accent: '#9d7bff', accent2: '#5ee7ff' });

  return (
    <section id="about" ref={ref} aria-labelledby="about-title" className="relative py-32 md:py-40">
      <div className="shell grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Reveal>
            <p className="label">(04) About</p>
          </Reveal>
          <h2 id="about-title" className="mt-6 font-display text-[clamp(2.6rem,6.5vw,6rem)] font-medium leading-[0.92] tracking-[-0.045em]">
            <SplitReveal text="Science, story" />
            <br />
            <span className="serif-accent font-normal tracking-normal">&amp; code.</span>
          </h2>
          {site.about.paragraphs.map((p, i) => (
            <Reveal key={i} delay={0.1 + i * 0.08}>
              <p className="mt-8 max-w-2xl text-lg leading-relaxed text-fg/80 md:text-xl">{p}</p>
            </Reveal>
          ))}
          <Reveal delay={0.2}>
            <div className="mt-14">
              <p className="label">Right now</p>
              <ul className="mt-5 space-y-3">
                {site.about.now.map((n) => (
                  <li key={n} className="flex items-center gap-4 text-muted">
                    <span className="h-px w-8 shrink-0 bg-[var(--accent)]" aria-hidden="true" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-5 lg:pt-28">
          <Reveal>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.75rem] border border-line bg-line">
              {site.about.facts.map((f) => (
                <div key={f.label} className="flex flex-col-reverse gap-3 bg-void/75 p-6 backdrop-blur-md md:p-8">
                  <dt className="text-sm leading-snug text-muted">{f.label}</dt>
                  <dd className="font-display text-[clamp(2.6rem,5vw,4rem)] font-light leading-none tracking-tight">
                    <CountUp value={f.value} prefix={f.prefix} suffix={f.suffix} />
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 flex flex-wrap gap-2">
              {site.socials.map((s) => (
                <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="chip transition-colors hover:border-fg hover:text-fg">
                  {s.label} ↗
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
