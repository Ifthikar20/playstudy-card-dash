/**
 * A small, safe evaluator for the y = f(x) expressions the tutor draws.
 *
 * Expressions arrive from two places: the live board (character-whitelisted on the
 * server) and pinned visuals stored inside a student's own notes (not checked by the
 * server at all). Neither is trusted enough for `new Function`; an identifier
 * allow-list is no defence when JavaScript can be written without identifiers.
 *
 * So the arithmetic is parsed here and evaluated as a closure tree: numbers, x,
 * + - * / ^ (or **), parentheses, the constants pi and e, and the Math functions
 * below. Anything else fails to compile and the graph shows the expression as text.
 */

export type Fn = (x: number) => number;

const UNARY: Record<string, (a: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, exp: Math.exp,
  log: Math.log, ln: Math.log, log2: Math.log2, log10: Math.log10,
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
};
const BINARY: Record<string, (a: number, b: number) => number> = {
  min: Math.min, max: Math.max, pow: Math.pow, atan2: Math.atan2,
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, PI: Math.PI, e: Math.E, E: Math.E };

/** The characters an expression may contain: the allow-list the server applies to the
 *  expressions the tutor writes live (app/api/guide.py, _GRAPH_FN_RE). */
export const EXPR_CHARS = /^[0-9xX+\-*/^().,\sa-zA-Z]+$/;
export const EXPR_MAX_LEN = 200;

/** True when `value` is a string this module will even look at. Used where a graph
 *  spec is read back out of a note, so a bad one is dropped before it is drawn. */
export function isSafeExpression(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= EXPR_MAX_LEN && EXPR_CHARS.test(value);
}

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if ((c >= "0" && c <= "9") || (c === "." && i + 1 < src.length && src[i + 1] >= "0" && src[i + 1] <= "9")) {
      let j = i;
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      const v = Number(src.slice(i, j));
      if (!Number.isFinite(v)) return null;
      out.push({ t: "num", v });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "*" && src[i + 1] === "*") {
      out.push({ t: "op", v: "^" });
      i += 2;
      continue;
    }
    if ("+-*/^(),".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    return null;
  }
  return out;
}

class ParseError extends Error {}

/*
  expr   := term (('+' | '-') term)*
  term   := unary (('*' | '/') unary)*
  unary  := ('-' | '+') unary | power
  power  := atom ('^' unary)?            right-associative; the exponent may be signed
  atom   := number | ident '(' args ')' | ident | '(' expr ')'
*/
class Parser {
  private i = 0;
  private readonly toks: Tok[];

  constructor(toks: Tok[]) {
    this.toks = toks;
  }

  parse(): Fn {
    const f = this.expr();
    if (this.i !== this.toks.length) throw new ParseError("trailing input");
    return f;
  }

  private isOp(v: string): boolean {
    const t = this.toks[this.i];
    return !!t && t.t === "op" && t.v === v;
  }

  private next(): Tok | undefined {
    return this.toks[this.i++];
  }

  private expr(): Fn {
    let left = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.next() as Tok & { t: "op" }).v;
      const right = this.term();
      const l = left;
      left = op === "+" ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
    }
    return left;
  }

  private term(): Fn {
    let left = this.unary();
    while (this.isOp("*") || this.isOp("/")) {
      const op = (this.next() as Tok & { t: "op" }).v;
      const right = this.unary();
      const l = left;
      left = op === "*" ? (x) => l(x) * right(x) : (x) => l(x) / right(x);
    }
    return left;
  }

  private unary(): Fn {
    if (this.isOp("-")) {
      this.next();
      const f = this.unary();
      return (x) => -f(x);
    }
    if (this.isOp("+")) {
      this.next();
      return this.unary();
    }
    return this.power();
  }

  private power(): Fn {
    const base = this.atom();
    if (this.isOp("^")) {
      this.next();
      const exponent = this.unary();
      return (x) => Math.pow(base(x), exponent(x));
    }
    return base;
  }

  private atom(): Fn {
    const t = this.next();
    if (!t) throw new ParseError("unexpected end");
    if (t.t === "num") {
      const v = t.v;
      return () => v;
    }
    if (t.t === "op") {
      if (t.v !== "(") throw new ParseError(`unexpected ${t.v}`);
      const f = this.expr();
      if (!this.isOp(")")) throw new ParseError(") expected");
      this.next();
      return f;
    }
    const name = t.v;
    if (this.isOp("(")) {
      this.next();
      const args: Fn[] = [];
      if (!this.isOp(")")) {
        args.push(this.expr());
        while (this.isOp(",")) {
          this.next();
          args.push(this.expr());
        }
      }
      if (!this.isOp(")")) throw new ParseError(") expected");
      this.next();
      const one = UNARY[name];
      const two = BINARY[name];
      if (one && args.length === 1) {
        const a = args[0];
        return (x) => one(a(x));
      }
      if (two && args.length === 2) {
        const [a, b] = args;
        return (x) => two(a(x), b(x));
      }
      throw new ParseError(`bad call ${name}`);
    }
    if (name === "x" || name === "X") return (x) => x;
    if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
      const v = CONSTANTS[name];
      return () => v;
    }
    throw new ParseError(`unknown identifier ${name}`);
  }
}

/** The expression as a function of x, or null when it is not one we can draw. */
export function compileExpression(src: unknown): Fn | null {
  if (!isSafeExpression(src)) return null;
  const toks = tokenize(src);
  if (!toks || toks.length === 0) return null;
  try {
    return new Parser(toks).parse();
  } catch {
    return null;
  }
}
