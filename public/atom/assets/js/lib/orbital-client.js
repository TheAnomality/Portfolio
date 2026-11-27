// Promise wrapper around the orbital worker, with a main-thread fallback.
import { sampleOrbital, isosurface } from './hydrogen.js';

let worker = null, failed = false, seq = 0;
const pending = new Map();

function getWorker() {
  if (worker || failed) return worker;
  try {
    worker = new Worker(new URL('../workers/orbital-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data);
    };
    worker.onerror = () => {
      failed = true; worker = null;
      for (const [, p] of pending) p.fallback();
      pending.clear();
    };
  } catch (err) {
    failed = true;
  }
  return worker;
}

function call(msg, fallback) {
  const w = getWorker();
  if (!w) return Promise.resolve().then(fallback);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, fallback: () => Promise.resolve().then(fallback).then(resolve, reject) });
    w.postMessage({ id, ...msg });
  });
}

export function sample(n, l, m, count, seed = 7) {
  return call({ type: 'sample', n, l, m, count, seed }, () => sampleOrbital(n, l, m, count, seed));
}
export function surface(n, l, m, N = 72, frac = 0.9) {
  return call({ type: 'surface', n, l, m, N, frac }, () => isosurface(n, l, m, { N, frac }));
}
