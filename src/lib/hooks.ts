import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { useStore, type SceneTarget } from './store';
import { motionEnabled, useMotionEnabled } from './motion';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** true when animations are off (device setting or the visitor's Motion button). */
export const useReducedMotion = () => !useMotionEnabled();
export const useCoarsePointer = () => useMediaQuery('(hover: none), (pointer: coarse)');

/* ── Scene sections ──────────────────────────────────────────────────────────
 * Each section registers the look it wants for the 3D background. One shared
 * IntersectionObserver watches a line across the middle of the viewport; the
 * section crossing it decides the scene.
 */
const sceneTargets = new Map<Element, SceneTarget>();
let observer: IntersectionObserver | null = null;

function applyAccent(target: SceneTarget) {
  const root = document.documentElement.style;
  root.setProperty('--accent', target.accent);
  root.setProperty('--accent-2', target.accent2);
}

function getObserver() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = sceneTargets.get(entry.target);
          if (target) {
            useStore.getState().setScene(target);
            applyAccent(target);
          }
        }
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    );
  }
  return observer;
}

export function useSceneSection(ref: RefObject<Element | null>, target: SceneTarget) {
  const key = JSON.stringify(target);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    sceneTargets.set(el, JSON.parse(key) as SceneTarget);
    const obs = getObserver();
    obs.observe(el);
    return () => {
      obs.unobserve(el);
      sceneTargets.delete(el);
    };
  }, [ref, key]);
}

/** Counts up to `value` once the element is on screen. */
export function useCountUp(value: number, active: boolean, duration = 1600) {
  const [display, setDisplay] = useState(active ? 0 : value);
  const started = useRef(false);
  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    if (!motionEnabled() || value === 0) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, value, duration]);
  return display;
}

/** Live GitHub info for a repo (stars, last push). Cached for the session. */
export interface RepoInfo {
  stars: number;
  pushedAt: string;
  language: string | null;
}
const repoCache = new Map<string, Promise<RepoInfo | null>>();

export function useGitHubRepo(fullName: string) {
  const [info, setInfo] = useState<RepoInfo | null>(null);
  useEffect(() => {
    let alive = true;
    const key = `gh:${fullName}`;
    let promise = repoCache.get(key);
    if (!promise) {
      promise = (async () => {
        try {
          const cached = sessionStorage.getItem(`anomality.${key}`);
          if (cached) return JSON.parse(cached) as RepoInfo;
        } catch {
          /* storage unavailable */
        }
        try {
          const res = await fetch(`https://api.github.com/repos/${fullName}`, {
            headers: { Accept: 'application/vnd.github+json' },
          });
          if (!res.ok) return null;
          const json = await res.json();
          const value: RepoInfo = {
            stars: json.stargazers_count ?? 0,
            pushedAt: json.pushed_at ?? '',
            language: json.language ?? null,
          };
          try {
            sessionStorage.setItem(`anomality.${key}`, JSON.stringify(value));
          } catch {
            /* ignore */
          }
          return value;
        } catch {
          return null;
        }
      })();
      repoCache.set(key, promise);
    }
    promise.then((v) => alive && setInfo(v));
    return () => {
      alive = false;
    };
  }, [fullName]);
  return info;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}
