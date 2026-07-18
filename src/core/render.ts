import type { FieldFrame } from './field';
import { mapValue, cellColor, type MapperConfig } from './mapper';
import type { FxConfig } from './state';
import { applyFx, anyFx } from './fx';
import { coverCrop } from './cover';
import type { LayerBitmaps } from './layerimg';

export interface DrawOpts {
  colorGrid?: Uint8Array;
  fx?: FxConfig;
  transparent?: boolean;
  layers?: LayerBitmaps;
}

/** Character cells are roughly half as wide as they are tall. */
export const CHAR_ASPECT = 0.5;

export const FONT = "'SF Mono', ui-monospace, Menlo, Monaco, monospace";

export interface GridConfig {
  cols: number;
  cellH: number;
  font: string;
  /** Optional exact raster dimensions, used when matching imported media. */
  outputWidth?: number;
  outputHeight?: number;
}

export interface RasterSize {
  width: number;
  height: number;
}

/** Rows needed so cols×rows renders at the given output aspect ratio (w/h). */
export function rowsFor(cols: number, aspect: number): number {
  return Math.max(2, Math.round((cols * CHAR_ASPECT) / aspect));
}

/** Pure character-grid extraction, shared by canvas, ANSI and embed paths. */
export function gridChars(grid: FieldFrame, cfg: MapperConfig): string[] {
  const out: string[] = [];
  for (let y = 0; y < grid.rows; y++) {
    let row = '';
    for (let x = 0; x < grid.cols; x++) {
      row += cfg.ramp[mapValue(grid.get(x, y), cfg)];
    }
    out.push(row);
  }
  return out;
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  draw(grid: FieldFrame, mapper: MapperConfig, gc: GridConfig, opts: DrawOpts = {}): void {
    const colorGrid = opts.colorGrid;
    const width = gc.outputWidth ?? Math.round(grid.cols * gc.cellH * CHAR_ASPECT);
    const height = gc.outputHeight ?? Math.round(grid.rows * gc.cellH);
    const cellW = width / grid.cols;
    const cellH = height / grid.rows;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    if (!opts.transparent) {
      ctx.fillStyle = mapper.bg;
      ctx.fillRect(0, 0, width, height);
    }
    const layers = opts.layers;
    if (layers?.underlay) {
      const c = coverCrop(layers.underlay.width, layers.underlay.height, grid.cols, grid.rows);
      const b = Math.min(2, Math.max(0, layers.underlayBrightness));
      ctx.globalAlpha = Math.min(1, Math.max(0, layers.underlayOpacity));
      if (b !== 1) ctx.filter = `brightness(${b})`;
      ctx.drawImage(layers.underlay, c.sx, c.sy, c.sw, c.sh, 0, 0, width, height);
      if (b !== 1) ctx.filter = 'none';
      ctx.globalAlpha = 1;
    }
    if (layers) ctx.globalAlpha = Math.min(1, Math.max(0, layers.animOpacity));
    ctx.font = `${Math.round(cellH * 0.95)}px ${gc.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const useSource = mapper.colorMode === 'source' && colorGrid;
    let lastColor = '';
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const v = grid.get(x, y);
        const ch = mapper.ramp[mapValue(v, mapper)];
        if (ch === ' ') continue;
        let color: string;
        if (useSource) {
          const o = (y * grid.cols + x) * 3;
          color = `rgb(${colorGrid[o]},${colorGrid[o + 1]},${colorGrid[o + 2]})`;
        } else {
          color = cellColor(v, mapper);
        }
        if (color !== lastColor) {
          ctx.fillStyle = color;
          lastColor = color;
        }
        ctx.fillText(ch, (x + 0.5) * cellW, (y + 0.55) * cellH);
      }
    }
    if (layers) {
      ctx.globalAlpha = 1;
      if (layers.overlay) {
        const c = coverCrop(layers.overlay.width, layers.overlay.height, grid.cols, grid.rows);
        ctx.drawImage(layers.overlay, c.sx, c.sy, c.sw, c.sh, 0, 0, width, height);
      }
    }

    if (opts.fx && anyFx(opts.fx)) applyFx(ctx, width, height, opts.fx, cellH);
  }
}
