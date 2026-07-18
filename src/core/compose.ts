import type { FieldFrame } from './field';
import { clamp01, smoothstep } from './source';

/** Static or per-frame base layer: brightness grid + optional per-cell RGB. */
export interface BaseFrame {
  brightness: Float32Array;
  colors?: Uint8Array; // rgb triplets, cols·rows·3
}

export type BlendMode = 'replace' | 'modulate' | 'screen' | 'displace' | 'reveal' | 'inside';

export interface BlendConfig {
  mode: BlendMode;
  amount: number;   // 0..1
  softness: number; // reveal edge width
  hold: number;     // reveal plateau width
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Combine the animated effect grid with a base layer into `out`.
 * `phase` is t/duration in [0,1); every mode is periodic in it, so
 * composition preserves loop-perfection. When `outColor` is given and the
 * base has colors, per-cell RGB is carried through (displaced when the mode
 * moves samples around).
 */
export function composeFrame(
  effect: FieldFrame,
  base: BaseFrame | null,
  blend: BlendConfig,
  phase: number,
  out: FieldFrame,
  outColor?: Uint8Array,
): void {
  const cols = out.cols, rows = out.rows;
  const n = cols * rows;
  const a = clamp01(blend.amount);

  const copyColor = (dst: number, src: number) => {
    if (!outColor) return;
    if (base?.colors) {
      outColor[dst * 3] = base.colors[src * 3];
      outColor[dst * 3 + 1] = base.colors[src * 3 + 1];
      outColor[dst * 3 + 2] = base.colors[src * 3 + 2];
    }
  };

  if (!base || blend.mode === 'replace') {
    out.data.set(effect.data);
    if (outColor && base?.colors) outColor.set(base.colors);
    return;
  }

  const B = base.brightness;
  const E = effect.data;

  switch (blend.mode) {
    case 'modulate': {
      for (let i = 0; i < n; i++) {
        out.data[i] = clamp01(B[i] * lerp(1, 0.35 + 1.3 * E[i], a));
        copyColor(i, i);
      }
      return;
    }
    case 'screen': {
      for (let i = 0; i < n; i++) {
        out.data[i] = clamp01(1 - (1 - B[i]) * (1 - a * E[i]));
        copyColor(i, i);
      }
      return;
    }
    case 'inside': {
      for (let i = 0; i < n; i++) {
        const mask = smoothstep(0.05, 0.3, B[i]);
        out.data[i] = clamp01(B[i] * (1 - a * 0.4) + a * E[i] * mask);
        copyColor(i, i);
      }
      return;
    }
    case 'reveal': {
      // Reveal threshold sweeps 0→1→0 over the loop; `hold` widens the
      // fully-visible plateau. The effect field orders which cells appear first.
      const r = clamp01((0.5 - 0.5 * Math.cos(2 * Math.PI * phase)) * (1 + blend.hold));
      const soft = Math.max(0.01, blend.softness);
      for (let i = 0; i < n; i++) {
        const vis = smoothstep(E[i] - soft, E[i] + soft, r * (1 + 2 * soft) - soft);
        out.data[i] = clamp01(B[i] * lerp(1, vis, a));
        copyColor(i, i);
      }
      return;
    }
    case 'displace': {
      const k = a * 8;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const xl = E[y * cols + Math.max(0, x - 1)];
          const xr = E[y * cols + Math.min(cols - 1, x + 1)];
          const yu = E[Math.max(0, y - 1) * cols + x];
          const yd = E[Math.min(rows - 1, y + 1) * cols + x];
          const sx = Math.min(cols - 1, Math.max(0, Math.round(x + (xr - xl) * k)));
          const sy = Math.min(rows - 1, Math.max(0, Math.round(y + (yd - yu) * k)));
          const s = sy * cols + sx;
          out.data[i] = B[s];
          copyColor(i, s);
        }
      }
      return;
    }
  }
}
