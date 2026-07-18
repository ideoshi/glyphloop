import { describe, it, expect } from 'vitest';
import { crc32, zipStore } from '../src/core/zip';

describe('crc32', () => {
  it('matches the known check value for "123456789"', () => {
    const data = new TextEncoder().encode('123456789');
    expect(crc32(data) >>> 0).toBe(0xcbf43926);
  });
});

describe('zipStore', () => {
  it('produces a ZIP with correct signatures and entry count', async () => {
    const blob = zipStore([
      { name: 'a.txt', data: 'hello' },
      { name: 'dir/b.txt', data: new TextEncoder().encode('world') },
    ]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Local file header signature PK\x03\x04
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // End-of-central-directory signature PK\x05\x06 exists with entry count 2
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        eocd = i;
        break;
      }
    }
    expect(eocd).toBeGreaterThan(-1);
    const count = bytes[eocd + 10] | (bytes[eocd + 11] << 8);
    expect(count).toBe(2);
  });
});
