/** Median-cut palette extraction from packed RGB triplets. */

export type RGB = [number, number, number];

export function extractPalette(colors: Uint8Array, n: number): RGB[] {
  const pixels: RGB[] = [];
  const stride = Math.max(1, Math.floor(colors.length / 3 / 4096)) * 3;
  for (let i = 0; i + 2 < colors.length; i += stride) {
    pixels.push([colors[i], colors[i + 1], colors[i + 2]]);
  }
  if (pixels.length === 0) return [[0, 0, 0]];

  let boxes: RGB[][] = [pixels];
  while (boxes.length < n) {
    // Split the box with the largest channel range.
    let bestBox = -1, bestRange = -1, bestChan = 0;
    for (let b = 0; b < boxes.length; b++) {
      if (boxes[b].length < 2) continue;
      for (let c = 0; c < 3; c++) {
        let lo = 255, hi = 0;
        for (const p of boxes[b]) {
          if (p[c] < lo) lo = p[c];
          if (p[c] > hi) hi = p[c];
        }
        if (hi - lo > bestRange) {
          bestRange = hi - lo;
          bestBox = b;
          bestChan = c;
        }
      }
    }
    if (bestBox === -1 || bestRange === 0) break;
    const box = boxes[bestBox];
    box.sort((a, b) => a[bestChan] - b[bestChan]);
    const mid = box.length >> 1;
    boxes.splice(bestBox, 1, box.slice(0, mid), box.slice(mid));
  }

  return boxes.map((box) => {
    const avg: RGB = [0, 0, 0];
    for (const p of box) {
      avg[0] += p[0];
      avg[1] += p[1];
      avg[2] += p[2];
    }
    return avg.map((v) => Math.round(v / box.length)) as RGB;
  });
}

export function toHexColor([r, g, b]: RGB): string {
  const c = (v: number) => v.toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function nearestIndex(palette: RGB[], r: number, g: number, b: number): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d =
      (palette[i][0] - r) ** 2 + (palette[i][1] - g) ** 2 + (palette[i][2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Suggest ink/ink2/paper from an extracted palette. */
export function suggestInks(palette: RGB[]): { fg: string; fg2: string; bg: string } {
  const lum = (p: RGB) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
  const sat = (p: RGB) => Math.max(...p) - Math.min(...p);
  const sorted = [...palette].sort((a, b) => lum(a) - lum(b));
  const bg = sorted[0];
  const rest = sorted.slice(1);
  const byScore = [...rest].sort((a, b) => sat(b) + lum(b) * 0.5 - (sat(a) + lum(a) * 0.5));
  const fg = byScore[0] ?? sorted[sorted.length - 1];
  const fg2 = byScore.find((p) => p !== fg) ?? fg;
  return { fg: toHexColor(fg), fg2: toHexColor(fg2), bg: toHexColor(bg) };
}

/**
 * Median-cut palette plus reserved slots for rare-but-vivid accent colors
 * (neon signs, highlights) that population-based cuts average away.
 */
export function extractPaletteWithAccents(colors: Uint8Array, n: number, accentSlots: number): RGB[] {
  const base = extractPalette(colors, Math.max(1, n - accentSlots));

  // Bucket saturated pixels at 4 bits/channel, tracking count and mean color.
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  const stride = Math.max(1, Math.floor(colors.length / 3 / 8192)) * 3;
  for (let i = 0; i + 2 < colors.length; i += stride) {
    const r = colors[i], g = colors[i + 1], b = colors[i + 2];
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat < 70) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    e.count++;
    e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }

  const dist2 = (a: RGB, b: RGB) =>
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const accents: RGB[] = [];
  const candidates = [...buckets.values()].sort((a, b) => b.count - a.count);
  for (const c of candidates) {
    if (accents.length >= accentSlots) break;
    const col: RGB = [Math.round(c.r / c.count), Math.round(c.g / c.count), Math.round(c.b / c.count)];
    const near = [...base, ...accents].some((p) => dist2(p, col) < 48 * 48);
    if (!near) accents.push(col);
  }
  return [...base, ...accents];
}
