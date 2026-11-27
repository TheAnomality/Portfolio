// Off-main-thread sampling and isosurface extraction for hydrogen orbitals.
import { sampleOrbital, isosurface } from '../lib/hydrogen.js';

self.onmessage = (e) => {
  const { id, type, n, l, m } = e.data;
  try {
    if (type === 'sample') {
      const r = sampleOrbital(n, l, m, e.data.count, e.data.seed ?? 7);
      self.postMessage({ id, pos: r.pos, sign: r.sign }, [r.pos.buffer, r.sign.buffer]);
    } else if (type === 'surface') {
      const r = isosurface(n, l, m, { N: e.data.N ?? 72, frac: e.data.frac ?? 0.9 });
      self.postMessage({ id, positions: r.positions, normals: r.normals, sign: r.sign, indices: r.indices, half: r.half },
        [r.positions.buffer, r.normals.buffer, r.sign.buffer, r.indices.buffer]);
    }
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
