import type { Source } from '../core/source';
import { compileExprCached, type ExprEnv } from '../core/expr';
import { loopCoords } from '../core/noise';
import { splatPoints, type SurfacePoint } from './shapes3d';

const DEFAULTS = {
  xExpr: '(1 + 0.4*cos(v)) * cos(u)',
  yExpr: '(1 + 0.4*cos(v)) * sin(u)',
  zExpr: '0.4*sin(v)',
};

const U_STEPS = 130;
const V_STEPS = 60;

/**
 * Agent-defined parametric surface: x(u,v), y(u,v), z(u,v) with u,v ∈ [0,2π].
 * `theta` is available for shape morphing per loop; normals are numeric.
 */
export const parametric3d: Source = {
  id: 'parametric3d',
  name: 'Parametric 3D',
  params: [
    { key: 'xExpr', label: 'x(u,v)', type: 'text', default: DEFAULTS.xExpr },
    { key: 'yExpr', label: 'y(u,v)', type: 'text', default: DEFAULTS.yExpr },
    { key: 'zExpr', label: 'z(u,v)', type: 'text', default: DEFAULTS.zExpr },
    { key: 'spinX', label: 'Spin X / loop', type: 'range', min: 0, max: 4, step: 1, default: 1 },
    { key: 'spinY', label: 'Spin Y / loop', type: 'range', min: 0, max: 4, step: 1, default: 1 },
    { key: 'zoom', label: 'Zoom', type: 'range', min: 0.4, max: 2, step: 0.05, default: 1 },
    { key: 'ambient', label: 'Ambient', type: 'range', min: 0, max: 0.5, step: 0.05, default: 0.15 },
  ],
  sample(grid, t, duration, seed, p) {
    const fx = compileExprCached(String(p.xExpr ?? DEFAULTS.xExpr));
    const fy = compileExprCached(String(p.yExpr ?? DEFAULTS.yExpr));
    const fz = compileExprCached(String(p.zExpr ?? DEFAULTS.zExpr));
    if (fx instanceof Error || fy instanceof Error || fz instanceof Error) {
      grid.data.fill(0);
      return;
    }
    const phase = ((t / duration) % 1 + 1) % 1;
    const [z, w] = loopCoords(t, duration, 0.8);
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
    const at = (u: number, v: number): [number, number, number] => {
      env.vars.u = u;
      env.vars.v = v;
      const px = fx(env), py = fy(env), pz = fz(env);
      return [
        Number.isFinite(px) ? px : 0,
        Number.isFinite(py) ? py : 0,
        Number.isFinite(pz) ? pz : 0,
      ];
    };

    const eps = 0.02;
    const pts: SurfacePoint[] = [];
    for (let i = 0; i < U_STEPS; i++) {
      const u = (i / U_STEPS) * 2 * Math.PI;
      for (let j = 0; j < V_STEPS; j++) {
        const v = (j / V_STEPS) * 2 * Math.PI;
        const p0 = at(u, v);
        const pu = at(u + eps, v);
        const pv = at(u, v + eps);
        // Numeric normal from tangent cross product.
        const tu = [pu[0] - p0[0], pu[1] - p0[1], pu[2] - p0[2]];
        const tv = [pv[0] - p0[0], pv[1] - p0[1], pv[2] - p0[2]];
        let nx = tu[1] * tv[2] - tu[2] * tv[1];
        let ny = tu[2] * tv[0] - tu[0] * tv[2];
        let nz = tu[0] * tv[1] - tu[1] * tv[0];
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;
        pts.push({ p: p0, n: [nx, ny, nz] });
      }
    }

    const ax = 2 * Math.PI * Math.round(p.spinX as number) * phase + (seed % 7) * 0.4 + 0.5;
    const ay = 2 * Math.PI * Math.round(p.spinY as number) * phase + (seed % 11) * 0.3;
    splatPoints(grid, pts, ax, ay, p.zoom as number, p.ambient as number);
  },
};
