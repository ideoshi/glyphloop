import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { AppState } from '../core/state';
import { FrameRenderer, frameTimes, yieldToUI, type ExportOpts } from './frames';
import { preloadLayerImages } from '../core/layerimg';

export async function exportGif(state: AppState, opts: ExportOpts): Promise<Blob> {
  await preloadLayerImages(state.layers);
  const fr = new FrameRenderer(state, opts.scale);
  const times = frameTimes(state.fps, state.duration);
  const gif = GIFEncoder();
  const delay = 1000 / state.fps;

  for (let i = 0; i < times.length; i++) {
    if (opts.signal.aborted) throw new Error('cancelled');
    const canvas = fr.render(times[i]);
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, { palette, delay });
    opts.onProgress(i + 1, times.length);
    if (i % 3 === 2) await yieldToUI();
  }

  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'image/gif',
  });
}
