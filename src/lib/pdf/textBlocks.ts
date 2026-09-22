/**
 * PDF text → the blocks Teach mode points at.
 *
 * PDF.js hands back a page's text as positioned fragments ("items"), in whatever
 * order the file stores them. Teach mode needs what the notes give it: paragraphs,
 * headings and bullets, in reading order, each with a box on the page. This groups
 * items into lines, lines into blocks, and keeps two-column pages in column order.
 *
 * The text of a block is built from the same pieces the page's text layer renders
 * (item strings, plus the separators recorded here), so a phrase the AI quotes from
 * a block can always be found again in the DOM.
 *
 * Pure geometry: no PDF.js import, so it can be tested on plain numbers.
 */

/** One text item from PDF.js (`page.getTextContent()`), the fields we use. */
export interface PdfTextItem {
  str: string;
  /** Text-space transform [a, b, c, d, e, f]. */
  transform: number[];
  /** Advance width in text space (unscaled). */
  width: number;
  /** PDF.js's id for the font; a heading set in bold uses a different one from the body. */
  fontName?: string;
}

/** A fragment placed on the page, in CSS pixels at the viewport's scale. */
export interface PlacedText {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** What comes between this fragment and the next one in the block: "", " " or "\n"-free space. */
  after: string;
  font?: string;
}

export interface PdfBlock {
  /** "furniture" is a running header or footer: shown and selectable, but not something to teach. */
  kind: "h2" | "p" | "li" | "furniture";
  left: number;
  top: number;
  width: number;
  height: number;
  pieces: PlacedText[];
  /** The block's text exactly as the DOM will read: pieces joined by their `after`. */
  text: string;
}

interface Segment {
  items: PlacedText[];
  left: number;
  right: number;
  top: number;
  bottom: number;
  size: number;
  /** The font most of its characters are set in. */
  font: string;
  text: string;
}

const BULLET = /^(?:[•●○◦▪■□►▸–—\-*·]|\(?\d{1,2}[.)]|\(?[a-z][.)])\s/;

function multiply(m: number[], n: number[]): number[] {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** The font that most of these characters are set in. */
function dominantFont(items: PlacedText[]): string {
  const count = new Map<string, number>();
  for (const it of items) count.set(it.font ?? "", (count.get(it.font ?? "") ?? 0) + it.text.length);
  let best = "";
  let most = -1;
  count.forEach((n, f) => {
    if (n > most) {
      best = f;
      most = n;
    }
  });
  return best;
}

/** Items → fragments in viewport pixels. Rotated text (a label up a chart axis) is left out. */
export function placeItems(items: PdfTextItem[], viewportTransform: number[], scale: number): PlacedText[] {
  const out: PlacedText[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const tx = multiply(viewportTransform, it.transform);
    const height = Math.hypot(tx[2], tx[3]);
    if (height < 1) continue;
    if (Math.abs(Math.atan2(tx[1], tx[0])) > 0.05) continue; // not horizontal
    const width = Math.max(1, it.width * scale);
    // tx[5] is the baseline; glyphs sit mostly above it.
    out.push({ text: it.str, left: tx[4], top: tx[5] - height * 0.86, width, height, after: "", font: it.fontName });
  }
  return out;
}

/** Fragments on one baseline, split where a wide gap (a column gutter or a table cell) opens up. */
function segments(placed: PlacedText[]): Segment[] {
  const byTop = [...placed].sort((a, b) => a.top - b.top || a.left - b.left);
  const rows: PlacedText[][] = [];
  for (const p of byTop) {
    const mid = p.top + p.height / 2;
    const row = rows.find((r) => {
      const h = median(r.map((q) => q.height));
      const rmid = r[0].top + r[0].height / 2;
      return Math.abs(rmid - mid) < Math.min(h, p.height) * 0.5;
    });
    if (row) row.push(p);
    else rows.push([p]);
  }
  const out: Segment[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.left - b.left);
    let cur: PlacedText[] = [];
    const flush = () => {
      if (!cur.length) return;
      out.push({
        items: cur,
        left: Math.min(...cur.map((c) => c.left)),
        right: Math.max(...cur.map((c) => c.left + c.width)),
        top: Math.min(...cur.map((c) => c.top)),
        bottom: Math.max(...cur.map((c) => c.top + c.height)),
        size: median(cur.map((c) => c.height)),
        font: dominantFont(cur),
        text: cur.map((c) => c.text).join(" ").replace(/\s+/g, " ").trim(),
      });
      cur = [];
    };
    for (const p of row) {
      const prev = cur[cur.length - 1];
      if (prev && p.left - (prev.left + prev.width) > Math.max(prev.height, p.height) * 2.2) flush();
      cur.push(p);
    }
    flush();
  }
  return out;
}

/**
 * Reading order. A page with a real left and right column reads the left column
 * down, then the right, with anything spanning both (a title, a figure caption)
 * breaking the flow where it sits; a single-column page just reads top to bottom.
 */
function readingOrder(segs: Segment[], pageWidth: number): Segment[] {
  const byTop = [...segs].sort((a, b) => a.top - b.top || a.left - b.left);
  const mid = pageWidth / 2;
  const leftOnly = byTop.filter((s) => s.right <= mid + pageWidth * 0.04);
  const rightOnly = byTop.filter((s) => s.left >= mid - pageWidth * 0.04);
  if (leftOnly.length < 4 || rightOnly.length < 4) return byTop;
  const out: Segment[] = [];
  let left: Segment[] = [];
  let right: Segment[] = [];
  const flush = () => {
    out.push(...left, ...right);
    left = [];
    right = [];
  };
  for (const s of byTop) {
    if (leftOnly.includes(s)) left.push(s);
    else if (rightOnly.includes(s)) right.push(s);
    else {
      flush();
      out.push(s);
    }
  }
  flush();
  return out;
}

/** Little words a Title Case heading leaves in lower case ("Lenses and the Eye"). */
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "vs", "with"]);

/**
 * "2.1. Machine Learning", "1. INTRODUCTION", "3 Results and Discussion": a numbered
 * section heading rather than a list item. Sub-numbers make it one; a single number
 * needs a title in capitals or Title Case - "1. Measure the focal length." is a step.
 */
function numberedHeading(text: string): boolean {
  const m = /^(\d{1,2}(?:\.\d{1,2})*)\.?\s+(\S.*)$/u.exec(text);
  if (!m || text.length > 90 || /[.,;:]$/.test(text)) return false;
  const rest = m[2];
  if (m[1].includes(".")) return /^\p{Lu}/u.test(rest);
  const words = rest.split(/\s+/);
  const capitals = rest === rest.toUpperCase() && /\p{Lu}{2}/u.test(rest);
  const titleCase = words.length <= 7 && words.every((w) => /^[\p{Lu}\d(]/u.test(w) || SMALL_WORDS.has(w.toLowerCase()));
  return capitals || titleCase;
}

/** A line in capitals, like "REAL-WORLD APPLICATIONS" (or the second line of one). */
function capitalsLine(text: string): boolean {
  return text.length <= 80 && text === text.toUpperCase() && (text.match(/\p{Lu}/gu)?.length ?? 0) >= 4;
}

/** Text between two fragments on one line: a space where there's a visible gap and neither side already has one. */
function joiner(a: PlacedText, b: PlacedText): string {
  const gap = b.left - (a.left + a.width);
  if (/\s$/.test(a.text) || /^\s/.test(b.text)) return "";
  return gap > Math.min(a.height, b.height) * 0.12 ? " " : "";
}

/**
 * Page fragments → Teach mode blocks, in reading order. `pageHeight` lets a running
 * header or footer (small print in the top or bottom margin) be told from content.
 */
export function buildBlocks(placed: PlacedText[], pageWidth: number, pageHeight = pageWidth * 1.294): PdfBlock[] {
  const segs = readingOrder(segments(placed), pageWidth);
  if (!segs.length) return [];
  // The body text: the size and the font most characters on the page are set in.
  const body = median(segs.flatMap((s) => s.items.flatMap((i) => Array<number>(Math.min(40, i.text.length)).fill(i.height))));
  const bodyFont = dominantFont(segs.flatMap((s) => s.items));
  const big = (s: Segment) => s.size >= body * 1.28;
  // A heading line: short, not a sentence or a formula, mostly words - and set bigger
  // than the body, or in another font at body size (the bold of a subheading), or
  // numbered like a section, or in capitals. Plenty of papers set their headings in
  // the body's own font and size, so the last two matter as much as the first.
  // A full text line, for telling a short heading from a line of a paragraph that just
  // happens to use another font resource (PDFs often split one typeface into several).
  const lineWidth = median(segs.filter((s) => Math.abs(s.size - body) <= body * 0.1).map((s) => s.right - s.left));
  const headingLine = (s: Segment) => {
    const words = s.text.replace(/^\d{1,2}(?:\.\d{1,2})*\.?\s+/, "");
    return (
      s.text.length <= 90 &&
      !/[.,;:]$/.test(s.text) &&
      !/[=<>≤≥]/.test(s.text) &&
      /^[\p{Lu}\d]/u.test(s.text) &&
      (words.match(/[\p{L}\s]/gu)?.length ?? 0) >= words.length * 0.7 &&
      (s.size >= body * 1.12 ||
        (s.size >= body * 0.95 &&
          (numberedHeading(s.text) ||
            capitalsLine(s.text) ||
            (!!s.font && s.font !== bodyFont && s.right - s.left < lineWidth * 0.72))))
    );
  };
  const blocks: Segment[][] = [];
  for (const s of segs) {
    const cur = blocks[blocks.length - 1];
    const prev = cur?.[cur.length - 1];
    const startsBullet = BULLET.test(s.text) && !numberedHeading(s.text);
    const hp = !!prev && (big(prev) || headingLine(prev));
    const hs = big(s) || headingLine(s);
    const joins =
      prev &&
      !startsBullet &&
      // a heading never runs into the paragraph under it; a two-line title stays one
      hp === hs &&
      (!hp || prev.font === s.font) &&
      Math.abs(s.size - prev.size) <= Math.max(s.size, prev.size) * 0.12 &&
      s.top - prev.bottom < Math.max(s.size, prev.size) * 0.85 &&
      s.top >= prev.top &&
      // same column: the lines overlap horizontally
      Math.min(s.right, prev.right) - Math.max(s.left, prev.left) > 0;
    if (joins && cur) cur.push(s);
    else blocks.push([s]);
  }

  const out: PdfBlock[] = [];
  for (const lines of blocks) {
    const pieces: PlacedText[] = [];
    lines.forEach((line, li) => {
      line.items.forEach((it, ii) => {
        const next = line.items[ii + 1];
        const piece = { ...it, after: next ? joiner(it, next) : "" };
        pieces.push(piece);
      });
      const last = pieces[pieces.length - 1];
      if (li < lines.length - 1 && last) {
        // Line break: a hyphen at the end joins the word up; otherwise a space.
        const nextFirst = lines[li + 1].items[0]?.text ?? "";
        last.after = /-$/.test(last.text) && /^[a-z]/.test(nextFirst) ? "" : /\s$/.test(last.text) ? "" : " ";
      }
    });
    const text = pieces.map((p) => p.text + p.after).join("").replace(/\s+/g, " ").trim();
    // Page furniture on its own: a page number, "Page 3 of 12".
    if (!text || /^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i.test(text)) continue;
    const first = lines[0];
    const left = Math.min(...lines.map((l) => l.left));
    const top = Math.min(...lines.map((l) => l.top));
    const right = Math.max(...lines.map((l) => l.right));
    const bottom = Math.max(...lines.map((l) => l.bottom));
    const furniture = lines.length === 1 && first.size <= body * 0.92 && (bottom < pageHeight * 0.075 || top > pageHeight * 0.925);
    const kind: PdfBlock["kind"] = furniture
      ? "furniture"
      : (big(first) && lines.length <= 3) || (lines.length <= 2 && lines.every(headingLine))
        ? "h2"
        : BULLET.test(text)
          ? "li"
          : "p";
    out.push({ kind, left, top, width: right - left, height: bottom - top, pieces, text });
  }
  return out;
}

/** A header or footer line's text with its numbers taken out, so "... 2536" on one page matches "... 2537" on the next. */
export function edgeKey(text: string): string {
  return text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

/**
 * Running headers and footers: short strips in the top or bottom margin that come back,
 * numbers aside, on several pages ("© November 2024 | IJIRT | Volume 11 Issue 6"). Each
 * page alone can't tell one from a heading - they're often set as large as the text -
 * so this looks across the whole document. Returns their edgeKey()s.
 */
export function repeatedEdgeLines(pages: { blocks: PdfBlock[]; height: number }[]): Set<string> {
  const seen = new Map<string, Set<number>>();
  pages.forEach((page, i) => {
    for (const b of page.blocks) {
      if (b.top > page.height * 0.12 && b.top + b.height < page.height * 0.88) continue;
      if (b.height > page.height * 0.05) continue; // a real paragraph, not a one-line strip
      const key = edgeKey(b.text);
      if (key.replace(/[^\p{L}]/gu, "").length < 3) continue;
      if (!seen.has(key)) seen.set(key, new Set());
      seen.get(key)!.add(i);
    }
  });
  const need = pages.length >= 3 ? Math.max(2, Math.ceil(pages.length * 0.3)) : 2;
  return new Set([...seen].filter(([, on]) => on.size >= need).map(([key]) => key));
}
