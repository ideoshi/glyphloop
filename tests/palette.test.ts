import { describe, it, expect } from 'vitest';
import { extractPalette, suggestInks, nearestIndex, toHexColor } from '../src/core/palette';

function pixels(...rgbs: [number, number, number][]): Uint8Array {
  const out = new Uint8Array(rgbs.length * 3);
  rgbs.forEach((p, i) => out.set(p, i * 3));
  return out;
}

describe('extractPalette', () => {
  it('finds the two clusters in a two-color image', () => {
    const data = pixels(
      ...Array(50).fill([250, 10, 10] as [number, number, number]),
      ...Array(50).fill([10, 10, 250] as [number, number, number]),
    );
    const pal = extractPalette(data, 2);
    expect(pal).toHaveLength(2);
    const hexes = pal.map(toHexColor).sort();
    expect(hexes[0]).toMatch(/^#0a0afa|^#0a0a/); // blue-ish
    expect(pal.some((p) => p[0] > 200)).toBe(true); // red cluster present
    expect(pal.some((p) => p[2] > 200)).toBe(true); // blue cluster present
  });

  it('handles empty input', () => {
    expect(extractPalette(new Uint8Array(0), 4)).toEqual([[0, 0, 0]]);
  });
});

describe('nearestIndex', () => {
  it('picks the closest palette entry', () => {
    const pal: [number, number, number][] = [[0, 0, 0], [255, 255, 255]];
    expect(nearestIndex(pal, 10, 10, 10)).toBe(0);
    expect(nearestIndex(pal, 240, 240, 240)).toBe(1);
  });
});

describe('suggestInks', () => {
  it('uses the darkest color as background', () => {
    const inks = suggestInks([
      [5, 5, 10],
      [230, 120, 40],
      [120, 160, 250],
    ]);
    expect(inks.bg).toBe('#05050a');
    expect(inks.fg).not.toBe(inks.bg);
  });
});

describe('extractPaletteWithAccents', () => {
  it('keeps rare but vivid accent colors that median-cut would average away', async () => {
    const { extractPaletteWithAccents } = await import('../src/core/palette');
    // 2000 muted gray-gold pixels + 20 vivid magenta pixels
    const px: number[] = [];
    for (let i = 0; i < 2000; i++) px.push(120 + (i % 40), 110 + (i % 30), 90 + (i % 20));
    for (let i = 0; i < 20; i++) px.push(255, 40, 200);
    const pal = extractPaletteWithAccents(new Uint8Array(px), 16, 4);
    const hasMagenta = pal.some(([r, g, b]) => r > 200 && g < 100 && b > 150);
    expect(hasMagenta).toBe(true);
  });
});
