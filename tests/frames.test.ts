import { describe, it, expect } from 'vitest';
import { frameTimes } from '../src/export/frames';

describe('frameTimes', () => {
  it('produces fps·duration frames, never including t=duration', () => {
    const times = frameTimes(30, 4);
    expect(times).toHaveLength(120);
    expect(times[0]).toBe(0);
    expect(times[119]).toBeCloseTo(119 / 30);
    expect(times).not.toContain(4);
  });

  it('rounds frame count for non-integer products', () => {
    expect(frameTimes(30, 3.5)).toHaveLength(105);
  });
});
