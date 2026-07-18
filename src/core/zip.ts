/** Minimal ZIP writer (method 0 = store, no compression). */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array | string;
}

export function zipStore(files: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  for (const file of files) {
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const name = encoder.encode(file.name);
    const crc = crc32(data);

    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, // local file header signature
      ...u16(20), ...u16(0x0800), ...u16(0), // version, UTF-8 flag, method: store
      ...u16(0), ...u16(0), // mod time/date
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0),
    ]);
    parts.push(local, name, data);

    central.push(
      new Uint8Array([
        0x50, 0x4b, 0x01, 0x02, // central directory signature
        ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
        ...u16(0), ...u16(0),
        ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(name.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0),
        ...u32(offset),
      ]),
      name,
    );
    offset += local.length + name.length + data.length;
  }

  const centralSize = central.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, // end of central directory signature
    ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);

  return new Blob([...parts, ...central, eocd].map((p) => p.buffer.slice(p.byteOffset, p.byteOffset + p.byteLength) as ArrayBuffer), {
    type: 'application/zip',
  });
}
