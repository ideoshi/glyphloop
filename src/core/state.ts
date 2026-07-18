import { defaults, type ParamValues } from './params';
import { RAMPS, type MapperConfig } from './mapper';
import type { BlendConfig } from './compose';
import type { BaseConfig } from './base';
import { SOURCES } from '../sources';

export interface FxConfig {
  glow: number;
  scanlines: number;
  vignette: number;
}

/** Image layer stack: underlay beneath the glyphs, PNG overlay above them.
 * Images are data URI strings so the preset stays pure JSON. Browser-only. */
export interface LayersConfig {
  underlay: { enabled: boolean; src: string | null; opacity: number; brightness: number };
  animOpacity: number;
  overlay: { enabled: boolean; src: string | null };
}

export function defaultLayers(): LayersConfig {
  return {
    underlay: { enabled: false, src: null, opacity: 1, brightness: 1 },
    animOpacity: 1,
    overlay: { enabled: false, src: null },
  };
}

/** Complete serializable editor/render state - also the preset format. */
export interface AppState {
  sourceId: string;
  sourceParams: Record<string, ParamValues>;
  base: BaseConfig;
  blend: BlendConfig;
  mapper: MapperConfig;
  fx: FxConfig;
  layers: LayersConfig;
  cols: number;
  cellH: number;
  aspect: number;
  fps: number;
  duration: number;
  speed: number;
  seed: number;
}

export function defaultState(): AppState {
  const sourceParams: Record<string, ParamValues> = {};
  for (const s of SOURCES) sourceParams[s.id] = defaults(s.params);
  return {
    sourceId: 'flowfield',
    sourceParams,
    base: { type: 'none', text: 'ASCII' },
    blend: { mode: 'replace', amount: 0.8, softness: 0.15, hold: 1 },
    fx: { glow: 0, scanlines: 0, vignette: 0 },
    layers: defaultLayers(),
    mapper: {
      ramp: RAMPS[0].chars,
      invert: false,
      gamma: 1,
      colorMode: 'mono',
      fg: '#e8a34c',
      bg: '#0d0f12',
      fg2: '#6ea8fe',
    },
    cols: 140,
    cellH: 14,
    aspect: 16 / 9,
    fps: 30,
    duration: 6,
    speed: 1,
    seed: 1234,
  };
}
