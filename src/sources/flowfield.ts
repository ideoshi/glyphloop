import type { Source } from '../core/source';
import { normCoords, contrast } from '../core/source';
import { fbm4, loopCoords } from '../core/noise';

export const flowfield: Source = {
  id: 'flowfield',
  name: 'Flow field',
  params: [
    { key: 'scale', label: 'Scale', type: 'range', min: 0.3, max: 4, step: 0.05, default: 1.2 },
    { key: 'warp', label: 'Warp', type: 'range', min: 0, max: 4, step: 0.05, default: 1.6 },
    { key: 'octaves', label: 'Octaves', type: 'range', min: 1, max: 5, step: 1, default: 3 },
    { key: 'motion', label: 'Motion', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.6 },
    { key: 'contrast', label: 'Contrast', type: 'range', min: 0.5, max: 4, step: 0.1, default: 2.2 },
  ],
  sample(grid, t, duration, seed, p) {
    const scale = p.scale as number;
    const warp = p.warp as number;
    const oct = Math.round(p.octaves as number);
    const con = p.contrast as number;
    const [z, w] = loopCoords(t, duration, p.motion as number);
    const { u, v } = normCoords(grid);

    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const px = u[x] * scale * 2;
        const py = v[y] * scale * 2;
        // Inigo Quilez-style domain warping, animated on the loop circle.
        const q1 = fbm4(seed + 1, px, py, z, w, oct);
        const q2 = fbm4(seed + 2, px + 5.2, py + 1.3, z, w, oct);
        const val = fbm4(seed, px + warp * q1, py + warp * q2, z, w, oct);
        grid.set(x, y, contrast(val, con));
      }
    }
  },
};
