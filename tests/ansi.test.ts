import { describe, it, expect } from 'vitest';
import { frameToAnsi, hexToAnsiFg } from '../src/core/ansi';

describe('frameToAnsi', () => {
  it('joins rows with newlines', () => {
    expect(frameToAnsi(['ab', 'cd'])).toBe('ab\ncd');
  });

  it('wraps with 24-bit color and reset when fg given', () => {
    const out = frameToAnsi(['x'], '#ff8800');
    expect(out).toBe('\x1b[38;2;255;136;0mx\x1b[0m');
  });
});

describe('hexToAnsiFg', () => {
  it('converts hex to SGR foreground sequence', () => {
    expect(hexToAnsiFg('#000000')).toBe('\x1b[38;2;0;0;0m');
  });
});
