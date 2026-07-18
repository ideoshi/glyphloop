import { describe, it, expect } from 'vitest';
import { buildEmbedData, PLAYER_JS } from '../src/export/embed';
import { buildTerminalFrames } from '../src/export/terminal';
import { rleDecode } from '../src/core/rle';
import { defaultState } from '../src/core/state';

function smallState() {
  const s = defaultState();
  s.cols = 40;
  s.duration = 2;
  s.fps = 12;
  return s;
}

describe('buildEmbedData', () => {
  it('produces fps·duration RLE frames that decode to cols·rows cells', () => {
    const state = smallState();
    const data = buildEmbedData(state);
    expect(data.frames).toHaveLength(24);
    expect(data.cols).toBe(40);
    for (const f of data.frames) {
      expect(rleDecode(f)).toHaveLength(data.cols * data.rows);
    }
  });

  it('carries the mapper style', () => {
    const data = buildEmbedData(smallState());
    expect(data.ramp).toBe(' .:-=+*#%@');
    expect(data.fg).toMatch(/^#/);
  });

  it('carries layer data URIs and animation opacity when enabled', () => {
    const state = smallState();
    state.layers.underlay = { enabled: true, src: 'data:image/png;base64,AAAA', opacity: 1, brightness: 1 };
    state.layers.animOpacity = 0.5;
    state.layers.overlay = { enabled: true, src: 'data:image/png;base64,BBBB' };
    const data = buildEmbedData(state);
    expect(data.underlay).toBe('data:image/png;base64,AAAA');
    expect(data.animOpacity).toBe(0.5);
    expect(data.overlay).toBe('data:image/png;base64,BBBB');
  });

  it('omits layer fields when disabled or default', () => {
    const data = buildEmbedData(smallState());
    expect(data.underlay).toBeUndefined();
    expect(data.animOpacity).toBeUndefined();
    expect(data.overlay).toBeUndefined();
  });

  it('carries underlay opacity and brightness only when not neutral', () => {
    const state = smallState();
    state.layers.underlay = { enabled: true, src: 'data:image/png;base64,AAAA', opacity: 0.4, brightness: 1.5 };
    const data = buildEmbedData(state);
    expect(data.underlayOpacity).toBe(0.4);
    expect(data.underlayBrightness).toBe(1.5);

    const neutral = smallState();
    neutral.layers.underlay = { enabled: true, src: 'data:image/png;base64,AAAA', opacity: 1, brightness: 1 };
    const d2 = buildEmbedData(neutral);
    expect(d2.underlayOpacity).toBeUndefined();
    expect(d2.underlayBrightness).toBeUndefined();

    const wild = smallState();
    wild.layers.underlay = { enabled: true, src: 'data:image/png;base64,AAAA', opacity: -3, brightness: 9 };
    const d3 = buildEmbedData(wild);
    expect(d3.underlayOpacity).toBe(0);
    expect(d3.underlayBrightness).toBe(2);
  });
});

describe('PLAYER_JS', () => {
  it('is dependency-free (no imports or requires)', () => {
    expect(PLAYER_JS).not.toMatch(/\bimport\b|\brequire\(/);
    expect(PLAYER_JS).toContain('AsciiPlayer');
    expect(PLAYER_JS).toContain('prefers-reduced-motion');
  });

  it('stacks underlay and overlay images around the pre', () => {
    expect(PLAYER_JS).toContain('data.underlay');
    expect(PLAYER_JS).toContain('data.overlay');
    expect(PLAYER_JS).toContain('object-fit:cover');
    expect(PLAYER_JS).toContain('pointer-events:none');
    expect(PLAYER_JS).toContain('data.underlayOpacity');
    expect(PLAYER_JS).toContain('data.underlayBrightness');
  });
});

describe('buildTerminalFrames', () => {
  it('produces one ANSI string per frame with color and reset', () => {
    const frames = buildTerminalFrames(smallState());
    expect(frames).toHaveLength(24);
    for (const f of frames) {
      expect(f.startsWith('\x1b[38;2;')).toBe(true);
      expect(f.endsWith('\x1b[0m')).toBe(true);
      expect(f).not.toContain('\x1c');
    }
  });
});
