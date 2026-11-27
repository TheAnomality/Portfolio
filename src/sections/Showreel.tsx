import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { site } from '../content/site';
import { useReducedMotion, useSceneSection } from '../lib/hooks';
import { EASE, PauseIcon, PlayIcon, Reveal, SplitReveal } from '../components/ui';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Showreel() {
  const ref = useRef<HTMLElement>(null);
  useSceneSection(ref, { shape: 'galaxy', x: 0, y: 0, scale: 1.3, dim: 0.32, accent: '#9d7bff', accent2: '#5ee7ff' });
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const inView = useInView(frame, { margin: '-25% 0px' });
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(site.showreel.seconds);
  const userPaused = useRef(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (inView && !reduced && !userPaused.current) v.play().catch(() => {});
    else if (!inView) v.pause();
  }, [inView, reduced]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => {});
    } else {
      userPaused.current = true;
      v.pause();
    }
  };

  return (
    <section id="showreel" ref={ref} aria-labelledby="showreel-title" className="relative py-32 md:py-40">
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <Reveal>
              <p className="label">(02) Showreel</p>
            </Reveal>
            <h2 id="showreel-title" className="mt-6 font-display text-[clamp(2.6rem,7vw,7rem)] font-medium leading-[0.92] tracking-[-0.045em]">
              <SplitReveal text="Everything," />
              <br />
              <span className="serif-accent font-normal tracking-normal">in {site.showreel.seconds} seconds.</span>
            </h2>
          </div>
          <Reveal delay={0.15} className="max-w-sm">
            <p className="text-muted">
              A motion piece written as plain HTML and GSAP, then rendered to video with{' '}
              <a className="text-fg underline decoration-[var(--accent)] underline-offset-4" href="https://hyperframes.heygen.com" target="_blank" rel="noopener noreferrer">
                HyperFrames
              </a>
              . The source lives in this repo’s <code className="font-mono text-sm text-fg/80">showreel/</code> folder.
            </p>
          </Reveal>
        </div>

        <motion.div
          ref={frame}
          className="group relative mt-14 overflow-hidden rounded-[1.75rem] border border-line-strong bg-panel shadow-[0_40px_140px_-40px_rgb(157_123_255/0.5)]"
          initial={{ opacity: 0, y: 80, scale: 0.94 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 1.3, ease: EASE }}
        >
          <video
            ref={video}
            className="aspect-video w-full object-cover"
            src={site.showreel.src}
            poster={site.showreel.poster}
            muted
            loop
            playsInline
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || site.showreel.seconds)}
            onClick={toggle}
            aria-label={`${site.name} showreel`}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-4 bg-gradient-to-t from-void/85 via-void/30 to-transparent p-4 pt-16 md:p-6 md:pt-20">
            <button
              type="button"
              onClick={toggle}
              className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-full bg-fg text-void transition-transform duration-300 hover:scale-110"
              aria-label={playing ? 'Pause showreel' : 'Play showreel'}
              data-cursor={playing ? 'Pause' : 'Play'}
            >
              {playing ? <PauseIcon /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
            </button>
            <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <div className="h-full bg-gradient-to-r from-[var(--accent-2)] to-[var(--accent)]" style={{ width: `${(time / (duration || 1)) * 100}%` }} />
            </div>
            <span className="font-mono text-xs tabular-nums text-fg/80">
              {fmt(time)} / {fmt(duration)}
            </span>
            <button
              type="button"
              onClick={() => video.current?.requestFullscreen?.().catch(() => {})}
              className="pointer-events-auto grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/25 text-fg transition-colors hover:bg-white/10"
              aria-label="Watch full screen"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
