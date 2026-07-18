export interface MapperConfig {
  ramp: string;
  invert: boolean;
  gamma: number;
  colorMode: 'mono' | 'gradient' | 'source';
  fg: string;
  bg: string;
  fg2: string;
}

export const RAMPS: { name: string; chars: string }[] = [
  { name: 'Classic', chars: ' .:-=+*#%@' },
  { name: 'Dense', chars: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$' },
  { name: 'Blocks', chars: ' ░▒▓█' },
  { name: 'Dots', chars: ' .·••●' },
  { name: 'Binary', chars: ' 01' },
  { name: 'Slashes', chars: ' /\\|X' },
];

/** Brightness [0,1] → ramp index, after gamma and invert. */
export function mapValue(v: number, cfg: MapperConfig): number {
  let x = Math.min(1, Math.max(0, v));
  x = Math.pow(x, cfg.gamma);
  if (cfg.invert) x = 1 - x;
  return Math.min(cfg.ramp.length - 1, Math.floor(x * cfg.ramp.length));
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Color for a cell of brightness v (post gamma/invert not applied - raw v). */
export function cellColor(v: number, cfg: MapperConfig): string {
  if (cfg.colorMode === 'mono') return cfg.fg;
  const [r1, g1, b1] = parseHex(cfg.fg);
  const [r2, g2, b2] = parseHex(cfg.fg2);
  const t = Math.min(1, Math.max(0, v));
  return toHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
