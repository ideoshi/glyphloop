/** Hex color → 24-bit ANSI SGR foreground sequence. */
export function hexToAnsiFg(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

/** Serialize one frame of character rows for terminal playback. */
export function frameToAnsi(rows: string[], fg?: string): string {
  const body = rows.join('\n');
  return fg ? `${hexToAnsiFg(fg)}${body}\x1b[0m` : body;
}
