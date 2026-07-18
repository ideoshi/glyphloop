import { describe, it, expect } from 'vitest';
import { FieldFrame } from '../src/core/field';
import { defaults } from '../src/core/params';
import { SOURCES } from '../src/sources';

const COLS = 32;
const ROWS = 18;
const DURATION = 4;
const SEED = 1234;

function sampleAt(sourceId: string, t: number): Float32Array {
  const src = SOURCES.find((s) => s.id === sourceId)!;
  const grid = new FieldFrame(COLS, ROWS);
  src.sample(grid, t, DURATION, SEED, defaults(src.params));
  return grid.data.slice();
}

describe('source registry', () => {
  it('has all registered sources', () => {
    expect(SOURCES.map((s) => s.id).sort()).toEqual([
      'blobs', 'expr', 'flowfield', 'parametric3d', 'rain', 'shapes3d', 'waves',
    ]);
  });
});

for (const src of ['waves', 'flowfield', 'blobs', 'rain', 'shapes3d', 'expr', 'parametric3d']) {
  describe(`source: ${src}`, () => {
    it('outputs brightness in [0, 1]', () => {
      for (const t of [0, 0.7, 1.9, 3.3]) {
        const data = sampleAt(src, t);
        for (const v of data) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    });

    it('is deterministic for the same seed and time', () => {
      expect(sampleAt(src, 1.5)).toEqual(sampleAt(src, 1.5));
    });

    it('is loop-perfect: t=0 equals t=duration', () => {
      const a = sampleAt(src, 0);
      const b = sampleAt(src, DURATION);
      let maxDiff = 0;
      for (let i = 0; i < a.length; i++) maxDiff = Math.max(maxDiff, Math.abs(a[i] - b[i]));
      expect(maxDiff).toBeLessThan(1e-6);
    });

    it('actually animates (t=0 differs from mid-loop)', () => {
      const a = sampleAt(src, 0);
      const b = sampleAt(src, DURATION / 2);
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
      expect(diff).toBeGreaterThan(0.1);
    });
  });
}
