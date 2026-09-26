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
 *            autosave instead of a network write per line. Escape goes back to
 *            reading once what you typed is saved; clicking away only saves.
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
import rehypeSanitize from "rehype-sanitize";
import { KATEX_OPTS, NOTE_SCHEMA } from "@/lib/notes/sanitizeSchema";
import { cn } from "@/lib/utils";
import { BASE_NOTE_COMPONENTS, HEADING_COLORS, headingVars } from "@/lib/notes/render";
import { NoteParagraph } from "@/lib/notes/formula";
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
  /** Put the caret in the notes — the toolbar and keyboard entry point. At the
   *  top by default; pass a source offset (clamped, so `Infinity` is the end)
   *  to open somewhere else. On a sheet that is already open it only moves
   *  focus, and the caret too when one is given. */
  startEditing: (caret?: number) => void;
  stopEditing: () => void;
  isEditing: () => boolean;
  /** Save anything typed and not yet saved. True when the server has it all
   *  (always, while reading); false when it was refused or failed — `problem()`
   *  says why. Await it before anything that locks the notes. */
  flush: () => Promise<boolean>;
  /** Type `text` at the caret, as the student would. When the sheet is closed it
   *  opens at the END and the text goes in as soon as it is ready. False when
   *  the notes cannot be written in (not editable, or locked). */
  insertText: (text: string) => boolean;
  /** Why the words on screen are not saved, or null. */
  problem: () => string | null;
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
  // Formulas set as formulas (lib/notes/formula.tsx).
  p: NoteParagraph,
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
  /** The notes may be empty, and may be saved empty: a student's own note. A
   *  study section is never empty here — an empty one is the auto-writer's. */
  allowEmpty?: boolean;
  /** What an empty page says, in both states. */
  placeholder?: string;
  /** Open the writing surface as soon as the notes can be written in, with the
   *  caret at the end — a note the student has just made, or come back to. */
  openOnMount?: boolean;
  /** What a click on the rendered notes does. "edit" (the default): place the caret
   *  and open the writing surface. "teach": a single click asks the tutor to explain
   *  from there (onTeach) and a double-click edits there. "select": nothing - the
   *  student is highlighting, and the clicks are placing a selection. */
  clickMode?: "edit" | "teach" | "select";
  onTeach?: (target: HTMLElement) => void;
  /** Words dictation is still hearing, shown on the open sheet's status line. */
  interim?: string;
}

export const PaperNotes = forwardRef<PaperNotesHandle, PaperNotesProps>(function PaperNotes(
  { clickMode = "edit", onTeach, md, guideKey, prose, canEdit, locked, onCommit, allowEmpty = false, placeholder, openOnMount = false, interim },
  handleRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<OneSheetHandle>(null);
  const [writing, setWriting] = useState<{ caret: number; at: number } | null>(null);
  /* Text handed to `insertText` while the sheet was still closed. It goes in the
     moment the sheet has mounted, in order. */
  const queued = useRef<string[]>([]);

  const live = canEdit && !locked;
  const blank = !md.trim();
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
  // nothing can reflow under the guide's already-measured pointer rects. Whoever
  // locks is expected to have awaited `flush` first; the sheet's own unmount
  // flush is the safety net, and it reports a failure rather than dropping it.
  useEffect(() => {
    if (live) return;
    queued.current = [];
    setWriting(null);
  }, [live]);

  // Another writer landed a new copy under an open surface.
  useEffect(() => {
    if (writing) sheetRef.current?.external(md);
  }, [md, writing]);

  // A fresh note opens ready to type in. Once only: after Escape it stays closed.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!openOnMount || autoOpened.current || !live) return;
    autoOpened.current = true;
    open(Infinity);
  }, [live, open, openOnMount]);

  // Text that arrived while the sheet was opening. The sheet's handle is attached
  // in its layout phase, so by this passive effect it is there to take it.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!writing || !sheet || !queued.current.length) return;
    for (const text of queued.current.splice(0)) sheet.insertText(text);
  }, [writing]);

  useImperativeHandle(
    handleRef,
    () => ({
      startEditing: (caret?: number) => {
        if (!live) return;
        if (writing) sheetRef.current?.focus(caret);
        else open(caret ?? 0);
      },
      stopEditing: close,
      isEditing: () => !!writing,
      // Nothing is ever unsaved while reading: only the sheet holds edits.
      flush: () => (writing && sheetRef.current ? sheetRef.current.flush() : Promise.resolve(true)),
      insertText: (text: string) => {
        if (!live || !text) return false;
        if (writing && sheetRef.current) return sheetRef.current.insertText(text);
        // Open once, however many phrases arrive before the sheet is ready.
        if (!queued.current.length) open(Infinity);
        queued.current.push(text);
        return true;
      },
      problem: () => sheetRef.current?.problem() ?? null,
    }),
    [close, live, open, writing],
  );

  const IGNORE = "a,button,input,textarea,[data-an-chrome]";
  /** Open the writing surface at the caret under `t` (the rendered notes' own click). */
  const editAt = (t: HTMLElement, sel: Selection | null) => {
    if (!live || writing) return;
    // An empty note has no units to aim at: anywhere in it is the start.
    if (blank) return open(0);
    const el = t.closest<HTMLElement>(`[${UNIT_ATTR}]`);
    if (!el || !rootRef.current?.contains(el)) return;
    // No arming, no "Edit notes" gate, no coarse-pointer bail: a tap on a phone
    // places the caret and raises the keyboard, which is what a document does.
    open(sourceOffsetAt(el, sel?.anchorNode ?? null, sel?.anchorOffset ?? 0));
  };
  // A single click waits this long for a second one: in "teach" mode one click is a
  // lesson, two are the caret, and the lesson must not start under a double-click.
  const clickTimer = useRef<number | undefined>(undefined);
  const selectedAtDown = useRef(false);
  useEffect(() => () => window.clearTimeout(clickTimer.current), []);
  const onPointerDownCapture = () => {
    const sel = window.getSelection();
    // Spent clicks: one that lets a selection go, and one that closes a writing surface
    // open elsewhere on the page (the way out of editing is a click outside it).
    selectedAtDown.current = (!!sel && !sel.isCollapsed) || !!document.querySelector("textarea[data-an-input]");
  };
  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t || t.closest(IGNORE)) return;
    const sel = window.getSelection();
    // A drag-select is the student highlighting, not a click for the editor or the tutor;
    // nor is the click that lets a selection go asking for anything.
    if ((sel && !sel.isCollapsed) || selectedAtDown.current) return;
    if (clickMode === "select") return;
    if (clickMode === "edit" || !onTeach) return editAt(t, sel);
    if (e.detail > 1) return; // the second click of a double-click: onDoubleClick's
    window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = undefined;
      onTeach(t);
    }, 240);
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    if (clickMode !== "teach") return;
    window.clearTimeout(clickTimer.current);
    clickTimer.current = undefined;
    const t = e.target as HTMLElement | null;
    if (!t || t.closest(IGNORE)) return;
    // The double-click's own word selection is not a highlight: the caret goes there.
    const sel = window.getSelection();
    const anchor = { node: sel?.anchorNode ?? null, offset: sel?.anchorOffset ?? 0 };
    sel?.removeAllRanges();
    editAt(t, anchor.node ? ({ anchorNode: anchor.node, anchorOffset: anchor.offset } as Selection) : null);
  };

  const tree = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS(sanitized)}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, NOTE_SCHEMA], [rehypeKatex, KATEX_OPTS]]}
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
          allowEmpty={allowEmpty}
          placeholder={placeholder}
          interim={interim}
          exitBadge={clickMode === "teach"}
        />
      ) : (
        <>
          <div
            className={cn(prose, live && clickMode === "edit" && "cursor-text")}
            data-guide-notes={guideKey}
            {...(live ? { "data-an-live": "" } : {})}
            onPointerDownCapture={onPointerDownCapture}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
          >
            {tree}
          </div>
          {/* Outside `data-guide-notes`, so no TreeWalker, quote finder or text
              selection in the notes can ever pick the placeholder up as notes. */}
          {blank && placeholder &&
            (live ? (
              <button
                type="button"
                onClick={() => open(0)}
                className="mx-auto block w-full max-w-[78ch] cursor-text text-left text-[16px] leading-[1.75] text-muted-foreground/60"
              >
                {placeholder}
              </button>
            ) : (
              <p className="mx-auto max-w-[78ch] text-[16px] leading-[1.75] text-muted-foreground/60">{placeholder}</p>
            ))}
        </>
      )}
    </div>
  );
});
