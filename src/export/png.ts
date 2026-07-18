import type { AppState } from '../core/state';
import { type RasterSize } from '../core/render';
import { FrameRenderer } from './frames';
import { preloadLayerImages } from '../core/layerimg';

/** Render the frame at time t to a PNG blob at the given cell-size scale. */
export async function exportPng(
  state: AppState,
  t: number,
  scale: number,
  transparent = false,
  targetSize?: RasterSize,
): Promise<Blob> {
  await preloadLayerImages(state.layers);
  const fr = new FrameRenderer(state, scale, transparent, targetSize);
  const canvas = fr.render(t);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))), 'image/png');
  });
}
