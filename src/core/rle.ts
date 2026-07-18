/** Run-length encode byte values as flat [count, value, count, value, ...]. */
export function rleEncode(indices: Uint8Array): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < indices.length) {
    const v = indices[i];
    let run = 1;
    while (i + run < indices.length && indices[i + run] === v) run++;
    out.push(run, v);
    i += run;
  }
  return out;
}

export function rleDecode(pairs: number[], out?: Uint8Array): Uint8Array {
  let total = 0;
  for (let i = 0; i < pairs.length; i += 2) total += pairs[i];
  const buf = out ?? new Uint8Array(total);
  let pos = 0;
  for (let i = 0; i < pairs.length; i += 2) {
    buf.fill(pairs[i + 1], pos, pos + pairs[i]);
    pos += pairs[i];
  }
  return buf;
}
