import { defaults, type ParamValues } from '../core/params';
import { compileExprCached } from '../core/expr';
import { SOURCES } from '../sources';
import { RAMPS } from '../core/mapper';
import { MEDIA_SCALE_MAX, MEDIA_SCALE_MIN } from '../core/cover';
import { defaultState, type AppState } from '../core/state';

export interface PresetInput {
  sourceId?: string;
  sourceParams?: Record<string, ParamValues>;
  base?: Partial<AppState['base']>;
  blend?: Partial<AppState['blend']>;
  fx?: Partial<AppState['fx']>;
  mapper?: Partial<AppState['mapper']> & { ramp?: string; rampName?: string };
  layers?: {
    underlay?: { enabled?: boolean; src?: string | null; opacity?: number; brightness?: number };
    animOpacity?: number;
    overlay?: { enabled?: boolean; src?: string | null };
  };
  cols?: number;
  aspect?: number | string;
  fps?: number;
  duration?: number;
  seed?: number;
  cellH?: number;
}

const BLEND_MODES = ['replace', 'modulate', 'screen', 'displace', 'reveal', 'inside'];

const ASPECT_NAMES: Record<string, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16,
  '21:9': 21 / 9,
};

export function parsePresetJson(json: string): PresetInput {
  const parsed: unknown = JSON.parse(json);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid preset format: expected a JSON object');
  }
  return parsed as PresetInput;
}

/**
 * Merge a partial preset (as an agent would author) onto full defaults.
 * Throws descriptive errors for unknown sources/params so agents get
 * actionable feedback.
 */
export function mergePreset(input: PresetInput, allowBrowserOnly = false): AppState {
  const state = defaultState();

  if (input.sourceId !== undefined) {
    const src = SOURCES.find((s) => s.id === input.sourceId);
    if (!src) {
      throw new Error(
        `Unknown sourceId "${input.sourceId}". Valid: ${SOURCES.map((s) => s.id).join(', ')}`,
      );
    }
    state.sourceId = src.id;
  }

  if (input.base) {
    if (input.base.type && !['none', 'text', 'media'].includes(input.base.type)) {
      throw new Error(`Unknown base.type "${input.base.type}". Valid: none, text, media`);
    }
    if (!allowBrowserOnly && input.base.type && input.base.type !== 'none') {
      throw new Error(
        `base.type "${input.base.type}" needs the browser editor (canvas/codecs) and cannot render headless. ` +
          'Headless presets must use base.type "none" (or omit base).',
      );
    }
    if (input.base.fit && !['cover', 'contain', 'stretch'].includes(input.base.fit)) {
      throw new Error(`Unknown base.fit "${input.base.fit}". Valid: cover, contain, stretch`);
    }
    Object.assign(state.base, input.base);
    if (state.base.scale != null) {
      state.base.scale = Math.min(MEDIA_SCALE_MAX, Math.max(MEDIA_SCALE_MIN, state.base.scale));
    }
  }

  if (input.blend) {
    if (input.blend.mode && !BLEND_MODES.includes(input.blend.mode)) {
      throw new Error(`Unknown blend.mode "${input.blend.mode}". Valid: ${BLEND_MODES.join(', ')}`);
    }
    Object.assign(state.blend, input.blend);
    state.blend.amount = Math.min(1, Math.max(0, state.blend.amount));
  }

  if (input.fx) {
    for (const k of Object.keys(input.fx)) {
      if (!['glow', 'scanlines', 'vignette'].includes(k)) {
        throw new Error(`Unknown fx "${k}". Valid: glow, scanlines, vignette`);
      }
    }
    Object.assign(state.fx, input.fx);
  }

  if (input.layers) {
    for (const k of Object.keys(input.layers)) {
      if (!['underlay', 'animOpacity', 'overlay'].includes(k)) {
        throw new Error(`Unknown layers key "${k}". Valid: underlay, animOpacity, overlay`);
      }
    }
    const wantsImages = input.layers.underlay?.enabled || input.layers.overlay?.enabled;
    if (!allowBrowserOnly && wantsImages) {
      throw new Error(
        'layers.underlay/overlay need the browser editor (canvas image decode) and cannot render headless. ' +
          'Headless presets must keep layers disabled (or omit layers).',
      );
    }
    if (input.layers.underlay) Object.assign(state.layers.underlay, input.layers.underlay);
    state.layers.underlay.opacity = Math.min(1, Math.max(0, state.layers.underlay.opacity));
    state.layers.underlay.brightness = Math.min(2, Math.max(0, state.layers.underlay.brightness));
    if (input.layers.overlay) Object.assign(state.layers.overlay, input.layers.overlay);
    if (input.layers.animOpacity !== undefined) {
      state.layers.animOpacity = Math.min(1, Math.max(0, input.layers.animOpacity));
    }
  }

  if (input.sourceParams) {
    for (const [srcId, params] of Object.entries(input.sourceParams)) {
      const src = SOURCES.find((s) => s.id === srcId);
      if (!src) throw new Error(`sourceParams for unknown source "${srcId}"`);
      const specs = defaults(src.params);
      for (const [key, value] of Object.entries(params)) {
        if (!(key in specs)) {
          throw new Error(
            `Unknown param "${key}" for source "${srcId}". Valid: ${Object.keys(specs).join(', ')}`,
          );
        }
        const spec = src.params.find((s) => s.key === key)!;
        let v = value;
        if (spec.type === 'range' && typeof v === 'number') {
          v = Math.min(spec.max ?? v, Math.max(spec.min ?? v, v));
        }
        if (spec.type === 'text' && key.toLowerCase().includes('expr')) {
          const compiled = compileExprCached(String(v));
          if (compiled instanceof Error) {
            throw new Error(`Invalid expression for ${srcId}.${key}: ${compiled.message}`);
          }
        }
        state.sourceParams[srcId][key] = v;
      }
    }
  }

  if (input.mapper) {
    const { rampName, ...rest } = input.mapper;
    if (rampName) {
      const preset = RAMPS.find((r) => r.name.toLowerCase() === rampName.toLowerCase());
      if (!preset) throw new Error(`Unknown rampName "${rampName}". Valid: ${RAMPS.map((r) => r.name).join(', ')}`);
      state.mapper.ramp = preset.chars;
    }
    Object.assign(state.mapper, rest);
    if (state.mapper.ramp.length < 2) throw new Error('mapper.ramp must have at least 2 characters');
  }

  if (input.aspect !== undefined) {
    const aspect = typeof input.aspect === 'string' ? ASPECT_NAMES[input.aspect] : input.aspect;
    if (!aspect || aspect <= 0) {
      throw new Error(`Invalid aspect "${input.aspect}". Use a number (w/h) or one of: ${Object.keys(ASPECT_NAMES).join(', ')}`);
    }
    state.aspect = aspect;
  }

  if (input.cols !== undefined) state.cols = Math.min(240, Math.max(20, Math.round(input.cols)));
  if (input.fps !== undefined) state.fps = Math.min(60, Math.max(5, Math.round(input.fps)));
  if (input.duration !== undefined) state.duration = Math.min(60, Math.max(1, input.duration));
  if (input.seed !== undefined) state.seed = input.seed | 0;
  if (input.cellH !== undefined) state.cellH = Math.min(40, Math.max(4, Math.round(input.cellH)));

  return state;
}
