/**
 * PaperNotes — the study notes as a page you can write on.
 *
 * TWO STATES, ONE FILE, NO MODE BUTTON.
 *
 *  READING   The notes render exactly as they always have and as Read mode
 *            still does: real <h2>s at 18px with their colour chip, real list
 *            indentation, real blockquote borders, live KaTeX, live GFM tables
 *            and live pinned `playstudy-visual` diagrams.
 *
 *  WRITING   Click (or tap) anywhere in them and the WHOLE SECTION becomes one
 *            continuous writing surface with the caret exactly where you
 *            clicked — see OneSheet. From there every gesture is the browser's
 *            own: type anywhere, arrow across paragraphs with the column
 *            preserved, select from the middle of one paragraph to the middle
 *            of another and delete it, Enter for a new paragraph or bullet
 *            anywhere, Backspace at the start to merge into the paragraph
 *            above, one undo stack for the whole section, and a debounced
 *            autosave instead of a network write per line. Escape, or clicking
 *            away, goes back to reading.
 *
 * WHY IT CANNOT CORRUPT NOTES
 *  - While writing, `textarea.value` IS the stored Markdown, byte for byte.
 *    There is no DOM → Markdown serialiser anywhere in this feature, so a save
 *    cannot emit a byte the student did not type: `<mark class="hi">`, `\ce{}`
 *    chemistry, KaTeX, GFM tables and pinned fences survive because they are
 *    never read.
 *  - Those blocks are FROZEN: `beforeinput` refuses any input that touches one,
 *    the caret steps over them rather than into them, and `guardDoc` re-proves
 *    it on the candidate document before anything is sent.
 *
 * WHAT STAYS COUPLED
 *  - `data-guide-notes` never leaves the DOM in either state.
 *  - Teach mode (`locked`) always renders the READING state, so `indexBlocks`,
 *    `findBlockEl` and `findQuoteRange` see exactly the DOM they see today.
 */

import {
  type ComponentProps,
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";
import { BASE_NOTE_COMPONENTS, HEADING_COLORS, headingVars } from "@/lib/notes/render";
import {
  HUE_ATTR,
  KIND_ATTR,
  MATH_OPTS,
  UNIT_ATTR,
  renderedToBuf,
  sanitizeWithMap,
  stampUnits,
  type UnitKind,
} from "@/lib/notes/units";
import { OneSheet, type OneSheetHandle } from "@/components/notes/OneSheet";

export interface PaperNotesHandle {
  /** Put the caret in the notes — the toolbar and keyboard entry point. */
  startEditing: () => void;
  stopEditing: () => void;
  isEditing: () => boolean;
}

/* react-markdown passes the mdast node plus the hast properties as loose props.
   `node` is destructured out so it never reaches the DOM. */
type MdComponentProps = { node?: unknown; children?: ReactNode } & Record<string, unknown>;

const REMARK_PLUGINS = (src: string): ComponentProps<typeof ReactMarkdown>["remarkPlugins"] => [
  remarkGfm,
  [remarkMath, MATH_OPTS],
  stampUnits(src),
];

function Heading({ Tag, rest, children }: { Tag: "h2" | "h3"; rest: Record<string, unknown>; children: ReactNode }) {
  const hue = Number(rest[HUE_ATTR] ?? 0);
  return (
    <Tag {...rest} style={headingVars(HEADING_COLORS[hue % HEADING_COLORS.length])}>
      <span className="an-h-chip box-decoration-clone rounded-md px-1.5 py-0.5">{children}</span>
    </Tag>
  );
}

const READ_COMPONENTS = {
  ...BASE_NOTE_COMPONENTS,
  h2: ({ node, children, ...rest }: MdComponentProps) => (
    <Heading Tag="h2" rest={rest}>
      {children}
    </Heading>
  ),
  h3: ({ node, children, ...rest }: MdComponentProps) => (
    <Heading Tag="h3" rest={rest}>
      {children}
    </Heading>
  ),
};

/** Rendered-text offset of a DOM position inside a unit element. */
function renderedOffsetAt(el: HTMLElement, node: Node | null, offset: number): number {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let seen = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (t === node) return seen + offset;
    seen += (t.nodeValue || "").length;
  }
  return seen;
}

/** The scroller the notes live in — the inset content frame at md+, the document
 *  below it. Used to hold the clicked line still while the surface swaps. */
function scrollerOf(el: HTMLElement | null): HTMLElement | Window {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return window;
}

export interface PaperNotesProps {
  md: string;
  /** topic.db_id — the value TeachMode and the sticky notes resolve sections by. */
  guideKey?: number;
  /** The prose class string. Identical in the reading state and in Read mode. */
  prose: string;
  canEdit: boolean;
  /** True while Teach mode is open: the notes are read-only so the guide's
   *  already-measured pointer rects can never be invalidated by a reflow. */
  locked: boolean;
  /** Persists the whole markdown body. Returns the server's copy, which we adopt. */
  onCommit: (next: string) => Promise<string | void>;
}

export const PaperNotes = forwardRef<PaperNotesHandle, PaperNotesProps>(function PaperNotes(
  { md, guideKey, prose, canEdit, locked, onCommit },
  handleRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<OneSheetHandle>(null);
  const [writing, setWriting] = useState<{ caret: number; at: number } | null>(null);

  const live = canEdit && !locked;
  const { sanitized, toSrc } = useMemo(() => sanitizeWithMap(md), [md]);

  /* A click in the rendered prose → the exact source offset under the pointer.
     Offsets are into the SANITIZED string the renderer parses, so they are
     mapped back before they are ever used against the stored bytes. */
  const sourceOffsetAt = useCallback(
    (el: HTMLElement, node: Node | null, offset: number): number => {
      const raw = el.getAttribute(UNIT_ATTR);
      if (!raw) return 0;
      const [a, b] = raw.split(":").map(Number);
      const start = toSrc(a);
      if ((el.getAttribute(KIND_ATTR) as UnitKind | null) === "atom") return start;
      const src = md.slice(start, toSrc(b, true));
      return start + renderedToBuf(src, renderedOffsetAt(el, node, offset));
    },
    [md, toSrc],
  );

  /** Swap prose → sheet without the page jumping under the student's finger. */
  const open = useCallback((caret: number) => {
    const root = rootRef.current;
    const at = root ? root.getBoundingClientRect().top : 0;
    setWriting({ caret, at });
  }, []);

  useLayoutEffect(() => {
    if (!writing || !rootRef.current) return;
    const delta = rootRef.current.getBoundingClientRect().top - writing.at;
    if (!delta) return;
    const sc = scrollerOf(rootRef.current);
    if (sc === window) window.scrollBy(0, delta);
    else (sc as HTMLElement).scrollTop += delta;
  }, [writing]);

  const close = useCallback(() => setWriting(null), []);

  // Teach mode takes over, or editing is withdrawn: leave the writing surface so
  // nothing can reflow under the guide's already-measured pointer rects.
  useEffect(() => {
    if (!live) setWriting(null);
  }, [live]);

  // Another writer landed a new copy under an open surface.
  useEffect(() => {
    if (writing) sheetRef.current?.external(md);
  }, [md, writing]);

  useImperativeHandle(
    handleRef,
    () => ({
      startEditing: () => open(0),
      stopEditing: close,
      isEditing: () => !!writing,
    }),
    [close, open, writing],
  );

  const onClick = (e: React.MouseEvent) => {
    if (!live || writing) return;
    const t = e.target as HTMLElement | null;
    if (!t || t.closest("a,button,input,textarea,[data-an-chrome]")) return;
    const sel = window.getSelection();
    // A drag-select belongs to the sticky-note flow, not to the editor.
    if (sel && !sel.isCollapsed) return;
    const el = t.closest<HTMLElement>(`[${UNIT_ATTR}]`);
    if (!el || !rootRef.current?.contains(el)) return;
    // No arming, no "Edit notes" gate, no coarse-pointer bail: a tap on a phone
    // places the caret and raises the keyboard, which is what a document does.
    open(sourceOffsetAt(el, sel?.anchorNode ?? null, sel?.anchorOffset ?? 0));
  };

  const tree = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS(sanitized)}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={READ_COMPONENTS as ComponentProps<typeof ReactMarkdown>["components"]}
      >
        {sanitized}
      </ReactMarkdown>
    ),
    [sanitized],
  );

  /* One stable outer element across BOTH states: the scroll anchor measures it
     while the surface underneath is being replaced, and it carries nothing of
     its own — no text node, no id — so every TreeWalker in the app is unaffected. */
  return (
    <div ref={rootRef}>
      {writing ? (
        <OneSheet
          ref={sheetRef}
          initial={md}
          caret={writing.caret}
          guideKey={guideKey}
          onCommit={onCommit}
          onClose={close}
        />
      ) : (
        <div
          className={cn(prose, live && "cursor-text")}
          data-guide-notes={guideKey}
          {...(live ? { "data-an-live": "" } : {})}
          onClick={onClick}
        >
          {tree}
        </div>
      )}
    </div>
  );
});
