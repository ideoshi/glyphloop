import type { Source } from '../core/source';
import { clamp01 } from '../core/source';

type P3 = [number, number, number];

interface SurfacePoint {
  p: P3;
  n: P3;
}

function normalize(v: P3): P3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross(a: P3, b: P3): P3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function torus(): SurfacePoint[] {
  const pts: SurfacePoint[] = [];
  const R = 0.95, r = 0.42;
  for (let i = 0; i < 150; i++) {
    const u = (i / 150) * 2 * Math.PI;
    for (let j = 0; j < 64; j++) {
      const v = (j / 64) * 2 * Math.PI;
      const cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
      pts.push({ p: [(R + r * cv) * cu, (R + r * cv) * su, r * sv], n: [cv * cu, cv * su, sv] });
    }
  }
  return pts;
}

function sphere(): SurfacePoint[] {
  const pts: SurfacePoint[] = [];
  for (let i = 0; i < 130; i++) {
    const u = (i / 130) * 2 * Math.PI;
    for (let j = 1; j < 65; j++) {
      const v = (j / 65) * Math.PI;
      const n: P3 = [Math.sin(v) * Math.cos(u), Math.sin(v) * Math.sin(u), Math.cos(v)];
      pts.push({ p: [n[0] * 1.15, n[1] * 1.15, n[2] * 1.15], n });
    }
  }
  return pts;
}

function cube(): SurfacePoint[] {
  const pts: SurfacePoint[] = [];
  const h = 0.85, m = 42;
  const faces: { n: P3; u: P3; v: P3 }[] = [
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
    { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
    { n: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  ];
  for (const f of faces) {
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        const a = ((i / (m - 1)) * 2 - 1) * h;
        const b = ((j / (m - 1)) * 2 - 1) * h;
        pts.push({
          p: [
            f.n[0] * h + f.u[0] * a + f.v[0] * b,
            f.n[1] * h + f.u[1] * a + f.v[1] * b,
            f.n[2] * h + f.u[2] * a + f.v[2] * b,
          ],
          n: f.n,
        });
      }
    }
  }
  return pts;
}

function knot(): SurfacePoint[] {
  const pts: SurfacePoint[] = [];
  const scale = 0.34, tube = 0.19;
  const center = (s: number): P3 => [
    (Math.sin(s) + 2 * Math.sin(2 * s)) * scale,
    (Math.cos(s) - 2 * Math.cos(2 * s)) * scale,
    -Math.sin(3 * s) * scale * 1.2,
  ];
  for (let i = 0; i < 320; i++) {
    const s = (i / 320) * 2 * Math.PI;
    const c = center(s);
    const c2 = center(s + 0.01);
    const tangent = normalize([c2[0] - c[0], c2[1] - c[1], c2[2] - c[2]]);
    let nrm = normalize(cross(tangent, [0, 0, 1]));
    if (!Number.isFinite(nrm[0])) nrm = [1, 0, 0];
    const bin = cross(tangent, nrm);
    for (let j = 0; j < 18; j++) {
      const phi = (j / 18) * 2 * Math.PI;
      const dir: P3 = [
        nrm[0] * Math.cos(phi) + bin[0] * Math.sin(phi),
        nrm[1] * Math.cos(phi) + bin[1] * Math.sin(phi),
        nrm[2] * Math.cos(phi) + bin[2] * Math.sin(phi),
      ];
      pts.push({ p: [c[0] + dir[0] * tube, c[1] + dir[1] * tube, c[2] + dir[2] * tube], n: dir });
    }
  }
  return pts;
}

const SHAPES: Record<string, () => SurfacePoint[]> = { torus, sphere, cube, knot };
const shapeCache = new Map<string, SurfacePoint[]>();

function shapePoints(shape: string): SurfacePoint[] {
  let pts = shapeCache.get(shape);
  if (!pts) {
    pts = (SHAPES[shape] ?? torus)();
    shapeCache.set(shape, pts);
  }
  return pts;
}

const LIGHT = normalize([-0.45, -0.55, 0.75]);
const CAMERA_Z = 3.2;

/** Rotate, project, z-buffer and Lambert-shade a point cloud into the grid. */
export function splatPoints(
  grid: { cols: number; rows: number; data: Float32Array },
  pts: SurfacePoint[],
  ax: number,
  ay: number,
  zoom: number,
  ambient: number,
): void {
  const cx = Math.cos(ax), sx = Math.sin(ax);
  const cy = Math.cos(ay), sy = Math.sin(ay);
  const cols = grid.cols, rows = grid.rows;
  const aspect = (cols * 0.5) / rows;
  const zbuf = new Float32Array(cols * rows).fill(-Infinity);
  grid.data.fill(0);

  for (const { p: pt, n } of pts) {
    let x = pt[0] * cy + pt[2] * sy;
    const z1 = -pt[0] * sy + pt[2] * cy;
    const y = pt[1] * cx - z1 * sx;
    const z = pt[1] * sx + z1 * cx;

    const nx = n[0] * cy + n[2] * sy;
    const nz1 = -n[0] * sy + n[2] * cy;
    const ny = n[1] * cx - nz1 * sx;
    const nz = n[1] * sx + nz1 * cx;

    const persp = CAMERA_Z / (CAMERA_Z - z);
    x *= persp * zoom;
    const py = y * persp * zoom;

    const gx = Math.round(((x / aspect) * 0.5 + 0.5) * (cols - 1));
    const gy = Math.round((py * 0.5 + 0.5) * (rows - 1));
    if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) continue;

    const idx = gy * cols + gx;
    if (z <= zbuf[idx]) continue;
    zbuf[idx] = z;

    const diffuse = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    grid.data[idx] = clamp01(ambient + (1 - ambient) * diffuse);
  }
}

export type { SurfacePoint };

export const shapes3d: Source = {
  id: 'shapes3d',
  name: '3D shape',
  params: [
    { key: 'shape', label: 'Shape', type: 'select', options: ['torus', 'sphere', 'cube', 'knot'], default: 'torus' },
    { key: 'spinX', label: 'Spin X / loop', type: 'range', min: 0, max: 4, step: 1, default: 1 },
    { key: 'spinY', label: 'Spin Y / loop', type: 'range', min: 0, max: 4, step: 1, default: 1 },
    { key: 'zoom', label: 'Zoom', type: 'range', min: 0.4, max: 2, step: 0.05, default: 1 },
    { key: 'ambient', label: 'Ambient', type: 'range', min: 0, max: 0.5, step: 0.05, default: 0.15 },
  ],
  sample(grid, t, duration, seed, p) {
    const pts = shapePoints(p.shape as string);
    const spinX = Math.round(p.spinX as number);
    const spinY = Math.round(p.spinY as number);

    // Integer spins per loop + seed-fixed base orientation → loop-perfect.
    const ax = 2 * Math.PI * spinX * (t / duration) + (seed % 7) * 0.4 + 0.5;
    const ay = 2 * Math.PI * spinY * (t / duration) + (seed % 11) * 0.3;
    splatPoints(grid, pts, ax, ay, p.zoom as number, p.ambient as number);
  },
};
