/**
 * The one renderer for study notes.
 *
 * Read mode, the notes page and the in-place editor all import these, so the
 * heading chips, highlights and pinned visuals cannot drift between surfaces.
 * The chip's colour is handed over as CSS custom properties (`--an-h`,
 * `--an-h-bg`) and painted by one rule in index.css, so the rendered chip and
 * the editing ink are the same colour by construction.
 */

import type { CSSProperties, ReactNode } from "react";
import { GuideVisual, parseVisualFence } from "@/components/guide/GuideVisual";
import { VISUAL_FENCES } from "@/lib/notes/fences";
import { HEADING_COLORS, newTagRe } from "@/lib/notes/units";

/** Keep only <mark> raw HTML in AI notes; drop every other tag so rehype-raw is
 *  safe to run. Text and Markdown are left untouched. */
export function sanitizeNotes(md: string): string {
  // The pattern is shared with `sanitizeWithMap` in units.ts, which records the
  // copy/replace runs that map a rendered offset back to the stored bytes. Two
  // literal copies of it would be silent offset corruption the day they drift.
  return md.replace(newTagRe(), (m, tag: string) =>
    /^mark$/i.test(tag) ? (m.startsWith("</") ? "</mark>" : "<mark>") : "",
  );
}

/* Re-exported so every existing importer keeps one import site; the array
   itself lives in units.ts, which has no React dependency. */
export { HEADING_COLORS };

/* CSSProperties has no index signature for custom properties, so widen it
   rather than casting each key through `any`. */
type CssVars = CSSProperties & Record<`--${string}`, string>;

export const headingVars = (c: string): CssVars =>
  ({ "--an-h": c, "--an-h-bg": `${c}22` }) as CssVars;

/* A visual the student pinned from the Teach mode whiteboard. It's stored in the
   notes as a fenced `playstudy-visual` block, and drawn here by the same component
   that drew it on the board, so it looks exactly like what they were shown. */
/* react-markdown hands components an mdast `node` plus the hast properties
   as loose props; this is the narrowest shape that compiles against it. */
type MdComponentProps = { node?: unknown; children?: ReactNode } & Record<string, unknown>;

export function PinnedOrPre({ node, ...props }: MdComponentProps) {
  const child = Array.isArray(props.children) ? props.children[0] : props.children;
  const className: string = child?.props?.className ?? "";
  const unit: string | undefined = child?.props?.["data-an-unit"];
  if (VISUAL_FENCES.some((f) => className.includes(`language-${f}`))) {
    const spec = parseVisualFence(String(child?.props?.children ?? ""));
    if (spec) {
      return (
        <div className="guide-pinned not-prose" data-an-unit={unit} data-an-kind="atom">
          <GuideVisual spec={spec} />
        </div>
      );
    }
  }
  return <pre {...props} data-an-unit={unit} data-an-kind="atom" />;
}

export const BASE_NOTE_COMPONENTS = {
  // Highlighter: a light amber chip with dark ink — reads on any background
  // (app light/dark and both Read-mode themes), like a real highlighter.
  mark: ({ node, ...props }: MdComponentProps) => (
    <mark className="rounded bg-amber-200/80 px-1 py-0.5 text-amber-950" {...props} />
  ),
  a: ({ node, ...props }: MdComponentProps) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  pre: PinnedOrPre,
};

/** h2/h3 with the cycled colour chip. `counter` is one ref per rendered body,
 *  so the hues cycle in document order exactly as they always have. */
export function headingFactory(counter: { current: number }) {
  return (Tag: "h2" | "h3") =>
    ({ node, children, ...rest }: MdComponentProps) => {
      const c = HEADING_COLORS[counter.current++ % HEADING_COLORS.length];
      return (
        <Tag {...rest} style={headingVars(c)}>
          <span className="an-h-chip box-decoration-clone rounded-md px-1.5 py-0.5">{children}</span>
        </Tag>
      );
    };
}
