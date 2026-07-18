import type { BaseFrame } from './compose';
import type { MediaFit } from './cover';
import { mediaBaseFrame } from './mediabake';
import { canvasRasterizer, DEFAULT_TEXT_FONT } from '../sources/textmask';

export type BaseType = 'none' | 'text' | 'media';

export interface BaseConfig {
  type: BaseType;
  text: string;
  font?: string;
  /** Media framing: how the imported image/video maps onto the grid. */
  fit?: MediaFit;
  /** Media zoom around center, clamped 0.25..4 (1 = fitted size). */
  scale?: number;
}

const textCache = new Map<string, BaseFrame>();

export function clearTextBaseCache(): void {
  textCache.clear();
}

function textBase(text: string, cols: number, rows: number, font: string): BaseFrame {
  const key = `${cols}x${rows}:${font}:${text}`;
  let frame = textCache.get(key);
  if (!frame) {
    frame = { brightness: canvasRasterizer(text || ' ', cols, rows, font) };
    textCache.set(key, frame);
  }
  return frame;
}

/** Base layer frame for the given loop phase, or null (no base). Browser-only for text/media. */
export function baseFrameAt(base: BaseConfig, phase: number, cols: number, rows: number): BaseFrame | null {
  if (base.type === 'text') return textBase(base.text, cols, rows, base.font || DEFAULT_TEXT_FONT);
  if (base.type === 'media') return mediaBaseFrame(phase, cols, rows);
  return null;
}
