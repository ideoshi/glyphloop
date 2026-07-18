# Glyphloop - Agent Guide

This repo generates **loop-perfect ASCII animations** for websites. As an AI
agent you can create one without a browser: author a small JSON preset, run
one command (or use the MCP server), and drop the output files into a site.

## Quick start (CLI)

```sh
npx glyphloop@beta render --preset flowfield-hero --out out/hero
npx glyphloop@beta render --json '{"sourceId":"waves","mapper":{"fg":"#00ff88"}}' --out out/waves
```

From a source checkout:

```sh
npm run render -- --preset flowfield-hero --out out/hero
npm run render -- --json '{"sourceId":"waves","mapper":{"fg":"#00ff88"}}' --out out/waves
```

Output (`--format embed`, the default):

| File | Purpose |
|---|---|
| `frames.json` | RLE-compressed character frames + style metadata |
| `player.js` | Dependency-free player (~2 kB, honors `prefers-reduced-motion`) |
| `index.html` | Working demo page |

Other formats: `--format terminal` (ANSI `frames.ans` + `play.sh`),
`--format frames` (frames.json only). The command prints a JSON summary on
success and a descriptive `error:` line on bad input - errors list the valid
options, so read them and retry.

## MCP server (use from any project)

```sh
npx glyphloop@beta mcp
```

From this repository, run `npm run mcp`. To register the installed command in
Claude Code:

```sh
claude mcp add --scope user glyphloop -- npx -y glyphloop@beta mcp
```

Tools: `list_sources` (call first - full schema + params), `preview_frame`
(render one frame as text to check the look before committing), and
`render_animation` (write embed/terminal/frames files to a directory).
Iterate: preview → tweak preset → preview → render.

## Embedding in a website

```html
<div data-ascii-player></div>
<script>window.ASCII_DATA = /* contents of frames.json */;</script>
<script src="player.js"></script>
```

Or call `AsciiPlayer(element, data)` yourself. The player renders into a
`<pre>`; size with CSS `font-size`. Keep embeds modest: ~140 cols × 8–12 s ×
24 fps is commonly 0.5–2.5 MB of `frames.json` depending on motion and RLE
compression, and per-cell source color can be larger. Preview the actual export
before shipping it on a performance-sensitive page.

## Preset schema (all fields optional)

```jsonc
{
  "sourceId": "flowfield",   // effect layer: flowfield | waves | blobs | rain | shapes3d | expr | parametric3d
  "sourceParams": { "<sourceId>": { /* per-source params below */ } },

  "base":  { "type": "none",          // "text"/"media" bases need the browser editor; headless = "none"
             "fit": "cover",           // media framing: cover | contain | stretch (contain letterboxes)
             "scale": 1 },             // media zoom around center, 0.25-4 (1 = fitted size)
  "layers": { "underlay": { "enabled": false, "src": null, "opacity": 1, "brightness": 1 }, "animOpacity": 1,
              "overlay": { "enabled": false, "src": null } },
                                       // browser-only image underlay/overlay stack (data URIs); headless presets
                                       // keep layers disabled or omit them; animOpacity (0..1) fades the ASCII
                                       // layer over the underlay; underlay opacity (0..1) fades the image toward
                                       // the paper color, brightness (0..2) darkens or brightens it (1 neutral)
  "blend": { "mode": "replace",       // replace | modulate | screen | displace | reveal | inside
             "amount": 0.8,            // 0-1 effect strength
             "softness": 0.15,         // reveal edge width
             "hold": 1 },              // reveal plateau width

  "mapper": {
    "rampName": "Classic",            // Classic | Dense | Blocks | Dots | Binary | Slashes
    "ramp": " .:-=+*#%@",             // or custom characters, dark → bright
    "invert": false,
    "gamma": 1,
    "colorMode": "mono",              // mono | gradient | source (source = per-cell base-image color)
    "fg": "#e8a34c", "fg2": "#6ea8fe", "bg": "#0d0f12"
  },

  "fx": { "glow": 0, "scanlines": 0, "vignette": 0 },  // 0-1 each; raster preview/PNG/GIF/MP4 only

  "cols": 140,                        // 20–240
  "aspect": "16:9",                   // 16:9 | 4:3 | 1:1 | 9:16 | 21:9 or a number (w/h)
  "fps": 24,                          // 5–60
  "duration": 8,                      // seconds 1–60; generated sources loop seamlessly
  "seed": 7                           // same seed = same animation
}
```

## Source parameters

**flowfield** - ambient flowing noise (best default for heroes)
`scale` 0.3–4, `warp` 0–4, `octaves` 1–5, `motion` 0.1–2, `contrast` 0.5–4.

**waves** - layered sine interference
`scale` 0.5–8, `cycles` 1–8 (int, passes per loop), `layers` 1–5, `radial` 0–1, `contrast` 0.5–3.

**blobs** - soft morphing organic shapes
`scale` 0.3–4, `threshold` 0.2–0.8, `softness` 0.01–0.4, `octaves` 1–5, `motion` 0.1–2.

**rain** - matrix-style falling streaks
`density` 0.1–1, `tail` 2–40, `maxSpeed` 1–6, `glitter` 0–1.

**shapes3d** - rotating shaded 3D object
`shape` torus|sphere|cube|knot, `spinX`/`spinY` 0–4 (int rotations/loop), `zoom` 0.4–2, `ambient` 0–0.5.

**expr** - YOUR OWN 2D animation as a brightness expression
`expr`: `f(x, y, ...) → 0..1`. Example: `"0.5 + 0.5*sin(8*length(x,y) - 2*theta)"`.

**parametric3d** - YOUR OWN 3D surface
`xExpr`/`yExpr`/`zExpr` in `u, v ∈ [0, 2π]`, plus `spinX`/`spinY`/`zoom`/`ambient`.
Example (torus): `x = (1 + 0.4*cos(v))*cos(u)`, `y = (1 + 0.4*cos(v))*sin(u)`, `z = 0.4*sin(v)`.
Use `theta` inside the exprs for shape morphing per loop.

### Expression language (expr + parametric3d)

Variables: `x y` (aspect-corrected, y ∈ −1..1) · `u v` (0..1 in expr, 0..2π in parametric3d) ·
`t T theta phase seed` (`theta` = 2π·t/T).
Functions: `sin cos tan atan2 abs min max pow sqrt exp log floor ceil fract sign clamp lerp
smoothstep length hypot hash(x,y) noise(x,y) fbm(x,y[,oct])`. Constants: `PI TAU E`.
Operators: `+ - * / % ^`.

**Loop-perfection rule:** animate only via integer multiples of `theta`
(`sin(k*x + 2*theta)`) or via `noise`/`fbm` (already bound to the loop
circle). `t` alone will NOT wrap seamlessly.

Bad expressions fail at preset validation with a position-tagged message - no
code execution is possible (whitelisted parser, no eval).

## Design tips

- Dark `bg` + one warm/cool `fg`; `gradient` + `Dots` ramp reads premium.
- 8–12 s loops with low motion feel calm; short + fast feels energetic.
- Vary `seed` to explore compositions cheaply. Preview before rendering.
- `fx.glow` ~0.4 + `fx.scanlines` ~0.25 = CRT look (raster exports only).
- Heroes: `21:9`/`16:9`; section accents: `1:1`.

## Design-import workflow (the power move, for agents too)

Design a frame anywhere you have full control - HTML/CSS, Canva, Figma, a
canvas script - export it as an image (or video), and **drag & drop (or
paste) it onto the editor**. Glyphloop auto-selects the media base, switches
blend to `modulate`, sets `colorMode: "source"`, and ASCII-fies it with
per-cell colors intact. Position gradients, exotic fonts, layouts, photos:
design first, glyph second. The same works for motion: any rendered video
becomes an ASCII animation. (Note: Chrome won't load fonts inside
SVG-as-image, so rasterize HTML via a real browser screenshot or canvas text
rather than foreignObject.)

### Tips for custom images & animations

- **ASCII is luminance-driven**: brightness picks the character. Design on a
  near-black background with a bright subject - contrast IS legibility.
  For light-background designs, set `mapper.invert: true`.
- **Design at grid scale.** Your image becomes ~140–240 "pixels" wide. Big
  bold shapes and thick strokes survive; thin lines and small text vanish.
  Preview at the target `cols` before polishing.
- **Colors need brightness.** `colorMode: "source"` keeps per-cell color, but
  dark saturated colors render as sparse dim glyphs. Keep hues at mid-to-high
  luminance. Prefer a curated look? Click "Set ink & paper from image" to
  derive inks, then choose mono or gradient instead.
- **Match the aspect.** Media is cover-cropped to the grid - design at the
  aspect you'll render (16:9, 21:9, 1:1) so nothing important gets cut.
- **Local media limits**: images ≤25 MiB and 40 decoded megapixels; videos
  ≤100 MiB; preset JSON ≤10 MiB. Media stays in the browser and is not uploaded.
- **Videos**: ≤20 s, baked at the editor's fps; exactly one pass plays per
  loop. Set Loop(s) to the clip length for natural speed, and use source
  footage that already loops if you want a seamless result.
- **Layer effects over the design**: `modulate` = living shimmer, `screen` =
  glints, `displace` = warp/ripple, `reveal` = build-in/out, `inside` =
  effect confined to the subject. Keep `amount` ≤0.5 when the design itself
  is the hero.
- **Exposure knobs**: `mapper.gamma` <1 lifts mids (denser glyphs), >1 thins
  them; the character ramp is your line weight - ` █` for solid, the classic
  ramp for tonal detail.

## Browser-only features (editor: `npm run dev` → localhost:5199)

- **Base layers**: put an image/video or text UNDER the effect and blend
  (`modulate`, `screen`, `displace`, `reveal`, `inside`) - rain inside a
  logo, waves warping a photo, dissolve-reveal text.
- **Color inheritance**: `colorMode: "source"` renders per-cell colors
  sampled from the base image/video; "Set ink & paper from image" derives a
  curated set of Ink, Ink 2, and Paper colors for mono/gradient modes.
- PNG (incl. transparent alpha), GIF, MP4 export.
