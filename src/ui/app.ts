import { FieldFrame } from '../core/field';
import { defaultState, defaultLayers, type AppState } from '../core/state';
import { preloadLayerImages, layerBitmaps } from '../core/layerimg';
import { imageDataUri } from '../core/downscale';
import { RAMPS, type MapperConfig } from '../core/mapper';
import { CanvasRenderer, rowsFor, FONT } from '../core/render';
import { SOURCES, sourceById } from '../sources';
import { SceneRenderer } from '../core/scene';
import { bakeFile, rebake, needsRebake, isBaking, bakedInfo, bakedColors } from '../core/mediabake';
import type { MediaFit } from '../core/cover';
import { extractPalette, suggestInks } from '../core/palette';
import type { BlendMode } from '../core/compose';
import { renderControls, toast } from './controls';
import { TEXT_FONTS, ensureTextFont, fontFamilyFor } from './fonts';
import { buildExportPanel } from '../export/panel';
import { mergePreset, parsePresetJson, type PresetInput } from '../cli/preset';
import { compileExprCached } from '../core/expr';
import { BUILTIN_PRESETS, builtinBySlug } from '../presets/builtins';
import { track, trackEditorOpened } from '../core/telemetry';
import { assertMediaFile, assertPresetFile } from '../core/guardrails';

const ASPECTS: Record<string, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16,
  '21:9': 21 / 9,
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function section(title: string): { root: HTMLElement; body: HTMLElement } {
  const root = el('div', 'section');
  root.appendChild(el('h3', 'section-title', title));
  const body = el('div', 'section-body');
  root.appendChild(body);
  return { root, body };
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  const row = el('label', 'control-row');
  row.appendChild(el('span', 'control-label', label));
  row.appendChild(control);
  return row;
}

function rangeInput(
  min: number,
  max: number,
  step: number,
  value: number,
  onInput: (v: number) => void,
  ref?: (input: HTMLInputElement, valEl: HTMLElement) => void,
): HTMLElement {
  const wrap = el('span', 'control-range');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const val = el('span', 'control-value', String(value));
  input.addEventListener('input', () => {
    val.textContent = input.value;
    onInput(Number(input.value));
  });
  wrap.append(input, val);
  ref?.(input, val);
  return wrap;
}

function selectInput(options: string[], value: string, onChange: (v: string) => void): HTMLSelectElement {
  const input = document.createElement('select');
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    input.appendChild(o);
  }
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

function colorInput(value: string, onInput: (v: string) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'color';
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

export function mountApp(root: HTMLElement): void {
  const state = defaultState();
  let t = 0;
  let playing = true;

  // ---- layout ----
  root.innerHTML = '';
  const header = el('header', 'header');
  const brandLink = el('a', 'brand-link');
  brandLink.href = '/';
  brandLink.setAttribute('aria-label', 'Glyphloop home');
  const wordmark = document.createElement('img');
  wordmark.className = 'wordmark';
  wordmark.src = new URL('../../brand/wordmark-ui.png', import.meta.url).href;
  wordmark.alt = 'Glyphloop';
  brandLink.appendChild(wordmark);
  header.appendChild(brandLink);
  const presetBar = el('div', 'preset-bar');
  header.appendChild(presetBar);

  const main = el('main', 'main');
  const stage = el('div', 'stage');
  const canvas = document.createElement('canvas');
  stage.appendChild(canvas);
  const firstRun = el('div', 'first-run');
  firstRun.setAttribute('role', 'note');
  firstRun.append(
    el('strong', 'first-run-title', 'Make your first loop'),
    el('span', 'first-run-copy', 'Paste or drop an image → inherit its colours → choose motion → export.'),
  );
  const firstRunActions = el('span', 'first-run-actions');
  const starterBtn = el('button', 'btn btn-primary', 'Use a starter preset');
  const dismissBtn = el('button', 'btn', 'Dismiss');
  firstRunActions.append(starterBtn, dismissBtn);
  firstRun.appendChild(firstRunActions);
  stage.appendChild(firstRun);
  const panel = el('aside', 'panel');
  main.append(stage, panel);
  root.append(header, main);

  const renderer = new CanvasRenderer(canvas);
  let grid = new FieldFrame(state.cols, rowsFor(state.cols, state.aspect));
  let colorGrid = new Uint8Array(grid.cols * grid.rows * 3);
  let scene = new SceneRenderer(grid.cols, grid.rows);

  const dismissFirstRun = () => {
    firstRun.hidden = true;
    try { localStorage.setItem('glyphloop-onboarding-dismissed', '1'); } catch { /* optional */ }
  };
  try { firstRun.hidden = localStorage.getItem('glyphloop-onboarding-dismissed') === '1'; } catch { /* optional */ }
  dismissBtn.addEventListener('click', dismissFirstRun);

  const rebuildGrid = () => {
    const rows = rowsFor(state.cols, state.aspect);
    grid = new FieldFrame(state.cols, rows);
    colorGrid = new Uint8Array(state.cols * rows * 3);
    scene = new SceneRenderer(state.cols, rows);
    if (state.base.type === 'media' && needsRebake(state.cols, rows, mediaFit(), mediaScale()) && !isBaking()) {
      rebake(state.cols, rows, state.fps, mediaFit(), mediaScale())
        .then(() => toast('Media re-baked for new grid'))
        .catch((e) => toast(`Re-bake failed: ${(e as Error).message}`, 'error'));
    }
  };

  const mediaFit = (): MediaFit => state.base.fit ?? 'cover';
  const mediaScale = (): number => state.base.scale ?? 1;

  // Debounced media rebake for fit/scale tweaks; a slider drag re-seeks a
  // whole video otherwise.
  let mediaRebakeTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleMediaRebake = (delay: number) => {
    clearTimeout(mediaRebakeTimer);
    mediaRebakeTimer = setTimeout(() => {
      const rows = rowsFor(state.cols, state.aspect);
      if (state.base.type !== 'media' || isBaking()) return;
      if (!needsRebake(state.cols, rows, mediaFit(), mediaScale())) return;
      rebake(state.cols, rows, state.fps, mediaFit(), mediaScale())
        .catch((e) => toast(`Re-bake failed: ${(e as Error).message}`, 'error'));
    }, delay);
  };

  // ---- source section ----
  const srcSection = section('Effect');
  const paramContainer = el('div');
  const srcSelect = selectInput(
    SOURCES.map((s) => s.id),
    state.sourceId,
    (id) => {
      state.sourceId = id;
      refreshParams();
    },
  );
  for (const opt of Array.from(srcSelect.options)) {
    opt.textContent = sourceById(opt.value).name;
  }
  srcSection.body.appendChild(labeled('Type', srcSelect));
  srcSection.body.appendChild(paramContainer);

  let setDuration: (v: number) => void = () => {};
  let applyInks: (inks: { fg: string; fg2: string; bg: string }) => void = () => {};
  let refreshLayers: () => void = () => {};

  /** Auto-capture a still image as the underlay source; videos clear it (v1). */
  const captureUnderlay = async (file: File) => {
    if (file.type.startsWith('image/')) {
      try {
        state.layers.underlay.src = await imageDataUri(file);
      } catch (e) {
        state.layers.underlay.src = null;
        toast('Could not read image for underlay: ' + (e as Error).message, 'error');
        refreshLayers();
        return;
      }
      preloadLayers();
    } else {
      state.layers.underlay.src = null;
      state.layers.underlay.enabled = false;
    }
    refreshLayers();
  };

  const preloadLayers = () => {
    preloadLayerImages(state.layers).catch((e) => toast(`Layer image failed to load: ${(e as Error).message}`, 'error'));
  };

  const refreshParams = () => {
    const src = sourceById(state.sourceId);
    renderControls(paramContainer, src.params, state.sourceParams[src.id], (key, value) => {
      state.sourceParams[src.id][key] = value;
    }, (key, value) => {
      if (!key.toLowerCase().includes('expr')) return null;
      const compiled = compileExprCached(String(value));
      return compiled instanceof Error ? compiled.message : null;
    });
  };
  refreshParams();

  // ---- base section ----
  const baseSection = section('Base layer');
  const baseBody = el('div');
  const refreshBase = () => {
    baseBody.innerHTML = '';
    if (state.base.type === 'text') {
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.value = state.base.text;
      textInput.addEventListener('input', () => (state.base.text = textInput.value));
      baseBody.appendChild(labeled('Text', textInput));
      const currentName =
        Object.keys(TEXT_FONTS).find((n) => TEXT_FONTS[n] === state.base.font) ?? 'Mono';
      const fontSelect = selectInput([...Object.keys(TEXT_FONTS), 'Custom…'], currentName, async (name) => {
        if (name === 'Custom…') {
          customFontRow.style.display = '';
          return;
        }
        customFontRow.style.display = 'none';
        try {
          await ensureTextFont(name);
          state.base.font = TEXT_FONTS[name];
        } catch (e) {
          toast((e as Error).message, 'error');
        }
      });
      baseBody.appendChild(labeled('Font', fontSelect));
      // Custom Google Font: type any family name (e.g. "Bungee") and press Enter.
      const customFont = document.createElement('input');
      customFont.type = 'text';
      customFont.placeholder = 'Google Font name ⏎';
      customFont.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter' || !customFont.value.trim()) return;
        const name = customFont.value.trim();
        try {
          await ensureTextFont(name);
          state.base.font = fontFamilyFor(name);
          toast(`Font "${name}" loaded`);
        } catch (err) {
          toast((err as Error).message, 'error');
        }
      });
      const customFontRow = labeled('', customFont);
      customFontRow.style.display = 'none';
      baseBody.appendChild(customFontRow);
    }
    if (state.base.type === 'media') {
      const status = el('div', 'media-status');
      const info = bakedInfo();
      status.textContent = info
        ? `${info.name} - ${info.frames} frames${info.seconds ? `, ${info.seconds.toFixed(1)}s` : ''}`
        : 'No file loaded';
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'video/*,image/*';
      fileInput.style.display = 'none';
      const pick = el('button', 'btn', '📂 Load video/image');
      pick.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
          const kind = assertMediaFile(file);
          track('media_import_started', { kind, via: 'picker' });
          status.textContent = 'Baking…';
          const rows = rowsFor(state.cols, state.aspect);
          const result = await bakeFile(file, state.cols, rows, state.fps, (done, total) => {
            status.textContent = `Baking ${done}/${total}…`;
          }, mediaFit(), mediaScale());
          if (result.seconds > 0) setDuration(Math.min(20, Math.max(2, result.seconds)));
          await captureUnderlay(file);
          status.textContent = `${file.name} - ${result.frames} frames${result.seconds ? `, ${result.seconds.toFixed(1)}s` : ''}`;
          toast('Media baked');
          dismissFirstRun();
          track('media_import_completed', { kind, via: 'picker' });
        } catch (e) {
          status.textContent = 'No file loaded';
          toast(`Bake failed: ${(e as Error).message}`, 'error');
          track('media_import_failed', { kind: file.type.split('/')[0] || 'unknown', via: 'picker' });
        }
      });
      const paletteBtn = el('button', 'btn', '🎨 Set ink & paper from image');
      paletteBtn.addEventListener('click', () => {
        const colors = bakedColors();
        if (!colors) {
          toast('Load an image or video first', 'error');
          return;
        }
        applyInks(suggestInks(extractPalette(colors, 5)));
        toast('Palette applied from media');
      });
      const fitSelect = selectInput(['cover', 'contain', 'stretch'], mediaFit(), (v) => {
        state.base.fit = v as MediaFit;
        scheduleMediaRebake(0);
      });
      const scaleRow = labeled('Scale', rangeInput(0.25, 4, 0.05, mediaScale(), (v) => {
        state.base.scale = v;
        scheduleMediaRebake(300);
      }));
      baseBody.append(
        labeled('', pick), status, fileInput,
        labeled('Fit', fitSelect), scaleRow,
        labeled('', paletteBtn),
      );
    }
  };
  const baseTypeSelect = selectInput(['none', 'text', 'media'], state.base.type, (v) => {
    state.base.type = v as typeof state.base.type;
    if (v !== 'none' && state.blend.mode === 'replace') {
      state.blend.mode = 'modulate';
      refreshBlendMode();
    }
    refreshBase();
  });
  baseSection.body.appendChild(labeled('Type', baseTypeSelect));
  baseSection.body.appendChild(baseBody);
  refreshBase();

  // ---- blend section ----
  const blendSection = section('Blend');
  let refreshBlendMode: () => void = () => {};
  const blendModeSelect = selectInput(
    ['replace', 'modulate', 'screen', 'displace', 'reveal', 'inside'],
    state.blend.mode,
    (v) => (state.blend.mode = v as BlendMode),
  );
  refreshBlendMode = () => {
    blendModeSelect.value = state.blend.mode;
  };
  blendSection.body.appendChild(labeled('Mode', blendModeSelect));
  blendSection.body.appendChild(
    labeled('Amount', rangeInput(0, 1, 0.05, state.blend.amount, (v) => (state.blend.amount = v))),
  );
  blendSection.body.appendChild(
    labeled('Softness', rangeInput(0.02, 0.5, 0.01, state.blend.softness, (v) => (state.blend.softness = v))),
  );
  blendSection.body.appendChild(
    labeled('Hold', rangeInput(0, 3, 0.1, state.blend.hold, (v) => (state.blend.hold = v))),
  );

  // ---- style section ----
  const styleSection = section('Style');
  const rampNames = RAMPS.map((r) => r.name).concat('Custom');
  const customRamp = document.createElement('input');
  customRamp.type = 'text';
  customRamp.className = 'ramp-input';
  customRamp.value = state.mapper.ramp;
  customRamp.addEventListener('input', () => {
    if (customRamp.value.length >= 2) state.mapper.ramp = customRamp.value;
  });
  const rampSelect = selectInput(rampNames, 'Classic', (name) => {
    const preset = RAMPS.find((r) => r.name === name);
    if (preset) {
      state.mapper.ramp = preset.chars;
      customRamp.value = preset.chars;
    }
  });
  styleSection.body.appendChild(labeled('Ramp', rampSelect));
  styleSection.body.appendChild(labeled('Chars', customRamp));
  styleSection.body.appendChild(
    labeled('Gamma', rangeInput(0.3, 3, 0.05, state.mapper.gamma, (v) => (state.mapper.gamma = v))),
  );
  const invert = document.createElement('input');
  invert.type = 'checkbox';
  invert.addEventListener('change', () => (state.mapper.invert = invert.checked));
  styleSection.body.appendChild(labeled('Invert', invert));
  const colorModeSelect = selectInput(['mono', 'gradient', 'source'], state.mapper.colorMode, (v) => {
    state.mapper.colorMode = v as MapperConfig['colorMode'];
  });
  styleSection.body.appendChild(labeled('Color mode', colorModeSelect));
  const fgInput = colorInput(state.mapper.fg, (v) => (state.mapper.fg = v));
  const fg2Input = colorInput(state.mapper.fg2, (v) => (state.mapper.fg2 = v));
  const bgInput = colorInput(state.mapper.bg, (v) => (state.mapper.bg = v));
  styleSection.body.appendChild(labeled('Ink', fgInput));
  styleSection.body.appendChild(labeled('Ink 2', fg2Input));
  styleSection.body.appendChild(labeled('Paper', bgInput));
  applyInks = (inks) => {
    Object.assign(state.mapper, inks);
    fgInput.value = inks.fg;
    fg2Input.value = inks.fg2;
    bgInput.value = inks.bg;
  };

  // ---- fx section ----
  const fxSection = section('FX (raster)');
  fxSection.body.appendChild(
    labeled('Glow', rangeInput(0, 1, 0.05, state.fx.glow, (v) => (state.fx.glow = v))),
  );
  fxSection.body.appendChild(
    labeled('Scanlines', rangeInput(0, 1, 0.05, state.fx.scanlines, (v) => (state.fx.scanlines = v))),
  );
  fxSection.body.appendChild(
    labeled('Vignette', rangeInput(0, 1, 0.05, state.fx.vignette, (v) => (state.fx.vignette = v))),
  );

  // ---- layers section ----
  const layersSection = section('Layers');
  const underlayCheck = document.createElement('input');
  underlayCheck.type = 'checkbox';
  underlayCheck.addEventListener('change', () => {
    state.layers.underlay.enabled = underlayCheck.checked;
    preloadLayers();
  });
  const underlayHint = el('div', 'media-status');
  layersSection.body.appendChild(labeled('Image under', underlayCheck));
  layersSection.body.appendChild(underlayHint);
  layersSection.body.appendChild(
    labeled('Image opacity', rangeInput(0, 1, 0.05, state.layers.underlay.opacity, (v) => (state.layers.underlay.opacity = v))),
  );
  layersSection.body.appendChild(
    labeled('Image brightness', rangeInput(0, 2, 0.05, state.layers.underlay.brightness, (v) => (state.layers.underlay.brightness = v))),
  );
  layersSection.body.appendChild(
    labeled('ASCII opacity', rangeInput(0, 1, 0.05, state.layers.animOpacity, (v) => (state.layers.animOpacity = v))),
  );
  const overlayCheck = document.createElement('input');
  overlayCheck.type = 'checkbox';
  overlayCheck.addEventListener('change', () => {
    state.layers.overlay.enabled = overlayCheck.checked;
    preloadLayers();
  });
  const overlayInput = document.createElement('input');
  overlayInput.type = 'file';
  overlayInput.accept = 'image/*';
  overlayInput.style.display = 'none';
  const overlayPick = el('button', 'btn', '📂 Load overlay PNG');
  overlayPick.addEventListener('click', () => overlayInput.click());
  overlayInput.addEventListener('change', async () => {
    const file = overlayInput.files?.[0];
    if (!file) return;
    try {
      state.layers.overlay.src = await imageDataUri(file);
      state.layers.overlay.enabled = true;
      await preloadLayerImages(state.layers);
      refreshLayers();
      toast(`Overlay "${file.name}" loaded`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  });
  layersSection.body.appendChild(labeled('PNG over', overlayCheck));
  layersSection.body.appendChild(labeled('', overlayPick));
  layersSection.body.appendChild(overlayInput);
  refreshLayers = () => {
    const hasUnderlay = !!state.layers.underlay.src;
    underlayCheck.disabled = !hasUnderlay;
    underlayCheck.checked = state.layers.underlay.enabled;
    underlayHint.textContent = hasUnderlay ? '' : 'Load an image as media to enable the underlay';
    overlayCheck.disabled = !state.layers.overlay.src;
    overlayCheck.checked = state.layers.overlay.enabled;
  };
  refreshLayers();

  // ---- grid section ----
  const gridSection = section('Grid');
  gridSection.body.appendChild(
    labeled('Columns', rangeInput(40, 240, 4, state.cols, (v) => {
      state.cols = v;
      rebuildGrid();
    })),
  );
  gridSection.body.appendChild(
    labeled('Cell size', rangeInput(6, 28, 1, state.cellH, (v) => (state.cellH = v))),
  );
  gridSection.body.appendChild(
    labeled('Aspect', selectInput(Object.keys(ASPECTS), '16:9', (v) => {
      state.aspect = ASPECTS[v];
      rebuildGrid();
    })),
  );

  // ---- playback section ----
  const playSection = section('Playback');
  const playBtn = el('button', 'btn', '⏸ Pause');
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸ Pause' : '▶ Play';
  });
  const scrub = document.createElement('input');
  scrub.type = 'range';
  scrub.min = '0';
  scrub.max = '1';
  scrub.step = '0.001';
  scrub.value = '0';
  scrub.addEventListener('input', () => {
    t = Number(scrub.value) * state.duration;
  });
  playSection.body.appendChild(labeled('', playBtn));
  playSection.body.appendChild(labeled('Scrub', scrub));
  playSection.body.appendChild(
    labeled('Loop (s)', rangeInput(2, 20, 0.5, state.duration, (v) => (state.duration = v), (input, valEl) => {
      setDuration = (v: number) => {
        state.duration = v;
        input.value = String(v);
        valEl.textContent = String(v);
      };
    })),
  );
  playSection.body.appendChild(
    labeled('FPS', selectInput(['12', '24', '30', '60'], String(state.fps), (v) => (state.fps = Number(v)))),
  );
  playSection.body.appendChild(
    labeled('Speed', rangeInput(0.1, 3, 0.1, state.speed, (v) => (state.speed = v))),
  );

  // ---- seed section ----
  const seedSection = section('Seed');
  const seedInput = document.createElement('input');
  seedInput.type = 'number';
  seedInput.value = String(state.seed);
  seedInput.addEventListener('change', () => (state.seed = Number(seedInput.value) | 0));
  const dice = el('button', 'btn', '🎲 Randomize');
  dice.addEventListener('click', () => {
    state.seed = Math.floor(Math.random() * 1e9);
    seedInput.value = String(state.seed);
  });
  seedSection.body.appendChild(labeled('Seed', seedInput));
  seedSection.body.appendChild(labeled('', dice));

  // ---- export section ----
  const exportSection = section('Export');
  buildExportPanel(exportSection.body, state, () => t, (event) => {
    const { name, ...properties } = event;
    track(name, properties);
  });

  panel.append(baseSection.root, srcSection.root, blendSection.root, styleSection.root, fxSection.root, layersSection.root, gridSection.root, playSection.root, seedSection.root, exportSection.root);

  // ---- presets ----
  const PRESET_KEY = 'glyphloop-presets';
  const loadPresets = (): Record<string, AppState> => {
    try {
      return JSON.parse(localStorage.getItem(PRESET_KEY) ?? '{}');
    } catch {
      return {};
    }
  };
  const syncControl = (root: HTMLElement, labelText: string, value: string | number | boolean) => {
    const row = Array.from(root.querySelectorAll<HTMLElement>('.control-row')).find((candidate) =>
      candidate.querySelector('.control-label')?.textContent === labelText,
    );
    const input = row?.querySelector<HTMLInputElement | HTMLSelectElement>('input, select');
    if (!input) return;
    if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = String(value);
    const display = row?.querySelector<HTMLElement>('.control-value');
    if (display) display.textContent = String(value);
  };
  const applyState = (s: AppState) => {
    Object.assign(state, s);
    const incoming = (s as Partial<AppState>).layers;
    state.layers = {
      ...defaultLayers(),
      ...incoming,
      underlay: { ...defaultLayers().underlay, ...incoming?.underlay },
      overlay: { ...defaultLayers().overlay, ...incoming?.overlay },
    };
    preloadLayers();
    rebuildGrid();
    srcSelect.value = state.sourceId;
    refreshParams();
    refreshBase();
    baseTypeSelect.value = state.base.type;
    refreshBlendMode();
    syncControl(blendSection.root, 'Amount', state.blend.amount);
    syncControl(blendSection.root, 'Softness', state.blend.softness);
    syncControl(blendSection.root, 'Hold', state.blend.hold);
    seedInput.value = String(state.seed);
    customRamp.value = state.mapper.ramp;
    rampSelect.value = RAMPS.find((item) => item.chars === state.mapper.ramp)?.name ?? 'Custom';
    syncControl(styleSection.root, 'Gamma', state.mapper.gamma);
    colorModeSelect.value = state.mapper.colorMode;
    fgInput.value = state.mapper.fg;
    fg2Input.value = state.mapper.fg2;
    bgInput.value = state.mapper.bg;
    invert.checked = state.mapper.invert;
    syncControl(fxSection.root, 'Glow', state.fx.glow);
    syncControl(fxSection.root, 'Scanlines', state.fx.scanlines);
    syncControl(fxSection.root, 'Vignette', state.fx.vignette);
    syncControl(layersSection.root, 'Image opacity', state.layers.underlay.opacity);
    syncControl(layersSection.root, 'Image brightness', state.layers.underlay.brightness);
    syncControl(layersSection.root, 'ASCII opacity', state.layers.animOpacity);
    syncControl(gridSection.root, 'Columns', state.cols);
    syncControl(gridSection.root, 'Cell size', state.cellH);
    syncControl(gridSection.root, 'Aspect', Object.keys(ASPECTS).find((key) => Math.abs(ASPECTS[key] - state.aspect) < 0.0001) ?? '16:9');
    syncControl(playSection.root, 'Loop (s)', state.duration);
    syncControl(playSection.root, 'FPS', state.fps);
    syncControl(playSection.root, 'Speed', state.speed);
    refreshLayers();
    toast('Preset loaded');
  };
  const presetSelect = selectInput([''], '', (name) => {
    if (name.startsWith('builtin:')) {
      const builtin = builtinBySlug(name.slice('builtin:'.length));
      if (builtin) {
        applyState(mergePreset(builtin.preset, true));
        dismissFirstRun();
        track('preset_selected', { preset: builtin.slug, builtIn: true });
      }
      return;
    }
    if (name.startsWith('saved:')) {
      const savedName = name.slice('saved:'.length);
      const p = loadPresets()[savedName];
      if (p) {
        applyState(p);
        dismissFirstRun();
        track('preset_selected', { preset: savedName, builtIn: false });
      }
    }
  });
  const refreshPresetList = () => {
    const names = Object.keys(loadPresets());
    presetSelect.innerHTML = '';
    const promptOption = document.createElement('option');
    promptOption.value = '';
    promptOption.textContent = '— choose a preset —';
    presetSelect.appendChild(promptOption);
    const starters = document.createElement('optgroup');
    starters.label = 'Built-in starters';
    for (const item of BUILTIN_PRESETS) {
      const o = document.createElement('option');
      o.value = `builtin:${item.slug}`;
      o.textContent = `${item.name} — ${item.description}`;
      starters.appendChild(o);
    }
    presetSelect.appendChild(starters);
    if (names.length) {
      const saved = document.createElement('optgroup');
      saved.label = 'Your presets';
      for (const name of names) {
        const o = document.createElement('option');
        o.value = `saved:${name}`;
        o.textContent = name;
        saved.appendChild(o);
      }
      presetSelect.appendChild(saved);
    }
  };
  refreshPresetList();
  const saveBtn = el('button', 'btn', 'Save');
  saveBtn.addEventListener('click', () => {
    const name = prompt('Preset name?');
    if (!name) return;
    const all = loadPresets();
    all[name] = JSON.parse(JSON.stringify(state));
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(all));
    } catch {
      toast('Preset too large for browser storage - use Download instead', 'error');
      return;
    }
    refreshPresetList();
    presetSelect.value = `saved:${name}`;
    toast(`Saved "${name}"`);
  });
  const dlBtn = el('button', 'btn', 'Download');
  dlBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ascii-preset.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  const upInput = document.createElement('input');
  upInput.type = 'file';
  upInput.accept = '.json';
  upInput.style.display = 'none';
  upInput.addEventListener('change', async () => {
    const file = upInput.files?.[0];
    if (!file) return;
    try {
      assertPresetFile(file);
      applyState(mergePreset(parsePresetJson(await file.text()), true));
    } catch (error) {
      toast(`Invalid preset file: ${(error as Error).message}`, 'error');
    }
  });
  const upBtn = el('button', 'btn', 'Load file');
  upBtn.addEventListener('click', () => upInput.click());
  const privacyLink = el('a', 'privacy-link', 'Privacy');
  privacyLink.setAttribute('href', '/privacy.html');
  privacyLink.setAttribute('target', '_blank');
  privacyLink.setAttribute('rel', 'privacy-policy');
  presetBar.append(presetSelect, saveBtn, dlBtn, upBtn, privacyLink, upInput);

  const openBuiltin = (slug: string) => {
    const builtin = builtinBySlug(slug);
    if (!builtin) return false;
    applyState(mergePreset(builtin.preset, true));
    presetSelect.value = `builtin:${slug}`;
    dismissFirstRun();
    track('preset_selected', { preset: slug, builtIn: true });
    return true;
  };
  starterBtn.addEventListener('click', () => openBuiltin('flowfield-hero'));

  // ---- design import: drag & drop or paste an image/video anywhere ----
  const importMediaFile = async (file: File) => {
    let kind: 'image' | 'video';
    try {
      kind = assertMediaFile(file);
    } catch (error) {
      toast((error as Error).message, 'error');
      return;
    }
    track('media_import_started', { kind, via: 'drop-or-paste' });
    state.base.type = 'media';
    baseTypeSelect.value = 'media';
    if (state.blend.mode === 'replace') {
      state.blend.mode = 'modulate';
      refreshBlendMode();
    }
    refreshBase();
    const status = () => document.querySelector('.media-status');
    try {
      const rows = rowsFor(state.cols, state.aspect);
      const result = await bakeFile(file, state.cols, rows, state.fps, (done, total) => {
        const el = status();
        if (el) el.textContent = `Baking ${done}/${total}…`;
      });
      if (result.seconds > 0) setDuration(Math.min(20, Math.max(2, result.seconds)));
      await captureUnderlay(file);
      state.mapper.colorMode = 'source';
      colorModeSelect.value = 'source';
      refreshBase();
      dismissFirstRun();
      toast(`${file.name} imported - colors inherited (color mode: source)`);
      track('media_import_completed', { kind, via: 'drop-or-paste' });
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, 'error');
      track('media_import_failed', { kind, via: 'drop-or-paste' });
    }
  };

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    stage.classList.add('drop-hint');
  });
  document.addEventListener('dragleave', () => stage.classList.remove('drop-hint'));
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    stage.classList.remove('drop-hint');
    const file = e.dataTransfer?.files?.[0];
    if (file) void importMediaFile(file);
  });
  document.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (file) void importMediaFile(file);
  });

  // ---- render loop ----
  let last = performance.now();
  const tick = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    if (playing) {
      t = (t + dt * state.speed) % state.duration;
      scrub.value = String(t / state.duration);
    }
    scene.render(state, t % state.duration, grid, colorGrid);
    renderer.draw(grid, state.mapper, { cols: state.cols, cellH: state.cellH, font: FONT }, { colorGrid, fx: state.fx, layers: layerBitmaps(state.layers) });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const query = new URLSearchParams(window.location.search);
  const requestedRecipe = query.get('recipe');
  const requestedPreset = query.get('preset');
  if (requestedRecipe) {
    try {
      applyState(mergePreset(parsePresetJson(requestedRecipe), true));
      dismissFirstRun();
      track('preset_selected', { preset: 'shared-recipe', builtIn: false });
    } catch (error) {
      toast(`Could not open shared preset: ${(error as Error).message}`, 'error');
    }
  } else if (requestedPreset && !openBuiltin(requestedPreset)) {
    toast(`Unknown preset "${requestedPreset}"`, 'error');
  }
  trackEditorOpened();

  // Console/automation API: drive the editor programmatically, e.g.
  // __studio.apply({sourceId: 'waves', mapper: {fg: '#0f0'}}).
  (window as unknown as { __studio: object }).__studio = {
    state,
    apply(partial: PresetInput) {
      applyState(mergePreset(partial, true));
    },
    seek(phase: number) {
      t = phase * state.duration;
    },
  };
}
