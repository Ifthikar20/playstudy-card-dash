/**
 * Where exactly to point on the Teach mode whiteboard.
 *
 * A teacher at a whiteboard puts a finger on the part being talked about - the third
 * colour band, side c, the resistor - not somewhere near the picture. This finds that
 * part on screen and says where the pointer's tip goes:
 *
 * - a picture's part comes from a region the server located (0-1 of the picture as
 *   displayed), mapped through the <img>'s own box, border and letterboxing;
 * - a drawn visual's part is an element marked data-board-part="<id>" (with its
 *   visible text in data-board-label, and for SVG the exact spot to touch in
 *   data-part-at="x y", in that element's own user units).
 *
 * Everything is measured from what's on screen at the moment of asking, so the
 * answer stays right while the board animates in, widens, scrolls or is dragged.
 * The two small choreography helpers at the end are shared by Teach mode and the
 * dev gallery (/dev-board?only=pointing), so the gallery checks the real thing.
 */
import { splitSentences } from "@/lib/guide/speech";
import type { GuidePoint, GuideRegion } from "@/services/guide";
import type { Gesture, HostRect, PointerHandle } from "@/components/guide/GuidePointer";

export interface Pt {
  x: number;
  y: number;
}

/** A rectangle in viewport pixels, as getBoundingClientRect measures it. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A part on screen: its box, and the spot on it to point at. `exact` means the
 * visual itself said where the tip goes (data-part-at), so it's used as it is.
 */
export interface PartSpot {
  box: Box;
  at: Pt;
  exact: boolean;
}

export const PART_ATTR = "data-board-part";
export const PART_LABEL_ATTR = "data-board-label";
export const PART_AT_ATTR = "data-part-at";
/** The one picture a board shows. */
export const BOARD_IMAGE = "img.guide-image-img";

const boxOf = (r: Box): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---- pictures -------------------------------------------------------------------

/** The size of one side of a CSS length that's a plain pixel value ("1px"), else 0. */
const px = (v: string) => parseFloat(v) || 0;

/** Where along the free space object-position puts the picture ("50%" = centred). */
function offsetFor(v: string | undefined, free: number, scale: number): number {
  if (!v) return free / 2;
  if (v === "left" || v === "top") return 0;
  if (v === "right" || v === "bottom") return free;
  if (v === "center") return free / 2;
  if (v.endsWith("%")) return (free * parseFloat(v)) / 100;
  return px(v) * scale;
}

/**
 * The on-screen box of a located region inside a picture. Worked out from the
 * bounding rect alone (which already includes any transform on the board), less the
 * border and padding, less the bands object-fit: contain leaves either side when the
 * picture's shape isn't its box's. Null while the picture has no size yet.
 */
export function regionTarget(img: HTMLImageElement, region: GuideRegion): PartSpot | null {
  const r = img.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const cs = getComputedStyle(img);
  // Border and padding are in untransformed CSS px; the rect may be scaled.
  const sx = r.width / (img.offsetWidth || r.width);
  const sy = r.height / (img.offsetHeight || r.height);
  const insetL = (px(cs.borderLeftWidth) + px(cs.paddingLeft)) * sx;
  const insetR = (px(cs.borderRightWidth) + px(cs.paddingRight)) * sx;
  const insetT = (px(cs.borderTopWidth) + px(cs.paddingTop)) * sy;
  const insetB = (px(cs.borderBottomWidth) + px(cs.paddingBottom)) * sy;
  const cl = r.left + insetL;
  const ct = r.top + insetT;
  const cw = r.width - insetL - insetR;
  const ch = r.height - insetT - insetB;
  if (cw < 1 || ch < 1) return null;

  // How big the picture itself is drawn inside that content box.
  let dw = cw;
  let dh = ch;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const fit = cs.objectFit;
  if (nw > 0 && nh > 0 && fit && fit !== "fill") {
    let s = fit === "cover" ? Math.max(cw / nw, ch / nh) : Math.min(cw / nw, ch / nh);
    if (fit === "none") s = sx;
    else if (fit === "scale-down") s = Math.min(s, sx);
    dw = nw * s;
    dh = nh * s;
  }
  const [posX, posY] = (cs.objectPosition || "50% 50%").split(/\s+/);
  const ox = cl + offsetFor(posX, cw - dw, sx);
  const oy = ct + offsetFor(posY, ch - dh, sy);

  const [bx, by, bw, bh] = region.box;
  // A part cropped away (object-fit: cover) can't be pointed at: keep only what shows.
  const left = Math.max(cl, ox + bx * dw);
  const top = Math.max(ct, oy + by * dh);
  const right = Math.min(cl + cw, ox + (bx + bw) * dw);
  const bottom = Math.min(ct + ch, oy + (by + bh) * dh);
  if (right - left < 1 || bottom - top < 1) return null;
  const box = { left, top, width: right - left, height: bottom - top };
  const at = { x: clamp(ox + region.point[0] * dw, left, right), y: clamp(oy + region.point[1] * dh, top, bottom) };
  return { box, at, exact: false };
}

// ---- drawn visuals -----------------------------------------------------------------

/** The element a drawn visual marked as part `part`, if it's there. */
export function findAnchor(root: ParentNode, part: string): Element | null {
  if (!part) return null;
  return root.querySelector(`[${PART_ATTR}="${CSS.escape(part)}"]`);
}

/**
 * An anchor's box and the spot to touch: its data-part-at (SVG user units, carried
 * to the screen through the element's own getScreenCTM, so its transforms and the
 * viewBox scaling all count), else the middle of its box.
 */
export function spotOf(el: Element): PartSpot | null {
  if (!el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 && r.height < 1) return null;
  const box = boxOf(r);
  const raw = el.getAttribute(PART_AT_ATTR);
  if (raw && typeof SVGGraphicsElement !== "undefined" && el instanceof SVGGraphicsElement) {
    const [x, y] = raw.trim().split(/[\s,]+/).map(Number);
    const m = el.getScreenCTM();
    if (m && Number.isFinite(x) && Number.isFinite(y)) {
      const p = new DOMPoint(x, y).matrixTransform(m);
      return { box, at: { x: p.x, y: p.y }, exact: true };
    }
  }
  return { box, at: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, exact: false };
}

/** Part `part` of the drawn visual under `root`, on screen. */
export function anchorTarget(root: ParentNode, part: string): PartSpot | null {
  const el = findAnchor(root, part);
  return el ? spotOf(el) : null;
}

const STOP = new Set([
  "the", "an", "of", "this", "that", "these", "those", "its", "it", "is", "are", "on", "in", "at", "to",
  "and", "or", "here", "there", "which", "with", "from", "for", "by", "one", "we", "see", "look",
]);
const ORDINAL: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5, "6th": 6, "7th": 7, "8th": 8, "9th": 9, "10th": 10,
};

/** "Sides" and "side" are the same word here; "glass" keeps its s. */
const stem = (t: string) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t);

/** Lower-case content words. A leading article "a" goes, but "side a" keeps its a. */
function words(s: string): string[] {
  const raw = s
    .toLowerCase()
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/[^\p{L}\p{N}.\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return raw.filter((t, i) => !STOP.has(t) && !(t === "a" && i === 0 && raw.length > 1)).map(stem);
}

/**
 * The drawn part `label` names, when one clearly does: words shared with the part's
 * label and id ("side c" → sides.c), plus "the third …" → the third of a kind. Only a
 * match that's good (at least half the words) and clearly ahead of the next is taken,
 * so an ambiguous name leaves the pointer on the whole visual rather than guessing.
 */
export function matchAnchor(root: ParentNode, label: string): HTMLElement | null {
  const said = words(label);
  const ordinal = said.map((t) => ORDINAL[t]).find((n) => n != null);
  const content = said.filter((t) => ORDINAL[t] == null);
  const need = content.length + (ordinal ? 1 : 0);
  if (!need) return null;
  const wanted = new Set(content);
  const scored: Array<{ el: HTMLElement; score: number }> = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(`[${PART_ATTR}]`))) {
    const id = el.getAttribute(PART_ATTR) ?? "";
    const text = el.getAttribute(PART_LABEL_ATTR) ?? el.textContent ?? "";
    // an id's indexes are positions, not names: "events.3" says nothing about "3 volts"
    const idWords = words(id.replace(/[._-]+/g, " ")).filter((t) => !/^\d+$/.test(t));
    const have = new Set([...words(text), ...idWords]);
    let hits = 0;
    for (const t of wanted) if (have.has(t)) hits++;
    if (ordinal) {
      const index = Number(id.split(".").pop());
      if (Number.isInteger(index) && index === ordinal - 1) hits++;
    }
    if (!hits) continue;
    // the share of what was said that matches, then (slightly) how little of the part is left over
    const score = hits / need + (0.1 * hits) / Math.max(1, have.size + (ordinal ? 1 : 0));
    scored.push({ el, score });
  }
  // One part can carry two names (a circuit's "battery" wraps "components.0"): an
  // anchor that wraps a match about as good inside it isn't a rival - the inner one is
  // the part, and pointing at it is pointing at both.
  const MARGIN = 0.15;
  const distinct = scored.filter((a) => !scored.some((b) => b !== a && a.el.contains(b.el) && b.score >= a.score - MARGIN));
  distinct.sort((a, b) => b.score - a.score);
  const [best, next] = distinct;
  if (!best || best.score < 0.5) return null;
  if (next && best.score - next.score < MARGIN) return null;
  return best.el;
}

/** Where part `point` of the visual under `root` is on screen right now, if it can be found. */
export function locatePart(root: HTMLElement, point: GuidePoint, regions: Record<string, GuideRegion>): PartSpot | null {
  const img = root.querySelector<HTMLImageElement>(BOARD_IMAGE);
  if (img) {
    const region = regions[point.label];
    return region ? regionTarget(img, region) : null;
  }
  const byId = point.part ? anchorTarget(root, point.part) : null;
  if (byId) return byId;
  const named = matchAnchor(root, point.label);
  return named ? spotOf(named) : null;
}

// ---- where the tip goes ----------------------------------------------------------

/**
 * The exact spot for the pointer's tip on a part. A spot the visual chose is used as
 * it is. A tall, thin part (a colour band, a bar) is touched at its bottom edge: the
 * arrow and the avatar trail down and to the right of the tip, and from the middle
 * they'd cover the next band along. Otherwise the part's own spot, kept inside it.
 */
export function aimPoint(rect: Box, at?: Pt, exact = false): Pt {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  if (at && exact) return at;
  const inset = (n: number) => Math.min(3, n / 4);
  const x0 = rect.left + inset(rect.width);
  const x1 = right - inset(rect.width);
  const y0 = rect.top + inset(rect.height);
  const y1 = bottom - inset(rect.height);
  const cx = at ? clamp(at.x, x0, x1) : rect.left + rect.width / 2;
  if (rect.height >= rect.width * 2 && rect.width <= 60) return { x: cx, y: bottom - Math.min(4, rect.height * 0.08) };
  return at ? { x: cx, y: clamp(at.y, y0, y1) } : { x: cx, y: rect.top + rect.height / 2 };
}

/** Nothing inside to point at: rest just outside the visual's bottom-left corner, clear of it. */
export const restSpot = (whole: Box): Pt => ({ x: whole.left - 3, y: whole.top + whole.height + 3 });

/** Loop round a part the first time the board is explained; a tap after that, two for something tiny. */
export function partGesture(box: Box, first: boolean): Gesture {
  if (first) return "circle";
  return Math.min(box.width, box.height) < 24 ? "double" : "click";
}

// ---- moving between parts as they're named ---------------------------------------

/** When to move to part `point`: in sentence `sentence`, `at` (0-1) of the way through it. */
export interface ScheduledPart {
  point: number;
  sentence: number;
  at: number;
  /** False when the label never comes up in what's said, so its moment was spread in. */
  heard: boolean;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where `label` is first said at or after (sentence, offset): the whole phrase, else
 * its most telling word - the longest one no other label shares, so "the red band"
 * is heard at "red", never at the "band" every colour band has.
 */
function findMention(
  sentences: string[],
  label: string,
  from: { sentence: number; offset: number },
  shared: Set<string>,
): { sentence: number; at: number } | null {
  const phrase = label
    .trim()
    .replace(/^(the|a|an|this|that)\s+/i, "")
    .replace(/\s+/g, " ");
  const key = words(label)
    .filter((t) => ORDINAL[t] == null && !shared.has(t))
    .sort((a, b) => b.length - a.length)[0];
  const needles = [phrase, key].filter((n): n is string => !!n && n.length > 0);
  for (const needle of needles) {
    // whole words only ("red" isn't in "reduce"), allowing a plural ("bands")
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(needle)}(?:s|es)?(?![\\p{L}\\p{N}])`, "giu");
    for (let s = from.sentence; s < sentences.length; s++) {
      const text = sentences[s];
      re.lastIndex = s === from.sentence ? from.offset : 0;
      const m = re.exec(text);
      if (m) {
        const index = m.index + m[1].length;
        return { sentence: s, at: text.length ? index / text.length : 0 };
      }
    }
  }
  return null;
}

/**
 * When to move from part to part while `say` is spoken: each label at the moment
 * it's named, in order. The first part is where the pointer starts, so it's due at
 * once; parts that are never named out loud are spread between their neighbours.
 * Sentences are split exactly as the Narrator splits them, so its captions match.
 */
export function labelSchedule(say: string, points: GuidePoint[]): ScheduledPart[] {
  if (!points.length) return [];
  const sentences = splitSentences(say);
  const out: ScheduledPart[] = [];
  let from = { sentence: 0, offset: 0 };
  const vocab = points.map((p) => new Set(words(p.label)));
  points.forEach((p, i) => {
    const shared = new Set(vocab.flatMap((v, j) => (j === i ? [] : [...v])));
    const hit = findMention(sentences, p.label, from, shared);
    if (hit) {
      out.push({ point: i, sentence: hit.sentence, at: hit.at, heard: true });
      from = { sentence: hit.sentence, offset: Math.round(hit.at * sentences[hit.sentence].length) + 1 };
    } else {
      out.push({ point: i, sentence: -1, at: 0, heard: false });
    }
  });
  out[0] = { ...out[0], sentence: 0, at: 0 };
  const last = Math.max(0, sentences.length - 1);
  for (let i = 1; i < out.length; i++) {
    if (out[i].sentence >= 0) continue;
    let j = i;
    while (j < out.length && out[j].sentence < 0) j++;
    const start = out[i - 1].sentence;
    const end = j < out.length ? out[j].sentence : last + 1;
    const run = j - i;
    for (let k = 0; k < run; k++) {
      let s = start + Math.max(1, Math.round(((end - start) * (k + 1)) / (run + 1)));
      s = Math.min(s, last, j < out.length ? end : last);
      out[i + k] = { point: i + k, sentence: Math.max(start, s), at: 0, heard: false };
    }
    i = j - 1;
  }
  return out;
}

// ---- choreography (shared by Teach mode and the dev gallery) ----------------------

/** A viewport box in the pointer's host coordinates. */
export function hostBox(host: HTMLElement, b: Box): HostRect {
  const hr = host.getBoundingClientRect();
  return { x: b.left - hr.left, y: b.top - hr.top, w: b.width, h: b.height };
}

/** A viewport point in the pointer's host coordinates. */
export function hostPt(host: HTMLElement, p: Pt): Pt {
  const hr = host.getBoundingClientRect();
  return { x: p.x - hr.left, y: p.y - hr.top };
}

/** Grow a box to at least `min` px each way about its centre, so a hairline part still gets a visible ring. */
function atLeast(b: Box, min: number): Box {
  const w = Math.max(b.width, min);
  const h = Math.max(b.height, min);
  return { left: b.left - (w - b.width) / 2, top: b.top - (h - b.height) / 2, width: w, height: h };
}

/**
 * Ring the part tightly and put the pointer's tip on it. The avatar tucks in and
 * the idle drift stops (precise), and the speech bubble is kept off the board and
 * the part. Returns where the tip goes, in host coordinates.
 */
export function pointAtPart(
  p: PointerHandle,
  host: HTMLElement,
  spot: PartSpot,
  opts: { gesture?: Gesture; duration?: number; board?: Box | null } = {},
): Pt {
  const ring = hostBox(host, atLeast(spot.box, 8));
  const tip = hostPt(host, aimPoint(spot.box, spot.at, spot.exact));
  const keepClear = opts.board ? [hostBox(host, opts.board), ring] : [ring];
  p.focus(ring, "pink", { above: true, pad: 3, radius: 6, ring: true });
  p.moveTo(tip, { gesture: opts.gesture ?? "click", around: ring, duration: opts.duration, precise: true, keepClear });
  return tip;
}

/**
 * Nothing to point at inside the visual: outline all of it, glide once to rest just
 * outside its bottom-left corner and stay there, still. Never a press at a random
 * spot, which would claim a part that nobody located. Returns the tip (host px).
 */
export function restBeside(p: PointerHandle, host: HTMLElement, whole: Box, opts: { duration?: number; board?: Box | null } = {}): Pt {
  const outline = hostBox(host, whole);
  const tip = hostPt(host, restSpot(whole));
  const keepClear = opts.board ? [hostBox(host, opts.board), outline] : [outline];
  p.focus(outline, "pink", { above: true });
  p.moveTo(tip, { gesture: "none", duration: opts.duration, precise: true, keepClear });
  return tip;
}
