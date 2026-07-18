/**
 * Safe arithmetic expression compiler for agent/user-defined sources.
 * No eval - a Pratt parser builds a closure tree over a whitelisted
 * environment. Grammar: numbers, identifiers, calls, + - * / % ^, parens.
 * noise/fbm/hash are seeded and sampled on the loop circle, so expressions
 * that animate via integer multiples of `theta` stay loop-perfect.
 */
import { valueNoise4, fbm4, hash2 } from './noise';

export interface ExprEnv {
  vars: Record<string, number>;
  seed: number;
  z: number; // loop-circle coords for noise
  w: number;
}

type Fn = (env: ExprEnv) => number;

const VAR_NAMES = new Set(['x', 'y', 'u', 'v', 't', 'T', 'theta', 'phase', 'seed']);
const CONSTS: Record<string, number> = { PI: Math.PI, TAU: 2 * Math.PI, E: Math.E };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const FUNCS: Record<string, { arity: number[]; apply: (args: number[], env: ExprEnv) => number }> = {
  sin: { arity: [1], apply: (a) => Math.sin(a[0]) },
  cos: { arity: [1], apply: (a) => Math.cos(a[0]) },
  tan: { arity: [1], apply: (a) => Math.tan(a[0]) },
  abs: { arity: [1], apply: (a) => Math.abs(a[0]) },
  sqrt: { arity: [1], apply: (a) => Math.sqrt(Math.abs(a[0])) },
  exp: { arity: [1], apply: (a) => Math.exp(a[0]) },
  log: { arity: [1], apply: (a) => Math.log(Math.max(1e-9, Math.abs(a[0]))) },
  floor: { arity: [1], apply: (a) => Math.floor(a[0]) },
  ceil: { arity: [1], apply: (a) => Math.ceil(a[0]) },
  sign: { arity: [1], apply: (a) => Math.sign(a[0]) },
  fract: { arity: [1], apply: (a) => a[0] - Math.floor(a[0]) },
  atan2: { arity: [2], apply: (a) => Math.atan2(a[0], a[1]) },
  min: { arity: [2], apply: (a) => Math.min(a[0], a[1]) },
  max: { arity: [2], apply: (a) => Math.max(a[0], a[1]) },
  pow: { arity: [2], apply: (a) => Math.pow(a[0], a[1]) },
  length: { arity: [2], apply: (a) => Math.hypot(a[0], a[1]) },
  hypot: { arity: [2], apply: (a) => Math.hypot(a[0], a[1]) },
  hash: { arity: [2], apply: (a, e) => hash2(e.seed, Math.floor(a[0]), Math.floor(a[1])) },
  noise: { arity: [2], apply: (a, e) => valueNoise4(e.seed, a[0], a[1], e.z, e.w) },
  fbm: { arity: [2, 3], apply: (a, e) => fbm4(e.seed, a[0], a[1], e.z, e.w, clamp(Math.round(a[2] ?? 3), 1, 6)) },
  clamp: { arity: [3], apply: (a) => clamp(a[0], a[1], a[2]) },
  lerp: { arity: [3], apply: (a) => a[0] + (a[1] - a[0]) * a[2] },
  smoothstep: {
    arity: [3],
    apply: (a) => {
      const t = clamp((a[2] - a[0]) / (a[1] - a[0] || 1e-9), 0, 1);
      return t * t * (3 - 2 * t);
    },
  },
};

interface Token {
  kind: 'num' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma';
  value: string;
  pos: number;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?/i.exec(src.slice(i));
      if (!m) throw new Error(`Unexpected character "${c}" at position ${i}`);
      tokens.push({ kind: 'num', value: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(src.slice(i))!;
      tokens.push({ kind: 'ident', value: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    if ('+-*/%^'.includes(c)) {
      tokens.push({ kind: 'op', value: c, pos: i });
      i++;
      continue;
    }
    if (c === '(') {
      tokens.push({ kind: 'lparen', value: c, pos: i });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ kind: 'rparen', value: c, pos: i });
      i++;
      continue;
    }
    if (c === ',') {
      tokens.push({ kind: 'comma', value: c, pos: i });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${c}" at position ${i}`);
  }
  return tokens;
}

const BINARY_PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 4 };

/** Compile an expression to a callable. Throws Error with a message + position on bad input. */
export function compileExpr(src: string): Fn {
  const tokens = tokenize(src);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (kind: Token['kind']): Token => {
    const t = next();
    if (!t || t.kind !== kind) {
      throw new Error(`Expected ${kind} at position ${t ? t.pos : src.length}`);
    }
    return t;
  };

  function parsePrimary(): Fn {
    const t = next();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.kind === 'num') {
      const n = Number(t.value);
      return () => n;
    }
    if (t.kind === 'op' && t.value === '-') {
      const operand = parseExpr(3);
      return (e) => -operand(e);
    }
    if (t.kind === 'op' && t.value === '+') {
      return parseExpr(3);
    }
    if (t.kind === 'lparen') {
      const inner = parseExpr(0);
      expect('rparen');
      return inner;
    }
    if (t.kind === 'ident') {
      if (peek()?.kind === 'lparen') {
        const fn = FUNCS[t.value];
        if (!fn) throw new Error(`Unknown function "${t.value}" at position ${t.pos}`);
        next(); // (
        const args: Fn[] = [];
        if (peek()?.kind !== 'rparen') {
          args.push(parseExpr(0));
          while (peek()?.kind === 'comma') {
            next();
            args.push(parseExpr(0));
          }
        }
        expect('rparen');
        if (!fn.arity.includes(args.length)) {
          throw new Error(`Function "${t.value}" expects ${fn.arity.join(' or ')} argument(s), got ${args.length}`);
        }
        return (e) => fn.apply(args.map((a) => a(e)), e);
      }
      if (t.value in CONSTS) {
        const c = CONSTS[t.value];
        return () => c;
      }
      if (VAR_NAMES.has(t.value)) {
        const name = t.value;
        return (e) => e.vars[name];
      }
      throw new Error(`Unknown identifier "${t.value}" at position ${t.pos}`);
    }
    throw new Error(`Unexpected token "${t.value}" at position ${t.pos}`);
  }

  function parseExpr(minPrec: number): Fn {
    let left = parsePrimary();
    for (;;) {
      const t = peek();
      if (!t || t.kind !== 'op') break;
      const prec = BINARY_PREC[t.value];
      if (prec === undefined || prec < minPrec) break;
      next();
      const rightPrec = t.value === '^' ? prec : prec + 1; // ^ right-assoc
      const right = parseExpr(rightPrec);
      const op = t.value;
      const l = left;
      switch (op) {
        case '+': left = (e) => l(e) + right(e); break;
        case '-': left = (e) => l(e) - right(e); break;
        case '*': left = (e) => l(e) * right(e); break;
        case '/': left = (e) => l(e) / (right(e) || 1e-9); break;
        case '%': left = (e) => l(e) % (right(e) || 1e-9); break;
        case '^': left = (e) => Math.pow(l(e), right(e)); break;
      }
    }
    return left;
  }

  const root = parseExpr(0);
  if (pos < tokens.length) {
    throw new Error(`Unexpected token "${tokens[pos].value}" at position ${tokens[pos].pos}`);
  }
  return root;
}

const cache = new Map<string, Fn | Error>();

/** Cached compile; returns the function or the compile Error (never throws). */
export function compileExprCached(src: string): Fn | Error {
  let hit = cache.get(src);
  if (!hit) {
    try {
      hit = compileExpr(src);
    } catch (e) {
      hit = e as Error;
    }
    if (cache.size > 200) cache.clear();
    cache.set(src, hit);
  }
  return hit;
}
