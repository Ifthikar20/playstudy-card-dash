/*
  Where a PDF lesson stops for questions: its checkpoints.

  A checkpoint is a run of consecutive pages holding about 400 words of readable text.
  A dense page is one on its own, so a check comes every two or three minutes of
  narration; light pages and slides group up to four, so an invite doesn't pop up
  every twenty seconds, and the questions get enough related ideas to put in order or
  sort. Each checkpoint gets its own quiz, written only when the lesson reaches it, so
  a 200-page PDF costs nothing up front.

  The grouping must come out the same every time the PDF is opened: the server keeps
  one quiz per (first page, last page), and a range that shifted would never find its
  stored questions again. It only depends on the word counts, which come from the text
  layer's pure geometry (lib/pdf/textBlocks.ts).

  pdfCheckpoints and checkpointForPage are pure, and this file imports nothing it
  needs at load time from the app (the quiz types are erased, lib/guide/blocks has no
  imports of its own), so `node --test scripts/tests/` runs them as they are.
  pdfPageBlocks reads the page, so it only works in the browser.
*/
import type { PdfCheckpoint } from "../quiz/types.ts";
import { BLOCKS_ROOT_ATTR, indexBlocks } from "../guide/blocks.ts";

/** A checkpoint closes once it holds this many words... */
export const CHECKPOINT_WORDS = 400;
/** ...or spans this many pages, whichever comes first. */
export const CHECKPOINT_PAGES = 4;
/** A last group lighter than this is folded into the one before: a quiz on half a slide isn't worth stopping for. */
const TAIL_WORDS = 120;
/** A page with fewer words than this (a picture, a title slide) isn't where the lesson stops for the quiz. */
const ANCHOR_WORDS = 40;
/** The server's longest range (app/api/pdf_quizzes.py): a merged tail never makes one longer. */
const MAX_SPAN = 8;
/** The server reads at most this many blocks a page (guide.py MAX_BLOCKS). */
const MAX_BLOCKS = 80;

/** How much readable text one page has (its headings, paragraphs and bullets). */
export interface PdfPageWords {
  page: number;
  words: number;
}

/** One page's blocks as the server is sent them: the ids Teach mode points with. */
export interface PdfPageBlocks {
  page: number;
  blocks: { id: string; kind: string; text: string }[];
}

/** Words in a piece of text, counted the same way everywhere a page's size is judged. */
export function wordCount(text: string): number {
  const t = (text ?? "").trim();
  return t ? t.split(/\s+/).length : 0;
}

/** "Page 3", "Pages 3–5", "Slide 4", "Slides 4–7". */
export function checkpointTitle(first: number, last: number, unit: "Page" | "Slide" = "Page"): string {
  return first === last ? `${unit} ${first}` : `${unit}s ${first}–${last}`;
}

interface Group {
  pages: PdfPageWords[];
  words: number;
}

const toCheckpoint = (g: Group, unit: "Page" | "Slide"): PdfCheckpoint => {
  const first = g.pages[0].page;
  const last = g.pages[g.pages.length - 1].page;
  // Where the lesson reaches the quiz: the last page with real text. A picture-only page
  // is skipped by Teach mode (it has nothing to narrate), so an invite waiting on one
  // would never open. With no page that full, the last with any text at all.
  const withText = [...g.pages].reverse();
  const anchor = withText.find((p) => p.words >= ANCHOR_WORDS) ?? withText.find((p) => p.words > 0) ?? g.pages[g.pages.length - 1];
  return { topicId: `pdfq-${first}-${last}`, first, last, title: checkpointTitle(first, last, unit), anchorPage: anchor.page };
};

/**
 * Split a PDF into checkpoints. `pages` is every page's word count (any order); pages
 * missing from it are treated as absent. Each page joins the open group, which closes
 * at CHECKPOINT_WORDS words or CHECKPOINT_PAGES pages. Groups with no words at all are
 * dropped, and a light last group joins the one before it (if the two together still
 * fit the server's eight-page limit).
 */
export function pdfCheckpoints(pages: PdfPageWords[], unit: "Page" | "Slide" = "Page"): PdfCheckpoint[] {
  // One entry per page, in page order: the PDF reports its pages as they lay out.
  const byPage = new Map<number, PdfPageWords>();
  for (const p of pages ?? []) {
    if (!p || !Number.isInteger(p.page) || p.page < 1) continue;
    const words = Number.isFinite(p.words) && p.words > 0 ? Math.floor(p.words) : 0;
    byPage.set(p.page, { page: p.page, words });
  }
  const ordered = [...byPage.values()].sort((a, b) => a.page - b.page);

  const groups: Group[] = [];
  let open: Group | null = null;
  for (const p of ordered) {
    // A gap in the numbering (a page that never reported) starts a new group, so a
    // checkpoint is always a run of pages that are all there.
    if (open && p.page !== open.pages[open.pages.length - 1].page + 1) {
      groups.push(open);
      open = null;
    }
    open ??= { pages: [], words: 0 };
    open.pages.push(p);
    open.words += p.words;
    const span = p.page - open.pages[0].page + 1;
    if (open.words >= CHECKPOINT_WORDS || span >= CHECKPOINT_PAGES) {
      groups.push(open);
      open = null;
    }
  }
  if (open) groups.push(open);

  const kept = groups.filter((g) => g.words > 0);
  if (kept.length > 1) {
    const tail = kept[kept.length - 1];
    const prev = kept[kept.length - 2];
    const span = tail.pages[tail.pages.length - 1].page - prev.pages[0].page + 1;
    const joined = tail.pages[0].page === prev.pages[prev.pages.length - 1].page + 1;
    if (tail.words < TAIL_WORDS && span <= MAX_SPAN && joined) {
      kept.splice(kept.length - 2, 2, { pages: [...prev.pages, ...tail.pages], words: prev.words + tail.words });
    }
  }
  return kept.map((g) => toCheckpoint(g, unit));
}

/**
 * The checkpoint a page belongs to. A page in none (a run of picture-only pages) gets
 * the next checkpoint after it, or failing that the last one before it; null only when
 * there are no checkpoints at all.
 */
export function checkpointForPage(cps: PdfCheckpoint[], page: number): PdfCheckpoint | null {
  if (!cps?.length) return null;
  const inside = cps.find((c) => page >= c.first && page <= c.last);
  if (inside) return inside;
  const after = cps.filter((c) => c.first > page).sort((a, b) => a.first - b.first)[0];
  if (after) return after;
  return [...cps].sort((a, b) => b.last - a.last)[0];
}

/**
 * The text of pages first..last as Teach mode sees it: each page's text layer
 * (`data-guide-notes="-N"`) run through the same indexBlocks, so running headers and
 * footers are left out and the block ids are the ones the pointer finds. The server
 * writes the questions from this, and cites these ids, so the tutor can point at the
 * paragraph that holds an answer. Pages not laid out yet (or with no text) are left out.
 */
export function pdfPageBlocks(first: number, last: number, root: ParentNode = document): PdfPageBlocks[] {
  const out: PdfPageBlocks[] = [];
  for (let page = first; page <= last; page++) {
    const el = root.querySelector<HTMLElement>(`[${BLOCKS_ROOT_ATTR}="${-page}"]`);
    if (!el) continue;
    const blocks = indexBlocks(el)
      .slice(0, MAX_BLOCKS)
      .map(({ id, kind, text }) => ({ id, kind, text }));
    if (blocks.length) out.push({ page, blocks });
  }
  return out;
}
