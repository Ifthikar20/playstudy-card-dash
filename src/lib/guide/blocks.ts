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

const CANDIDATES = "h1,h2,h3,h4,p,li,pre,table,img";

/** Text of a block without its nested lists (so a parent `li` doesn't swallow its children). */
function blockText(el: HTMLElement): string {
  if (el.tagName === "IMG") return (el as HTMLImageElement).alt || "";
  if (el.tagName === "LI" && el.querySelector("ul,ol")) {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("ul,ol").forEach((n) => n.remove());
    return clone.textContent || "";
  }
  return el.textContent || "";
}

function kindOf(el: HTMLElement): string {
  const tag = el.tagName;
  if (tag === "IMG") return "image";
  if (tag === "PRE") return "code";
  if (tag === "TABLE") return "table";
  if (tag === "P" && el.parentElement?.tagName === "BLOCKQUOTE") return "quote";
  return tag.toLowerCase();
}

/** (Re)assign block ids inside `root` and return the blocks in reading order. */
export function indexBlocks(root: HTMLElement): GuideBlock[] {
  root.querySelectorAll(`[${BLOCK_ATTR}]`).forEach((n) => n.removeAttribute(BLOCK_ATTR));
  const out: GuideBlock[] = [];
  let n = 0;
  root.querySelectorAll<HTMLElement>(CANDIDATES).forEach((el) => {
    const tag = el.tagName;
    if (tag === "P" && el.parentElement?.tagName === "LI") return; // the li covers it
    if (tag !== "PRE" && tag !== "IMG" && el.closest("pre")) return; // inside a code block
    if (tag === "P" && el.querySelector("img") && !(el.textContent || "").trim()) return; // the img is indexed itself
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
const normalize = (s: string) =>
  s
    .toLowerCase()
    .split("")
    .filter((ch) => !STRIP.test(ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Locate `quote` (case/whitespace/quote-mark insensitive) inside `el` and
 * return a Range over it. Falls back to a shorter prefix of the quote when the
 * model paraphrased the tail; null when nothing matches.
 */
export function findQuoteRange(el: HTMLElement, quote: string): Range | null {
  const needleFull = normalize(quote);
  if (needleFull.length < 3) return null;

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
  if (!full) return null;

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
  let at = hay.indexOf(needle);
  if (at === -1) {
    const words = needleFull.split(" ");
    for (let w = words.length - 1; w >= 3 && at === -1; w--) {
      needle = words.slice(0, w).join(" ");
      at = hay.indexOf(needle);
    }
  }
  if (at === -1) return null;

  const startOff = map[at];
  const endOff = map[at + needle.length - 1] + 1;
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
