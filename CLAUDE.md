# Glyphloop

Local web app + headless CLI for loop-perfect generative ASCII animations (web
embeds, MP4/GIF/PNG, terminal players). Imported video repeats one sampled pass
and is seamless only when the source footage already loops.

## Commands

- `npm run dev` - editor UI on http://localhost:5199 (browser preview via `.claude/launch.json`)
- `npm test` - vitest unit tests (always run before committing)
- `npm run build` - typecheck + production build
- `npm run render -- --preset <file> --out <dir>` - headless render; see AGENTS.md
- `npm run mcp` - start the MCP server (stdio) so an agent can drive renders

## Generating animations as an agent

Read **AGENTS.md** first - it has the preset JSON schema, per-source parameter
tables, MCP tool reference, and embed integration snippets.

Headless sources (render via CLI/MCP): flowfield, waves, blobs, rain, shapes3d,
expr, parametric3d. Image/video/text base layers and PNG/GIF/MP4 export are
browser-editor features (canvas/codecs) and cannot render headless.

To expose the MCP server to an agent from any project, register the repo-local
binary (replace the path with this repo's absolute path):

```sh
claude mcp add --scope user glyphloop -- node "/absolute/path/to/glyphloop/bin/glyphloop.js" mcp
```

Use the public `npx glyphloop@beta render ...` and `npx glyphloop@beta mcp`
commands from any project. For development against this checkout, use
`npm run render -- ...` and `npm run mcp` from inside the repo.

## Architecture

```
Source (pure fn of t, seed, params - must be loop-periodic)
  → FieldFrame (src/core/field.ts, brightness grid)
  → AsciiMapper (src/core/mapper.ts, brightness → char + color)
  → CanvasRenderer (src/core/render.ts)
  → exporters (src/export/*)
```

- `src/core/state.ts` - `AppState`, the single serializable state = preset format.
  Keep it import-clean: no UI or CJS-dep imports (the CLI loads it under Node ESM).
- `src/sources/` - one file per source + `SOURCES` registry in `index.ts`.
- `src/cli/preset.ts` - validates presets and rejects browser-only bases/layers
  (image/video/text) so the headless CLI only accepts renderable input.
- `src/cli/` - preset merge/validation + render command (run via tsx).
- `src/mcp/server.ts` - MCP server (list_sources, preview_frame, render_animation).
- Loop-perfection rule: time may only enter a source via `loopCoords()` noise
  sampling or integer-cycle `2π·k·t/T` phases. Tests enforce t=0 ≡ t=duration.

## Conventions

- TDD for pure core code; browser behavior verified manually in the editor.
- gifenc is CJS - anything the CLI imports must not pull `src/export/gif.ts`/`mp4.ts`.
- Keep repository documentation focused on how to use, develop, and contribute
  to Glyphloop.
- Use focused feature branches and merge through pull requests after checks pass.
