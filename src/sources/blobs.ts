import type { Source } from '../core/source';
import { normCoords, smoothstep } from '../core/source';
import { fbm4, loopCoords } from '../core/noise';

export const blobs: Source = {
  id: 'blobs',
  name: 'Noise blobs',
  params: [
    { key: 'scale', label: 'Scale', type: 'range', min: 0.3, max: 4, step: 0.05, default: 1 },
    { key: 'threshold', label: 'Threshold', type: 'range', min: 0.2, max: 0.8, step: 0.01, default: 0.52 },
    { key: 'softness', label: 'Softness', type: 'range', min: 0.01, max: 0.4, step: 0.01, default: 0.18 },
    { key: 'octaves', label: 'Octaves', type: 'range', min: 1, max: 5, step: 1, default: 3 },
    { key: 'motion', label: 'Motion', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.8 },
  ],
  sample(grid, t, duration, seed, p) {
    const scale = p.scale as number;
    const th = p.threshold as number;
    const soft = p.softness as number;
    const oct = Math.round(p.octaves as number);
    const [z, w] = loopCoords(t, duration, p.motion as number);
    const { u, v } = normCoords(grid);

    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const val = fbm4(seed, u[x] * scale * 2, v[y] * scale * 2, z, w, oct);
        grid.set(x, y, smoothstep(th - soft, th + soft, val));
      }
    }
  },
};
