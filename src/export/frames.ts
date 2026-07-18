import { FieldFrame } from '../core/field';
import { CanvasRenderer, rowsFor, gridChars, FONT } from '../core/render';
import { SceneRenderer } from '../core/scene';
import type { AppState } from '../core/state';
import { layerBitmaps } from '../core/layerimg';

/**
 * Frame timestamps for one loop: n = round(fps·duration) frames starting at
 * t=0. t=duration is never rendered - frame 0 is the wrap, keeping exported
 * loops seamless.
 */
export function frameTimes(fps: number, duration: number): number[] {
  const n = Math.round(fps * duration);
  return Array.from({ length: n }, (_, i) => i / fps);
}

/** Deterministic offscreen re-renderer shared by all exporters. */
export class FrameRenderer {
  readonly canvas: HTMLCanvasElement;
  private grid: FieldFrame;
  readonly colorGrid: Uint8Array;
  private scene: SceneRenderer;
  private renderer: CanvasRenderer;
  private cellH: number;

  constructor(private state: AppState, scale = 1, private transparent = false) {
    this.canvas = document.createElement('canvas');
    this.renderer = new CanvasRenderer(this.canvas);
    const rows = rowsFor(state.cols, state.aspect);
    this.grid = new FieldFrame(state.cols, rows);
    this.colorGrid = new Uint8Array(state.cols * rows * 3);
    this.scene = new SceneRenderer(state.cols, rows);
    this.cellH = Math.round(state.cellH * scale);
  }

  private sample(t: number): void {
    this.scene.render(this.state, t, this.grid, this.colorGrid);
  }

  /** Render frame at time t to the internal canvas and return it. */
  render(t: number): HTMLCanvasElement {
    this.sample(t);
    this.renderer.draw(this.grid, this.state.mapper, {
      cols: this.state.cols,
      cellH: this.cellH,
      font: FONT,
    }, { colorGrid: this.colorGrid, fx: this.state.fx, transparent: this.transparent, layers: layerBitmaps(this.state.layers) });
    return this.canvas;
  }

  /** Character rows for frame at time t (text-based exporters). */
  chars(t: number): string[] {
    this.sample(t);
    return gridChars(this.grid, this.state.mapper);
  }

  get cols(): number {
    return this.grid.cols;
  }

  get rows(): number {
    return this.grid.rows;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/**
 * Let the UI paint between chunks of synchronous export work.
 * MessageChannel (unlike setTimeout) is not clamped to 1s in throttled
 * background tabs, so exports keep full speed when the tab isn't focused.
 */
export function yieldToUI(): Promise<void> {
  return new Promise((r) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => r();
    ch.port2.postMessage(null);
  });
}

export interface ExportOpts {
  scale: number;
  onProgress: (done: number, total: number) => void;
  signal: { aborted: boolean };
}
