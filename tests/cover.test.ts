import { describe, it, expect } from 'vitest';
import { coverCrop, fitRect } from '../src/core/cover';

// A 100x50 grid has visual aspect (100 * 0.5) / 50 = 1 (square).
describe('coverCrop', () => {
  it('crops a wide source horizontally, centered', () => {
    expect(coverCrop(200, 100, 100, 50)).toEqual({ sx: 50, sy: 0, sw: 100, sh: 100 });
  });

  it('crops a tall source vertically, centered', () => {
    expect(coverCrop(100, 200, 100, 50)).toEqual({ sx: 0, sy: 50, sw: 100, sh: 100 });
  });

  it('leaves a matching-aspect source uncropped', () => {
    expect(coverCrop(80, 80, 100, 50)).toEqual({ sx: 0, sy: 0, sw: 80, sh: 80 });
  });
});

// Canvas 400x400 (square). Sources are drawn whole into a centered dest rect.
describe('fitRect', () => {
  it('contain letterboxes a wide source', () => {
    // 200x100 source into 400x400: fits width, half height, centered
    expect(fitRect(200, 100, 400, 400, 'contain', 1)).toEqual({ dx: 0, dy: 100, dw: 400, dh: 200 });
  });

  it('contain letterboxes a tall source', () => {
    expect(fitRect(100, 200, 400, 400, 'contain', 1)).toEqual({ dx: 100, dy: 0, dw: 200, dh: 400 });
  });

  it('cover overflows a wide source horizontally', () => {
    // fits height (400), width scales to 800, centered overflow
    expect(fitRect(200, 100, 400, 400, 'cover', 1)).toEqual({ dx: -200, dy: 0, dw: 800, dh: 400 });
  });

  it('cover overflows a tall source vertically', () => {
    expect(fitRect(100, 200, 400, 400, 'cover', 1)).toEqual({ dx: 0, dy: -200, dw: 400, dh: 800 });
  });

  it('stretch fills the canvas exactly', () => {
    expect(fitRect(123, 456, 400, 400, 'stretch', 1)).toEqual({ dx: 0, dy: 0, dw: 400, dh: 400 });
  });

  it('stretch honors scale around center', () => {
    expect(fitRect(123, 456, 400, 400, 'stretch', 2)).toEqual({ dx: -200, dy: -200, dw: 800, dh: 800 });
  });

  it('matching aspect gives identical rects for cover and contain', () => {
    const contain = fitRect(50, 50, 400, 400, 'contain', 1);
    const cover = fitRect(50, 50, 400, 400, 'cover', 1);
    expect(contain).toEqual({ dx: 0, dy: 0, dw: 400, dh: 400 });
    expect(cover).toEqual(contain);
  });

  it('scale zooms around center', () => {
    // contain 400x200 doubled: 800x400, centered
    expect(fitRect(200, 100, 400, 400, 'contain', 2)).toEqual({ dx: -200, dy: 0, dw: 800, dh: 400 });
    // and halved: 200x100, centered
    expect(fitRect(200, 100, 400, 400, 'contain', 0.5)).toEqual({ dx: 100, dy: 150, dw: 200, dh: 100 });
  });

  it('clamps scale into 0.25..4', () => {
    expect(fitRect(100, 100, 400, 400, 'contain', 99)).toEqual(fitRect(100, 100, 400, 400, 'contain', 4));
    expect(fitRect(100, 100, 400, 400, 'contain', 0)).toEqual(fitRect(100, 100, 400, 400, 'contain', 0.25));
  });

  it('survives degenerate source sizes', () => {
    const r = fitRect(0, 0, 400, 400, 'contain', 1);
    expect(r.dw).toBeGreaterThanOrEqual(0);
    expect(r.dh).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.dx)).toBe(true);
    expect(Number.isFinite(r.dy)).toBe(true);
  });
});
