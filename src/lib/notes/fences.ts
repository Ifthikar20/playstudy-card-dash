/**
 * The fenced-block languages the notes pipeline speaks.
 *
 * Their own module, and not a constant in GuideVisual.tsx, for one reason: the
 * fence name is written INTO the student's notes and stored in the database, so
 * three files have to agree on it forever — the writer (visualToMarkdown), the
 * reader (render.tsx) and the writing surface (sheet.ts, which must still lock a
 * pinned diagram it cannot type into). Two literal copies of this list is how a
 * diagram pinned last year quietly stops being recognised.
 */

/** What new pins are written as. */
export const VISUAL_FENCE = "anothernotes-visual";

/**
 * What is still READ.
 *
 * Every diagram pinned before the PlayStudy -> AnotherNotes rename carries the
 * old language, in content the student owns and we will not rewrite. Dropping
 * the old entry turns each of them into a meaningless block of JSON.
 */
export const VISUAL_FENCES: readonly string[] = [VISUAL_FENCE, "playstudy-visual"];

/** True when a fenced block is a pinned visual, whichever era it came from. */
export const isVisualFence = (lang: string | null | undefined): boolean =>
  !!lang && VISUAL_FENCES.includes(lang);
