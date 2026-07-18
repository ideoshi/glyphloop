import type { Source } from '../core/source';
import { waves } from './waves';
import { flowfield } from './flowfield';
import { blobs } from './blobs';
import { rain } from './rain';
import { shapes3d } from './shapes3d';
import { expr } from './expr';
import { parametric3d } from './parametric3d';

export const SOURCES: Source[] = [flowfield, waves, blobs, rain, shapes3d, expr, parametric3d];

export function sourceById(id: string): Source {
  const s = SOURCES.find((s) => s.id === id);
  if (!s) throw new Error(`Unknown source: ${id}`);
  return s;
}
