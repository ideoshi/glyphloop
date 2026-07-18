/**
 * Browser text rasterizer: draws text to an offscreen canvas at grid
 * resolution and returns per-cell coverage [0,1]. Cached per configuration.
 */

export type TextRasterizer = (text: string, cols: number, rows: number, font?: string) => Float32Array;

export const DEFAULT_TEXT_FONT = 'ui-monospace, Menlo, monospace';

const cache = new Map<string, Float32Array>();

/** Drop cached masks (call after a new font finishes loading). */
export function clearTextMaskCache(): void {
  cache.clear();
}

export const canvasRasterizer: TextRasterizer = (text, cols, rows, font = DEFAULT_TEXT_FONT) => {
  const key = `${cols}x${rows}:${font}:${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Render at a supersampled resolution, then average down to cells.
  const ss = 8;
  const w = cols * ss;
  const h = rows * ss * 2; // cells are half as wide as tall
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Fit the text to ~86% of the width.
  let size = h * 0.6;
  ctx.font = `700 ${size}px ${font}`;
  const measured = ctx.measureText(text).width || 1;
  size = Math.min(size, (size * (w * 0.86)) / measured);
  ctx.font = `700 ${Math.max(4, Math.floor(size))}px ${font}`;
  ctx.fillText(text, w / 2, h / 2);

  const img = ctx.getImageData(0, 0, w, h).data;
  const mask = new Float32Array(cols * rows);
  const sy = h / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      let count = 0;
      const y0 = Math.floor(y * sy), y1 = Math.floor((y + 1) * sy);
      for (let py = y0; py < y1; py += 2) {
        for (let px = x * ss; px < (x + 1) * ss; px += 2) {
          sum += img[(py * w + px) * 4];
          count++;
        }
      }
      mask[y * cols + x] = count ? sum / count / 255 : 0;
    }
  }
  cache.set(key, mask);
  return mask;
};
