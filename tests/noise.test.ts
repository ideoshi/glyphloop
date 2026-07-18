import { describe, it, expect } from 'vitest';
import { hash2, valueNoise4, fbm4, loopCoords } from '../src/core/noise';

describe('hash2', () => {
  it('is deterministic', () => {
    expect(hash2(42, 7, 13)).toBe(hash2(42, 7, 13));
  });

  it('is in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = hash2(1, i, i * 31);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('varies with seed', () => {
    expect(hash2(1, 5, 5)).not.toBe(hash2(2, 5, 5));
  });
});

describe('valueNoise4', () => {
  it('is deterministic', () => {
    expect(valueNoise4(9, 1.5, 2.5, 0.3, 0.7)).toBe(valueNoise4(9, 1.5, 2.5, 0.3, 0.7));
  });

  it('is in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = valueNoise4(3, i * 0.17, i * 0.29, i * 0.05, i * 0.11);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is smooth (nearby points are close)', () => {
    for (let i = 0; i < 50; i++) {
      const x = i * 0.37, y = i * 0.53;
      const a = valueNoise4(5, x, y, 0.5, 0.5);
      const b = valueNoise4(5, x + 0.01, y, 0.5, 0.5);
      expect(Math.abs(a - b)).toBeLessThan(0.2);
    }
  });
});

describe('loopCoords periodicity', () => {
  it('noise sampled on the loop circle wraps seamlessly', () => {
    const duration = 4;
    for (let i = 0; i < 50; i++) {
      const x = i * 0.31, y = i * 0.47;
      const [z0, w0] = loopCoords(0, duration, 1);
      const [z1, w1] = loopCoords(duration, duration, 1);
      const a = valueNoise4(7, x, y, z0, w0);
      const b = valueNoise4(7, x, y, z1, w1);
      expect(Math.abs(a - b)).toBeLessThan(1e-6);
    }
  });
});

describe('fbm4', () => {
  it('is in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const v = fbm4(11, i * 0.13, i * 0.21, 0.4, 0.9, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('adds detail with more octaves (differs from single octave)', () => {
    const a = fbm4(11, 3.3, 4.4, 0.4, 0.9, 1);
    const b = fbm4(11, 3.3, 4.4, 0.4, 0.9, 4);
    expect(a).not.toBe(b);
  });
});
