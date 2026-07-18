import { rowsFor } from './render';
import type { AppState } from './state';

const MIB = 1024 * 1024;

export const MAX_IMAGE_BYTES = 25 * MIB;
export const MAX_VIDEO_BYTES = 100 * MIB;
export const MAX_PRESET_BYTES = 10 * MIB;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const MAX_MEDIA_CELL_FRAMES = 12_000_000;
export const MAX_EXPORT_PIXELS = 32_000_000;
export const MAX_EXPORT_DIMENSION = 8192;
export const MAX_RASTER_PIXEL_FRAMES = 1_500_000_000;
export const MAX_TEXT_CELL_FRAMES = 25_000_000;

export type MediaKind = 'image' | 'video';
export type GuardedExportFormat = 'png' | 'gif' | 'mp4' | 'embed' | 'terminal';

interface FileLike {
  size: number;
  type: string;
}

function mib(bytes: number): number {
  return Math.round(bytes / MIB);
}

export function mediaKind(file: FileLike): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

export function assertMediaFile(file: FileLike, expected?: MediaKind): MediaKind {
  const kind = mediaKind(file);
  if (!kind || (expected && kind !== expected)) {
    throw new Error(expected === 'image' ? 'Choose an image file' : 'Choose an image or video file');
  }
  const max = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > max) {
    throw new Error(`${kind === 'image' ? 'Image' : 'Video'} is too large (maximum ${mib(max)} MiB)`);
  }
  return kind;
}

export function assertImageDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('Image has invalid dimensions');
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new Error('Image is too large after decoding (maximum 40 megapixels)');
  }
}

export function assertMediaBakeBudget(cols: number, rows: number, fps: number, seconds: number): void {
  const frames = Math.max(1, Math.round(seconds * fps));
  if (cols * rows * frames > MAX_MEDIA_CELL_FRAMES) {
    throw new Error('This video is too demanding to bake safely. Reduce columns or FPS, then try again');
  }
}

export function assertPresetFile(file: Pick<FileLike, 'size'>): void {
  if (file.size > MAX_PRESET_BYTES) {
    throw new Error(`Preset is too large (maximum ${mib(MAX_PRESET_BYTES)} MiB)`);
  }
}

export function exportDimensions(state: AppState, scale: number): { width: number; height: number; rows: number } {
  const rows = rowsFor(state.cols, state.aspect);
  const cellH = Math.round(state.cellH * scale);
  return {
    width: Math.round(state.cols * cellH * 0.5),
    height: Math.round(rows * cellH),
    rows,
  };
}

export function assertExportBudget(state: AppState, format: GuardedExportFormat, scale: number): void {
  const frames = Math.max(1, Math.round(state.fps * state.duration));
  const { width, height, rows } = exportDimensions(state, scale);
  const pixels = width * height;

  if (format === 'png' || format === 'gif' || format === 'mp4') {
    if (width > MAX_EXPORT_DIMENSION || height > MAX_EXPORT_DIMENSION || pixels > MAX_EXPORT_PIXELS) {
      throw new Error('Export dimensions are too large. Reduce columns, cell size, or export scale');
    }
    if (format !== 'png' && pixels * frames > MAX_RASTER_PIXEL_FRAMES) {
      throw new Error('This animation is too demanding to export safely. Reduce scale, FPS, or loop duration');
    }
    return;
  }

  if (state.cols * rows * frames > MAX_TEXT_CELL_FRAMES) {
    throw new Error('This animation contains too many character cells. Reduce columns, FPS, or loop duration');
  }
}
