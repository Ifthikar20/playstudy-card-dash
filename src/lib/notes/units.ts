/**
 * Notes → editable units.
 *
 * The notes are stored as Markdown and must stay Markdown. Every mechanism in
 * here exists so that editing one line is a *byte-exact splice* of one
 * substring into the stored string: nothing outside the edited range is ever
 * parsed, rewritten or normalised, so there is no DOM→Markdown serialiser that
 * could damage `<mark>` highlights, `$$…$$` math, `\ce{}` chemistry or a pinned
 * ```playstudy-visual fence.
 *
 * `stampUnits` runs inside the SAME remark pipeline that renders the notes, so
 * the ranges it reports and the pixels the student sees can never diverge.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/* ------------------------------------------------------------------ *
 * 1. sanitizeNotes(), plus a map from sanitized offsets back to source
 * ------------------------------------------------------------------ */

/**
 * ONE definition of the tag pattern. `sanitizeNotes()` in render.tsx used to
 * hold a second literal copy of this regex; the two had to stay byte-identical
 * or `toSrc` would map offsets into a string the renderer never produced —
 * silent corruption with nothing to catch it. render.tsx now imports this.
 */
export const TAG_RE_SOURCE = "<\\/?([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*>";
export const newTagRe = () => new RegExp(TAG_RE_SOURCE, "g");

/**
 * ONE definition of the remark-math options. This app parses the notes in four
 * places and every one of them must agree: with `singleDollarTextMath` left at
 * its default, `$$E = mc^2$$` is read as `$…$` text math and a round trip can
 * quietly demote it. Import this; never re-type the object literal.
 */
export const MATH_OPTS = { singleDollarTextMath: false } as const;

/**
 * Soft, readable highlighter hues for section headings — cycled so consecutive
 * headings differ. Lives here rather than in render.tsx so the pure parsing
 * layer can stamp the same hue the renderer paints without importing React.
 */
export const HEADING_COLORS = ["#7C3AED", "#2563EB", "#0D9488", "#D97706", "#DB2777", "#0EA5E9"];

const TAG_RE = newTagRe();

interface Run {
  o: number; // offset in the sanitized string
  s: number; // offset in the original string
  n: number; // length in the sanitized string
  srcLen: number; // length in the original string
  copy: boolean;
}

export interface SanitizeMap {
  sanitized: string;
  /** Sanitized offset → original offset. `isEnd` lands past a stripped tag. */
  toSrc: (offset: number, isEnd?: boolean) => number;
}

/**
 * Byte-identical to `sanitizeNotes()` in the renderer, but it also records the
 * copy/replace runs so an offset into the rendered (sanitized) string can be
 * mapped back to the stored string. This is what keeps `<mark class="hi">` and
 * other stripped-at-render markup intact when the block around it is edited.
 */
export function sanitizeWithMap(src: string): SanitizeMap {
  const runs: Run[] = [];
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(src))) {
    if (m.index > last) {
      runs.push({ o: out.length, s: last, n: m.index - last, srcLen: m.index - last, copy: true });
      out += src.slice(last, m.index);
    }
    const rep = /^mark$/i.test(m[1]) ? (m[0].startsWith("</") ? "</mark>" : "<mark>") : "";
    runs.push({ o: out.length, s: m.index, n: rep.length, srcLen: m[0].length, copy: false });
    out += rep;
    last = m.index + m[0].length;
  }
  if (last < src.length) {
    runs.push({ o: out.length, s: last, n: src.length - last, srcLen: src.length - last, copy: true });
    out += src.slice(last);
  }

  const toSrc = (offset: number, isEnd = false): number => {
    for (let i = runs.length - 1; i >= 0; i--) {
      const r = runs[i];
      if (offset > r.o + r.n || offset < r.o) continue;
      if (r.copy) return r.s + (offset - r.o);
      return isEnd ? r.s + r.srcLen : r.s;
    }
    return isEnd ? src.length : 0;
  };

  return { sanitized: out, toSrc };
}

/* ------------------------------------------------------------------ *
 * 2. The remark plugin that stamps units onto the rendered elements
 * ------------------------------------------------------------------ */

export const UNIT_ATTR = "data-ps-unit";
export const KIND_ATTR = "data-ps-kind";
export const TOP_ATTR = "data-ps-top";
export const HUE_ATTR = "data-ps-hue";

export type UnitKind = "paragraph" | "heading" | "item" | "atom";

/**
 * `$$E = mc^2$$` on ONE line parses as a PARAGRAPH containing inline math, not
 * as a math block — and that is exactly the shape `visualToMarkdown()` writes
 * for a pinned formula. Without this it would be a freely editable paragraph a
 * student could break by deleting a `$`. Verified against the installed
 * remark-math with `singleDollarTextMath: false`.
 */
export const LONE_DISPLAY = /^\$\$[\s\S]*\$\$$/;

/** Block types the caret may never enter: fences, tables, rules, block HTML. */
const ATOMIC = new Set(["code", "thematicBreak", "html", "table"]);

/** The shape of an mdast node we care about. `unist` types it as an open
   record, so this is the narrowest honest description rather than `any`. */
type Offsets = { start: { offset: number }; end: { offset: number } };

/**
 * The subset of an mdast node this plugin actually reads. mdast's own union is
 * far richer and varies per node type, so describing only what we touch — and
 * leaving the rest open — keeps this honest without re-declaring the library's
 * types or falling back to `any`.
 */
type MdNode = {
  type?: string;
  depth?: number;
  children?: MdNode[];
  position?: Offsets;
  data?: { hName?: string; hProperties?: Record<string, string> };
  value?: string;
  [key: string]: unknown;
};

/** A hard line break inside a unit can't survive the one-line editing buffer. */
const hasBreak = (n: MdNode | undefined | null): boolean =>
  !!n && (n.type === "break" || (n.children || []).some(hasBreak));

/**
 * Stamps every editable unit with its exact range in `src` (which must be the
 * SANITIZED string this same pipeline is rendering). Goes into the renderer's
 * own `remarkPlugins` array, so units and pixels cannot drift apart.
 */
export function stampUnits(src: string) {
  return () => (tree: MdNode) => {
    // Heading hue index, stamped at parse time so the cycled colours survive a
    // partial re-render (a mutable render-order counter would not).
    let hue = 0;
    const set = (n: MdNode, kind: UnitKind, s: number, e: number, top: boolean) => {
      n.data = n.data || {};
      n.data.hProperties = {
        ...(n.data.hProperties || {}),
        [UNIT_ATTR]: `${s}:${e}`,
        [KIND_ATTR]: kind,
        ...(top ? { [TOP_ATTR]: "1" } : {}),
      };
    };

    const walk = (n: MdNode, parent: MdNode | null, i: number, top: boolean) => {
      if (n.type === "listItem") {
        // A TIGHT list item's <p> is unwrapped by mdast-util-to-hast and loses
        // its properties, so stamp the listItem with its first paragraph's
        // range. That range also naturally excludes any nested sub-list, so
        // editing a parent bullet can never touch its children.
        const first = n.children?.[0];
        const r = (first?.type === "paragraph" ? first.position : n.position) as Offsets;
        set(n, hasBreak(first ?? n) ? "atom" : "item", r.start.offset, r.end.offset, false);
        (n.children || []).forEach((c: MdNode, j: number) => {
          if (!(j === 0 && c.type === "paragraph")) walk(c, n, j, false);
        });
        return;
      }

      if (n.type === "math" || n.type === "inlineMath") {
        // rehype-katex REPLACES the math element and drops its properties, so
        // wrap it in a synthetic node whose <div> survives katex.
        if (!parent) return;
        parent.children[i] = {
          type: "psAtom",
          position: n.position,
          children: [n],
          data: {
            hName: "div",
            hProperties: {
              [UNIT_ATTR]: `${n.position.start.offset}:${n.position.end.offset}`,
              [KIND_ATTR]: "atom" as UnitKind,
            },
          },
        };
        return;
      }

      if (n.type === "paragraph" || n.type === "heading") {
        const raw = src.slice(n.position.start.offset, n.position.end.offset);
        const atom = LONE_DISPLAY.test(raw.trim()) || hasBreak(n);
        const kind: UnitKind = atom ? "atom" : n.type === "heading" ? "heading" : "paragraph";
        set(n, kind, n.position.start.offset, n.position.end.offset, !atom && top);
        if (n.type === "heading" && (n.depth === 2 || n.depth === 3)) {
          n.data.hProperties[HUE_ATTR] = String(hue++);
        }
        return;
      }

      if (n.type && ATOMIC.has(n.type)) {
        const r = n.position as Offsets;
        return set(n, "atom", r.start.offset, r.end.offset, false);
      }

      (n.children || []).forEach((c: MdNode, j: number) => walk(c, n, j, n.type === "root"));
    };

    walk(tree, null, 0, true);
  };
}

/* ------------------------------------------------------------------ *
 * 3. The ink layer — per-character styling of the editing buffer
 * ------------------------------------------------------------------ */

const inlineProc = unified().use(remarkParse).use(remarkGfm).use(remarkMath, MATH_OPTS);

export interface InkRun {
  text: string;
  syntax: boolean;
  strong: boolean;
  em: boolean;
  code: boolean;
  mark: boolean;
  link: boolean;
}

/**
 * Splits the editing buffer into styled runs. Characters covered by a `text`
 * or `inlineCode` value are content; everything else (`**`, `##`, `<mark>`,
 * `[](…)`) is syntax and is ghosted. NOTHING here may change layout metrics —
 * no font-size, weight, padding or margin — or the transparent textarea's caret
 * would stop sitting on its glyph.
 */
export function inkRuns(buf: string): InkRun[] {
  const n = buf.length;
  const content = new Uint8Array(n);
  const flag = {
    strong: new Uint8Array(n),
    em: new Uint8Array(n),
    code: new Uint8Array(n),
    mark: new Uint8Array(n),
    link: new Uint8Array(n),
  };
  const fill = (a: Uint8Array, s: number, e: number) => {
    for (let i = Math.max(0, s); i < Math.min(n, e); i++) a[i] = 1;
  };

  let root: MdNode | null = null;
  try {
    root = inlineProc.parse(buf) as unknown as MdNode;
  } catch {
    root = null;
  }
  const first = root?.children?.[0];
  let openMark = -1;

  const walk = (node: MdNode) => {
    const p = node.position;
    if (!p) return;
    const s = p.start.offset as number;
    const e = p.end.offset as number;
    if (node.type === "text") fill(content, s, e);
    else if (node.type === "inlineCode") {
      fill(flag.code, s, e);
      fill(content, s + 1, e - 1);
    } else if (node.type === "strong") fill(flag.strong, s, e);
    else if (node.type === "emphasis") fill(flag.em, s, e);
    else if (node.type === "link") fill(flag.link, s, e);
    else if (node.type === "html") {
      if (/^<mark\b/i.test(node.value)) openMark = e;
      else if (/^<\/mark/i.test(node.value) && openMark >= 0) {
        fill(flag.mark, openMark, s);
        openMark = -1;
      }
    }
    (node.children || []).forEach(walk);
  };
  if (first) (first.children || []).forEach(walk);

  const out: InkRun[] = [];
  for (let i = 0; i < n; i++) {
    const cur: InkRun = {
      text: buf[i],
      syntax: !content[i],
      strong: !!flag.strong[i],
      em: !!flag.em[i],
      code: !!flag.code[i],
      mark: !!flag.mark[i],
      link: !!flag.link[i],
    };
    const last = out[out.length - 1];
    if (
      last &&
      last.syntax === cur.syntax &&
      last.strong === cur.strong &&
      last.em === cur.em &&
      last.code === cur.code &&
      last.mark === cur.mark &&
      last.link === cur.link
    ) {
      last.text += cur.text;
    } else out.push(cur);
  }
  return out;
}

/** Rendered-text offset → offset in the Markdown buffer. */
export function renderedToBuf(buf: string, rendered: number): number {
  let seen = 0;
  let at = 0;
  for (const r of inkRuns(buf)) {
    if (r.syntax) {
      at += r.text.length;
      continue;
    }
    if (seen + r.text.length > rendered) return at + (rendered - seen);
    seen += r.text.length;
    at += r.text.length;
  }
  return buf.length;
}

/* ------------------------------------------------------------------ *
 * 4. Concurrency — find an edited region again after another writer landed
 * ------------------------------------------------------------------ */

/**
 * Another writer (TeachMode.pinVisual, the guide/ask `notes_updated` stream,
 * reviseTopicNotes) changed the notes under us. Because an edit is an ADDRESSED
 * change against a known base, we can find the region again instead of
 * clobbering the whole body the way a stale full-document PATCH does. Ambiguous
 * or missing → null, and the caller shows a conflict bar rather than guessing.
 */
export function reanchor(fresh: string, was: string): [number, number] | null {
  if (!was) return null;
  const first = fresh.indexOf(was);
  if (first < 0 || fresh.indexOf(was, first + 1) >= 0) return null;
  return [first, first + was.length];
}

/* ------------------------------------------------------------------ *
 * 5. The guard — refuse any splice we cannot prove safe
 * ------------------------------------------------------------------ */

const guardProc = unified().use(remarkParse).use(remarkGfm).use(remarkMath, MATH_OPTS);

const MARK_TAG = /<(\/?)mark\b[^>]*>/gi;
const MARK_OPEN = /<mark\b[^>]*>/gi;

export const markCount = (s: string): number => (s.match(MARK_OPEN) || []).length;

/**
 * Every `<mark>` must open and close, in order. An unclosed tag would make
 * `keyIdeasOf()` pair it with a closing tag paragraphs away, silently turning
 * half the notes into one "key idea".
 */
export function marksWellFormed(md: string): boolean {
  let open = false;
  for (const m of md.matchAll(MARK_TAG)) {
    const close = m[1] === "/";
    if (close === !open) return false;
    open = !open;
  }
  return !open;
}

/** Every atom in the document, by content — the thing an edit must never change. */
export function atomSignature(md: string): { sig: string; parts: string[]; blocks: number } {
  const tree = guardProc.parse(md) as unknown as MdNode;
  const parts: string[] = [];
  let blocks = 0;
  const walk = (n: MdNode) => {
    if (n.type === "code") {
      parts.push(`C\u0000${n.lang || ""}\u0000${n.value}`);
      return;
    }
    if (n.type === "math") {
      parts.push(`M\u0000${n.value}`);
      return;
    }
    if (n.type === "table") {
      parts.push(`T\u0000${md.slice(n.position.start.offset, n.position.end.offset)}`);
      return;
    }
    if (n.type === "paragraph") {
      const raw = md.slice(n.position.start.offset, n.position.end.offset).trim();
      if (LONE_DISPLAY.test(raw)) parts.push(`D\u0000${raw}`);
      blocks++;
      return;
    }
    if (n.type === "heading") {
      blocks++;
      return;
    }
    (n.children || []).forEach(walk);
  };
  walk(tree);
  // `parts` lets a caller compare atoms one by one against a DECLARED intent
  // instead of only asking "did the whole set change?", which is what makes
  // "delete this one pinned diagram" provable rather than merely refused.
  return { sig: parts.join("\n"), parts, blocks };
}

export interface GuardResult {
  ok: boolean;
  why?: string;
}
