import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../lib/store';
import { setMotion, useMotionState } from '../lib/motion';
import { EASE } from './ui';

const WEBGL_KEY = 'anomality.webgl-notice-dismissed';

function Toast({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[70] rounded-2xl border border-line-strong bg-panel/[0.97] p-5 shadow-[0_24px_70px_-20px_rgb(0_0_0/0.9)] backdrop-blur-xl sm:inset-x-auto sm:bottom-6 sm:left-6 sm:max-w-md"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <p className="font-display text-base font-medium tracking-tight">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
      <div className="mt-4 flex flex-wrap gap-2">{actions}</div>
    </motion.div>
  );
}

/**
 * Explains why the page is still when that's not obvious:
 * - the device asks for reduced motion (offers to turn animations on), or
 * - WebGL is unavailable, so the 3D background is replaced by a gradient.
 */
export default function Notices({ webgl }: { webgl: boolean }) {
  const introDone = useStore((s) => s.introDone);
  const viewer = useStore((s) => s.viewer);
  const { pref, systemReduced } = useMotionState();
  const [webglDismissed, setWebglDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(WEBGL_KEY) === '1';
    } catch {
      return false;
    }
  });

  const showMotion = introDone && !viewer && systemReduced && pref === null;
  const showWebgl = introDone && !viewer && !webgl && !webglDismissed && !showMotion;

  return (
    <AnimatePresence>
      {showMotion && (
        <Toast
          key="motion"
          title="Animations are paused"
          actions={
            <>
              <button type="button" className="btn btn-accent h-10 text-sm" onClick={() => setMotion(true)}>
                Turn animations on
              </button>
              <button type="button" className="btn btn-ghost h-10 text-sm" onClick={() => setMotion(false)}>
                Keep them off
              </button>
            </>
          }
        >
          Your device has <b className="text-fg">Reduce motion</b> turned on, so this site keeps still. You can change it any time with the
          Motion button at the top.
        </Toast>
      )}
      {showWebgl && (
        <Toast
          key="webgl"
          title="The 3D background is off"
          actions={
            <button
              type="button"
              className="btn btn-ghost h-10 text-sm"
              onClick={() => {
                setWebglDismissed(true);
                try {
                  sessionStorage.setItem(WEBGL_KEY, '1');
                } catch {
                  /* ignore */
                }
              }}
            >
              Got it
            </button>
          }
        >
          This browser can't run WebGL right now. Turning on <b className="text-fg">graphics (hardware) acceleration</b> in your browser
          settings brings the particles back.
        </Toast>
      )}
    </AnimatePresence>
  );
}
