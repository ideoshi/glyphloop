import type { FieldFrame } from './field';
import type { ParamSpec, ParamValues } from './params';

/**
 * A source is a pure function of (t, seed, params): it writes brightness
 * [0,1] into the grid for time t and must be exactly periodic in t with
 * the given duration (loop-perfect by construction).
 */
export interface Source {
  id: string;
  name: string;
  params: ParamSpec[];
  sample(grid: FieldFrame, t: number, duration: number, seed: number, p: ParamValues): void;
}

/** Normalized, aspect-corrected cell coords: x in [-A, A], y in [-1, 1]. */
export function normCoords(grid: FieldFrame, charAspect = 0.5): { u: Float32Array; v: Float32Array } {
  const u = new Float32Array(grid.cols);
  const v = new Float32Array(grid.rows);
  const aspect = (grid.cols * charAspect) / grid.rows;
  for (let x = 0; x < grid.cols; x++) u[x] = ((x / (grid.cols - 1)) * 2 - 1) * aspect;
  for (let y = 0; y < grid.rows; y++) v[y] = (y / (grid.rows - 1)) * 2 - 1;
  return { u, v };
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function contrast(v: number, amount: number): number {
  return clamp01(0.5 + (v - 0.5) * amount);
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
