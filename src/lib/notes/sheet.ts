/**
 * The study notes as ONE continuous writing surface.
 *
 * `inkRuns` (units.ts) paints one line of Markdown into styled runs. This is the
 * same idea at document scale: one parse of the whole section, one bitmap per
 * character, one list of runs — plus the block structure (`boxes`) and the
 * ranges the caret may not enter (`frozen`).
 *
 * WHY THIS IS SAFE, STATED ONCE
 *   The surface is a transparent <textarea> over a painted copy of its own
 *   value, and `textarea.value` IS the stored Markdown, byte for byte, at every
 *   instant. There are no spacer characters, no synthetic elements and no
 *   DOM → Markdown serialiser anywhere in the path, so a save cannot rewrite a
 *   byte the student did not type. `<mark class="hi">`, `\ce{}`, KaTeX, GFM
 *   tables and ```playstudy-visual fences survive because they are never read.
 *
 * THE METRIC RULE (index.css, units.ts) STILL HOLDS AND IS NOW FREE
 *   Nothing a run carries may change layout metrics — no font-size, weight,
 *   padding or margin — or the transparent textarea's caret would stop sitting
 *   on its glyph. At document scale that is not a constraint to work around: a
 *   single textarea has one font, one line-height and one measure by
 *   construction, so backgrounds, colour, opacity and text-decoration (all
 *   metric-free) are the entire painting vocabulary, and they are enough.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  HEADING_COLORS,
  LONE_DISPLAY,
  MATH_OPTS,
  atomSignature,
  markCount,
  marksWellFormed,
  type GuardResult,
} from "@/lib/notes/units";
import { isVisualFence } from "@/lib/notes/fences";

/* One processor, built from the SAME options constant every other parser in the
   app uses. Four separate copies of `{ singleDollarTextMath: false }` is how a
   `$$…$$` silently becomes a `$…$`; there is now exactly one. */
const proc = unified().use(remarkParse).use(remarkGfm).use(remarkMath, MATH_OPTS);

/** Block types whose source the caret may never enter. Mirrors units.ts ATOMIC,
 *  plus `math` (a fenced `$$` block is a node here, not a paragraph). */
const ATOMIC = new Set(["code", "thematicBreak", "html", "table", "math"]);

/** Human label for the locked band drawn over an atom's source while writing. */
const ATOM_LABEL: Record<string, string> = {
  code: "Code block",
  visual: "Pinned diagram",
  table: "Table",
  math: "Formula",
  html: "Raw HTML",
  thematicBreak: "Divider",
};

export interface SheetRun {
  text: string;
  syntax: boolean; // ## ** > - | ``` [](…) — ghosted, never hidden
  strong: boolean;
  em: boolean;
  del: boolean;
  code: boolean;
  mark: boolean;
  link: boolean;
  tag: boolean; // a <mark …> / </mark> tag: frozen as a pair
  atom: boolean; // locked block source (fence, table, formula, rule)
  quote: boolean; // inside a blockquote
  head: number; // heading depth, else 0
  hue: number; // heading colour index, else -1
}

export interface SheetAtom {
  start: number;
  end: number;
  kind: string;
  label: string;
  /** A direct child of root. Nested atoms are frozen but not labelled. */
  top: boolean;
}

export interface Sheet {
  runs: SheetRun[];
  atoms: SheetAtom[];
  /** Sorted, merged [start,end) that no input may touch and no caret may enter. */
  frozen: Array<[number, number]>;
  /**
   * The frozen ranges that are made ENTIRELY of `<mark>` tag bytes.
   *
   * They are frozen so a keystroke can never break a highlight open, but unlike
   * an atom they may be removed by an edit that swallows the whole pair: both
   * halves go together, so `marksWellFormed` still holds and `guardDoc` still
   * proves nothing else moved. Without this a highlighted phrase could be made
   * but never deleted — you could not select across it in either direction.
   *
   * An atom is deliberately NOT soft. Taking one out has to go through the
   * declared-intent path, or the flush would refuse the save afterwards and the
   * student would lose the work with no way to see why.
   */
  soft: Array<[number, number]>;
  /** Source ranges of every top-level block, for the block-boundary flush. */
  blocks: Array<[number, number]>;
}

/* The narrowest honest description of the mdast nodes we read, matching the one
   units.ts uses rather than reaching for `any`. */
type MdNode = {
  type?: string;
  depth?: number;
  lang?: string | null;
  value?: string;
  children?: MdNode[];
  position?: { start: { offset: number }; end: { offset: number } };
};



export function buildSheet(md: string): Sheet {
  const n = md.length;
  const content = new Uint8Array(n);
  const f = {
    strong: new Uint8Array(n),
    em: new Uint8Array(n),
    del: new Uint8Array(n),
    code: new Uint8Array(n),
    mark: new Uint8Array(n),
    link: new Uint8Array(n),
    tag: new Uint8Array(n),
    atom: new Uint8Array(n),
    quote: new Uint8Array(n),
  };
  const head = new Uint8Array(n);
  const hue = new Int8Array(n).fill(-1);

  const fill = (a: Uint8Array | Int8Array, s: number, e: number, v = 1) => {
    for (let i = Math.max(0, s); i < Math.min(n, e); i++) a[i] = v;
  };

  const atoms: SheetAtom[] = [];
  const blocks: Array<[number, number]> = [];
  /* [start, end, soft] — `soft` marks a `<mark>` tag, see Sheet.soft. */
  const frozen: Array<[number, number, boolean]> = [];
  let hueN = 0;
  let openMark = -1;

  const range = (node: MdNode): [number, number] | null => {
    const p = node.position;
    return p ? [p.start.offset, p.end.offset] : null;
  };

  const inline = (node: MdNode) => {
    const r = range(node);
    if (!r) return;
    const [s, e] = r;
    switch (node.type) {
      case "text":
        fill(content, s, e);
        return;
      case "inlineCode":
        fill(f.code, s, e);
        fill(content, s + 1, e - 1);
        return;
      case "strong":
        fill(f.strong, s, e);
        break;
      case "emphasis":
        fill(f.em, s, e);
        break;
      case "delete":
        fill(f.del, s, e);
        break;
      case "link":
        fill(f.link, s, e);
        break;
      case "inlineMath":
        // `$$x$$` inside a sentence. Its rendered width has no relationship to
        // its source width, so it is NOT overlaid with a KaTeX render — it stays
        // visible as source and is frozen, which is honest and metric-safe.
        fill(f.atom, s, e);
        frozen.push([s, e, false]);
        atoms.push({ start: s, end: e, kind: "math", label: ATOM_LABEL.math, top: false });
        return;
      case "html": {
        const v = String(node.value ?? "");
        if (/^<mark\b/i.test(v)) {
          // The tag pair is one frozen glyph, so a selection-delete can never
          // leave a highlight half-open — the dominant way marksWellFormed fails.
          fill(f.tag, s, e);
          frozen.push([s, e, true]);
          openMark = e;
        } else if (/^<\/mark/i.test(v)) {
          fill(f.tag, s, e);
          frozen.push([s, e, true]);
          if (openMark >= 0) {
            fill(f.mark, openMark, s);
            openMark = -1;
          }
        } else {
          fill(f.atom, s, e);
          frozen.push([s, e, false]);
        }
        return;
      }
      default:
        break;
    }
    (node.children || []).forEach(inline);
  };

  const block = (node: MdNode, top: boolean, inQuote: boolean) => {
    const r = range(node);
    if (node.type !== "root" && r) {
      const [s, e] = r;
      const isLone = node.type === "paragraph" && LONE_DISPLAY.test(md.slice(s, e).trim());
      if ((node.type && ATOMIC.has(node.type)) || isLone) {
        const kind = isLone ? "math" : node.type!;
        const label =
          kind === "code" && isVisualFence(node.lang) ? ATOM_LABEL.visual : ATOM_LABEL[kind] ?? "Locked block";
        fill(f.atom, s, e);
        // A BLOCK atom is frozen together with every newline touching it.
        //
        // Without the padding the caret can legally rest at the very end of a
        // closing ``` — one typed character makes it "```ZZZ", which is no
        // longer a closing fence, and the block swallows the rest of the notes.
        // With only ONE newline of padding the caret can still rest on the blank
        // line under a table, where a typed character becomes another TABLE ROW.
        // Both were found by walking every legal caret position and typing one
        // character at each, not by reasoning about it; the guard refused both,
        // but a keystroke that bounces is a worse answer than a caret that never
        // lands there. Greedy padding leaves exactly one safe landing spot on
        // each side: the end of the previous real line, and the start of the
        // next one.
        //
        // Consequence, stated plainly: two locked blocks with only blank lines
        // between them become ONE frozen region, so you cannot put a paragraph
        // between them from this surface. Inline atoms (a <mark> tag pair,
        // inline math) get no padding at all — the characters beside them are
        // ordinary prose.
        let fs = s;
        let fe = e;
        while (fs > 0 && md[fs - 1] === "\n") fs--;
        while (fe < n && md[fe] === "\n") fe++;
        frozen.push([fs, fe, false]);
        atoms.push({ start: s, end: e, kind, label, top });
        if (top) blocks.push([s, e]);
        return; // never descend into an atom
      }
      if (inQuote) fill(f.quote, s, e);
      if (node.type === "paragraph" || node.type === "heading") {
        if (node.type === "heading") {
          fill(head, s, e, node.depth ?? 2);
          if (node.depth === 2 || node.depth === 3) {
            // Stamped at parse time in document order, exactly as stampUnits
            // does, so the hues match the rendered notes character for character.
            fill(hue, s, e, hueN++ % HEADING_COLORS.length);
          }
        }
        if (top) blocks.push([s, e]);
        (node.children || []).forEach(inline);
        return;
      }
      if (top) blocks.push([s, e]);
    }
    const quote = inQuote || node.type === "blockquote";
    (node.children || []).forEach((c) => block(c, node.type === "root", quote));
  };

  let tree: MdNode;
  try {
    tree = proc.parse(md) as unknown as MdNode;
  } catch {
    tree = { type: "root", children: [] };
  }
  block(tree, true, false);

  /* Coalesce into runs — the same loop as inkRuns, one flag wider. */
  const runs: SheetRun[] = [];
  for (let i = 0; i < n; i++) {
    const cur: SheetRun = {
      text: md[i],
      syntax: !content[i] && !f.atom[i] && !f.tag[i],
      strong: !!f.strong[i],
      em: !!f.em[i],
      del: !!f.del[i],
      code: !!f.code[i],
      mark: !!f.mark[i],
      link: !!f.link[i],
      tag: !!f.tag[i],
      atom: !!f.atom[i],
      quote: !!f.quote[i],
      head: head[i],
      hue: hue[i],
    };
    const last = runs[runs.length - 1];
    if (
      last &&
      last.syntax === cur.syntax &&
      last.strong === cur.strong &&
      last.em === cur.em &&
      last.del === cur.del &&
      last.code === cur.code &&
      last.mark === cur.mark &&
      last.link === cur.link &&
      last.tag === cur.tag &&
      last.atom === cur.atom &&
      last.quote === cur.quote &&
      last.head === cur.head &&
      last.hue === cur.hue
    ) {
      last.text += cur.text;
    } else runs.push(cur);
  }

  frozen.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  /* A merged range is soft only if EVERY range that went into it was — an atom
     touching a tag pair makes the whole region as hard as the atom. */
  const softly: boolean[] = [];
  for (const r of frozen) {
    const i = merged.length - 1;
    const prev = merged[i];
    if (prev && r[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], r[1]);
      softly[i] = softly[i] && r[2];
    } else {
      merged.push([r[0], r[1]]);
      softly.push(r[2]);
    }
  }

  return {
    runs,
    atoms,
    frozen: merged,
    soft: merged.filter((_, i) => softly[i]),
    blocks: blocks.sort((a, b) => a[0] - b[0]),
  };
}

/**
 * Everything a reader would see, with Markdown syntax removed — the
 * document-scale replacement for `strippedText`, which walked only the FIRST
 * parsed block of whatever it was handed (so a phrase spanning two paragraphs
 * came back truncated), dropped inline math entirely, and joined the two sides
 * of a hard break with no separator at all.
 */
export function sheetPlain(md: string): string {
  let out = "";
  for (const r of buildSheet(md).runs) {
    if (!r.syntax && !r.atom && !r.tag) {
      out += r.text;
      continue;
    }
    // An inline formula reads better on a sticky note as its own source than as
    // a hole in the sentence; a table or a fence would just be noise.
    if (r.atom && !r.text.includes("\n")) {
      out += r.text;
      continue;
    }
    // Dropped syntax that spanned a line break still separated two words.
    if (/\s/.test(r.text)) out += " ";
  }
  return out.replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------ *
 * The changed range, and the guard that runs on every candidate document
 * ------------------------------------------------------------------ */

/** The minimal [start,end) of `a` that `b` replaced. Surrogate-safe: a pair is
 *  never split, so a diff can never land between the halves of an emoji. */
export function changedRange(a: string, b: string): [number, number] {
  const max = Math.min(a.length, b.length);
  let p = 0;
  while (p < max && a.charCodeAt(p) === b.charCodeAt(p)) p++;
  while (p > 0 && a.charCodeAt(p - 1) >= 0xd800 && a.charCodeAt(p - 1) <= 0xdbff) p--;
  let s = 0;
  while (s < max - p && a.charCodeAt(a.length - 1 - s) === b.charCodeAt(b.length - 1 - s)) s++;
  while (s > 0 && a.charCodeAt(a.length - s) >= 0xdc00 && a.charCodeAt(a.length - s) <= 0xdfff) s--;
  return [p, a.length - s];
}

/** What a command says it means to do. Free typing declares zero on every axis,
 *  which is STRICTER than the `blocks delta ≤ 1` slack the per-line guard
 *  allowed; removing a pinned block declares exactly which one. */
export interface Intent {
  removeAtoms?: string[];
  addAtoms?: string[];
}

const EMPTY_INTENT: Intent = {};

/** How strict `guardDoc` is about the document as a whole, as opposed to what one
 *  edit declares. */
export interface GuardOptions {
  /** A student's own note may be cleared to nothing. A study section may not:
   *  an empty section body is what tells the auto-writer to write it again. */
  allowEmpty?: boolean;
}

const tally = (parts: string[]) => {
  const m = new Map<string, number>();
  for (const p of parts) m.set(p, (m.get(p) ?? 0) + 1);
  return m;
};

/**
 * Which atoms disappeared and which appeared between two documents, as
 * MULTISETS. Set semantics would be a real weakening of what `guardSplice`
 * proved: it compared the joined signature string, so two identical pinned
 * fences counted twice, and deleting one of them was caught. Counting keeps
 * that property while still allowing an edit to DECLARE one deliberate removal.
 */
export function atomDelta(before: string, after: string): { gone: string[]; made: string[] } {
  const a = tally(atomSignature(before).parts);
  const b = tally(atomSignature(after).parts);
  const gone: string[] = [];
  const made: string[] = [];
  for (const [k, n] of a) for (let i = 0; i < n - (b.get(k) ?? 0); i++) gone.push(k);
  for (const [k, n] of b) for (let i = 0; i < n - (a.get(k) ?? 0); i++) made.push(k);
  return { gone, made };
}

const sameMultiset = (x: string[], y: string[]) =>
  x.length === y.length && [...x].sort().join("\u0001") === [...y].sort().join("\u0001");

/**
 * `guardDoc` replaces `guardSplice` at document scale.
 *
 *  KEPT   atomSignature equality — now as a DECLARED-DELTA comparison over
 *         MULTISETS, so free typing proves "no atom changed at all" rather than
 *         "no atom changed by much", and a deliberate removal proves it removed
 *         exactly the one block it said it would.
 *  KEPT   marksWellFormed, and the empty-body refusal — unless the caller says
 *         the document is one that may be empty (`allowEmpty`, a student's note).
 *  DROPPED the `blocks delta <= 1` clamp: Enter legitimately adds blocks, and a
 *         paste legitimately adds several. Nothing replaces it as a magnitude
 *         bound; the byte-identity proof below is what stands in its place.
 *  ADDED  a byte-identity proof outside the changed range. For a textarea this
 *         is true by construction, which is exactly the point: it is a tripwire
 *         that fails the save the day anything in this path starts EMITTING
 *         Markdown instead of copying it.
 */
export function guardDoc(
  before: string,
  after: string,
  intent: Intent = EMPTY_INTENT,
  opts: GuardOptions = {},
): GuardResult {
  if (before === after) return { ok: true };
  // Clearing a note still goes through every check below: a pinned block in it
  // has to be declared to go, exactly as when it is taken out on its own.
  if (!opts.allowEmpty && !after.trim())
    return { ok: false, why: "An empty body would be rewritten by the AI on your next visit." };

  const [s, e] = changedRange(before, after);
  const tailLen = before.length - e;
  if (before.slice(0, s) !== after.slice(0, s) || before.slice(e) !== after.slice(after.length - tailLen))
    return { ok: false, why: "that edit touched more of the notes than we can account for" };

  const { gone, made } = atomDelta(before, after);
  if (!sameMultiset(gone, intent.removeAtoms ?? []) || !sameMultiset(made, intent.addAtoms ?? []))
    return { ok: false, why: "that would change a pinned diagram, formula, table or code block" };

  if (!marksWellFormed(after)) return { ok: false, why: "a highlight is left unclosed" };

  /* Self-check on the diff itself: the document-wide <mark> delta must be
     entirely explained by the range that changed. Given byte-identity above this
     is a tautology — which is exactly why it is worth asserting, because it stops
     being one the moment `changedRange` or the caller is wrong. */
  const inner = markCount(after.slice(s, after.length - tailLen)) - markCount(before.slice(s, e));
  if (markCount(after) - markCount(before) !== inner)
    return { ok: false, why: "that would change a highlight elsewhere in the notes" };

  return { ok: true };
}
