import { useSyncExternalStore } from 'react';

/**
 * Should the site animate?
 *
 * By default it follows the device's "Reduce motion" setting (Windows:
 * Settings → Accessibility → Visual effects → Animation effects; macOS/iOS:
 * Accessibility → Reduce motion). Visitors can override it with the Motion
 * button in the nav; their choice is remembered in this browser.
 */
export type MotionPref = 'on' | 'off' | null; // null = follow the device

const KEY = 'anomality.motion';
const listeners = new Set<() => void>();
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

function readPref(): MotionPref {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'on' || value === 'off' ? value : null;
  } catch {
    return null;
  }
}

let pref: MotionPref = readPref();

export const systemReducedMotion = () => !!media?.matches;
export const motionEnabled = () => (pref ? pref === 'on' : !systemReducedMotion());

function applyClass() {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduce-motion', !motionEnabled());
}

function emit() {
  applyClass();
  listeners.forEach((listener) => listener());
}

/** true / false to choose, null to go back to following the device. */
export function setMotion(on: boolean | null) {
  pref = on === null ? null : on ? 'on' : 'off';
  try {
    if (pref) localStorage.setItem(KEY, pref);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the choice lasts for this visit */
  }
  emit();
}

media?.addEventListener('change', emit);
applyClass();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useMotionEnabled() {
  return useSyncExternalStore(subscribe, motionEnabled, () => true);
}

export interface MotionState {
  enabled: boolean;
  pref: MotionPref;
  systemReduced: boolean;
}

let cached: MotionState = { enabled: motionEnabled(), pref, systemReduced: systemReducedMotion() };
const snapshot = () => {
  const next = { enabled: motionEnabled(), pref, systemReduced: systemReducedMotion() };
  if (next.enabled !== cached.enabled || next.pref !== cached.pref || next.systemReduced !== cached.systemReduced) cached = next;
  return cached;
};

export function useMotionState(): MotionState {
  return useSyncExternalStore(subscribe, snapshot, () => cached);
}
