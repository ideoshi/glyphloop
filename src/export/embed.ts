import { FieldFrame } from '../core/field';
import { mapValue } from '../core/mapper';
import { rowsFor } from '../core/render';
import { rleEncode } from '../core/rle';
import { zipStore } from '../core/zip';
import { SceneRenderer } from '../core/scene';
import { extractPaletteWithAccents, nearestIndex, toHexColor } from '../core/palette';
import type { AppState } from '../core/state';
import { frameTimes, yieldToUI, type ExportOpts } from './frames';

export interface EmbedData {
  cols: number;
  rows: number;
  fps: number;
  ramp: string;
  colorMode: string;
  fg: string;
  bg: string;
  fg2: string;
  frames: number[][];
  /** Present only for colorMode 'source': hex palette + RLE'd per-cell palette indices. */
  palette?: string[];
  colorFrames?: number[][];
  /** Layer stack (data URIs / opacity); present only when enabled in the preset. */
  underlay?: string;
  underlayOpacity?: number;
  underlayBrightness?: number;
  animOpacity?: number;
  overlay?: string;
}

const EMBED_PALETTE_SIZE = 48;

/** Pure frame data build (canvas-free for text/media-free scenes), shared with tests. */
export function buildEmbedData(state: AppState, onFrame?: (done: number, total: number) => void): EmbedData {
  const rows = rowsFor(state.cols, state.aspect);
  const grid = new FieldFrame(state.cols, rows);
  const colorGrid = new Uint8Array(state.cols * rows * 3);
  const scene = new SceneRenderer(state.cols, rows);
  const times = frameTimes(state.fps, state.duration);
  const indices = new Uint8Array(state.cols * rows);
  const frames: number[][] = [];
  const useColor = state.mapper.colorMode === 'source';
  const rawColorFrames: Uint8Array[] = [];

  for (let i = 0; i < times.length; i++) {
    scene.render(state, times[i], grid, colorGrid);
    for (let c = 0; c < grid.data.length; c++) indices[c] = mapValue(grid.data[c], state.mapper);
    frames.push(rleEncode(indices));
    if (useColor) rawColorFrames.push(colorGrid.slice());
    onFrame?.(i + 1, times.length);
  }

  const { ramp, colorMode, fg, bg, fg2 } = state.mapper;
  const data: EmbedData = { cols: state.cols, rows, fps: state.fps, ramp, colorMode, fg, bg, fg2, frames };

  const layers = state.layers;
  if (layers) {
    if (layers.underlay.enabled && layers.underlay.src) {
      data.underlay = layers.underlay.src;
      // Clamp to the canvas renderer's ranges so embeds match the editor.
      const uo = Math.min(1, Math.max(0, layers.underlay.opacity));
      const ub = Math.min(2, Math.max(0, layers.underlay.brightness));
      if (uo < 1) data.underlayOpacity = uo;
      if (ub !== 1) data.underlayBrightness = ub;
    }
    if (layers.animOpacity < 1) data.animOpacity = layers.animOpacity;
    if (layers.overlay.enabled && layers.overlay.src) data.overlay = layers.overlay.src;
  }

  if (useColor && rawColorFrames.length) {
    // Build one palette over sampled frames, then RLE per-cell palette indices.
    const sampleStride = Math.max(1, Math.floor(rawColorFrames.length / 8));
    const samples: number[] = [];
    for (let f = 0; f < rawColorFrames.length; f += sampleStride) samples.push(...rawColorFrames[f]);
    const palette = extractPaletteWithAccents(new Uint8Array(samples), EMBED_PALETTE_SIZE, 10);
    const cellCount = state.cols * rows;
    const idxBuf = new Uint8Array(cellCount);
    data.palette = palette.map(toHexColor);
    data.colorFrames = rawColorFrames.map((cf) => {
      for (let c = 0; c < cellCount; c++) {
        idxBuf[c] = nearestIndex(palette, cf[c * 3], cf[c * 3 + 1], cf[c * 3 + 2]);
      }
      return rleEncode(idxBuf);
    });
  }

  return data;
}

export const PLAYER_JS = `(function () {
  'use strict';

  function decodeRuns(pairs) {
    var out = [];
    for (var i = 0; i < pairs.length; i += 2) out.push([pairs[i], pairs[i + 1]]);
    return out;
  }

  function decodeChars(pairs, ramp, cols) {
    var chars = [];
    for (var i = 0; i < pairs.length; i += 2) {
      var ch = ramp[pairs[i + 1]];
      for (var n = 0; n < pairs[i]; n++) chars.push(ch);
    }
    var rows = [];
    for (var r = 0; r < chars.length; r += cols) rows.push(chars.slice(r, r + cols).join(''));
    return rows.join('\\n');
  }

  function frameHtml(charPairs, colorPairs, ramp, cols, palette) {
    // Expand chars, then emit spans per color run (split at row boundaries).
    var chars = [];
    for (var i = 0; i < charPairs.length; i += 2) {
      var ch = ramp[charPairs[i + 1]];
      for (var n = 0; n < charPairs[i]; n++) chars.push(ch);
    }
    var runs = decodeRuns(colorPairs);
    var html = '';
    var pos = 0;
    for (var r = 0; r < runs.length; r++) {
      var len = runs[r][0], color = palette[runs[r][1]];
      var text = '';
      for (var k = 0; k < len; k++) {
        if (pos > 0 && pos % cols === 0) text += '\\n';
        text += chars[pos++];
      }
      text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      html += '<span style="color:' + color + '">' + text + '</span>';
    }
    return html;
  }

  function AsciiPlayer(el, data) {
    var colored = !!(data.palette && data.colorFrames);
    var frames = [];
    for (var i = 0; i < data.frames.length; i++) {
      frames.push(
        colored
          ? frameHtml(data.frames[i], data.colorFrames[i], data.ramp, data.cols, data.palette)
          : decodeChars(data.frames[i], data.ramp, data.cols)
      );
    }
    var wrap = document.createElement('div');
    wrap.style.cssText = 'background:' + data.bg + ';display:inline-block;position:relative;';
    function layerImg(src) {
      var im = document.createElement('img');
      im.src = src;
      im.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;pointer-events:none;';
      return im;
    }
    if (data.underlay) {
      var under = layerImg(data.underlay);
      if (data.underlayOpacity != null) under.style.opacity = String(data.underlayOpacity);
      if (data.underlayBrightness != null) under.style.filter = 'brightness(' + data.underlayBrightness + ')';
      wrap.appendChild(under);
    }
    var pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;padding:0;font-family:ui-monospace,Menlo,Consolas,monospace;line-height:1;white-space:pre;user-select:none;position:relative;';
    if (data.animOpacity != null && data.animOpacity < 1) pre.style.opacity = String(data.animOpacity);
    if (colored) {
      // spans carry their own colors
    } else if (data.colorMode === 'gradient') {
      pre.style.backgroundImage = 'linear-gradient(' + data.fg + ',' + data.fg2 + ')';
      pre.style.webkitBackgroundClip = 'text';
      pre.style.backgroundClip = 'text';
      pre.style.color = 'transparent';
    } else {
      pre.style.color = data.fg;
    }
    wrap.appendChild(pre);
    if (data.overlay) wrap.appendChild(layerImg(data.overlay));
    el.appendChild(wrap);

    var show = colored
      ? function (i) { pre.innerHTML = frames[i]; }
      : function (i) { pre.textContent = frames[i]; };

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    show(0);
    if (reduced || frames.length < 2) return;

    var start = null, lastIdx = -1;
    function tick(now) {
      if (start === null) start = now;
      var idx = Math.floor(((now - start) / 1000) * data.fps) % frames.length;
      if (idx !== lastIdx) { show(idx); lastIdx = idx; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  window.AsciiPlayer = AsciiPlayer;
  document.addEventListener('DOMContentLoaded', function () {
    if (window.ASCII_DATA) {
      var el = document.querySelector('[data-ascii-player]');
      if (el) AsciiPlayer(el, window.ASCII_DATA);
    }
  });
})();
`;

export function demoHtml(data: EmbedData): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>ASCII animation</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${data.bg};font-size:clamp(4px, calc(100vw / ${data.cols} / 0.62), 14px);}</style>
</head>
<body>
<div data-ascii-player></div>
<script>window.ASCII_DATA = ${JSON.stringify(data)};</script>
<script src="player.js"></script>
</body>
</html>
`;
}

export async function exportEmbed(state: AppState, opts: ExportOpts): Promise<Blob> {
  await yieldToUI();
  const data = buildEmbedData(state, opts.onProgress);
  if (opts.signal.aborted) throw new Error('cancelled');
  return zipStore([
    { name: 'frames.json', data: JSON.stringify(data) },
    { name: 'player.js', data: PLAYER_JS },
    { name: 'index.html', data: demoHtml(data) },
  ]);
}
