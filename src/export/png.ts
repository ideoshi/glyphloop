import type { AppState } from '../core/state';
import { FrameRenderer } from './frames';
import { preloadLayerImages } from '../core/layerimg';

/** Render the frame at time t to a PNG blob at the given cell-size scale. */
export async function exportPng(state: AppState, t: number, scale: number, transparent = false): Promise<Blob> {
  await preloadLayerImages(state.layers);
  const fr = new FrameRenderer(state, scale, transparent);
  const canvas = fr.render(t);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))), 'image/png');
  });
}
