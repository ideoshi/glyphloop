/**
 * Center-crop rectangle of a srcW x srcH image covering a cols x rows
 * character grid (cells are half as wide as tall). Shared by the media
 * bake and the layer compositor so underlay pixels align with the glyphs
 * baked from them.
 */
export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export function coverCrop(srcW: number, srcH: number, cols: number, rows: number): CropRect {
  const target = (cols * 0.5) / rows;
  const src = srcW / srcH;
  if (src > target) {
    const w = srcH * target;
    return { sx: (srcW - w) / 2, sy: 0, sw: w, sh: srcH };
  }
  const h = srcW / target;
  return { sx: 0, sy: (srcH - h) / 2, sw: srcW, sh: h };
}

export type MediaFit = 'cover' | 'contain' | 'stretch';

export const MEDIA_SCALE_MIN = 0.25;
export const MEDIA_SCALE_MAX = 4;

export interface FitDest {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Destination rectangle for drawing a whole srcW x srcH image onto a
 * canvasW x canvasH bake canvas: contain letterboxes, cover overflows,
 * stretch fills exactly. scale multiplies the fitted size around center.
 */
export function fitRect(
  srcW: number,
  srcH: number,
  canvasW: number,
  canvasH: number,
  fit: MediaFit,
  scale: number,
): FitDest {
  const s = Math.min(MEDIA_SCALE_MAX, Math.max(MEDIA_SCALE_MIN, scale));
  let dw: number;
  let dh: number;
  if (fit === 'stretch' || srcW <= 0 || srcH <= 0) {
    dw = canvasW * s;
    dh = canvasH * s;
  } else {
    const k = fit === 'contain'
      ? Math.min(canvasW / srcW, canvasH / srcH)
      : Math.max(canvasW / srcW, canvasH / srcH);
    dw = srcW * k * s;
    dh = srcH * k * s;
  }
  return { dx: (canvasW - dw) / 2, dy: (canvasH - dh) / 2, dw, dh };
}
