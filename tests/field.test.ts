import { describe, it, expect } from 'vitest';
import { FieldFrame } from '../src/core/field';
import { defaults, type ParamSpec } from '../src/core/params';

describe('FieldFrame', () => {
  it('round-trips get/set', () => {
    const f = new FieldFrame(8, 4);
    f.set(3, 2, 0.5);
    expect(f.get(3, 2)).toBeCloseTo(0.5);
  });

  it('is row-major', () => {
    const f = new FieldFrame(8, 4);
    f.set(3, 2, 0.75);
    expect(f.data[2 * 8 + 3]).toBeCloseTo(0.75);
  });

  it('exposes cols and rows', () => {
    const f = new FieldFrame(8, 4);
    expect(f.cols).toBe(8);
    expect(f.rows).toBe(4);
    expect(f.data.length).toBe(32);
  });
});

describe('defaults', () => {
  it('extracts default values from specs', () => {
    const specs: ParamSpec[] = [
      { key: 'scale', label: 'Scale', type: 'range', min: 0, max: 10, step: 0.1, default: 3 },
      { key: 'mode', label: 'Mode', type: 'select', options: ['a', 'b'], default: 'a' },
      { key: 'on', label: 'On', type: 'checkbox', default: true },
    ];
    expect(defaults(specs)).toEqual({ scale: 3, mode: 'a', on: true });
  });
});
