import type { LayersConfig } from './state';

/** Decoded layer images ready for synchronous canvas compositing. */
export interface LayerBitmaps {
  underlay?: ImageBitmap;
  underlayOpacity: number;
  underlayBrightness: number;
  animOpacity: number;
  overlay?: ImageBitmap;
}

const cache = new Map<string, ImageBitmap>();

async function decode(src: string): Promise<void> {
  if (cache.has(src)) return;
  const blob = await (await fetch(src)).blob();
  cache.set(src, await createImageBitmap(blob));
}

/** Decode any enabled layer images into the cache (idempotent). Browser-only. */
export async function preloadLayerImages(layers: LayersConfig | undefined): Promise<void> {
  if (!layers) return;
  const jobs: Promise<void>[] = [];
  if (layers.underlay.enabled && layers.underlay.src) jobs.push(decode(layers.underlay.src));
  if (layers.overlay.enabled && layers.overlay.src) jobs.push(decode(layers.overlay.src));
  await Promise.all(jobs);
}

/** Cache-only lookup for the hot render path. Undefined when nothing to composite. */
export function layerBitmaps(layers: LayersConfig | undefined): LayerBitmaps | undefined {
  if (!layers) return undefined;
  const underlay =
    layers.underlay.enabled && layers.underlay.src ? cache.get(layers.underlay.src) : undefined;
  const overlay =
    layers.overlay.enabled && layers.overlay.src ? cache.get(layers.overlay.src) : undefined;
  if (!underlay && !overlay && layers.animOpacity >= 1) return undefined;
  return {
    underlay,
    underlayOpacity: layers.underlay.opacity ?? 1,
    underlayBrightness: layers.underlay.brightness ?? 1,
    animOpacity: layers.animOpacity,
    overlay,
  };
}
