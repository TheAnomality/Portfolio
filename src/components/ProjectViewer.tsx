import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { site } from '../content/site';
import { useStore } from '../lib/store';
import { lockScroll } from '../lib/smooth-scroll';
import { ArrowUpRight, EASE_IN_OUT } from './ui';

/**
 * Opens a project (served by this site at /atom/ or /animewiki/) full-screen
 * inside the portfolio. The browser's Back button closes it, and the page
 * behind becomes inert so keyboard focus stays inside.
 */
export default function ProjectViewer() {
  const viewer = useStore((s) => s.viewer);
  const close = useStore((s) => s.closeViewer);
  const project = site.projects.find((p) => p.id === viewer) ?? null;
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const requestClose = useCallback(() => {
    if (window.location.hash.startsWith('#view-')) window.history.back();
    else close();
  }, [close]);

  useEffect(() => {
    if (!project) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    setLoaded(false);
    lockScroll(true);
    const content = document.getElementById('content');
    if (content) content.inert = true;

    if (window.location.hash !== `#view-${project.id}`) {
      window.history.pushState({ view: project.id }, '', `#view-${project.id}`);
    }
    const onPop = () => close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 80);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      lockScroll(false);
      if (content) content.inert = false;
      returnFocus.current?.focus?.({ preventScroll: true });
    };
  }, [project, close, requestClose]);

  const host = typeof window !== 'undefined' ? window.location.host : '';

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          key={project.id}
          role="dialog"
          aria-modal="true"
          aria-label={`${project.title}, running live inside the portfolio`}
          className="fixed inset-0 z-[80] flex flex-col bg-void"
          style={{ ['--accent' as string]: project.accent }}
          initial={{ clipPath: 'inset(100% 0% 0% 0%)' }}
          animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
          exit={{ clipPath: 'inset(0% 0% 100% 0%)' }}
          transition={{ duration: 0.85, ease: EASE_IN_OUT }}
        >
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-2 sm:gap-3 sm:px-4">
            <button
              ref={closeRef}
              type="button"
              onClick={requestClose}
              className="flex h-10 items-center gap-2 rounded-full px-3 text-sm text-fg transition-colors hover:bg-white/[0.07]"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M10 3.5L5.5 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Back to portfolio</span>
              <span className="sm:hidden">Back</span>
            </button>

            <div className="mx-auto flex h-9 min-w-0 max-w-xl flex-1 items-center gap-2 rounded-full border border-line bg-panel px-4 text-sm text-muted">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }} />
              <span className="truncate">
                {host}
                <span className="text-fg">{project.path}</span>
              </span>
              <span className="ml-auto hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-dim sm:inline">Live</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setLoaded(false);
                setReloadKey((k) => k + 1);
              }}
              className="grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:bg-white/[0.07] hover:text-fg"
              aria-label="Reload project"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M13 8a5 5 0 11-1.6-3.7M13 2.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <a
              href={project.path}
              target="_blank"
              rel="noopener"
              className="grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:bg-white/[0.07] hover:text-fg"
              aria-label={`Open ${project.title} in a new tab`}
            >
              <ArrowUpRight />
            </a>
          </div>

          <div className="relative min-h-0 flex-1">
            <AnimatePresence>
              {!loaded && (
                <motion.div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-void"
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="relative h-14 w-14">
                    <span className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-[var(--accent)]" />
                    <span className="absolute inset-3 animate-ping rounded-full bg-[var(--accent)] opacity-40" />
                  </div>
                  <p className="label">Launching {project.title}…</p>
                </motion.div>
              )}
            </AnimatePresence>
            <iframe
              key={reloadKey}
              src={project.path}
              title={`${project.title} (live site)`}
              className="h-full w-full border-0"
              allow="fullscreen; clipboard-write; autoplay; encrypted-media; picture-in-picture"
              onLoad={() => setLoaded(true)}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
