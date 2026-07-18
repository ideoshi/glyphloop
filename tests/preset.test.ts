import { describe, it, expect } from 'vitest';
import { mergePreset, parsePresetJson } from '../src/cli/preset';

describe('parsePresetJson', () => {
  it('accepts preset objects and rejects non-object JSON values', () => {
    expect(parsePresetJson('{"sourceId":"waves"}')).toEqual({ sourceId: 'waves' });
    for (const value of ['null', '42', '"waves"', '[]']) {
      expect(() => parsePresetJson(value)).toThrow(/expected a JSON object/);
    }
  });
});

describe('mergePreset', () => {
  it('returns full defaults for an empty preset', () => {
    const s = mergePreset({});
    expect(s.sourceId).toBe('flowfield');
    expect(s.fps).toBe(30);
    expect(s.mapper.ramp).toBe(' .:-=+*#%@');
  });

  it('deep-merges partial source params without losing others', () => {
    const s = mergePreset({ sourceId: 'waves', sourceParams: { waves: { scale: 4 } } });
    expect(s.sourceParams.waves.scale).toBe(4);
    expect(s.sourceParams.waves.layers).toBe(3); // default preserved
  });

  it('accepts named aspect ratios and rampName', () => {
    const s = mergePreset({ aspect: '1:1', mapper: { rampName: 'Blocks', fg: '#00ff88' } });
    expect(s.aspect).toBe(1);
    expect(s.mapper.ramp).toBe(' ░▒▓█');
    expect(s.mapper.fg).toBe('#00ff88');
  });

  it('clamps range params and grid values', () => {
    const s = mergePreset({ cols: 9999, sourceParams: { flowfield: { warp: 99 } } });
    expect(s.cols).toBe(240);
    expect(s.sourceParams.flowfield.warp).toBe(4);
  });

  it('rejects unknown sources with the valid list', () => {
    expect(() => mergePreset({ sourceId: 'nope' })).toThrow(/Valid: /);
  });

  it('rejects browser-only bases in headless mode', () => {
    expect(() => mergePreset({ base: { type: 'text' } })).toThrow(/browser/);
    expect(() => mergePreset({ base: { type: 'media' } })).toThrow(/browser/);
    expect(() => mergePreset({ blend: { mode: 'wobble' as never } })).toThrow(/Valid: replace/);
  });

  it('validates and clamps media fit and scale', () => {
    expect(() => mergePreset({ base: { type: 'media', fit: 'zoom' as never } }, true)).toThrow(/Valid: cover/);
    expect(mergePreset({ base: { type: 'media', fit: 'contain', scale: 99 } }, true).base.scale).toBe(4);
    expect(mergePreset({ base: { type: 'media', scale: 0.01 } }, true).base.scale).toBe(0.25);
    expect(mergePreset({ base: { type: 'media', fit: 'contain' } }, true).base.fit).toBe('contain');
    expect(mergePreset({}).base.fit).toBeUndefined();
  });

  it('rejects unknown params with the valid list', () => {
    expect(() => mergePreset({ sourceParams: { waves: { wobble: 1 } } })).toThrow(/Valid: scale/);
  });

  it('rejects enabled layers in headless mode but allows them in the browser', () => {
    expect(() => mergePreset({ layers: { underlay: { enabled: true, src: 'data:x' } } })).toThrow(/browser/);
    expect(() => mergePreset({ layers: { overlay: { enabled: true, src: 'data:x' } } })).toThrow(/browser/);
    const s = mergePreset({ layers: { underlay: { enabled: true, src: 'data:x' } } }, true);
    expect(s.layers.underlay.enabled).toBe(true);
    expect(s.layers.underlay.src).toBe('data:x');
  });

  it('clamps layers.animOpacity and accepts it headless', () => {
    expect(mergePreset({ layers: { animOpacity: 2 } }).layers.animOpacity).toBe(1);
    expect(mergePreset({ layers: { animOpacity: -1 } }).layers.animOpacity).toBe(0);
  });

  it('rejects unknown layers keys with the valid list', () => {
    expect(() => mergePreset({ layers: { wobble: 1 } as never })).toThrow(/Valid: underlay/);
  });

  it('clamps underlay opacity and brightness to their ranges', () => {
    const s = mergePreset({ layers: { underlay: { opacity: 5, brightness: -1 } } });
    expect(s.layers.underlay.opacity).toBe(1);
    expect(s.layers.underlay.brightness).toBe(0);
    const t = mergePreset({ layers: { underlay: { opacity: -2, brightness: 3 } } });
    expect(t.layers.underlay.opacity).toBe(0);
    expect(t.layers.underlay.brightness).toBe(2);
  });
});
