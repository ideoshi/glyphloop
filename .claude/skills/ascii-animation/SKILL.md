---
name: ascii-animation
description: Generate a loop-perfect ASCII animation (web embed, terminal, or raw frames) from a JSON preset using this repo's headless renderer. Use when asked to create an ASCII animation, ASCII background, or ASCII hero/embed for a website.
---

# Generating ASCII animations

1. Read `AGENTS.md` for the preset schema and per-source parameter tables.
2. Author a preset - start from a file in `presets/` and change only what the
   request needs (source, colors, size, duration, seed).
3. Render headless:

   ```sh
   npm run render -- --preset <preset.json> --out <dir>            # web embed
   npm run render -- --json '<inline-json>' --out <dir> --format terminal
   ```

4. The command prints a JSON summary. On `error:` output, the message lists
   valid options - fix the preset and retry.
5. For websites, deliver `frames.json` + `player.js` and this snippet:

   ```html
   <div data-ascii-player></div>
   <script>window.ASCII_DATA = /* frames.json contents */;</script>
   <script src="player.js"></script>
   ```

Headless sources: `flowfield`, `waves`, `blobs`, `rain`, `shapes3d`, `expr`
(custom brightness expression), `parametric3d` (custom 3D surface).
Image/video/text base layers, color inheritance, and PNG/GIF/MP4 export need
the editor UI (`npm run dev`, port 5199). Iterate on look by changing `seed` first, then params. Verify
output by serving the out dir and checking the demo `index.html`.
