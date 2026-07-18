/**
 * Seeded, dependency-free noise. Sources sample 4D value noise with two
 * dimensions traced around a circle (loopCoords) so animations are exactly
 * periodic in time.
 */

function hashInt(seed: number, x: number, y: number, z: number, w: number): number {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ x, 0x85ebca6b);
  h = Math.imul(h ^ y, 0xc2b2ae35);
  h = Math.imul(h ^ z, 0x27d4eb2f);
  h = Math.imul(h ^ w, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}

/** Deterministic hash of two integers → [0, 1). */
export function hash2(seed: number, x: number, y: number): number {
  return hashInt(seed, x | 0, y | 0, 0, 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 4D value noise, smooth, deterministic, output in [0, 1). */
export function valueNoise4(seed: number, x: number, y: number, z: number, w: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), wi = Math.floor(w);
  const u = smooth(x - xi), v = smooth(y - yi), s = smooth(z - zi), r = smooth(w - wi);

  const c = (dx: number, dy: number, dz: number, dw: number) =>
    hashInt(seed, xi + dx, yi + dy, zi + dz, wi + dw) / 4294967296;

  // Interpolate over the 16 corners of the 4D lattice cell.
  const x0000 = lerp(c(0, 0, 0, 0), c(1, 0, 0, 0), u);
  const x0100 = lerp(c(0, 1, 0, 0), c(1, 1, 0, 0), u);
  const x0010 = lerp(c(0, 0, 1, 0), c(1, 0, 1, 0), u);
  const x0110 = lerp(c(0, 1, 1, 0), c(1, 1, 1, 0), u);
  const x0001 = lerp(c(0, 0, 0, 1), c(1, 0, 0, 1), u);
  const x0101 = lerp(c(0, 1, 0, 1), c(1, 1, 0, 1), u);
  const x0011 = lerp(c(0, 0, 1, 1), c(1, 0, 1, 1), u);
  const x0111 = lerp(c(0, 1, 1, 1), c(1, 1, 1, 1), u);

  const y00 = lerp(x0000, x0100, v);
  const y10 = lerp(x0010, x0110, v);
  const y01 = lerp(x0001, x0101, v);
  const y11 = lerp(x0011, x0111, v);

  const z0 = lerp(y00, y10, s);
  const z1 = lerp(y01, y11, s);

  return lerp(z0, z1, r);
}

/** Fractal Brownian motion over valueNoise4, output in [0, 1). */
export function fbm4(seed: number, x: number, y: number, z: number, w: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x, fy = y, fz = z, fw = w;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise4(seed + o * 101, fx, fy, fz, fw);
    norm += amp;
    amp *= 0.5;
    fx *= 2; fy *= 2; fz *= 2; fw *= 2;
  }
  return sum / norm;
}

/**
 * Trace a circle in the (z, w) noise dimensions. Sampling noise at these
 * coords makes any animation exactly periodic with the given duration.
 */
export function loopCoords(t: number, duration: number, radius: number): [number, number] {
  const angle = (2 * Math.PI * (((t / duration) % 1) + 1)) % (2 * Math.PI);
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}
