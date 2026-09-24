/**
 * Notes → addressable blocks.
 *
 * The guide needs to point at things, so every block-level element in a
 * rendered notes container gets a short id (`data-guide-block="b7"`) in
 * document order. The same list (id, kind, text) is what the AI sees, so the
 * ids it returns map straight back to DOM nodes. `findQuoteRange` then turns
 * an AI-quoted phrase into a DOM Range so the pointer can land on the exact
 * words and underline them.
 */

export const BLOCKS_ROOT_ATTR = "data-guide-notes";
export const BLOCK_ATTR = "data-guide-block";

export interface GuideBlock {
  id: string;
  kind: string;
  text: string;
  el: HTMLElement;
}

// `.katex-display` is a formula on its own line: rehype-katex puts it straight in the
// notes, outside any paragraph, so without it here the AI never saw a single display
// equation and could never write one on the board.
const CANDIDATES = "h1,h2,h3,h4,p,li,pre,table,img,.katex-display";

/** The LaTeX source of a KaTeX-rendered formula (KaTeX keeps it in a MathML annotation). */
function texOf(k: Element): string {
  return k.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim() ?? "";
}

/**
 * Text of a block, as the AI should read it: without nested lists (so a parent `li`
 * doesn't swallow its children), and with every formula as LaTeX - `$$…$$` on its own
 * line, `$…$` inside a sentence - instead of KaTeX's glyph soup ("1f=v1−u1").
 */
function blockText(el: HTMLElement): string {
  if (el.tagName === "IMG") return (el as HTMLImageElement).alt || "";
  if (el.classList.contains("katex-display")) {
    const tex = texOf(el);
    return tex ? `$$${tex}$$` : el.textContent || "";
  }
  const nestedList = el.tagName === "LI" && !!el.querySelector("ul,ol");
  if (!nestedList && !el.querySelector(".katex")) return el.textContent || "";
  const clone = el.cloneNode(true) as HTMLElement;
  if (nestedList) clone.querySelectorAll("ul,ol").forEach((n) => n.remove());
  clone.querySelectorAll(".katex").forEach((k) => {
    const tex = texOf(k);
    const display = !!k.closest(".katex-display");
    k.replaceWith(document.createTextNode(tex ? (display ? `$$${tex}$$` : `$${tex}$`) : k.textContent || ""));
  });
  return clone.textContent || "";
}

function kindOf(el: HTMLElement): string {
  const tag = el.tagName;
  if (el.classList.contains("katex-display")) return "math";
  if (tag === "IMG") return "image";
  if (tag === "PRE") return "code";
  if (tag === "TABLE") return "table";
  if (tag === "P" && el.parentElement?.tagName === "BLOCKQUOTE") return "quote";
  return tag.toLowerCase();
}

/** The block-level elements inside `root`, in reading order, each counted once. */
function blockElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CANDIDATES)).filter((el) => {
    const tag = el.tagName;
    if (tag === "P" && el.parentElement?.tagName === "LI") return false; // the li covers it
    if (el.classList.contains("katex-display") && el.parentElement?.closest("p,li,td,th")) return false; // its block covers it
    if (tag !== "PRE" && tag !== "IMG" && el.closest("pre")) return false; // inside a code block
    if (tag === "P" && el.querySelector("img") && !(el.textContent || "").trim()) return false; // the img is indexed itself
    return true;
  });
}

/** (Re)assign block ids inside `root` and return the blocks in reading order. */
export function indexBlocks(root: HTMLElement): GuideBlock[] {
  root.querySelectorAll(`[${BLOCK_ATTR}]`).forEach((n) => n.removeAttribute(BLOCK_ATTR));
  const out: GuideBlock[] = [];
  let n = 0;
  blockElements(root).forEach((el) => {
    const tag = el.tagName;
    const text = blockText(el).replace(/\s+/g, " ").trim();
    if (!text && tag !== "IMG") return;
    const id = `b${n++}`;
    el.setAttribute(BLOCK_ATTR, id);
    out.push({ id, kind: kindOf(el), text: (text || "image").slice(0, 700), el });
  });
  return out;
}

export function findBlockEl(root: HTMLElement, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[${BLOCK_ATTR}="${id}"]`);
}

const STRIP = /[“”"‘’'`*_]/;

/**
 * How two pieces of text are compared when looking for a quote: lower case, quote
 * marks and Markdown emphasis characters dropped, whitespace collapsed. A caller that
 * must know a Range covers the WHOLE quote compares both sides through this.
 */
export const normalizeQuote = (s: string) =>
  s
    .toLowerCase()
    .split("")
    .filter((ch) => !STRIP.test(ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

/** A match is only "the words" when it doesn't start or end inside a longer word
 *  ("cell" is not in "cellular", "the cell" is not in "bathe cells"). */
const WORDY = /[\p{L}\p{N}]/u;

/**
 * Where `quote` sits in `full` (plain text), as [start, end) offsets into `full`.
 * Case, whitespace and quote marks don't matter. Pure, so it can be checked without a DOM.
 *
 * `exact`: only the whole quote counts, never a shorter prefix, and a match on word
 * boundaries is preferred to one inside a longer word. Without it, a quote whose tail
 * the model paraphrased still finds its first three or more words.
 */
export function matchQuote(full: string, quote: string, opts: { exact?: boolean } = {}): [number, number] | null {
  const needleFull = normalizeQuote(quote);
  if (needleFull.length < 3 || !full) return null;

  // Normalized haystack with a map back to offsets in `full`.
  const map: number[] = [];
  let hay = "";
  let prevSpace = true;
  for (let i = 0; i < full.length; i++) {
    const ch = full[i];
    if (STRIP.test(ch)) continue;
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      hay += " ";
      map.push(i);
      prevSpace = true;
    } else {
      hay += ch.toLowerCase();
      map.push(i);
      prevSpace = false;
    }
  }

  let needle = needleFull;
  let at = -1;
  if (opts.exact) {
    // Every occurrence, the first one that stands as whole words wins; a match inside
    // a word is only a last resort (the tutor quoting "photosynthes" of a longer word).
    let first = -1;
    for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) {
      if (first === -1) first = i;
      const before = i > 0 ? hay[i - 1] : " ";
      const after = i + needle.length < hay.length ? hay[i + needle.length] : " ";
      const edgeStart = !WORDY.test(needle[0]) || !WORDY.test(before);
      const edgeEnd = !WORDY.test(needle[needle.length - 1]) || !WORDY.test(after);
      if (edgeStart && edgeEnd) {
        at = i;
        break;
      }
    }
    if (at === -1) at = first;
  } else {
    at = hay.indexOf(needle);
    if (at === -1) {
      const words = needleFull.split(" ");
      for (let w = words.length - 1; w >= 3 && at === -1; w--) {
        needle = words.slice(0, w).join(" ");
        at = hay.indexOf(needle);
      }
    }
  }
  if (at === -1) return null;
  return [map[at], map[at + needle.length - 1] + 1];
}

/**
 * Locate `quote` (case/whitespace/quote-mark insensitive) inside `el` and
 * return a Range over it; null when nothing matches.
 *
 * By default it falls back to a shorter prefix of the quote when the model
 * paraphrased the tail, which is right for Teach mode's underline. With
 * `{ exact: true }` it never does: the Range covers the whole quote or there is
 * none, which is what anything that CHANGES those words (a "Fix it") must use.
 */
export function findQuoteRange(el: HTMLElement, quote: string, opts: { exact?: boolean } = {}): Range | null {
  if (normalizeQuote(quote).length < 3) return null;

  const skipNested = el.tagName === "LI";
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (skipNested) {
        let p = node.parentElement;
        while (p && p !== el) {
          if (p.tagName === "UL" || p.tagName === "OL") return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  const starts: number[] = [];
  let full = "";
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
    nodes.push(t);
    starts.push(full.length);
    full += t.data;
  }
  const hit = matchQuote(full, quote, opts);
  if (!hit) return null;

  const [startOff, endOff] = hit;
  const locate = (off: number, isEnd: boolean) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (starts[i] <= off - (isEnd ? 1 : 0)) return { node: nodes[i], offset: off - starts[i] };
    }
    return { node: nodes[0], offset: 0 };
  };
  const a = locate(startOff, false);
  const b = locate(endOff, true);
  const range = document.createRange();
  try {
    range.setStart(a.node, Math.min(a.offset, a.node.data.length));
    range.setEnd(b.node, Math.min(b.offset, b.node.data.length));
  } catch {
    return null;
  }
  return range;
}

/**
 * Find `quote` anywhere in a rendered notes container: the whole quote, inside one
 * block, or nothing (never a prefix). For the tutor's questions about a section,
 * which are stored by their words, not by block id, because block ids don't survive
 * the notes re-rendering after a save.
 *
 * It reads the DOM without touching it (no ids are assigned), so it is safe to call
 * on every re-placement. When the words appear more than once, `hint` - the quote's
 * offset in the section's Markdown - picks the copy whose rendered unit
 * (`data-an-unit="start:end"`) starts closest to it; without a hint the first wins.
 */
export function locateQuote(root: HTMLElement, quote: string, hint?: number): Range | null {
  let best: Range | null = null;
  let bestGap = Infinity;
  for (const el of blockElements(root)) {
    const range = findQuoteRange(el, quote, { exact: true });
    if (!range) continue;
    if (hint == null || hint < 0) return range;
    const unit = (range.startContainer.parentElement ?? el).closest<HTMLElement>("[data-an-unit]");
    const start = Number.parseInt(unit?.getAttribute("data-an-unit") ?? "", 10);
    const gap = Number.isFinite(start) ? Math.abs(start - hint) : Infinity;
    if (!best || gap < bestGap) {
      best = range;
      bestGap = gap;
    }
  }
  return best;
}

/** Client rects for a Range or element, merged per line and trimmed of empties. */
export function rectsOf(target: Range | HTMLElement): DOMRect[] {
  const list = target instanceof Range ? Array.from(target.getClientRects()) : [target.getBoundingClientRect()];
  const rects = list.filter((r) => r.width > 1 && r.height > 1);
  if (!rects.length) return target instanceof Range ? [target.getBoundingClientRect()] : [];
  const lines: DOMRect[] = [];
  for (const r of rects) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.top - r.top) < 3) {
      const left = Math.min(last.left, r.left);
      const right = Math.max(last.right, r.right);
      lines[lines.length - 1] = new DOMRect(left, Math.min(last.top, r.top), right - left, Math.max(last.height, r.height));
    } else lines.push(r);
  }
  return lines.slice(0, 8);
}

/** True when the rect sits comfortably inside the viewport (above the dock). */
export function isMostlyVisible(rect: DOMRect): boolean {
  return rect.top >= 72 && rect.bottom <= window.innerHeight - 170;
}
