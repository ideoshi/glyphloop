import { FieldFrame } from './field';
import { composeFrame } from './compose';
import { baseFrameAt } from './base';
import { sourceById } from '../sources';
import type { AppState } from './state';

/**
 * Render one scene frame: effect source → compose with base → out grid
 * (+ per-cell colors when the base carries them and outColor is provided).
 * The single pipeline shared by the editor loop and every exporter.
 */
export class SceneRenderer {
  private effect: FieldFrame;

  constructor(cols: number, rows: number) {
    this.effect = new FieldFrame(cols, rows);
  }

  render(state: AppState, t: number, out: FieldFrame, outColor?: Uint8Array): void {
    const phase = ((t / state.duration) % 1 + 1) % 1;
    const src = sourceById(state.sourceId);
    src.sample(this.effect, t % state.duration, state.duration, state.seed, state.sourceParams[src.id]);
    const base = state.base.type === 'none' ? null : baseFrameAt(state.base, phase, out.cols, out.rows);
    composeFrame(this.effect, base, state.blend, phase, out, outColor);
  }
}
