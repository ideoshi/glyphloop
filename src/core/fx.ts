import type { FxConfig } from './state';

export function anyFx(fx: FxConfig): boolean {
  return fx.glow > 0 || fx.scanlines > 0 || fx.vignette > 0;
}

let bloomCanvas: HTMLCanvasElement | null = null;

/**
 * Extract only the brightest pixels (soft-kneed luminance threshold) into a
 * downscaled layer - so bloom lifts highlights instead of brightening the
 * whole frame.
 */
function bloomLayer(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const bw = Math.max(8, Math.round(w * 0.4));
  const bh = Math.max(8, Math.round(h * 0.4));
  if (!bloomCanvas) bloomCanvas = document.createElement('canvas');
  bloomCanvas.width = bw;
  bloomCanvas.height = bh;
  const bctx = bloomCanvas.getContext('2d', { willReadFrequently: true })!;
  bctx.drawImage(src, 0, 0, bw, bh);
  const img = bctx.getImageData(0, 0, bw, bh);
  const d = img.data;
  // Adaptive soft knee: bloom the top of the frame's OWN dynamic range, so
  // dim palettes still bloom their hottest cells and bright palettes don't
  // bloom everything.
  let max = 0;
  const lums = new Float32Array(d.length / 4);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    lums[p] = lum;
    if (lum > max) max = lum;
  }
  const lo = max * 0.7, hi = Math.max(lo + 1, max * 0.92);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let k = (lums[p] - lo) / (hi - lo);
    k = k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
    d[i] *= k;
    d[i + 1] *= k;
    d[i + 2] *= k;
  }
  bctx.putImageData(img, 0, 0);
  return bloomCanvas;
}

/** Raster post-effects applied after the character pass (preview + raster exports). */
export function applyFx(ctx: CanvasRenderingContext2D, w: number, h: number, fx: FxConfig, cellH: number): void {
  if (fx.glow > 0) {
    const layer = bloomLayer(ctx.canvas as HTMLCanvasElement, w, h);
    ctx.save();
    ctx.filter = `blur(${Math.max(1, cellH * 0.5 * (0.5 + fx.glow))}px)`;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, fx.glow * 1.4);
    ctx.drawImage(layer, 0, 0, w, h);
    ctx.restore();
  }
  if (fx.scanlines > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * fx.scanlines})`;
    const step = Math.max(2, cellH * 0.5);
    const lineH = Math.max(1, Math.round(cellH * 0.16));
    for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, lineH);
    ctx.restore();
  }
  if (fx.vignette > 0) {
    ctx.save();
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.85 * fx.vignette})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
