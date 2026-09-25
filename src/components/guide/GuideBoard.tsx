import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Pin, Check, Flag, Layers, X } from "lucide-react";
import type { VisualKind, VisualSpec } from "@/services/guide";
import { VISUAL_LABEL, reportPicture, visualKey } from "@/services/guide";
import { blockPicture, canShowPicture, onBlockedChange } from "@/lib/guide/blocked";
import { BOARD_IMAGE } from "@/lib/guide/boardParts";
import { GuideVisual, blankVisual, canBlank } from "./GuideVisual";

/*
  The Teach mode whiteboard.

  Works like a tutor at a real whiteboard: it writes one thing — a line of maths, a
  table, a chart, a timeline, a diagram, a circuit — the voice explains it, then it
  wipes that off and shows the next. Only ever one thing is on the board at a time,
  with one exception: while a real picture is up, a list, a card of facts, a table or
  a formula about its subject can go on a frosted card over it (draw with `over`), so
  the student keeps looking at the thing while reading about it. The same picture
  drawn again takes the card away; anything else replaces both. Prose-only sections
  never show the board.

  Three things soften "wiped off means gone": the strip along the bottom keeps the
  last few visuals so a student can go back and re-check one, the pin saves one into
  their notes for the next revision, and the blank button hides the labels so they
  can try naming the parts from memory before revealing them again.

  And while a picture is up, "Wrong picture" reports it: it fades out with a thank
  you, the server blocks it for everyone, and it's taken out of this tab at once - the
  board, its history, the lesson's later steps and any pinned copy (lib/guide/blocked).
  The lesson carries on.

  The board also holds the section's study tools: its quiz at the end of a section, and
  its flashcards from the footer's Flashcards button. Those open as a panel, which is
  state, not a visual: it goes in place of whatever is drawn, never enters the history
  (so it can't be pinned, blanked or reported), and when it closes the board shows what
  it showed before. The board only frames it (a head naming it, a close button, room to
  scroll); what goes inside comes from `renderPanel`, so the board knows nothing about
  quizzes. It is real UI the student works in, so the board is a region, not a picture:
  only the visual on it is an image.
*/

/** A study tool open on the board, in place of the visual. */
export interface BoardPanel {
  /** invite: the end-of-section "Quiz time" (Start quiz · Skip for now); quiz: the quiz
   *  itself; flashcards: the section's cards. */
  kind: "quiz" | "flashcards" | "invite";
  /** The section, by TeachSection.topicId. */
  topicId: string;
  /** The section's title, for the head: "Quiz · {title}". */
  title: string;
  /** The section's quiz is already done: its invitation says so, rather than "Quiz time". */
  done?: boolean;
}

/** What the head says while a panel is up. */
const panelHeading = (p: BoardPanel): string =>
  `${p.kind === "flashcards" ? "Flashcards" : p.kind === "invite" && !p.done ? "Quiz time" : "Quiz"} · ${p.title}`;

export interface BoardHandle {
  /** Put a visual on the board (erasing whatever's there). False when that visual was
   *  already up - it stays, and a list just moves its highlight to the new focus.
   *  `over`: a list, facts, a table or a formula goes on a card over the picture
   *  instead, when a real picture is up (see picture()); otherwise it's drawn as usual.
   *  The picture drawn again while a card is over it takes the card away (false). */
  draw(spec: VisualSpec, opts?: { over?: boolean }): boolean;
  /** Shorthand for a line of LaTeX. */
  write(latex: string, opts?: { replace?: boolean }): void;
  clear(): void;
  hide(): void;
  lastLine(): HTMLElement | null;
  /** The element showing `spec`, once it's really up: not while the previous visual is
   *  still being wiped off, not a copy the student is reviewing, and not a picture with
   *  a card over it. Null until then. */
  showing(spec: VisualSpec): HTMLElement | null;
  /** Whatever is live on the board right now (the card, when one is over the picture;
   *  never a copy being reviewed), for a step that names a part of it without drawing
   *  anything new. */
  live(): HTMLElement | null;
  /** The live picture's element when a real one is up - loaded, not reported, not a
   *  copy being reviewed, not being wiped off - whether or not a card is over it. What
   *  a card can go over; null otherwise. */
  picture(): HTMLElement | null;
  visible(): boolean;
  /** Open a study tool on the board, in place of whatever is drawn there (which comes
   *  back when it closes). The board shows even if nothing was drawn, and a minimized
   *  one opens up. Opening another panel replaces this one; the same section's panel
   *  keeps its contents (an invitation taken up carries on as the quiz). False when the
   *  board is switched off. `focus`: move the keyboard into it, for a panel the student
   *  opened themselves (never one the lesson puts up while they may be pressing Space). */
  openPanel(panel: BoardPanel, opts?: { focus?: boolean }): boolean;
  /** Close the panel, if one is up: the board goes back to what it showed before. */
  closePanel(): void;
  /** The panel that's up, or null. */
  panel(): BoardPanel | null;
  /** The panel's element (null while there's none). */
  panelEl(): HTMLElement | null;
}

type Mode = "writing" | "erasing";
interface BoardItem {
  id: number;
  spec: VisualSpec;
  mode: Mode;
}

/** A reported picture fading out: a still copy of what was on the board, and the thank you. */
interface Ghost {
  id: string;
  src: string;
  w: number;
  h: number;
  note: string;
}

const ERASE_MS = 500;
/** How long a reported picture's thank you stays (the picture itself fades in the first half). */
const GHOST_MS = 2400;
const HISTORY_MAX = 8;
const POS_KEY = "an-guide-board-pos";
/** Where the board stops floating and becomes a sheet along the bottom (index.css). */
const SHEET_QUERY = "(max-width: 900px)";
/** What can go on a card over a picture: words and numbers about its subject, never another drawing. */
const CARD_KINDS: ReadonlySet<VisualKind> = new Set<VisualKind>(["list", "facts", "table", "math"]);

export const GuideBoard = forwardRef<
  BoardHandle,
  {
    enabled?: boolean;
    title?: string;
    onClose?: () => void;
    onPin?: (spec: VisualSpec) => Promise<void> | void;
    /** Draws what goes inside a panel (Teach mode, from the page's study tools). */
    renderPanel?: (panel: BoardPanel) => ReactNode;
    /** The panel was closed from the board itself: its close button, Esc, or the board switched off. */
    onPanelClose?: (panel: BoardPanel) => void;
    /** The footer's Flashcards button, for the section being taught; left out when it has none. */
    onFlashcards?: () => void;
  }
>(function GuideBoard({ enabled = true, title, onClose, onPin, renderPanel, onPanelClose, onFlashcards }, ref) {
  const [item, setItem] = useState<BoardItem | null>(null);
  // The card over the picture (Part C of the pictures plan), when there is one.
  const [card, setCard] = useState<BoardItem | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [shown, setShown] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [full, setFull] = useState(false);
  // A long equation is shrunk to fit: by how much, and how much room that frees on each
  // side (a transform doesn't change the space a box takes, so that space is handed back
  // with negative margins - otherwise the board scrolls sideways at the full width).
  const [scale, setScale] = useState({ s: 1, dx: 0, dy: 0 });
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
  // Below 900px the board is a sheet along the bottom with a set place (index.css):
  // a spot it was dragged to on a wider screen doesn't apply there (it would squash
  // the sheet between that top and its bottom edge), and the sheet isn't dragged.
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(SHEET_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(SHEET_QUERY);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const placed = narrow ? null : pos;
  const idRef = useRef(0);
  const itemRef = useRef<BoardItem | null>(null);
  const cardRef = useRef<BoardItem | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const cardElRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const cardTimer = useRef<number | undefined>(undefined);
  const ghostTimer = useRef<number | undefined>(undefined);
  const ghostId = useRef<string | null>(null);
  // The live visual is being wiped off for the next one: it's no longer "up".
  const wiping = useRef(false);
  const shownRef = useRef(false);
  const reviewingRef = useRef<number | null>(null);
  reviewingRef.current = reviewing;
  const historyRef = useRef<VisualSpec[]>(history);
  historyRef.current = history;
  // Whether a visual can actually be seen right now (for visible()).
  const onScreen = useRef(false);
  onScreen.current = enabled && !minimized;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // The study tool open on the board, if any (see BoardPanel).
  const [panel, setPanel] = useState<BoardPanel | null>(null);
  const panelRef = useRef<BoardPanel | null>(null);
  const panelElRef = useRef<HTMLDivElement | null>(null);
  // Whether the board was up before the panel opened: closing it puts it back that way.
  const shownBeforePanel = useRef(false);
  // Move the keyboard into the panel once it's on screen (see openPanel).
  const focusPanel = useRef(false);
  const onPanelCloseRef = useRef(onPanelClose);
  onPanelCloseRef.current = onPanelClose;

  /** How far down the board's top may go: its bar stays on screen, and with a quiz or
   *  cards open (their buttons are at the bottom) the whole board does. */
  const lowestTop = (height: number) =>
    panelRef.current ? window.innerHeight - height - 6 : window.innerHeight - 44;

  // Drag the board by its header. Coordinates are clamped to keep it on screen and
  // saved so it stays put across visuals and reloads.
  const onDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return; // let the buttons work
    const board = boardRef.current;
    if (!board || full || narrow) return;
    const rect = board.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = rect.left;
    const origY = rect.top;
    const width = rect.width;
    const clamp = (nx: number, ny: number) => ({
      x: Math.max(6, Math.min(nx, window.innerWidth - width - 6)),
      y: Math.max(6, Math.min(ny, lowestTop(rect.height))),
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
  // visuals already size themselves to the board (and a formula on a card scrolls).
  useLayoutEffect(() => {
    const el = elRef.current;
    const body = bodyRef.current;
    if (!el || !body || item?.spec.kind !== "math") {
      setScale({ s: 1, dx: 0, dy: 0 });
      return;
    }
    const avail = body.clientWidth - 44;
    const natural = el.scrollWidth;
    const s = natural > avail && natural > 0 ? Math.max(0.32, avail / natural) : 1;
    // offsetWidth/Height: the box before the transform, which is what takes the space
    setScale({ s, dx: ((1 - s) * el.offsetWidth) / 2, dy: ((1 - s) * el.offsetHeight) / 2 });
  }, [item?.id, full]);

  const put = (next: BoardItem | null) => {
    wiping.current = false;
    itemRef.current = next;
    setItem(next);
  };

  /** A new visual comes up: the board shows, back to live, labels on, not yet pinned. */
  const freshStart = () => {
    setShown(true);
    shownRef.current = true;
    setReviewing(null);
    setBlanked(false);
    setPinned(false);
  };

  const remember = (spec: VisualSpec) =>
    setHistory((h) => (visualKey(h[h.length - 1] ?? null) === visualKey(spec) ? h : [...h, spec].slice(-HISTORY_MAX)));

  const dropGhost = () => {
    window.clearTimeout(ghostTimer.current);
    ghostId.current = null;
    setGhost(null);
  };

  /** Take the card off the picture: faded out, or gone at once. */
  const dropCard = (fade = true) => {
    const cur = cardRef.current;
    cardRef.current = null;
    if (!cur) return;
    window.clearTimeout(cardTimer.current);
    if (!fade) {
      setCard(null);
      return;
    }
    setCard((c) => (c ? { ...c, mode: "erasing" } : c));
    cardTimer.current = window.setTimeout(() => setCard(null), ERASE_MS);
  };

  /** A card over the picture; a card already there fades out first. */
  const showCard = (next: BoardItem) => {
    window.clearTimeout(cardTimer.current);
    const had = cardRef.current;
    cardRef.current = next;
    if (had) {
      setCard((c) => (c ? { ...c, mode: "erasing" } : c));
      cardTimer.current = window.setTimeout(() => {
        if (cardRef.current === next) setCard(next);
      }, ERASE_MS);
    } else {
      setCard(next);
    }
  };

  /** A real picture is the live visual: not being wiped off, not taken away. */
  const pictureIsUp = () => {
    const base = itemRef.current;
    return !!base && !wiping.current && base.spec.kind === "image" && canShowPicture(base.spec.data);
  };

  const show = (spec: VisualSpec): boolean => {
    // Keep the same visual on the board across consecutive steps that discuss it,
    // instead of erasing and redrawing the identical thing (which would flicker).
    // A list stays up the same way; only its highlight moves to the item now being
    // explained (same id, so it isn't redrawn and keeps its ticks).
    const cur = itemRef.current;
    if (cur && cur.mode === "writing" && !wiping.current && visualKey(cur.spec) === visualKey(spec)) {
      if (spec.kind === "list") put({ ...cur, spec });
      return false;
    }
    const next: BoardItem = { id: ++idRef.current, spec, mode: "writing" };
    freshStart();
    dropGhost();
    remember(spec);
    window.clearTimeout(timer.current);
    if (itemRef.current) {
      wiping.current = true;
      setItem((c) => (c ? { ...c, mode: "erasing" } : c));
      // a picture taken away while the last one was being wiped off never comes up
      timer.current = window.setTimeout(() => put(next.spec.kind === "image" && !canShowPicture(next.spec.data) ? null : next), ERASE_MS);
    } else {
      put(next);
    }
    return true;
  };

  const draw = (spec: VisualSpec, opts?: { over?: boolean }): boolean => {
    // Only a checked picture that hasn't been taken away ever goes up.
    if (spec.kind === "image" && !canShowPicture(spec.data)) return false;
    const top = cardRef.current;
    // The card that's up already stays (a list's highlight moves on).
    if (top && visualKey(top.spec) === visualKey(spec)) {
      if (spec.kind === "list") {
        const moved = { ...top, spec };
        cardRef.current = moved;
        setCard(moved);
      }
      return false;
    }
    if (opts?.over && CARD_KINDS.has(spec.kind) && pictureIsUp()) {
      freshStart();
      remember(spec);
      showCard({ id: ++idRef.current, spec, mode: "writing" });
      return true;
    }
    const base = itemRef.current;
    if (top && base && !wiping.current && visualKey(base.spec) === visualKey(spec)) {
      // Pointing back at the picture: the card over it fades out, the picture is all there is.
      dropCard();
      setReviewing(null);
      setBlanked(false);
      setPinned(false);
      remember(spec); // what's live is always the history's last entry
      return false;
    }
    // A new picture, or anything that isn't a card, replaces everything.
    dropCard();
    return show(spec);
  };

  // ---- the panel: a study tool in place of the visual ---------------------------
  // The visual (and a card over it, and a copy being reviewed) stays where it is
  // underneath, only not drawn, so closing the panel simply brings it back.
  const openPanel = (next: BoardPanel, opts?: { focus?: boolean }): boolean => {
    if (!enabledRef.current) return false;
    if (!panelRef.current) shownBeforePanel.current = shownRef.current;
    panelRef.current = next;
    setPanel(next);
    focusPanel.current = !!opts?.focus;
    setShown(true);
    shownRef.current = true;
    setMinimized(false); // it's something to do now, so it can't sit rolled up in the title bar
    return true;
  };

  /** Take the panel down: the board shows what it did before, or goes away if it wasn't up. */
  const closePanel = () => {
    if (!panelRef.current) return;
    panelRef.current = null;
    setPanel(null);
    focusPanel.current = false;
    if (!shownBeforePanel.current && !itemRef.current) {
      setShown(false);
      shownRef.current = false;
    }
  };

  /** Closed from the board itself (its ×, Esc, the board switched off): the lesson hears of it. */
  const dismissPanel = () => {
    const was = panelRef.current;
    if (!was) return;
    closePanel();
    onPanelCloseRef.current?.(was);
  };

  // A panel the student opened takes the keyboard, so Space and the arrows work the
  // quiz or the cards (Teach mode leaves keys inside .guide-board-panel alone).
  useEffect(() => {
    const el = panelElRef.current;
    if (!panel || !focusPanel.current || !el) return;
    focusPanel.current = false;
    if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [panel, minimized]);

  // The board switched off (or closed with its red dot) takes the panel with it.
  useEffect(() => {
    if (!enabled) dismissPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismissPanel reads refs only
  }, [enabled]);

  // A picture taken away (reported here, or anywhere in this tab, or no longer vouched
  // for by the server) leaves the board, its history and the card over it at once.
  const onBlocked = useRef<() => void>(() => undefined);
  onBlocked.current = () => {
    const ok = (s: VisualSpec) => s.kind !== "image" || canShowPicture(s.data);
    if (!historyRef.current.every(ok)) {
      setHistory((h) => h.filter(ok));
      setReviewing(null);
    }
    const base = itemRef.current;
    if (base && base.spec.kind === "image" && !canShowPicture(base.spec.data)) {
      dropCard(false);
      setBlanked(false);
      // Already being wiped off for the next visual: that one still comes up on time
      // (its timer is the one below - clearing it would leave the board empty while the
      // voice talks about what's on it).
      if (wiping.current) return;
      window.clearTimeout(timer.current);
      if (ghostId.current && ghostId.current === base.spec.data.picture_id) {
        put(null); // reported here: its still copy is already fading in its place
      } else {
        wiping.current = false;
        itemRef.current = null;
        setItem((c) => (c ? { ...c, mode: "erasing" } : c));
        timer.current = window.setTimeout(() => setItem(null), ERASE_MS);
      }
    }
  };
  useEffect(() => onBlockedChange(() => onBlocked.current()), []);

  // The picture the student can actually see on the board (its picture_id): its <img>
  // decoded and in place. "Wrong picture" is offered only for that one - not while it's
  // still loading, and not when the server couldn't be asked about it and the board was
  // left empty. A report blocks a picture for everyone, so it must be about one they saw.
  const [seenId, setSeenId] = useState<string | null>(null);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) {
      setSeenId(null);
      return;
    }
    const check = () => {
      const img = body.querySelector<HTMLImageElement>(BOARD_IMAGE);
      setSeenId(img && img.complete && img.naturalWidth > 0 ? (img.dataset.pictureId ?? null) : null);
    };
    check();
    const mo = new MutationObserver(check);
    mo.observe(body, { childList: true, subtree: true });
    // an <img>'s load doesn't bubble, but it passes the body on its way down
    body.addEventListener("load", check, true);
    return () => {
      mo.disconnect();
      body.removeEventListener("load", check, true);
    };
  }, [enabled, shown, minimized]);

  // While the board floats over the right of the page, the notes underneath move
  // out of its way (see .guide-shift in index.css). A board the student has
  // dragged somewhere, minimized or blown up to full screen doesn't claim the
  // space - they've taken charge of the layout themselves.
  const claimsSpace = enabled && shown && !minimized && !full && !placed;
  useEffect(() => {
    document.body.classList.toggle("guide-board-open", claimsSpace);
    return () => document.body.classList.remove("guide-board-open");
  }, [claimsSpace]);

  // A picture gets a wider board, so its parts are big enough to point at (see
  // .guide-board[data-kind="image"] in index.css), and the notes make room for that.
  // A reported picture keeps it while it fades, then the board narrows again.
  const reviewed = reviewing != null ? history[reviewing] ?? null : null;
  const fading = !item && !!ghost;
  // (A panel isn't a picture: the board keeps its usual width while one is up.)
  const onBoardKind = panel ? undefined : ((reviewed ?? item?.spec)?.kind ?? (fading ? "image" : undefined));
  const wide = enabled && shown && !minimized && onBoardKind === "image";
  useEffect(() => {
    document.body.classList.toggle("guide-board-wide", wide);
    return () => document.body.classList.remove("guide-board-wide");
  }, [wide]);

  // A board dragged near the right edge is pushed off screen when it widens for a
  // picture (or the window narrows): pull it back in. Not saved as its place - the
  // student's own drag is, and it may fit again once the picture is gone.
  // A visual may hang below the window with just its bar showing, but a quiz or a
  // deck of cards is worked with its buttons at the bottom, so while one is open the
  // whole board comes up into view.
  useEffect(() => {
    const board = boardRef.current;
    if (!board || !placed || full) return;
    const pull = () => {
      // Only a board that really floats over the window can be pulled into it. One
      // held in place by its surroundings (a preview drawing it inline) never moves,
      // so asking again and again would never settle.
      if (getComputedStyle(board).position !== "fixed") return;
      const r = board.getBoundingClientRect();
      const x = Math.max(6, Math.min(r.left, window.innerWidth - r.width - 6));
      const y = Math.max(6, Math.min(r.top, lowestTop(r.height)));
      if (Math.abs(x - r.left) <= 0.5 && Math.abs(y - r.top) <= 0.5) return;
      // The same place again is no change: no new render, so no new round of this.
      setPos((p) => (p && Math.abs(p.x - x) <= 0.5 && Math.abs(p.y - y) <= 0.5 ? p : { x, y }));
    };
    pull();
    const ro = new ResizeObserver(pull);
    ro.observe(board);
    window.addEventListener("resize", pull);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", pull);
    };
  }, [placed, full, shown, minimized, enabled, panel]); // enabled: a board turned off and on again is a new element to watch

  useImperativeHandle(
    ref,
    () => ({
      draw(spec, opts) {
        return spec ? draw(spec, opts) : false;
      },
      write(latex, opts) {
        const clean = (latex || "").trim();
        if (clean) draw({ kind: "math", data: { latex: clean, replace: opts?.replace } });
      },
      clear() {
        dropCard();
        window.clearTimeout(timer.current);
        wiping.current = false;
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
        dropCard(false);
        dropGhost();
        setShown(false);
        shownRef.current = false;
        setReviewing(null);
        put(null);
        // a panel goes too: a new section starts on a clean board
        panelRef.current = null;
        focusPanel.current = false;
        setPanel(null);
      },
      // the part being talked about (a list's highlighted item), else the whole visual -
      // on the card, when one is over the picture
      lastLine: () => {
        const c = cardElRef.current;
        const el = c && c.dataset.mode === "writing" ? c : elRef.current;
        return el?.querySelector<HTMLElement>("[data-board-focus]") ?? el;
      },
      showing: (spec) => {
        const key = visualKey(spec);
        const c = cardElRef.current;
        if (c && c.dataset.mode === "writing" && c.dataset.visualKey === key) return c;
        const el = elRef.current;
        if (!el || el.dataset.mode !== "writing" || el.dataset.visualKey !== key) return null;
        // A picture under a card isn't all there - nor under one still fading out, which
        // would cover the part the pointer is about to touch.
        return cardRef.current || c?.isConnected ? null : el;
      },
      live: () => {
        const c = cardElRef.current;
        if (c && c.dataset.mode === "writing" && c.dataset.visualKey) return c;
        const el = elRef.current;
        return el && el.dataset.mode === "writing" && el.dataset.visualKey ? el : null;
      },
      picture: () => {
        if (reviewingRef.current != null || !pictureIsUp()) return null;
        const el = elRef.current;
        if (!el || el.dataset.mode !== "writing" || !el.dataset.visualKey) return null;
        const img = el.querySelector<HTMLImageElement>(BOARD_IMAGE);
        return img && img.complete && img.naturalWidth > 0 ? el : null;
      },
      visible: () => shownRef.current && onScreen.current,
      openPanel,
      closePanel,
      panel: () => panelRef.current,
      panelEl: () => panelElRef.current,
    }),
    [],
  );

  if (!enabled || !shown) return null;

  const cardUp = reviewing == null && !!card;
  const liveTop = card?.spec ?? item?.spec ?? null;
  // What the buttons act on: the copy being reviewed, else the card, else the live visual.
  const viewing = reviewed ?? (card && card.mode === "writing" ? card.spec : null) ?? item?.spec ?? null;
  const baseSpec = reviewed ?? item?.spec ?? null;
  const baseShown = baseSpec && blanked && !cardUp ? blankVisual(baseSpec) : baseSpec;
  const cardShown = card ? (blanked ? blankVisual(card.spec) : card.spec) : null;
  // The picture a "Wrong picture" report is about: the one up on the board (live or
  // reviewed), once it's really there to be seen (seenId).
  const reportable =
    baseSpec?.kind === "image" && canShowPicture(baseSpec.data) && seenId === baseSpec.data.picture_id ? baseSpec.data : null;

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

  // "Wrong picture": a still copy fades out with a thank you while the picture itself is
  // taken out of this tab at once (lib/guide/blocked) and reported to the server, which
  // blocks it for everyone. It's gone here even if the report doesn't get through.
  const report = async () => {
    if (!reportable || ghost) return;
    const img = elRef.current?.querySelector<HTMLImageElement>(BOARD_IMAGE);
    const r = img?.getBoundingClientRect();
    const g: Ghost = {
      id: reportable.picture_id,
      src: img?.currentSrc || img?.src || "",
      w: r?.width ?? 0,
      h: r?.height ?? 0,
      note: "Thanks — removed for everyone",
    };
    window.clearTimeout(ghostTimer.current);
    ghostId.current = g.id;
    setGhost(g);
    blockPicture(reportable);
    ghostTimer.current = window.setTimeout(() => {
      if (ghostId.current === g.id) dropGhost();
    }, GHOST_MS);
    const taken = await reportPicture(g.id);
    if (!taken && ghostId.current === g.id) setGhost((cur) => (cur ? { ...cur, note: "Removed here — the report didn't go through" } : cur));
  };

  return (
    <div
      ref={boardRef}
      className={`guide-board${minimized ? " guide-board-min" : ""}${full ? " guide-board-full" : ""}${placed && !full ? " guide-board-moved" : ""}`}
      style={placed && !full ? { left: placed.x, top: placed.y, right: "auto", transform: "none" } : undefined}
      data-kind={onBoardKind}
      data-panel={panel?.kind}
      role="region"
      aria-label="Lesson whiteboard"
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
        {/* The window's own title, centred like a Mac window: the section being taught,
            what's open on it ("Quiz · Cells"), or - once it's rolled up into the title
            bar - what is on the board. */}
        <span className="guide-board-name" title={(panel ? panelHeading(panel) : title) || undefined}>
          {panel ? panelHeading(panel) : minimized && liveTop ? VISUAL_LABEL[liveTop.kind] : title || "AnotherNotes"}
        </span>
        {!minimized && !panel && reviewing != null && (
          <button type="button" className="guide-board-live" onClick={() => setReviewing(null)}>
            Back to live
          </button>
        )}
        {panel && (
          <button
            type="button"
            className="guide-board-panel-close"
            onClick={dismissPanel}
            // Esc here closes the panel, as it does inside it (Teach mode leaves this
            // button's keys alone too, see STUDY_TOOL), never the whole lesson.
            onKeyDown={(e) => {
              if (e.key !== "Escape" || e.defaultPrevented) return;
              e.preventDefault();
              dismissPanel();
            }}
            aria-label={panel.kind === "flashcards" ? "Close the flashcards" : "Close the quiz"}
            title="Close"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {/* Minimized, a panel stays mounted (hidden) so a quiz half done isn't lost. */}
      {(!minimized || panel) && (
        <div className="guide-board-body" ref={bodyRef} style={minimized ? { display: "none" } : undefined}>
          {panel ? (
            // Keyed by the section alone: the invitation taken up carries on as the quiz.
            // Not a .guide-board-line, so none of the board's handwriting type or sweeps.
            <div
              key={`panel-${panel.topicId}`}
              ref={panelElRef}
              className="guide-board-panel"
              data-panel-kind={panel.kind}
              tabIndex={-1}
              role="group"
              aria-label={panelHeading(panel)}
              onKeyDown={(e) => {
                if (e.key !== "Escape" || e.defaultPrevented) return;
                e.preventDefault();
                dismissPanel();
              }}
            >
              {renderPanel?.(panel)}
            </div>
          ) : (
            <>
              {item && baseShown && (
                <div
                  key={`${item.id}-${reviewing ?? "live"}-${blanked && !cardUp ? "b" : ""}`}
                  ref={elRef}
                  className="guide-board-line"
                  data-mode={reviewing != null ? "writing" : item.mode}
                  data-kind={baseShown.kind}
                  data-visual-key={reviewing == null ? visualKey(item.spec) : undefined}
                  role="img"
                  aria-label={VISUAL_LABEL[baseShown.kind]}
                  style={
                    baseShown.kind === "math" && scale.s !== 1
                      ? { transform: `scale(${scale.s})`, margin: `${-scale.dy}px ${-scale.dx}px` }
                      : undefined
                  }
                >
                  <GuideVisual spec={baseShown} />
                </div>
              )}
              {/* The card over the picture: frosted, bottom-centre, scrolls when it's long. */}
              {cardUp && card && cardShown && (
                <div
                  key={`card-${card.id}-${blanked ? "b" : ""}`}
                  ref={cardElRef}
                  className="guide-board-line guide-board-overlay"
                  data-card=""
                  data-mode={card.mode}
                  data-kind={cardShown.kind}
                  data-visual-key={visualKey(card.spec)}
                  role="img"
                  aria-label={VISUAL_LABEL[cardShown.kind]}
                >
                  <GuideVisual spec={cardShown} />
                </div>
              )}
              {!item && ghost && !!ghost.src && (
                <div className="guide-board-ghost" aria-hidden>
                  <img src={ghost.src} alt="" style={ghost.w && ghost.h ? { width: ghost.w, height: ghost.h } : undefined} />
                </div>
              )}
              {ghost && (
                <div className="guide-board-gone" role="status">
                  {ghost.note}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* While a panel is up the footer goes: its buttons are all about the visual. */}
      {!minimized && !panel && (
        <div className="guide-board-foot">
          <div className="guide-board-nav">
            <button
              type="button"
              className="guide-board-arrow"
              onClick={() => step(-1)}
              disabled={at <= 0}
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
            {/* The section's own flashcards, on the board; closing them brings this visual back. */}
            {onFlashcards && (
              <button
                type="button"
                className="guide-board-btn"
                onClick={onFlashcards}
                aria-label="Flashcards"
                title="Flashcards for this section"
              >
                <Layers className="size-3.5" />
                <span className="guide-board-btn-label">Flashcards</span>
              </button>
            )}
            {/* Not "Quiz me": the section's quiz is its own thing. This only hides the labels. */}
            {canBlank(viewing) && (
              <button
                type="button"
                className="guide-board-btn"
                onClick={() => setBlanked((b) => !b)}
                aria-label={blanked ? "Show labels" : "Hide labels"}
                title={blanked ? "Show the labels again" : "Hide the labels and try to name them"}
              >
                {blanked ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                <span className="guide-board-btn-label">{blanked ? "Show labels" : "Hide labels"}</span>
              </button>
            )}
            {onPin && viewing && (
              <button type="button" className="guide-board-btn" onClick={pin} disabled={pinned} title="Keep this in your notes">
                {pinned ? <Check className="size-3.5" /> : <Pin className="size-3.5" />}
                {pinned ? "Pinned" : "Pin"}
              </button>
            )}
            {reportable && !ghost && (
              <button
                type="button"
                className="guide-board-btn guide-board-report"
                onClick={() => void report()}
                aria-label="Wrong picture: remove it for everyone"
                title="This picture is wrong for the lesson: remove it for everyone"
              >
                <Flag className="size-3.5" />
                <span className="guide-board-report-label">Wrong picture</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
