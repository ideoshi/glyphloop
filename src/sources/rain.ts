import type { Source } from '../core/source';
import { clamp01 } from '../core/source';
import { hash2, valueNoise4, loopCoords } from '../core/noise';

export const rain: Source = {
  id: 'rain',
  name: 'Rain',
  params: [
    { key: 'density', label: 'Density', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.6 },
    { key: 'tail', label: 'Tail length', type: 'range', min: 2, max: 40, step: 1, default: 12 },
    { key: 'maxSpeed', label: 'Max speed', type: 'range', min: 1, max: 6, step: 1, default: 3 },
    { key: 'glitter', label: 'Glitter', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 },
  ],
  sample(grid, t, duration, seed, p) {
    const density = p.density as number;
    const tail = p.tail as number;
    const maxSpeed = Math.round(p.maxSpeed as number);
    const glitter = p.glitter as number;
    const rows = grid.rows;
    const [z, w] = loopCoords(t, duration, 1);

    grid.data.fill(0);
    for (let c = 0; c < grid.cols; c++) {
      if (hash2(seed, c, 0) > density) continue;
      // Integer cycles per loop keeps each drop loop-perfect.
      const k = 1 + Math.floor(hash2(seed, c, 1) * maxSpeed);
      const phase0 = hash2(seed, c, 2);
      const head = ((((t / duration) * k + phase0) % 1) + 1) % 1 * rows;
      for (let y = 0; y < rows; y++) {
        const d = (head - y + rows * 8) % rows;
        if (d >= tail) continue;
        let b = 1 - d / tail;
        if (glitter > 0) {
          const flicker = valueNoise4(seed + 9, c * 2.7, y * 2.7, z * 3, w * 3);
          b *= 1 - glitter * 0.7 + glitter * 0.7 * flicker;
        }
        // Bright head, smoothly decaying tail.
        grid.set(c, y, clamp01(d < 1 ? 1 : b * b * 0.85));
      }
    }
  },
};
