import { describe, it, expect } from 'vitest';
import { compileExpr, type ExprEnv } from '../src/core/expr';

const env = (vars: Partial<ExprEnv['vars']> = {}): ExprEnv => ({
  vars: { x: 0, y: 0, u: 0, v: 0, t: 0, T: 4, theta: 0, phase: 0, seed: 1, ...vars },
  seed: 1,
  z: 0.5,
  w: 0.5,
});

describe('compileExpr', () => {
  it('evaluates arithmetic with precedence', () => {
    expect(compileExpr('1 + 2 * 3')(env())).toBe(7);
    expect(compileExpr('(1 + 2) * 3')(env())).toBe(9);
    expect(compileExpr('2 ^ 3 ^ 2')(env())).toBe(512); // right-assoc
    expect(compileExpr('7 % 3')(env())).toBe(1);
    expect(compileExpr('-2 + 5')(env())).toBe(3);
  });

  it('reads variables and constants', () => {
    expect(compileExpr('x * 2 + y')(env({ x: 3, y: 1 }))).toBe(7);
    expect(compileExpr('PI')(env())).toBeCloseTo(Math.PI);
    expect(compileExpr('theta / TAU')(env({ theta: Math.PI }))).toBeCloseTo(0.5);
  });

  it('calls whitelisted functions', () => {
    expect(compileExpr('sin(0)')(env())).toBe(0);
    expect(compileExpr('max(2, min(5, 3))')(env())).toBe(3);
    expect(compileExpr('clamp(1.5, 0, 1)')(env())).toBe(1);
    expect(compileExpr('lerp(0, 10, 0.3)')(env())).toBeCloseTo(3);
    expect(compileExpr('length(3, 4)')(env())).toBe(5);
    expect(compileExpr('smoothstep(0, 1, 0.5)')(env())).toBeCloseTo(0.5);
  });

  it('binds noise and fbm to the loop circle deterministically', () => {
    const e1 = compileExpr('noise(x, y)');
    const a = e1(env({ x: 1.5, y: 2.5 }));
    expect(a).toBe(e1(env({ x: 1.5, y: 2.5 })));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(compileExpr('fbm(x, y, 3)')(env({ x: 1, y: 1 }))).toBeGreaterThanOrEqual(0);
  });

  it('rejects unknown identifiers with position info', () => {
    expect(() => compileExpr('window')).toThrow(/Unknown identifier "window"/);
    expect(() => compileExpr('x + evil(1)')).toThrow(/Unknown function "evil"/);
  });

  it('rejects malformed input', () => {
    expect(() => compileExpr('1 +')).toThrow();
    expect(() => compileExpr('sin(')).toThrow();
    expect(() => compileExpr('a.b')).toThrow();
    expect(() => compileExpr('"str"')).toThrow();
    expect(() => compileExpr('x[0]')).toThrow();
  });

  it('wrong arg counts are errors', () => {
    expect(() => compileExpr('sin(1, 2)')).toThrow(/expects 1/);
    expect(() => compileExpr('atan2(1)')).toThrow(/expects 2/);
  });
});
