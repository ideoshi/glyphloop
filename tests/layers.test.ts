import { describe, it, expect } from 'vitest';
import { defaultState, defaultLayers } from '../src/core/state';

describe('LayersConfig', () => {
  it('defaults to disabled layers at full animation opacity', () => {
    const s = defaultState();
    expect(s.layers).toEqual({
      underlay: { enabled: false, src: null, opacity: 1, brightness: 1 },
      animOpacity: 1,
      overlay: { enabled: false, src: null },
    });
  });

  it('round-trips through preset JSON', () => {
    const s = defaultState();
    s.layers.underlay = { enabled: true, src: 'data:image/png;base64,AAAA', opacity: 0.4, brightness: 1.5 };
    s.layers.animOpacity = 0.6;
    const back = JSON.parse(JSON.stringify(s));
    expect(back.layers).toEqual(s.layers);
  });

  it('defaultLayers returns a fresh object each call', () => {
    const a = defaultLayers();
    const b = defaultLayers();
    a.animOpacity = 0;
    expect(b.animOpacity).toBe(1);
  });
});
