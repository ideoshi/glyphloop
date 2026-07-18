import type { Source } from '../core/source';
import { normCoords, clamp01 } from '../core/source';
import { compileExprCached, type ExprEnv } from '../core/expr';
import { loopCoords } from '../core/noise';

const DEFAULT_EXPR = '0.5 + 0.5*sin(6*x + 2*theta + 3*fbm(x*2 + 4, y*2))';

/**
 * Agent/user-defined brightness expression, evaluated per cell.
 * Loop-perfect when time enters only via integer multiples of `theta`
 * (= 2π·t/T) or via noise()/fbm(), which are bound to the loop circle.
 */
export const expr: Source = {
  id: 'expr',
  name: 'Expression',
  params: [
    { key: 'expr', label: 'f(x,y,t)', type: 'text', default: DEFAULT_EXPR },
  ],
  sample(grid, t, duration, seed, p) {
    const fn = compileExprCached(String(p.expr ?? DEFAULT_EXPR));
    if (fn instanceof Error) {
      grid.data.fill(0);
      return;
    }
    const [z, w] = loopCoords(t, duration, 0.8);
    const phase = ((t / duration) % 1 + 1) % 1;
    const { u, v } = normCoords(grid);
    const env: ExprEnv = {
      seed,
      z,
      w,
      vars: {
        x: 0, y: 0, u: 0, v: 0,
        t: t % duration,
        T: duration,
        theta: 2 * Math.PI * phase,
        phase,
        seed,
      },
    };
    for (let gy = 0; gy < grid.rows; gy++) {
      for (let gx = 0; gx < grid.cols; gx++) {
        env.vars.x = u[gx];
        env.vars.y = v[gy];
        env.vars.u = gx / (grid.cols - 1);
        env.vars.v = gy / (grid.rows - 1);
        const out = fn(env);
        grid.set(gx, gy, Number.isFinite(out) ? clamp01(out) : 0);
      }
    }
  },
};
