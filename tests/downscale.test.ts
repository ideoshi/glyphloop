import { describe, it, expect } from 'vitest';
import { fitWithin, MAX_LAYER_EDGE } from '../src/core/downscale';

describe('fitWithin', () => {
  it('leaves images within the cap untouched', () => {
    expect(fitWithin(1920, 1080, 1920)).toEqual({ w: 1920, h: 1080, scaled: false });
    expect(fitWithin(640, 480, 1920)).toEqual({ w: 640, h: 480, scaled: false });
  });

  it('scales a wide image so the longest edge hits the cap', () => {
    expect(fitWithin(4000, 2500, 1920)).toEqual({ w: 1920, h: 1200, scaled: true });
  });

  it('scales a tall image so the longest edge hits the cap', () => {
    expect(fitWithin(2500, 4000, 1920)).toEqual({ w: 1200, h: 1920, scaled: true });
  });

  it('never rounds a dimension below 1', () => {
    expect(fitWithin(100000, 10, 1920)).toEqual({ w: 1920, h: 1, scaled: true });
  });

  it('exports the shared cap', () => {
    expect(MAX_LAYER_EDGE).toBe(1920);
  });
});
