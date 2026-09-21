/**
 * PaperNotes — the study notes as a page you can write on.
 *
 * There is no "edit mode" and no raw-Markdown textarea. The notes render
 * exactly as they always have; clicking a line turns THAT line into a
 * transparent <textarea> sitting on top of a painted copy of its own Markdown,
 * in the same font, size, colour, measure and x-position. Everything above and
 * below stays fully rendered.
 *
 * WHY IT CANNOT CORRUPT NOTES
 *  - A commit is `notes.slice(0,start) + edited + notes.slice(end)` at offsets
 *    produced by the SAME remark pipeline that rendered the page. Nothing
 *    outside the edited line is ever read, parsed or rewritten. There is no
 *    DOM -> Markdown serialiser anywhere in this file.
 *  - Pinned `playstudy-visual` fences, tables, code blocks, `$$…$$` math
 *    (including the one-line `$$…$$` form `visualToMarkdown` writes) and any
 *    line holding a hard break are ATOMS: the caret cannot enter them.
 *  - Every candidate document goes through `guardSplice` before it is sent.
 *
 * WHAT STAYS COUPLED
 *  - `data-guide-notes` never leaves the DOM, so TeachMode, the sticky-note
 *    watcher and the sticky-jump deep link keep working — including while a
 *    line is open, which is more than today's editor manages.
 *  - No chrome is ever rendered inside a block: no placeholder text node, no
 *    line number, no drag handle, no per-block toolbar. `findQuoteRange`'s
 *    TreeWalker and `sel.toString()` therefore see exactly what they see today.
 */

import {
  type ComponentProps,
  createContext,
  forwardRef,
  type ReactNode,
  useCallback,
  useContext,
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BASE_NOTE_COMPONENTS, HEADING_COLORS, headingVars } from "@/lib/notes/render";
import {
  HUE_ATTR,
  KIND_ATTR,
  TOP_ATTR,
  UNIT_ATTR,
  flattenLine,
  guardSplice,
  inkRuns,
  reanchor,
  renderedToBuf,
  sanitizeWithMap,
  spliceUnit,
  stampUnits,
  unwrapUnit,
  type InkRun,
  type UnitKind,
} from "@/lib/notes/units";

export interface PaperNotesHandle {
  /** Open the first editable line — the keyboard and touch entry point. */
  startEditing: () => void;
  stopEditing: () => void;
  isEditing: () => boolean;
}

interface Focus {
  sanStart: number; // start offset in the sanitized string — identifies the element
  start: number; // start offset in the stored markdown
  end: number;
  kind: UnitKind;
  was: string; // the exact stored bytes this unit had when it was opened
  top: boolean; // a top-level paragraph: Enter may split it
}

interface BufValue {
  buf: string;
  caret: number;
  refocus: number;
  setBuf: (v: string) => void;
  commit: (v: string) => void;
  cancel: () => void;
  move: (delta: number) => void;
  split: (at: number) => void;
}

const FocusCtx = createContext<Focus | null>(null);
const BufCtx = createContext<BufValue | null>(null);

const inkClass = (r: InkRun) =>
  cn(
    r.syntax && "ps-syntax",
    r.strong && "ps-strong",
    r.em && "ps-em",
    r.code && "ps-code",
    r.mark && "ps-mark",
    r.link && !r.syntax && "ps-link",
  ) || undefined;

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

/* ------------------------------------------------------------------ *
 * The editing surface for one line
 * ------------------------------------------------------------------ */

function UnitEditor({ kind }: { kind: UnitKind }) {
  const ctx = useContext(BufCtx)!;
  const ref = useRef<HTMLTextAreaElement>(null);
  const runs = useMemo(() => inkRuns(ctx.buf), [ctx.buf]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const at = Math.min(ctx.caret, el.value.length);
    el.setSelectionRange(at, at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.refocus]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // don't let Teach mode's window handler close the lesson
      ctx.cancel();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (kind === "paragraph" && el.selectionStart === el.selectionEnd && el.selectionStart > 0 && el.selectionStart < el.value.length) {
        ctx.split(el.selectionStart);
      } else {
        ctx.commit(el.value);
      }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      ctx.commit(el.value);
      ctx.move(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === "ArrowUp" && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      ctx.commit(el.value);
      ctx.move(-1);
      return;
    }
    if (e.key === "ArrowDown" && el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
      e.preventDefault();
      ctx.commit(el.value);
      ctx.move(1);
    }
  };

  return (
    <>
      <span
        data-ps-ink=""
        aria-hidden="true"
        className={kind === "heading" ? "ps-h-chip box-decoration-clone rounded-md px-1.5 py-0.5" : undefined}
      >
        {runs.map((r, i) => (
          <span key={i} className={inkClass(r)}>
            {r.text}
          </span>
        ))}
      </span>
      <textarea
        ref={ref}
        data-ps-input=""
        aria-label="Edit this line of your notes. Escape cancels, Enter saves."
        value={ctx.buf}
        spellCheck
        rows={1}
        autoCapitalize="sentences"
        onChange={(e) => ctx.setBuf(flattenLine(e.target.value))}
        onBlur={(e) => ctx.commit(e.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Unit-aware renderers. Only the focused unit re-renders per keystroke,
 * because `buf` lives in its own context and nothing else consumes it.
 * ------------------------------------------------------------------ */

/* react-markdown passes the mdast node plus the hast properties as loose
   props. `node` is destructured out so it never reaches the DOM. */
type MdComponentProps = { node?: unknown; children?: ReactNode } & Record<string, unknown>;

/* Built once per source string. Extracted so the plugin tuple is typed in one
   place rather than cast at the call site. */
const REMARK_PLUGINS = (src: string): ComponentProps<typeof ReactMarkdown>["remarkPlugins"] => [
  remarkGfm,
  [remarkMath, { singleDollarTextMath: false }],
  stampUnits(src),
];

function makeUnit(Tag: "p" | "li") {
  return function Unit({ node, children, ...rest }: MdComponentProps) {
    const focus = useContext(FocusCtx);
    const raw = rest[UNIT_ATTR] as string | undefined;
    const kind = rest[KIND_ATTR] as UnitKind | undefined;
    const mine = !!raw && !!focus && kind !== "atom" && focus.sanStart === Number(raw.split(":")[0]);
    if (!mine) return <Tag {...rest}>{children}</Tag>;
    return (
      <Tag {...rest} data-ps-editing={kind}>
        <UnitEditor kind={kind!} />
      </Tag>
    );
  };
}

function makeHeading(Tag: "h2" | "h3") {
  return function Heading({ node, children, ...rest }: MdComponentProps) {
    const focus = useContext(FocusCtx);
    const raw = rest[UNIT_ATTR] as string | undefined;
    const kind = rest[KIND_ATTR] as UnitKind | undefined;
    const hue = Number(rest[HUE_ATTR] ?? 0);
    const style = headingVars(HEADING_COLORS[hue % HEADING_COLORS.length]);
    const mine = !!raw && !!focus && kind !== "atom" && focus.sanStart === Number(raw.split(":")[0]);
    if (!mine) {
      return (
        <Tag {...rest} style={style}>
          <span className="ps-h-chip box-decoration-clone rounded-md px-1.5 py-0.5">{children}</span>
        </Tag>
      );
    }
    return (
      <Tag {...rest} style={style} data-ps-editing="heading">
        <UnitEditor kind="heading" />
      </Tag>
    );
  };
}

const UNIT_COMPONENTS = {
  ...BASE_NOTE_COMPONENTS,
  p: makeUnit("p"),
  li: makeUnit("li"),
  h2: makeHeading("h2"),
  h3: makeHeading("h3"),
};

/* ------------------------------------------------------------------ *
 * PaperNotes
 * ------------------------------------------------------------------ */

export interface PaperNotesProps {
  md: string;
  /** topic.db_id — the value TeachMode and the sticky notes resolve sections by. */
  guideKey?: number;
  /** The prose class string. Identical in the reading and editing states. */
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
  const { toast } = useToast();
  const rootRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [buf, setBuf] = useState("");
  const [caret, setCaret] = useState(0);
  const [refocus, setRefocus] = useState(0);
  const [armed, setArmed] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);

  const mdRef = useRef(md);
  mdRef.current = md;
  const focusRef = useRef<Focus | null>(null);
  focusRef.current = focus;

  const coarse = useMemo(
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches,
    [],
  );

  const { sanitized, toSrc } = useMemo(() => sanitizeWithMap(md), [md]);

  /* Offsets are into the SANITIZED string the renderer parses, so they are
     mapped back before any splice. That is what keeps `<mark class="hi">` and
     other render-stripped markup intact around an edited line. */
  const editableEls = useCallback(
    () =>
      Array.from(rootRef.current?.querySelectorAll<HTMLElement>(`[${UNIT_ATTR}]`) ?? []).filter(
        (el) => el.getAttribute(KIND_ATTR) !== "atom",
      ),
    [],
  );

  const openEl = useCallback(
    (el: HTMLElement, renderedCaret?: number) => {
      const raw = el.getAttribute(UNIT_ATTR);
      const kind = el.getAttribute(KIND_ATTR) as UnitKind | null;
      if (!raw || !kind || kind === "atom") return;
      const [a, b] = raw.split(":").map(Number);
      const start = toSrc(a);
      const end = toSrc(b, true);
      const was = mdRef.current.slice(start, end);
      const next = unwrapUnit(was);
      setFocus({ sanStart: a, start, end, kind, was, top: el.hasAttribute(TOP_ATTR) });
      setBuf(next);
      setCaret(renderedCaret == null ? next.length : renderedToBuf(next, renderedCaret));
      setRefocus((n) => n + 1);
    },
    [toSrc],
  );

  /** Persist a candidate document, but only if it provably changed nothing else. */
  const persist = useCallback(
    async (f: Focus, nextBuf: string): Promise<boolean> => {
      const base = mdRef.current;
      let start = f.start;
      let end = f.end;
      if (base.slice(start, end) !== f.was) {
        // Another writer (pinVisual, the guide/ask stream, revise) landed while
        // this line was open. Find the line again instead of clobbering the body.
        const at = reanchor(base, f.was);
        if (!at) {
          setConflict(true);
          return false;
        }
        [start, end] = at;
      }
      const next = spliceUnit(base, start, end, nextBuf);
      if (!next.trim()) {
        toast({
          title: "Notes can't be emptied",
          description: "An empty body would be rewritten by the AI on your next visit.",
          variant: "destructive",
        });
        return false;
      }
      const g = guardSplice(base, next, f.was, nextBuf);
      if (!g.ok) {
        toast({ title: "That change wasn't saved", description: g.why, variant: "destructive" });
        return false;
      }
      setBusy(true);
      try {
        await onCommit(next);
        return true;
      } catch (e) {
        toast({
          title: "Couldn't save that line",
          description: e instanceof Error ? e.message : undefined,
          variant: "destructive",
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onCommit, toast],
  );

  const commit = useCallback(
    (value: string) => {
      const f = focusRef.current;
      if (!f) return;
      const nextBuf = flattenLine(value);
      if (nextBuf === f.was || (nextBuf === unwrapUnit(f.was) && nextBuf.indexOf("\n") < 0 && f.was.indexOf("\n") < 0)) {
        setFocus(null);
        return;
      }
      setFocus(null);
      void persist(f, nextBuf).then((ok) => {
        if (ok) return;
        // Keep the student's words: reopen the line with what they typed.
        setFocus(f);
        setBuf(nextBuf);
        setCaret(nextBuf.length);
        setRefocus((n) => n + 1);
      });
    },
    [persist],
  );

  const cancel = useCallback(() => {
    setFocus(null);
    setArmed(false);
  }, []);

  const move = useCallback(
    (delta: number) => {
      const f = focusRef.current;
      const els = editableEls();
      if (!els.length) return;
      const i = f ? els.findIndex((el) => Number((el.getAttribute(UNIT_ATTR) || "").split(":")[0]) === f.sanStart) : -1;
      const target = els[Math.max(0, Math.min(els.length - 1, (i < 0 ? 0 : i) + delta))];
      if (target) window.setTimeout(() => openEl(target, delta < 0 ? Number.MAX_SAFE_INTEGER : 0), 0);
    },
    [editableEls, openEl],
  );

  /** Enter mid-paragraph: split one top-level paragraph into two. */
  const split = useCallback(
    (at: number) => {
      const f = focusRef.current;
      if (!f) return;
      if (!f.top || f.kind !== "paragraph") {
        commit(buf);
        return;
      }
      const head = buf.slice(0, at).replace(/\s+$/, "");
      const tail = buf.slice(at).replace(/^\s+/, "");
      if (!head || !tail) {
        commit(buf);
        return;
      }
      setFocus(null);
      void persist(f, `${head}\n\n${tail}`);
    },
    [buf, commit, persist],
  );

  useImperativeHandle(
    handleRef,
    () => ({
      startEditing: () => {
        setArmed(true);
        const first = editableEls()[0];
        if (first) openEl(first, 0);
      },
      stopEditing: cancel,
      isEditing: () => !!focusRef.current || armed,
    }),
    [armed, cancel, editableEls, openEl],
  );

  // Teach mode takes over: close the editor so nothing can reflow under the
  // guide's already-measured pointer rects.
  useEffect(() => {
    if (locked && focusRef.current) {
      setFocus(null);
      setArmed(false);
    }
  }, [locked]);

  const onClick = (e: React.MouseEvent) => {
    if (locked || !canEdit) return;
    const t = e.target as HTMLElement | null;
    if (!t || t.closest("[data-ps-input],[data-ps-ink],a,button,input,textarea")) return;
    const sel = window.getSelection();
    // A drag-select belongs to the sticky-note flow, not to the editor.
    if (sel && !sel.isCollapsed) return;
    const el = t.closest<HTMLElement>(`[${UNIT_ATTR}]`);
    if (!el || el.getAttribute(KIND_ATTR) === "atom" || !rootRef.current?.contains(el)) return;
    if (coarse && !armed) return; // on touch, tapping reads; the Edit button arms editing
    const rendered =
      sel && sel.anchorNode && el.contains(sel.anchorNode)
        ? renderedOffsetAt(el, sel.anchorNode, sel.anchorOffset)
        : undefined;
    openEl(el, rendered);
  };

  const tree = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS(sanitized)}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={UNIT_COMPONENTS as ComponentProps<typeof ReactMarkdown>["components"]}
      >
        {sanitized}
      </ReactMarkdown>
    ),
    [sanitized],
  );

  const bufValue = useMemo<BufValue>(
    () => ({ buf, caret, refocus, setBuf, commit, cancel, move, split }),
    [buf, caret, refocus, commit, cancel, move, split],
  );

  return (
    <>
      {conflict && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" data-ps-chrome="">
          <span>These notes changed somewhere else while you were writing.</span>
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setConflict(false)}>
            Show me the new version
          </button>
        </div>
      )}
      <div
        ref={rootRef}
        className={cn(prose, canEdit && !locked && "cursor-text")}
        data-guide-notes={guideKey}
        {...(canEdit && !locked ? { "data-ps-live": "" } : {})}
        onClick={onClick}
      >
        <FocusCtx.Provider value={focus}>
          <BufCtx.Provider value={bufValue}>{tree}</BufCtx.Provider>
        </FocusCtx.Provider>
      </div>
      {busy && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground" data-ps-chrome="">
          <Loader2 className="size-3 animate-spin" /> Saving…
        </p>
      )}
    </>
  );
});
