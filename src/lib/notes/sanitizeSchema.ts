/**
 * The HTML allow-list for rendered notes.
 *
 * Notes are Markdown with exactly one permitted HTML tag, <mark>. The regex pass in
 * render.tsx (`sanitizeNotes`) exists to keep the editor's offset map honest, but it
 * is a single pass over text and can be fooled by nesting one tag inside another
 * (`<<b>iframe …>` becomes `<iframe …>` once the inner tag is removed). This schema
 * runs on the parsed tree after rehype-raw, so whatever the text tricks produce,
 * nothing but the tags and attributes below ever reaches React.
 *
 * Order in the pipeline: rehype-raw → rehype-sanitize (this) → rehype-katex, so the
 * math source still arrives as `code.math-inline` / `code.math-display` and KaTeX's
 * own output (spans with classes and inline styles) is generated after the filter.
 */
import { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";

const base = defaultSchema;
const baseAttrs = base.attributes ?? {};

export const NOTE_SCHEMA: SanitizeSchema = {
  ...base,
  tagNames: [...(base.tagNames ?? []), "mark"],
  attributes: {
    ...baseAttrs,
    // stampUnits marks every editable unit with data-an-* attributes, and the
    // pinned-visual fence carries its kind in the code block's class name.
    "*": [...(baseAttrs["*"] ?? []), "data*"],
    // First entry wins per attribute name in hast-util-sanitize, so this replaces the
    // default `language-*` rule rather than sitting behind it.
    code: [
      ["className", /^language-./, "math-inline", "math-display"],
      ...(baseAttrs.code ?? []).filter((d) => !(Array.isArray(d) && d[0] === "className")),
    ],
    mark: [],
  },
  // Removed with their children, not merely unwrapped: their text is never content.
  strip: ["script", "style"],
};

/** KaTeX limits for notes and the board: `trust` stays at its default (false), so
 *  \href{javascript:…} and friends are never honoured; the two bounds stop a macro
 *  bomb from pinning the tab. */
export const KATEX_OPTS = { maxExpand: 1000, maxSize: 500 } as const;
