import { describe, expect, it } from 'vitest';
import { mergePreset } from '../src/cli/preset';
import { BUILTIN_PRESETS, builtinBySlug } from '../src/presets/builtins';

describe('built-in presets', () => {
  it('ships six unique starters that all validate', () => {
    expect(BUILTIN_PRESETS).toHaveLength(6);
    expect(new Set(BUILTIN_PRESETS.map((item) => item.slug)).size).toBe(6);
    for (const item of BUILTIN_PRESETS) expect(() => mergePreset(item.preset, true)).not.toThrow();
  });

  it('resolves the public preset slug used by the first-run flow', () => {
    expect(builtinBySlug('flowfield-hero')?.name).toBe('Flowfield Hero');
  });
});
