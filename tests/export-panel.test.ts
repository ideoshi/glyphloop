import { describe, expect, it } from 'vitest';
import { sourceAspectMatches } from '../src/export/panel';

describe('sourceAspectMatches', () => {
  const source = { width: 1408, height: 640 };

  it('accepts the native source aspect', () => {
    expect(sourceAspectMatches(1408 / 640, source)).toBe(true);
  });

  it('rejects a deliberately different composition aspect', () => {
    expect(sourceAspectMatches(16 / 9, source)).toBe(false);
  });

  it('rejects a missing source size', () => {
    expect(sourceAspectMatches(16 / 9, null)).toBe(false);
  });
});
