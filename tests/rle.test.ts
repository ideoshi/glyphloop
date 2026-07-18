import { describe, it, expect } from 'vitest';
import { rleEncode, rleDecode } from '../src/core/rle';

describe('RLE codec', () => {
  it('round-trips a random array', () => {
    const input = new Uint8Array(500);
    for (let i = 0; i < input.length; i++) input[i] = (i * 7919) % 10;
    expect(rleDecode(rleEncode(input))).toEqual(input);
  });

  it('compresses constant runs', () => {
    const input = new Uint8Array(1000).fill(3);
    const pairs = rleEncode(input);
    expect(pairs.length).toBeLessThan(20);
    expect(rleDecode(pairs)).toEqual(input);
  });

  it('handles runs longer than 255', () => {
    const input = new Uint8Array(70000).fill(7);
    expect(rleDecode(rleEncode(input))).toEqual(input);
  });

  it('handles empty input', () => {
    expect(rleDecode(rleEncode(new Uint8Array(0)))).toEqual(new Uint8Array(0));
  });
});
