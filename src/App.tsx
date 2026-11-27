import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { site } from './content/site';
import { pointer, useStore } from './lib/store';
import { hasWebGL, useReducedMotion } from './lib/hooks';
import Notices from './components/Notices';
import { startSmoothScroll } from './lib/smooth-scroll';
import Preloader from './components/Preloader';
import Cursor from './components/Cursor';
import Nav, { ScrollProgress } from './components/Nav';
import ProjectViewer from './components/ProjectViewer';
import Hero from './sections/Hero';
import Manifesto from './sections/Manifesto';
import Work from './sections/Work';
import Showreel from './sections/Showreel';
import Capabilities from './sections/Capabilities';
import About from './sections/About';
import Contact from './sections/Contact';
import Footer from './sections/Footer';

// three.js + React Three Fiber load in their own chunk, after the page shell.
const Scene = lazy(() => import('./three/Scene'));

export default function App() {
  const reduced = useReducedMotion();
  const [webgl] = useState(hasWebGL);
  const setSceneReady = useStore((s) => s.setSceneReady);
  const introDone = useStore((s) => s.introDone);
  const openViewer = useStore((s) => s.openViewer);
  const deepLink = useRef<string | null>(null);

  // Lenis smooth scrolling, restarted when the Motion preference changes.
  useEffect(() => startSmoothScroll(), [reduced]);

  useEffect(() => {
    if (webgl) return;
    setSceneReady();
    console.info('[TheAnomality] 3D background off: WebGL 2 is not available (graphics acceleration may be disabled).');
  }, [webgl, setSceneReady]);

  // Shared pointer position for the particles (no React re-renders).
  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      pointer.active = true;
    };
    const leave = () => {
      pointer.active = false;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'touch') pointer.active = false;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
    };
  }, []);

  // Links like your-domain.com/#view-atom open that project straight away.
  useEffect(() => {
    const match = window.location.hash.match(/^#view-(.+)$/);
    if (match && site.projects.some((p) => p.id === match[1])) {
      deepLink.current = match[1];
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);
  useEffect(() => {
    if (introDone && deepLink.current) {
      openViewer(deepLink.current);
      deepLink.current = null;
    }
  }, [introDone, openViewer]);

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      {webgl ? (
        <Suspense fallback={null}>
          <Scene reduced={reduced} />
        </Suspense>
      ) : (
        <div className="no-webgl-bg fixed inset-0 z-0" aria-hidden="true" />
      )}
      <div className="grain-wrap" aria-hidden="true">
        <div className="grain" />
      </div>

      <Preloader />
      <Cursor />
      <ScrollProgress />

      <div id="content">
        <a
          href="#main"
          className="fixed left-4 top-4 z-[110] -translate-y-24 rounded-full bg-fg px-5 py-3 text-sm font-medium text-void transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main" tabIndex={-1} className="relative z-10 outline-none">
          <Hero />
          <Manifesto />
          <Work />
          <Showreel />
          <Capabilities />
          <About />
          <Contact />
        </main>
        <Footer />
      </div>

      <ProjectViewer />
      <Notices webgl={webgl} />

      {/* Visitor stats and Core Web Vitals in your Vercel dashboard (no cookies). */}
      {import.meta.env.PROD && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
    </MotionConfig>
  );
}
