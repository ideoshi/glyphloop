/**
 * MCP server exposing the headless ASCII animation renderer to AI agents in
 * any project. Register once:
 *
 *   claude mcp add --scope user glyphloop -- npx -y glyphloop@beta mcp
 *
 * Tools: list_sources, preview_frame, render_animation.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SOURCES } from '../sources';
import { RAMPS, mapValue } from '../core/mapper';
import { rowsFor } from '../core/render';
import { FieldFrame } from '../core/field';
import { SceneRenderer } from '../core/scene';
import { mergePreset, type PresetInput } from '../cli/preset';
import { buildEmbedData, demoHtml, PLAYER_JS } from '../export/embed';
import { buildTerminalFrames, playScript } from '../export/terminal';
import { GLYPHLOOP_VERSION } from '../version';

const server = new McpServer({ name: 'glyphloop', version: GLYPHLOOP_VERSION });

const PRESET_GUIDE = `Preset JSON (all fields optional): {
  sourceId: one of ${SOURCES.map((s) => s.id).join(' | ')},
  sourceParams: { <sourceId>: { ...params } },
  blend/base: browser-only bases are rejected headless - use base "none",
  mapper: { rampName: ${RAMPS.map((r) => r.name).join('|')}, ramp, invert, gamma, colorMode: mono|gradient, fg, fg2, bg },
  cols (20-240), aspect ("16:9"|"1:1"|number), fps (5-60), duration (1-60 s), seed (int)
}
Sources 'expr' and 'parametric3d' accept expression strings - variables x y u v t T theta phase seed,
functions sin cos tan atan2 abs min max pow sqrt exp log floor ceil fract sign clamp lerp smoothstep
length hypot hash(x,y) noise(x,y) fbm(x,y[,oct]). theta = 2π·t/T; use integer multiples of theta (and
noise/fbm, which are loop-bound) so the animation loops seamlessly.`;

server.registerTool(
  'list_sources',
  {
    description:
      'List available animation sources with their parameters, plus the preset schema. Call this first.',
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: 'text',
        text:
          JSON.stringify(
            SOURCES.map((s) => ({
              id: s.id,
              name: s.name,
              params: s.params.map((p) => ({
                key: p.key,
                type: p.type,
                min: p.min,
                max: p.max,
                options: p.options,
                default: p.default,
              })),
            })),
            null,
            2,
          ) + `\n\n${PRESET_GUIDE}`,
      },
    ],
  }),
);

const presetShape = z.record(z.string(), z.unknown());

server.registerTool(
  'preview_frame',
  {
    description:
      'Render one frame of a preset as plain text so you can inspect the look before rendering. ' +
      'phase 0..1 picks the point in the loop.',
    inputSchema: {
      preset: presetShape.describe('Partial preset JSON (see list_sources)'),
      phase: z.number().min(0).max(1).optional().describe('Loop position, default 0.25'),
      maxCols: z.number().optional().describe('Downscale preview to at most this many columns (default 100)'),
    },
  },
  async ({ preset, phase, maxCols }) => {
    try {
      const state = mergePreset(preset as PresetInput);
      state.cols = Math.min(state.cols, Math.round(maxCols ?? 100));
      const rows = rowsFor(state.cols, state.aspect);
      const grid = new FieldFrame(state.cols, rows);
      new SceneRenderer(state.cols, rows).render(state, (phase ?? 0.25) * state.duration, grid);
      let text = '';
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < state.cols; x++) {
          text += state.mapper.ramp[mapValue(grid.get(x, y), state.mapper)];
        }
        text += '\n';
      }
      return { content: [{ type: 'text', text }] };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `error: ${(e as Error).message}` }] };
    }
  },
);

server.registerTool(
  'render_animation',
  {
    description:
      'Render a full loop-perfect animation to files. Format "embed" writes frames.json + player.js + ' +
      'index.html (drop into any website: <div data-ascii-player></div> + the two files). ' +
      '"terminal" writes frames.ans + play.sh. "frames" writes frames.json only.',
    inputSchema: {
      preset: presetShape.describe('Partial preset JSON (see list_sources)'),
      outDir: z.string().describe('Absolute directory to write output files into'),
      format: z.enum(['embed', 'terminal', 'frames']).optional().describe('Default embed'),
    },
  },
  async ({ preset, outDir, format }) => {
    try {
      const state = mergePreset(preset as PresetInput);
      const out = resolve(outDir);
      mkdirSync(out, { recursive: true });
      const fmt = format ?? 'embed';
      const files: string[] = [];
      let frames: number;

      if (fmt === 'terminal') {
        const ansiFrames = buildTerminalFrames(state);
        writeFileSync(join(out, 'frames.ans'), ansiFrames.join('\x1c'));
        writeFileSync(join(out, 'play.sh'), playScript(state.fps));
        chmodSync(join(out, 'play.sh'), 0o755);
        files.push('frames.ans', 'play.sh');
        frames = ansiFrames.length;
      } else {
        const data = buildEmbedData(state);
        writeFileSync(join(out, 'frames.json'), JSON.stringify(data));
        files.push('frames.json');
        if (fmt === 'embed') {
          writeFileSync(join(out, 'player.js'), PLAYER_JS);
          writeFileSync(join(out, 'index.html'), demoHtml(data));
          files.push('player.js', 'index.html');
        }
        frames = data.frames.length;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: true,
              out,
              format: fmt,
              source: state.sourceId,
              cols: state.cols,
              rows: rowsFor(state.cols, state.aspect),
              fps: state.fps,
              duration: state.duration,
              frames,
              files,
            }),
          },
        ],
      };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `error: ${(e as Error).message}` }] };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
