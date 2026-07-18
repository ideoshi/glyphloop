import { describe, it, expect } from 'vitest';
import { FieldFrame } from '../src/core/field';
import { composeFrame, type BaseFrame, type BlendConfig } from '../src/core/compose';

const COLS = 10, ROWS = 6;

function grid(fill: number): FieldFrame {
  const g = new FieldFrame(COLS, ROWS);
  g.data.fill(fill);
  return g;
}

function base(fill: number): BaseFrame {
  return { brightness: new Float32Array(COLS * ROWS).fill(fill) };
}

const blend = (mode: BlendConfig['mode'], amount = 1): BlendConfig => ({
  mode, amount, softness: 0.1, hold: 1,
});

describe('composeFrame', () => {
  it('replace ignores the base', () => {
    const out = new FieldFrame(COLS, ROWS);
    composeFrame(grid(0.7), base(0.2), blend('replace'), 0, out);
    expect(out.get(3, 3)).toBeCloseTo(0.7);
  });

  it('falls back to replace with no base', () => {
    const out = new FieldFrame(COLS, ROWS);
    composeFrame(grid(0.4), null, blend('modulate'), 0.5, out);
    expect(out.get(3, 3)).toBeCloseTo(0.4);
  });

  it('modulate at amount 0 returns the base', () => {
    const out = new FieldFrame(COLS, ROWS);
    composeFrame(grid(0.9), base(0.5), blend('modulate', 0), 0, out);
    expect(out.get(3, 3)).toBeCloseTo(0.5);
  });

  it('modulate scales base brightness by the effect', () => {
    const out = new FieldFrame(COLS, ROWS);
    composeFrame(grid(1), base(0.5), blend('modulate', 1), 0, out);
    const bright = out.get(3, 3);
    composeFrame(grid(0), base(0.5), blend('modulate', 1), 0, out);
    expect(bright).toBeGreaterThan(out.get(3, 3));
  });

  it('screen never darkens the base', () => {
    const out = new FieldFrame(COLS, ROWS);
    composeFrame(grid(0.8), base(0.3), blend('screen', 1), 0, out);
    expect(out.get(3, 3)).toBeGreaterThanOrEqual(0.3);
  });

  it('inside shows effect only where base is bright', () => {
    const b = base(0);
    b.brightness[3 * COLS + 3] = 1; // one bright cell
    const out = new FieldFrame(COLS, ROWS);
    composeFrame(grid(1), b, blend('inside', 1), 0, out);
    expect(out.get(3, 3)).toBeGreaterThan(0.5);
    expect(out.get(0, 0)).toBeLessThan(0.05);
  });

  it('reveal hides base at phase 0 and shows it mid-loop', () => {
    const out = new FieldFrame(COLS, ROWS);
    composeFrame(grid(0.5), base(1), blend('reveal', 1), 0, out);
    const hidden = out.get(3, 3);
    composeFrame(grid(0.5), base(1), blend('reveal', 1), 0.5, out);
    expect(out.get(3, 3)).toBeGreaterThan(0.9);
    expect(hidden).toBeLessThan(0.2);
  });

  it('displace stays in bounds and preserves a uniform base', () => {
    const e = new FieldFrame(COLS, ROWS);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) e.set(x, y, Math.sin(x) * 0.5 + 0.5);
    const out = new FieldFrame(COLS, ROWS);
    composeFrame(e, base(0.6), blend('displace', 1), 0, out);
    for (const v of out.data) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeCloseTo(0.6); // uniform base displaced anywhere is still 0.6
    }
  });

  it('carries per-cell colors through displace', () => {
    const b = base(0.5);
    b.colors = new Uint8Array(COLS * ROWS * 3);
    for (let i = 0; i < COLS * ROWS; i++) b.colors[i * 3] = 200; // red-ish
    const out = new FieldFrame(COLS, ROWS);
    const outColor = new Uint8Array(COLS * ROWS * 3);
    composeFrame(grid(0.5), b, blend('displace', 1), 0, out, outColor);
    expect(outColor[(3 * COLS + 3) * 3]).toBe(200);
  });
});
