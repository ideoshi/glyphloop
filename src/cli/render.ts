/**
 * Headless renderer for AI agents and scripts.
 *
 *   npm run render -- --preset presets/flowfield.json --out out/hero
 *   npm run render -- --json '{"sourceId":"waves"}' --out out/waves --format terminal
 *
 * Formats: embed (frames.json + player.js + index.html), terminal
 * (frames.ans + play.sh), frames (frames.json only).
 */
import { mkdirSync, writeFileSync, readFileSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { mergePreset, parsePresetJson, type PresetInput } from './preset';
import { buildEmbedData, demoHtml, PLAYER_JS } from '../export/embed';
import { buildTerminalFrames, playScript } from '../export/terminal';
import { BUILTIN_PRESETS, builtinBySlug } from '../presets/builtins';

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const presetPath = arg('preset');
const inlineJson = arg('json');
const out = arg('out') ?? fail('--out <dir> is required');
const format = arg('format') ?? 'embed';

if (!['embed', 'terminal', 'frames'].includes(format)) {
  fail(`unknown --format "${format}". Valid: embed, terminal, frames`);
}
if (!presetPath && !inlineJson) fail('provide --preset <file.json> or --json <inline-json>');

let input: PresetInput;
try {
  if (inlineJson) {
    input = parsePresetJson(inlineJson);
  } else {
    const builtin = builtinBySlug(presetPath!);
    if (builtin) input = builtin.preset;
    else if (existsSync(presetPath!)) input = parsePresetJson(readFileSync(presetPath!, 'utf8'));
    else fail(`unknown preset "${presetPath}". Use a JSON file or one of: ${BUILTIN_PRESETS.map((p) => p.slug).join(', ')}`);
  }
} catch (e) {
  fail(`could not parse preset: ${(e as Error).message}`);
}

let state;
try {
  state = mergePreset(input);
} catch (e) {
  fail((e as Error).message);
}

mkdirSync(out, { recursive: true });
const files: string[] = [];
let rows: number;
let frameCount: number;

if (format === 'terminal') {
  const frames = buildTerminalFrames(state);
  writeFileSync(join(out, 'frames.ans'), frames.join('\x1c'));
  writeFileSync(join(out, 'play.sh'), playScript(state.fps));
  chmodSync(join(out, 'play.sh'), 0o755);
  files.push('frames.ans', 'play.sh');
  rows = frames[0].split('\n').length;
  frameCount = frames.length;
} else {
  const data = buildEmbedData(state);
  writeFileSync(join(out, 'frames.json'), JSON.stringify(data));
  files.push('frames.json');
  if (format === 'embed') {
    writeFileSync(join(out, 'player.js'), PLAYER_JS);
    writeFileSync(join(out, 'index.html'), demoHtml(data));
    files.push('player.js', 'index.html');
  }
  rows = data.rows;
  frameCount = data.frames.length;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      out,
      format,
      source: state.sourceId,
      cols: state.cols,
      rows,
      fps: state.fps,
      duration: state.duration,
      frames: frameCount,
      files,
    },
    null,
    2,
  ),
);
