/**
 * Capture-time downscale for layer images: big photos become presets,
 * embeds and localStorage entries, so cap the longest edge before
 * encoding to a data URI. Browser APIs live inside function bodies only,
 * keeping the module loadable under Node ESM.
*/

import { assertImageDimensions, assertMediaFile } from './guardrails';

export const MAX_LAYER_EDGE = 1920;

export interface FitResult {
  w: number;
  h: number;
  scaled: boolean;
}

/** Target dimensions fitting w x h within maxEdge, preserving aspect. */
export function fitWithin(w: number, h: number, maxEdge: number): FitResult {
  const edge = Math.max(w, h);
  if (edge <= maxEdge) return { w, h, scaled: false };
  const k = maxEdge / edge;
  return {
    w: Math.max(1, Math.round(w * k)),
    h: Math.max(1, Math.round(h * k)),
    scaled: true,
  };
}

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

/**
 * Data URI for an image file, downscaled to maxEdge on its longest side.
 * Files already within the cap keep their original bytes (no re-encode
 * loss). Alpha-capable formats re-encode as PNG, everything else as JPEG.
 */
export async function imageDataUri(file: File, maxEdge = MAX_LAYER_EDGE): Promise<string> {
  assertMediaFile(file, 'image');
  const bmp = await createImageBitmap(file);
  try {
    assertImageDimensions(bmp.width, bmp.height);
    const { w, h, scaled } = fitWithin(bmp.width, bmp.height, maxEdge);
    if (!scaled) return await readAsDataUri(file);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, w, h);
    const keepAlpha = ['image/png', 'image/webp', 'image/gif'].includes(file.type);
    return keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    bmp.close();
  }
}
