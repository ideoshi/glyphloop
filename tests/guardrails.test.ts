import { describe, expect, it } from 'vitest';
import {
  assertExportBudget,
  assertImageDimensions,
  assertMediaBakeBudget,
  assertMediaFile,
  assertPresetFile,
  exportDimensions,
  MAX_IMAGE_BYTES,
  MAX_PRESET_BYTES,
  MAX_VIDEO_BYTES,
} from '../src/core/guardrails';
import { defaultState } from '../src/core/state';

describe('media guardrails', () => {
  it('accepts bounded image and video files', () => {
    expect(assertMediaFile({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBe('image');
    expect(assertMediaFile({ type: 'video/mp4', size: MAX_VIDEO_BYTES })).toBe('video');
  });

  it('rejects unsupported and oversized files', () => {
    expect(() => assertMediaFile({ type: 'text/plain', size: 10 })).toThrow(/image or video/);
    expect(() => assertMediaFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toThrow(/25 MiB/);
    expect(() => assertMediaFile({ type: 'video/mp4', size: MAX_VIDEO_BYTES + 1 })).toThrow(/100 MiB/);
    expect(() => assertMediaFile({ type: 'video/mp4', size: 10 }, 'image')).toThrow(/image file/);
  });

  it('rejects excessive decoded image dimensions', () => {
    expect(() => assertImageDimensions(8000, 5000)).not.toThrow();
    expect(() => assertImageDimensions(8001, 5000)).toThrow(/40 megapixels/);
    expect(() => assertImageDimensions(0, 100)).toThrow(/invalid dimensions/);
  });

  it('caps media bake work', () => {
    expect(() => assertMediaBakeBudget(140, 40, 30, 20)).not.toThrow();
    expect(() => assertMediaBakeBudget(240, 213, 60, 20)).toThrow(/Reduce columns or FPS/);
  });

  it('caps preset file size', () => {
    expect(() => assertPresetFile({ size: MAX_PRESET_BYTES })).not.toThrow();
    expect(() => assertPresetFile({ size: MAX_PRESET_BYTES + 1 })).toThrow(/10 MiB/);
  });
});

describe('export guardrails', () => {
  it('matches the renderer dimensions', () => {
    const state = defaultState();
    expect(exportDimensions(state, 2)).toEqual({ width: 1960, height: 1092, rows: 39 });
  });

  it('accepts the default export workload', () => {
    const state = defaultState();
    for (const format of ['png', 'gif', 'mp4', 'embed', 'terminal'] as const) {
      expect(() => assertExportBudget(state, format, 2)).not.toThrow();
    }
  });

  it('rejects excessive raster dimensions and work', () => {
    const state = defaultState();
    state.cols = 240;
    state.cellH = 28;
    state.aspect = 9 / 16;
    expect(() => assertExportBudget(state, 'png', 3)).toThrow(/dimensions/);

    const long = defaultState();
    long.duration = 20;
    long.fps = 60;
    expect(() => assertExportBudget(long, 'mp4', 3)).toThrow(/demanding/);
  });

  it('rejects excessive text-frame work', () => {
    const state = defaultState();
    state.cols = 240;
    state.aspect = 9 / 16;
    state.duration = 20;
    state.fps = 60;
    expect(() => assertExportBudget(state, 'embed', 1)).toThrow(/character cells/);
  });
});
