import type { BaseFrame } from './compose';
import { fitRect, type MediaFit } from './cover';
import { assertImageDimensions, assertMediaBakeBudget, assertMediaFile } from './guardrails';

/**
 * Media (video/image) bake: decode once into per-cell brightness AND color
 * frames at grid resolution; lookup afterwards is pure. One full media pass
 * plays per loop.
 */

interface Baked {
  frames: BaseFrame[];
  cols: number;
  rows: number;
  fit: MediaFit;
  scale: number;
  name: string;
  seconds: number;
}

let baked: Baked | null = null;
let lastFile: File | null = null;
let baking = false;

export function bakedInfo(): { name: string; seconds: number; frames: number } | null {
  return baked ? { name: baked.name, seconds: baked.seconds, frames: baked.frames.length } : null;
}

export function needsRebake(cols: number, rows: number, fit: MediaFit = 'cover', scale = 1): boolean {
  return (
    lastFile !== null &&
    !baking &&
    (!baked || baked.cols !== cols || baked.rows !== rows || baked.fit !== fit || baked.scale !== scale)
  );
}

export function isBaking(): boolean {
  return baking;
}

/** All baked colors concatenated - input for palette extraction. */
export function bakedColors(): Uint8Array | null {
  return baked?.frames[0]?.colors ?? null;
}

export function mediaBaseFrame(phase: number, cols: number, rows: number): BaseFrame | null {
  if (!baked || baked.cols !== cols || baked.rows !== rows || baked.frames.length === 0) return null;
  const idx = Math.min(baked.frames.length - 1, Math.floor((((phase % 1) + 1) % 1) * baked.frames.length));
  return baked.frames[idx];
}

/** Supersampling factor: cells keep vivid accents instead of averaging them away. */
const BAKE_SS = 6;

function frameFromCanvas(ctx: CanvasRenderingContext2D, cols: number, rows: number): BaseFrame {
  const w = cols * BAKE_SS, h = rows * BAKE_SS;
  const img = ctx.getImageData(0, 0, w, h).data;
  const brightness = new Float32Array(cols * rows);
  const colors = new Uint8Array(cols * rows * 3);

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let ar = 0, ag = 0, ab = 0;
      let vr = 0, vg = 0, vb = 0, vSat = -1;
      for (let sy = 0; sy < BAKE_SS; sy++) {
        for (let sx = 0; sx < BAKE_SS; sx++) {
          const o = (((cy * BAKE_SS + sy) * w) + cx * BAKE_SS + sx) * 4;
          const r = img[o], g = img[o + 1], b = img[o + 2];
          ar += r; ag += g; ab += b;
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          if (sat > vSat) { vSat = sat; vr = r; vg = g; vb = b; }
        }
      }
      const n = BAKE_SS * BAKE_SS;
      ar /= n; ag /= n; ab /= n;
      // If the cell hides a much more vivid subpixel (neon strip, highlight),
      // pull the cell color toward it rather than washing it out.
      const avgSat = Math.max(ar, ag, ab) - Math.min(ar, ag, ab);
      const punch = vSat > 60 && vSat > avgSat * 1.5 ? Math.min(0.7, 0.3 + vSat / 255) : 0;
      const r = ar + (vr - ar) * punch;
      const g = ag + (vg - ag) * punch;
      const b = ab + (vb - ab) * punch;
      const i = cy * cols + cx;
      brightness[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      colors[i * 3] = Math.round(r);
      colors[i * 3 + 1] = Math.round(g);
      colors[i * 3 + 2] = Math.round(b);
    }
  }
  return { brightness, colors };
}

const MAX_SECONDS = 20;

export async function bakeFile(
  file: File,
  cols: number,
  rows: number,
  fps: number,
  onProgress?: (done: number, total: number) => void,
  fit: MediaFit = 'cover',
  scale = 1,
): Promise<{ seconds: number; frames: number }> {
  const kind = assertMediaFile(file);
  if (baking) throw new Error('Another media file is still being processed');
  baking = true;
  try {
    const canvas = document.createElement('canvas');
    const w = cols * BAKE_SS;
    const h = rows * BAKE_SS;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const url = URL.createObjectURL(file);
    const draw = (src: CanvasImageSource, srcW: number, srcH: number) => {
      // whole-image dest rect: contain letterboxes (black), cover overflows
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      const d = fitRect(srcW, srcH, w, h, fit, scale);
      ctx.drawImage(src, d.dx, d.dy, d.dw, d.dh);
    };

    try {
      if (kind === 'image') {
        // createImageBitmap decodes off the render lifecycle (img.decode()
        // can stall indefinitely in throttled/background tabs).
        const img = await createImageBitmap(file);
        try {
          assertImageDimensions(img.width, img.height);
          draw(img, img.width, img.height);
        } finally {
          img.close();
        }
        baked = { frames: [frameFromCanvas(ctx, cols, rows)], cols, rows, fit, scale, name: file.name, seconds: 0 };
        lastFile = file;
        onProgress?.(1, 1);
        return { seconds: 0, frames: 1 };
      }

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Could not decode video'));
      });
      if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Video has an invalid duration');
      const seconds = Math.min(video.duration, MAX_SECONDS);
      assertMediaBakeBudget(cols, rows, fps, seconds);
      const total = Math.max(1, Math.round(seconds * fps));
      const frames: BaseFrame[] = [];

      for (let i = 0; i < total; i++) {
        await new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve();
          video.onerror = () => reject(new Error('Seek failed'));
          video.currentTime = Math.min(i / fps, Math.max(0, video.duration - 0.05));
        });
        draw(video, video.videoWidth, video.videoHeight);
        frames.push(frameFromCanvas(ctx, cols, rows));
        onProgress?.(i + 1, total);
      }
      baked = { frames, cols, rows, fit, scale, name: file.name, seconds };
      lastFile = file;
      return { seconds, frames: total };
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    baking = false;
  }
}

export async function rebake(
  cols: number,
  rows: number,
  fps: number,
  fit: MediaFit = 'cover',
  scale = 1,
): Promise<void> {
  if (lastFile) await bakeFile(lastFile, cols, rows, fps, undefined, fit, scale);
}
