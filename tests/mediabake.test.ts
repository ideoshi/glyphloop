import { describe, expect, it } from 'vitest';
import { loadVideoMetadata, mediaFitRect, type VideoMetadataElement } from '../src/core/mediabake';

describe('loadVideoMetadata', () => {
  it('attaches handlers before setting src', async () => {
    const video: VideoMetadataElement = {
      onloadedmetadata: null,
      onerror: null,
      error: null,
      get src() { return ''; },
      set src(_value: string) {
        expect(this.onloadedmetadata).toBeTypeOf('function');
        this.onloadedmetadata?.call(
          this as unknown as GlobalEventHandlers,
          new Event('loadedmetadata'),
        );
      },
    };

    await expect(loadVideoMetadata(video, 'blob:test')).resolves.toBeUndefined();
    expect(video.onloadedmetadata).toBeNull();
    expect(video.onerror).toBeNull();
  });

  it('includes the browser decode error when available', async () => {
    const video: VideoMetadataElement = {
      onloadedmetadata: null,
      onerror: null,
      error: { message: 'unsupported codec' },
      get src() { return ''; },
      set src(_value: string) {
        this.onerror?.call(this as unknown as GlobalEventHandlers, new Event('error'));
      },
    };

    await expect(loadVideoMetadata(video, 'blob:test')).rejects.toThrow(
      'Could not decode video: unsupported codec',
    );
  });
});

describe('mediaFitRect', () => {
  it('accounts for narrow glyph cells when matching source aspect', () => {
    // 140 cols at a 1408:640 source aspect gives 32 character rows.
    // The 6x bake canvas is 840x192 square pixels, but visually those cells
    // display at 420x192 because glyph cells are half-width.
    const rect = mediaFitRect(1408, 640, 840, 192, 'cover', 1);
    expect(rect.dx).toBeCloseTo(-2.4);
    expect(rect.dy).toBeCloseTo(0);
    expect(rect.dw).toBeCloseTo(844.8);
    expect(rect.dh).toBeCloseTo(192);
  });

  it('keeps stretch mapped to the full bake canvas', () => {
    expect(mediaFitRect(1408, 640, 840, 192, 'stretch', 1)).toEqual({
      dx: 0,
      dy: 0,
      dw: 840,
      dh: 192,
    });
  });
});
