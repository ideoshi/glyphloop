import { FieldFrame } from '../core/field';
import { frameToAnsi, hexToAnsiFg } from '../core/ansi';
import { gridChars, rowsFor } from '../core/render';
import { mapValue } from '../core/mapper';
import { zipStore } from '../core/zip';
import { SceneRenderer } from '../core/scene';
import type { AppState } from '../core/state';
import { frameTimes, yieldToUI, type ExportOpts } from './frames';

/** Pure ANSI frame build, shared with tests. Per-cell 24-bit color in 'source' mode. */
export function buildTerminalFrames(state: AppState, onFrame?: (done: number, total: number) => void): string[] {
  const rows = rowsFor(state.cols, state.aspect);
  const grid = new FieldFrame(state.cols, rows);
  const colorGrid = new Uint8Array(state.cols * rows * 3);
  const scene = new SceneRenderer(state.cols, rows);
  const times = frameTimes(state.fps, state.duration);
  const frames: string[] = [];
  const useColor = state.mapper.colorMode === 'source';

  for (let i = 0; i < times.length; i++) {
    scene.render(state, times[i], grid, colorGrid);
    if (useColor) {
      frames.push(colorAnsiFrame(grid, colorGrid, state));
    } else {
      frames.push(frameToAnsi(gridChars(grid, state.mapper), state.mapper.fg));
    }
    onFrame?.(i + 1, times.length);
  }
  return frames;
}

function colorAnsiFrame(grid: FieldFrame, colorGrid: Uint8Array, state: AppState): string {
  let out = '';
  let last = '';
  for (let y = 0; y < grid.rows; y++) {
    if (y > 0) out += '\n';
    for (let x = 0; x < grid.cols; x++) {
      const i = y * grid.cols + x;
      const ch = state.mapper.ramp[mapValue(grid.data[i], state.mapper)];
      if (ch === ' ') {
        out += ' ';
        continue;
      }
      // Quantize to 32-levels per channel to keep runs long.
      const q = (v: number) => v & 0xf8;
      const sgr = `\x1b[38;2;${q(colorGrid[i * 3])};${q(colorGrid[i * 3 + 1])};${q(colorGrid[i * 3 + 2])}m`;
      if (sgr !== last) {
        out += sgr;
        last = sgr;
      }
      out += ch;
    }
  }
  return out + '\x1b[0m';
}

export function playScript(fps: number): string {
  const delay = (1 / fps).toFixed(4);
  return `#!/usr/bin/env bash
# Loops the ASCII animation in the terminal. Ctrl-C to stop.
cd "$(dirname "$0")"
IFS=$'\\x1c' read -r -d '' -a FRAMES < frames.ans || true
[ \${#FRAMES[@]} -eq 0 ] && { echo "frames.ans not found or empty" >&2; exit 1; }
tput civis 2>/dev/null
trap 'tput cnorm 2>/dev/null; printf "\\x1b[0m\\n"; exit 0' INT TERM
printf '\\x1b[2J'
while :; do
  for f in "\${FRAMES[@]}"; do
    printf '\\x1b[H%s' "$f"
    sleep ${delay}
  done
done
`;
}

export async function exportTerminal(state: AppState, opts: ExportOpts): Promise<Blob> {
  await yieldToUI();
  const frames = buildTerminalFrames(state, opts.onProgress);
  if (opts.signal.aborted) throw new Error('cancelled');
  return zipStore([
    { name: 'frames.ans', data: frames.join('\x1c') },
    { name: 'play.sh', data: playScript(state.fps) },
  ]);
}

export { hexToAnsiFg };
