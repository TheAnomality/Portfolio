import { create } from 'zustand';
import type { ShapeId } from '../content/site';

/** What the 3D background should look like while a section is on screen. */
export interface SceneTarget {
  shape: ShapeId;
  /** Horizontal offset in world units (applied on wide screens only). */
  x: number;
  y: number;
  scale: number;
  /** 1 = full brightness, lower values let text sit on top comfortably. */
  dim: number;
  /** Vertical offset used instead of `y` on portrait (phone) screens. */
  mobileY?: number;
  /** UI accent colours for this section. */
  accent: string;
  accent2: string;
}

export const HERO_SCENE: SceneTarget = {
  shape: 'singularity',
  x: 2.1,
  y: 0.15,
  scale: 1,
  dim: 1,
  mobileY: 1.2,
  accent: '#9d7bff',
  accent2: '#5ee7ff',
};

interface PortfolioState {
  scene: SceneTarget;
  setScene: (scene: SceneTarget) => void;

  /** The WebGL canvas has rendered its first frame (or WebGL is unavailable). */
  sceneReady: boolean;
  setSceneReady: () => void;

  /** The preloader has finished and the intro animation may play. */
  introDone: boolean;
  setIntroDone: () => void;

  /** id of the project open in the in-portfolio viewer. */
  viewer: string | null;
  openViewer: (id: string) => void;
  closeViewer: () => void;

  /** Timestamp of the last click on the anomaly (drives the particle burst). */
  burstAt: number;
  triggerBurst: () => void;
}

export const useStore = create<PortfolioState>((set) => ({
  scene: HERO_SCENE,
  setScene: (scene) => set({ scene }),

  sceneReady: false,
  setSceneReady: () => set({ sceneReady: true }),

  introDone: false,
  setIntroDone: () => set({ introDone: true }),

  viewer: null,
  openViewer: (id) => set({ viewer: id }),
  closeViewer: () => set({ viewer: null }),

  burstAt: -1e9,
  triggerBurst: () => set({ burstAt: performance.now() }),
}));

/** Pointer position in normalised device coordinates (-1..1), shared without re-renders. */
export const pointer = { x: 0, y: 0, active: false };
