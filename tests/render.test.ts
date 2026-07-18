import { describe, it, expect } from 'vitest';
import { rowsFor, gridChars } from '../src/core/render';
import { FieldFrame } from '../src/core/field';
import type { MapperConfig } from '../src/core/mapper';

describe('rowsFor', () => {
  it('computes rows for a 16:9 output with 0.5 char aspect', () => {
    expect(rowsFor(160, 16 / 9)).toBe(45);
  });

  it('computes rows for square output', () => {
    expect(rowsFor(100, 1)).toBe(50);
  });
});

describe('gridChars', () => {
  const cfg: MapperConfig = {
    ramp: ' .:-=+*#%@',
    invert: false,
    gamma: 1,
    colorMode: 'mono',
    fg: '#ffffff',
    bg: '#000000',
    fg2: '#ff0000',
  };

  it('returns rows of strings sized cols', () => {
    const f = new FieldFrame(4, 2);
    f.set(0, 0, 0);
    f.set(3, 1, 1);
    const rows = gridChars(f, cfg);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(4);
    expect(rows[0][0]).toBe(' ');
    expect(rows[1][3]).toBe('@');
  });
});
