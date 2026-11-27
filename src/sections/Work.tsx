import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useInView, useMotionTemplate, useMotionValue, useSpring } from 'motion/react';
import { site, type Project } from '../content/site';
import { useStore } from '../lib/store';
import { timeAgo, useCoarsePointer, useGitHubRepo, useReducedMotion, useSceneSection } from '../lib/hooks';
import { ArrowUpRight, CountUp, EASE, Magnetic, Reveal, RollText, SplitReveal } from '../components/ui';

/** A second colour per project, used for the scene and gradients. */
const SECOND: Record<string, string> = { atom: '#3d7bff', animewiki: '#ffde59' };

function BrowserMockup({ project, onLaunch }: { project: Project; onLaunch: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref, { margin: '-15% 0px' });
  const coarse = useCoarsePointer();
  const reduced = useReducedMotion();
  const slides = project.gallery.length + 1; // video first, then stills
  const [slide, setSlide] = useState(0);

  // Advance the carousel while visible (the video gets longer on screen).
  useEffect(() => {
    if (!inView || reduced) return;
    const id = window.setTimeout(() => setSlide((s) => (s + 1) % slides), slide === 0 ? 9000 : 4200);
    return () => window.clearTimeout(id);
  }, [inView, slide, slides, reduced]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (inView && slide === 0 && !reduced) v.play().catch(() => {});
    else v.pause();
  }, [inView, slide, reduced]);

  // 3D tilt + moving glare
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const srx = useSpring(rx, { stiffness: 140, damping: 18 });
  const sry = useSpring(ry, { stiffness: 140, damping: 18 });
  const glare = useMotionTemplate`radial-gradient(600px circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.10), transparent 45%)`;

  const host = typeof window !== 'undefined' ? window.location.host : 'your-domain.com';

  return (
    <motion.div
      className="[perspective:1600px]"
      initial={{ opacity: 0, y: 80 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 1.3, ease: EASE }}
    >
      <motion.div
        ref={ref}
        style={{ rotateX: srx, rotateY: sry }}
        onPointerMove={(e) => {
          if (coarse || !ref.current) return;
          const r = ref.current.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          ry.set((px - 0.5) * 9);
          rx.set(-(py - 0.5) * 7);
          gx.set(px * 100);
          gy.set(py * 100);
        }}
        onPointerLeave={() => {
          rx.set(0);
          ry.set(0);
        }}
        className="group relative overflow-hidden rounded-2xl border border-line-strong bg-panel/90 shadow-[0_50px_120px_-30px_rgb(0_0_0/0.8)]"
      >
        <div
          className="pointer-events-none absolute -inset-px -z-10 rounded-2xl opacity-60 blur-2xl"
          style={{ background: 'linear-gradient(120deg, var(--accent), transparent 40%, var(--accent-2))' }}
        />
        {/* Browser bar */}
        <div className="flex h-11 items-center gap-3 border-b border-line bg-ink/80 px-4">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="mx-auto flex h-7 min-w-0 max-w-md flex-1 items-center justify-center gap-2 rounded-md bg-white/[0.05] px-3 font-mono text-[11px] text-muted">
            <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
              <path d="M8 1a3 3 0 00-3 3v2H4a1 1 0 00-1 1v6a1 1 0 001 1h8a1 1 0 001-1V7a1 1 0 00-1-1h-1V4a3 3 0 00-3-3zm-2 5V4a2 2 0 114 0v2H6z" />
            </svg>
            <span className="truncate">
              {host}
              {project.path}
            </span>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" aria-hidden="true" />
            Live
          </span>
        </div>

        {/* Screen */}
        <button
          type="button"
          onClick={onLaunch}
          className="relative block aspect-[16/10] w-full overflow-hidden bg-void text-left"
          data-cursor="Launch"
          aria-label={`Launch ${project.title} inside the portfolio`}
        >
          <video
            ref={video}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${slide === 0 ? 'opacity-100' : 'opacity-0'}`}
            src={project.video.src}
            poster={project.video.poster}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
          />
          {project.gallery.map((g, i) => (
            <img
              key={g.src}
              src={g.src}
              alt={g.alt}
              loading="lazy"
              decoding="async"
              width={1440}
              height={900}
              className={`absolute inset-0 h-full w-full object-cover object-top transition-[opacity,transform] duration-[1400ms] ease-out ${
                slide === i + 1 ? 'scale-100 opacity-100' : 'scale-[1.06] opacity-0'
              }`}
            />
          ))}
          <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: glare }} />
          <span className="absolute inset-0 flex items-center justify-center bg-void/45 opacity-0 backdrop-blur-[2px] transition-opacity duration-500 group-hover:opacity-100">
            <span className="btn btn-accent pointer-events-none">
              Launch inside portfolio <ArrowUpRight />
            </span>
          </span>
        </button>
      </motion.div>

      {/* Slide indicators */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {Array.from({ length: slides }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSlide(i)}
            aria-label={i === 0 ? 'Show preview video' : `Show screenshot ${i}`}
            aria-pressed={slide === i}
            className="group/dot grid h-6 w-6 place-items-center"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-500 ${slide === i ? 'w-6 bg-[var(--accent)]' : 'w-1.5 bg-white/25 group-hover/dot:bg-white/60'}`}
            />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ProjectSection({ project, flip }: { project: Project; flip: boolean }) {
  const intro = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const accent2 = SECOND[project.id] ?? '#5ee7ff';
  const base = { shape: project.shape, y: 0, accent: project.accent, accent2 };
  useSceneSection(intro, { ...base, x: flip ? -2.35 : 2.35, scale: 1, dim: 1 });
  useSceneSection(detail, { ...base, x: flip ? -2.8 : 2.8, scale: 0.8, dim: 0.3 });
  const openViewer = useStore((s) => s.openViewer);
  const repo = useGitHubRepo(project.githubRepo);

  return (
    <article
      aria-labelledby={`${project.id}-title`}
      className="relative"
      style={{ '--accent': project.accent, '--accent-2': accent2 } as CSSProperties}
    >
      {/* Chapter opener */}
      <div ref={intro} className="shell grid min-h-[100svh] items-center py-24 md:grid-cols-12">
        <div className={flip ? 'md:col-span-7 md:col-start-6 md:text-right' : 'md:col-span-7'}>
          <Reveal>
            <p className={`label flex items-center gap-3 ${flip ? 'md:justify-end' : ''}`}>
              <span className="accent-text">{project.index}</span>
              <span className="h-px w-12 bg-line-strong" aria-hidden="true" />
              {project.role} · {project.year}
            </p>
          </Reveal>
          <h3
            id={`${project.id}-title`}
            className="project-title mt-6 font-display font-semibold leading-[0.85] tracking-[-0.05em]"
            style={{ '--len': project.title.length } as CSSProperties}
          >
            <SplitReveal text={project.title} />
          </h3>
          <Reveal delay={0.15}>
            <p className="serif-accent mt-6 text-[clamp(1.5rem,3.2vw,2.8rem)] leading-tight text-fg/90">{project.tagline}</p>
          </Reveal>
          <dl className={`mt-12 grid max-w-xl grid-cols-2 gap-x-10 gap-y-8 ${flip ? 'md:ml-auto' : ''}`}>
            {project.stats.map((s, i) => (
              <Reveal key={s.label} delay={0.2 + i * 0.08} className="flex flex-col-reverse gap-2 border-t border-line pt-4 text-left">
                <dt className="text-sm text-muted">{s.label}</dt>
                <dd className="font-display text-[clamp(2rem,4vw,3.2rem)] font-light leading-none tracking-tight">
                  <CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} />
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>

      {/* Details + live preview */}
      <div ref={detail} className="shell grid gap-12 pb-36 lg:grid-cols-12 lg:gap-16">
        <div className={`lg:col-span-7 ${flip ? 'lg:order-2' : ''}`}>
          <BrowserMockup project={project} onLaunch={() => openViewer(project.id)} />
        </div>
        <div className="flex flex-col justify-center lg:col-span-5">
          <Reveal>
            <p className="text-lg leading-relaxed text-fg/80">{project.summary}</p>
          </Reveal>
          <ul className="mt-8 space-y-4">
            {project.highlights.map((h, i) => (
              <Reveal key={h} delay={0.05 * i}>
                <li className="flex gap-4 text-[0.98rem] leading-relaxed text-muted">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" aria-hidden="true" />
                  {h}
                </li>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={0.1}>
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="Built with">
              {project.stack.map((t) => (
                <li key={t} className="chip">
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-10 flex flex-wrap gap-3">
              <Magnetic>
                <button type="button" onClick={() => openViewer(project.id)} className="btn btn-accent" data-cursor="Launch">
                  <RollText>Launch inside portfolio</RollText>
                </button>
              </Magnetic>
              <a href={project.path} target="_blank" rel="noopener" className="btn btn-ghost">
                <RollText>Full site</RollText>
                <ArrowUpRight />
              </a>
              <a href={project.repo} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <RollText>Source</RollText>
                <ArrowUpRight />
              </a>
            </div>
            <p className="mt-6 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-dim">
              {repo && (
                <>
                  <span>★ {repo.stars} on GitHub</span>
                  {repo.pushedAt && <span>Updated {timeAgo(repo.pushedAt)}</span>}
                  {repo.language && <span>{repo.language}</span>}
                </>
              )}
            </p>
          </Reveal>
        </div>
      </div>
    </article>
  );
}

export default function Work() {
  const head = useRef<HTMLDivElement>(null);
  const first = site.projects[0];
  useSceneSection(head, {
    shape: first?.shape ?? 'atom',
    x: 2.35,
    y: 0,
    scale: 0.9,
    dim: 0.85,
    accent: first?.accent ?? '#9d7bff',
    accent2: SECOND[first?.id ?? ''] ?? '#5ee7ff',
  });

  return (
    <section id="work" aria-labelledby="work-title" className="relative">
      <div ref={head} className="shell flex min-h-[80vh] flex-col justify-center py-24">
        <Reveal>
          <p className="label">(01) Selected work</p>
        </Reveal>
        <h2 id="work-title" className="mt-6 font-display text-[clamp(2.8rem,9vw,9.5rem)] font-medium leading-[0.9] tracking-[-0.045em]">
          <SplitReveal text="Things I’ve" />
          <br />
          <span className="serif-accent font-normal tracking-normal">built.</span>
        </h2>
        <Reveal delay={0.2}>
          <p className="mt-8 max-w-lg text-lg text-muted">
            {site.projects.length} live projects running right inside this portfolio. Open them here without leaving, or in a new tab.
          </p>
        </Reveal>
      </div>
      {site.projects.map((p, i) => (
        <ProjectSection key={p.id} project={p} flip={i % 2 === 1} />
      ))}
    </section>
  );
}
