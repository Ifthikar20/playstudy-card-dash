/**
 * The one renderer for study notes.
 *
 * Read mode, the notes page and the in-place editor all import these, so the
 * heading chips, highlights and pinned visuals cannot drift between surfaces.
 * The chip's colour is handed over as CSS custom properties (`--ps-h`,
 * `--ps-h-bg`) and painted by one rule in index.css, so the rendered chip and
 * the editing ink are the same colour by construction.
 */

import type { CSSProperties, ReactNode } from "react";
import { GuideVisual, VISUAL_FENCE, parseVisualFence } from "@/components/guide/GuideVisual";

/** Keep only <mark> raw HTML in AI notes; drop every other tag so rehype-raw is
 *  safe to run. Text and Markdown are left untouched. */
export function sanitizeNotes(md: string): string {
  return md.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g, (m, tag: string) =>
    /^mark$/i.test(tag) ? (m.startsWith("</") ? "</mark>" : "<mark>") : "",
  );
}

/** Soft, readable highlighter hues for section headings — cycled so consecutive
 *  headings differ. Mid-tone so they read on both light and dark backgrounds. */
export const HEADING_COLORS = ["#7C3AED", "#2563EB", "#0D9488", "#D97706", "#DB2777", "#0EA5E9"];

/* CSSProperties has no index signature for custom properties, so widen it
   rather than casting each key through `any`. */
type CssVars = CSSProperties & Record<`--${string}`, string>;

export const headingVars = (c: string): CssVars =>
  ({ "--ps-h": c, "--ps-h-bg": `${c}22` }) as CssVars;

/* A visual the student pinned from the Teach mode whiteboard. It's stored in the
   notes as a fenced `playstudy-visual` block, and drawn here by the same component
   that drew it on the board, so it looks exactly like what they were shown. */
/* react-markdown hands components an mdast `node` plus the hast properties
   as loose props; this is the narrowest shape that compiles against it. */
type MdComponentProps = { node?: unknown; children?: ReactNode } & Record<string, unknown>;

export function PinnedOrPre({ node, ...props }: MdComponentProps) {
  const child = Array.isArray(props.children) ? props.children[0] : props.children;
  const className: string = child?.props?.className ?? "";
  const unit: string | undefined = child?.props?.["data-ps-unit"];
  if (className.includes(`language-${VISUAL_FENCE}`)) {
    const spec = parseVisualFence(String(child?.props?.children ?? ""));
    if (spec) {
      return (
        <div className="guide-pinned not-prose" data-ps-unit={unit} data-ps-kind="atom">
          <GuideVisual spec={spec} />
        </div>
      );
    }
  }
  return <pre {...props} data-ps-unit={unit} data-ps-kind="atom" />;
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
          <span className="ps-h-chip box-decoration-clone rounded-md px-1.5 py-0.5">{children}</span>
        </Tag>
      );
    };
}
