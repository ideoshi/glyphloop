import { describe, it, expect } from 'vitest';
import { mapValue, cellColor, RAMPS, type MapperConfig } from '../src/core/mapper';

const base: MapperConfig = {
  ramp: ' .:-=+*#%@',
  invert: false,
  gamma: 1,
  colorMode: 'mono',
  fg: '#ffffff',
  bg: '#000000',
  fg2: '#ff0000',
};

describe('mapValue', () => {
  it('maps 0 to first ramp index', () => {
    expect(mapValue(0, base)).toBe(0);
  });

  it('maps 1 to last ramp index', () => {
    expect(mapValue(1, base)).toBe(base.ramp.length - 1);
  });

  it('invert flips the mapping', () => {
    const inv = { ...base, invert: true };
    expect(mapValue(0, inv)).toBe(base.ramp.length - 1);
    expect(mapValue(1, inv)).toBe(0);
  });

  it('gamma > 1 darkens midtones', () => {
    const g = { ...base, gamma: 2 };
    expect(mapValue(0.5, g)).toBeLessThan(mapValue(0.5, base));
  });

  it('clamps out-of-range input', () => {
    expect(mapValue(-0.5, base)).toBe(0);
    expect(mapValue(1.5, base)).toBe(base.ramp.length - 1);
  });
});

describe('cellColor', () => {
  it('mono returns fg regardless of value', () => {
    expect(cellColor(0.2, base)).toBe('#ffffff');
    expect(cellColor(0.9, base)).toBe('#ffffff');
  });

  it('gradient at 0 is fg, at 1 is fg2', () => {
    const g: MapperConfig = { ...base, colorMode: 'gradient' };
    expect(cellColor(0, g).toLowerCase()).toBe('#ffffff');
    expect(cellColor(1, g).toLowerCase()).toBe('#ff0000');
  });

  it('gradient at 0.5 mixes channels', () => {
    const g: MapperConfig = { ...base, colorMode: 'gradient', fg: '#000000', fg2: '#ff0000' };
    const mid = cellColor(0.5, g);
    // red channel should be around 0x80
    const r = parseInt(mid.slice(1, 3), 16);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(155);
  });
});

describe('RAMPS', () => {
  it('includes the classic ramp and all ramps are non-empty', () => {
    expect(RAMPS.some((r) => r.chars === ' .:-=+*#%@')).toBe(true);
    for (const r of RAMPS) expect(r.chars.length).toBeGreaterThan(1);
  });
});
