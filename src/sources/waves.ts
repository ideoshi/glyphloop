import type { Source } from '../core/source';
import { normCoords, contrast } from '../core/source';
import { hash2 } from '../core/noise';

export const waves: Source = {
  id: 'waves',
  name: 'Waves',
  params: [
    { key: 'scale', label: 'Scale', type: 'range', min: 0.5, max: 8, step: 0.1, default: 2.5 },
    { key: 'cycles', label: 'Cycles / loop', type: 'range', min: 1, max: 8, step: 1, default: 1 },
    { key: 'layers', label: 'Layers', type: 'range', min: 1, max: 5, step: 1, default: 3 },
    { key: 'radial', label: 'Radial mix', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 },
    { key: 'contrast', label: 'Contrast', type: 'range', min: 0.5, max: 3, step: 0.1, default: 1.3 },
  ],
  sample(grid, t, duration, seed, p) {
    const scale = p.scale as number;
    const cycles = Math.round(p.cycles as number);
    const layers = Math.round(p.layers as number);
    const radial = p.radial as number;
    const con = p.contrast as number;
    const phase = 2 * Math.PI * cycles * (t / duration);
    const { u, v } = normCoords(grid);

    // Precompute per-layer direction vectors (seed-rotated).
    const dirs: [number, number, number][] = [];
    for (let i = 0; i < layers; i++) {
      const a = (i / layers) * Math.PI + hash2(seed, i, 77) * Math.PI;
      const dir = i % 2 === 0 ? 1 : -1;
      dirs.push([Math.cos(a), Math.sin(a), dir]);
    }

    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        let sum = 0;
        for (const [cx, cy, dir] of dirs) {
          sum += Math.sin(scale * Math.PI * (u[x] * cx + v[y] * cy) + phase * dir);
        }
        let val = sum / layers;
        if (radial > 0) {
          const d = Math.hypot(u[x], v[y]);
          const rad = Math.sin(scale * Math.PI * d * 1.5 - phase);
          val = val * (1 - radial) + rad * radial;
        }
        grid.set(x, y, contrast(0.5 + 0.5 * val, con));
      }
    }
  },
};
