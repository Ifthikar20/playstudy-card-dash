import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Pin, Check } from "lucide-react";
import type { VisualSpec } from "@/services/guide";
import { VISUAL_LABEL, visualKey } from "@/services/guide";
import { GuideVisual, blankVisual, canBlank } from "./GuideVisual";

/*
  The Teach mode whiteboard.

  Works like a tutor at a real whiteboard: it writes one thing — a line of maths, a
  table, a chart, a timeline, a diagram, a circuit — the voice explains it, then it
  wipes that off and shows the next. Only ever one thing is on the board at a time.
  Prose-only sections never show the board.

  Three things soften "wiped off means gone": the strip along the bottom keeps the
  last few visuals so a student can go back and re-check one, the pin saves one into
  their notes for the next revision, and the blank button hides the labels so they
  can try naming the parts from memory before revealing them again.
*/

export interface BoardHandle {
  /** Put a visual on the board (erasing whatever's there). */
  draw(spec: VisualSpec): void;
  /** Shorthand for a line of LaTeX. */
  write(latex: string, opts?: { replace?: boolean }): void;
  clear(): void;
  hide(): void;
  lastLine(): HTMLElement | null;
  visible(): boolean;
}

type Mode = "writing" | "erasing";
interface BoardItem {
  id: number;
  spec: VisualSpec;
  mode: Mode;
}

const ERASE_MS = 500;
const HISTORY_MAX = 8;
const POS_KEY = "ps-guide-board-pos";

export const GuideBoard = forwardRef<
  BoardHandle,
  { enabled?: boolean; onClose?: () => void; onPin?: (spec: VisualSpec) => Promise<void> | void }
>(function GuideBoard({ enabled = true, onClose, onPin }, ref) {
  const [item, setItem] = useState<BoardItem | null>(null);
  const [shown, setShown] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [full, setFull] = useState(false);
  const [scale, setScale] = useState(1);
  const [history, setHistory] = useState<VisualSpec[]>([]);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [blanked, setBlanked] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      return raw ? (JSON.parse(raw) as { x: number; y: number }) : null;
    } catch {
      return null;
    }
  });
  const idRef = useRef(0);
  const itemRef = useRef<BoardItem | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const shownRef = useRef(false);

  // Drag the board by its header. Coordinates are clamped to keep it on screen and
  // saved so it stays put across visuals and reloads.
  const onDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return; // let the buttons work
    const board = boardRef.current;
    if (!board || full) return;
    const rect = board.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = rect.left;
    const origY = rect.top;
    const width = rect.width;
    const clamp = (nx: number, ny: number) => ({
      x: Math.max(6, Math.min(nx, window.innerWidth - width - 6)),
      y: Math.max(6, Math.min(ny, window.innerHeight - 44)),
    });
    let last = clamp(origX, origY);
    setPos(last);
    const move = (ev: PointerEvent) => {
      last = clamp(origX + ev.clientX - startX, origY + ev.clientY - startY);
      setPos(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(last));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    e.preventDefault();
  };

  // Shrink a maths line that's wider than the board so a long equation fits. Other
  // visuals already size themselves to the board.
  useLayoutEffect(() => {
    const el = elRef.current;
    const body = bodyRef.current;
    if (!el || !body || item?.spec.kind !== "math") {
      setScale(1);
      return;
    }
    const avail = body.clientWidth - 44;
    const natural = el.scrollWidth;
    setScale(natural > avail && natural > 0 ? Math.max(0.32, avail / natural) : 1);
  }, [item?.id, full]);

  const put = (next: BoardItem | null) => {
    itemRef.current = next;
    setItem(next);
  };

  const show = (spec: VisualSpec) => {
    const next: BoardItem = { id: ++idRef.current, spec, mode: "writing" };
    // Keep the same visual on the board across consecutive steps that discuss it,
    // instead of erasing and redrawing the identical thing (which would flicker).
    if (itemRef.current && itemRef.current.mode === "writing" && visualKey(itemRef.current.spec) === visualKey(spec)) return;
    setShown(true);
    shownRef.current = true;
    setReviewing(null);
    setBlanked(false);
    setPinned(false);
    setHistory((h) => (visualKey(h[h.length - 1] ?? null) === visualKey(spec) ? h : [...h, spec].slice(-HISTORY_MAX)));
    window.clearTimeout(timer.current);
    if (itemRef.current) {
      setItem((cur) => (cur ? { ...cur, mode: "erasing" } : cur));
      timer.current = window.setTimeout(() => put(next), ERASE_MS);
    } else {
      put(next);
    }
  };

  // While the board floats over the right of the page, the notes underneath move
  // out of its way (see .guide-shift in index.css). A board the student has
  // dragged somewhere, minimized or blown up to full screen doesn't claim the
  // space - they've taken charge of the layout themselves.
  const claimsSpace = enabled && shown && !minimized && !full && !pos;
  useEffect(() => {
    document.body.classList.toggle("guide-board-open", claimsSpace);
    return () => document.body.classList.remove("guide-board-open");
  }, [claimsSpace]);

  useImperativeHandle(
    ref,
    () => ({
      draw(spec) {
        if (spec) show(spec);
      },
      write(latex, opts) {
        const clean = (latex || "").trim();
        if (clean) show({ kind: "math", data: { latex: clean, replace: opts?.replace } });
      },
      clear() {
        window.clearTimeout(timer.current);
        if (itemRef.current) {
          setItem((cur) => (cur ? { ...cur, mode: "erasing" } : cur));
          itemRef.current = null;
          timer.current = window.setTimeout(() => setItem(null), ERASE_MS);
        } else {
          setItem(null);
        }
      },
      hide() {
        window.clearTimeout(timer.current);
        setShown(false);
        shownRef.current = false;
        setReviewing(null);
        put(null);
      },
      lastLine: () => elRef.current,
      visible: () => shownRef.current,
    }),
    [],
  );

  if (!enabled || !shown) return null;

  const live = item?.spec ?? null;
  const viewing = reviewing != null ? history[reviewing] ?? live : live;
  const displayed = viewing && blanked ? blankVisual(viewing) : viewing;

  // Step back through the last few visuals and forward again. `reviewing` is an
  // index into history; null means "whatever is live on the board now", which is
  // always the last entry - so that's where stepping back starts from.
  const at = reviewing ?? history.length - 1;
  const step = (delta: number) => {
    const next = Math.max(0, Math.min(history.length - 1, at + delta));
    setReviewing(next === history.length - 1 ? null : next);
    setBlanked(false);
    setPinned(false);
  };

  const pin = async () => {
    if (!viewing || !onPin) return;
    setPinned(true);
    try {
      await onPin(viewing);
    } catch {
      setPinned(false);
    }
  };

  return (
    <div
      ref={boardRef}
      className={`guide-board${minimized ? " guide-board-min" : ""}${full ? " guide-board-full" : ""}${pos && !full ? " guide-board-moved" : ""}`}
      style={pos && !full ? { left: pos.x, top: pos.y, right: "auto", transform: "none" } : undefined}
      role="img"
      aria-label="Teach mode whiteboard"
    >
      <div className="guide-board-head" onPointerDown={onDragStart}>
        <span className="guide-board-traffic">
          <button type="button" className="guide-board-dot guide-board-dot-close" onClick={() => onClose?.()} aria-label="Close the board" title="Close" />
          <button
            type="button"
            className="guide-board-dot guide-board-dot-min"
            onClick={() => setMinimized((m) => !m)}
            aria-label={minimized ? "Expand the board" : "Minimize the board"}
            title={minimized ? "Expand" : "Minimize"}
          />
          <button
            type="button"
            className="guide-board-dot guide-board-dot-full"
            onClick={() => {
              setFull((f) => !f);
              setMinimized(false);
            }}
            aria-label={full ? "Leave full screen" : "Fill the screen"}
            title={full ? "Exit full screen" : "Full screen"}
          />
        </span>
        {minimized && live && <span className="guide-board-minlabel">{VISUAL_LABEL[live.kind]}</span>}
        {!minimized && reviewing != null && (
          <button type="button" className="guide-board-live" onClick={() => setReviewing(null)}>
            Back to live
          </button>
        )}
      </div>
      {!minimized && (
        <>
          <div className="guide-board-body" ref={bodyRef}>
            {item && displayed && (
              <div
                key={`${item.id}-${reviewing ?? "live"}-${blanked ? "b" : ""}`}
                ref={elRef}
                className="guide-board-line"
                data-mode={reviewing != null ? "writing" : item.mode}
                data-kind={displayed.kind}
                style={displayed.kind === "math" && scale !== 1 ? { transform: `scale(${scale})` } : undefined}
              >
                <GuideVisual spec={displayed} />
              </div>
            )}
          </div>
          <div className="guide-board-foot">
            <div className="guide-board-nav">
              <button
                type="button"
                className="guide-board-arrow"
                onClick={() => step(-1)}
                disabled={at === 0}
                aria-label="Previous visual"
                title="Previous"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                className="guide-board-arrow"
                onClick={() => step(1)}
                disabled={reviewing == null}
                aria-label="Back to the current visual"
                title="Next"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="guide-board-actions">
              {canBlank(viewing) && (
                <button
                  type="button"
                  className="guide-board-btn"
                  onClick={() => setBlanked((b) => !b)}
                  title={blanked ? "Show the labels again" : "Hide the labels and try to name them"}
                >
                  {blanked ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  {blanked ? "Reveal" : "Quiz me"}
                </button>
              )}
              {onPin && (
                <button type="button" className="guide-board-btn" onClick={pin} disabled={pinned} title="Keep this in your notes">
                  {pinned ? <Check className="size-3.5" /> : <Pin className="size-3.5" />}
                  {pinned ? "Pinned" : "Pin"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
});
