import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { GuidePointer, type HostRect, type MarkColor, type PointerHandle } from "@/components/guide/GuidePointer";
import { botKind } from "@/components/guide/GuideDock";
import { rectsOf } from "@/lib/guide/blocks";
import { bringIntoView, cancelAutoScroll, scrollParentOf } from "@/lib/guide/scroll";
import { Narrator, loadVoices, pickVoice, ttsAvailable } from "@/lib/guide/speech";
import { applyVoice, chosenVoice, readStored, RATE_KEY, voiceChoices, type VoiceOption } from "@/lib/guide/voice";
import { isTypingTarget } from "@/lib/useTalkKey";
import { fetchGuideVoices, synthesizeSpeech } from "@/services/guide";
import type { CheckAnswer, NoteCheck } from "@/services/notes";

/*
  The tutor going through what looks wrong in a page of notes.

  The same pink pointer as Teach mode lands on each phrase the tutor asked about, the
  question is spoken in the voice the student chose, and a bubble beside the words asks
  whether that's right: It's right / Fix it / Skip. Every question still open is
  underlined in amber, the one being asked about in pink.

  Nothing here edits the notes' DOM. The highlights are the pointer's overlays, and the
  words are found again on every placement (`locate`), because saving a fix re-renders
  the notes and any Range kept from before points at text nodes that are gone. The
  page keeps the notes locked while this is open, so the words can't move under the
  pointer for any other reason.

  It is mounted inside the page's pointer host: a positioned element that never
  scrolls itself and never carries a transform. The pointer and the bubble portal into
  it, so every coordinate here is host-relative and scrolls with the notes.
*/

/** The question bubble's widest. It is narrowed on a phone and never hangs off the page. */
const BUBBLE_W = 380;
/** Room under the phrase for the pointer (36px tall) before the bubble starts. */
const POINTER_GAP = 44;
/** Until the bubble has rendered once, this is its height for the flip decision. */
const BUBBLE_H_GUESS = 190;

export interface NoteReviewProps {
  /** The page's pointer host. Nothing is shown until it exists. */
  host: HTMLElement | null;
  /** Every check for the notes being reviewed; the answered ones are skipped. */
  checks: NoteCheck[];
  /** The check's words on screen right now, or null when they can't be found. Called
   *  on every placement, so it must look them up fresh (findQuoteRange / locateQuote). */
  locate: (check: NoteCheck) => Range | null;
  /** Record It's right / Skip. Resolve once `checks` will reflect it; reject to keep the question. */
  onAnswer: (check: NoteCheck, answer: CheckAnswer) => Promise<void>;
  /** Apply `check.fix`. Reject (with a message) when it couldn't be applied. */
  onFix: (check: NoteCheck) => Promise<void>;
  /** Finish later, Escape, or nothing left to ask. */
  onClose: () => void;
  /** The tutor's voice, when the page already knows it; otherwise the student's saved choice. */
  speaker?: VoiceOption | null;
}

/* ------------------------------------------------------------ pure helpers */

export interface BubbleBox {
  x: number;
  y: number;
  width: number;
  /** Drawn upwards from `y` (translateY(-100%)) instead of down from it. */
  above: boolean;
}

/**
 * Where the question bubble goes for a phrase at `target` (host coordinates).
 *
 * - Width: BUBBLE_W, or the host's width less a margin on a narrow screen.
 * - x: under the phrase, clamped so the whole bubble stays inside the host (anything
 *   past its right edge would give the whole app a sideways scrollbar).
 * - Below the phrase (leaving room for the pointer) when it fits in the visible part of
 *   the scroller, otherwise above - unless there is even less room above.
 *
 * `spaceBelow` / `spaceAbove` are measured in the viewport against the real scroll
 * parent, not the window: the page scrolls inside the shell's frame.
 */
export function placeBubble(opts: {
  target: HostRect;
  hostWidth: number;
  bubbleHeight: number;
  spaceBelow: number;
  spaceAbove: number;
}): BubbleBox {
  const { target, hostWidth, bubbleHeight, spaceBelow, spaceAbove } = opts;
  const width = Math.max(160, Math.min(BUBBLE_W, hostWidth - 16));
  const x = Math.max(8, Math.min(target.x, hostWidth - width - 8));
  const need = POINTER_GAP + bubbleHeight + 8;
  const below = spaceBelow >= need || spaceBelow >= spaceAbove;
  return { x, width, above: !below, y: below ? target.y + target.h + POINTER_GAP : target.y - 12 };
}

/**
 * The open checks in the order a reader meets them. Found phrases go by their place in
 * the document; a check whose words are gone comes after them all, so the student
 * deals with everything on the page before being told something has disappeared.
 */
export function readingOrder<T>(items: T[], rangeOf: (item: T) => Range | null): T[] {
  const placed = items.map((item, i) => {
    let range: Range | null = null;
    try {
      range = rangeOf(item);
    } catch {
      range = null;
    }
    return { item, range, i };
  });
  placed.sort((a, b) => {
    if (a.range && b.range) {
      try {
        return a.range.compareBoundaryPoints(Range.START_TO_START, b.range) || a.i - b.i;
      } catch {
        return a.i - b.i;
      }
    }
    if (a.range) return -1;
    if (b.range) return 1;
    return a.i - b.i;
  });
  return placed.map((p) => p.item);
}

const sameBox = (a: BubbleBox | null, b: BubbleBox | null) =>
  !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.above === b.above;

/** The block a Range sits in, for scrolling to it. */
function anchorOf(range: Range): Element | null {
  const node = range.startContainer;
  const el = node instanceof Element ? node : node.parentElement;
  return el?.closest("[data-guide-block],p,li,h1,h2,h3,h4,td,th") ?? el;
}

/** Our own overlays (the pointer's layer, this bubble): changes inside them are not the notes changing. */
function isOverlay(node: Node | null): boolean {
  const el = node instanceof Element ? node : node?.parentElement;
  return !!el?.closest("[data-guide-layer],[data-note-review]");
}

/* ---------------------------------------------------------------- component */

export function NoteReview({ host, checks, locate, onAnswer, onFix, onClose, speaker }: NoteReviewProps) {
  const { toast } = useToast();
  const pointer = useRef<PointerHandle | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const narrator = useRef<Narrator | null>(null);
  const voicesReady = useRef<Promise<void>>(Promise.resolve());
  const browserVoices = useRef<SpeechSynthesisVoice[]>([]);

  // Answered here but maybe not yet in `checks` (the page's store update lands a
  // render later): never ask the same question twice.
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [bubble, setBubble] = useState<BubbleBox | null>(null);
  /** Whether the current check's words are on screen; null until the first placement. */
  const [found, setFound] = useState<boolean | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState<CheckAnswer | null>(null);
  const [voice, setVoice] = useState<VoiceOption | null>(speaker ?? null);

  const open = useMemo(() => checks.filter((c) => !c.answer && !done.has(c.id)), [checks, done]);
  const current = open.find((c) => c.id === currentId) ?? null;

  // Refs for the listeners and async work below, so none of them run on stale props.
  const locateRef = useRef(locate);
  locateRef.current = locate;
  const openRef = useRef(open);
  openRef.current = open;
  const currentRef = useRef(current);
  currentRef.current = current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const placeSoon = useRef<(() => void) | null>(null);
  const answeredAny = useRef(false);
  const closed = useRef(false);

  const safeLocate = useCallback((c: NoteCheck): Range | null => {
    try {
      return locateRef.current(c);
    } catch {
      return null; // a section that re-rendered mid-lookup: treat as not found this time
    }
  }, []);

  // ------------------------------------------------------------ which question
  // Always the first open one in reading order: the ones before it have been answered,
  // so this walks the page top to bottom.
  useEffect(() => {
    if (currentId && open.some((c) => c.id === currentId)) return;
    const next = readingOrder(open, safeLocate)[0] ?? null;
    setCurrentId(next?.id ?? null);
    setFound(null);
    setBubble(null);
  }, [open, currentId, safeLocate]);

  const finish = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    narrator.current?.cancel();
    onCloseRef.current();
  }, []);

  // Nothing left to ask: say so (only if they answered something here) and hand back.
  useEffect(() => {
    if (open.length) return;
    if (answeredAny.current) toast({ title: "That's everything", description: "Your notes are up to date." });
    finish();
  }, [open.length, finish, toast]);

  // ------------------------------------------------------------------ the voice
  useEffect(() => {
    const n = new Narrator({ onCaption: () => undefined });
    n.rate = readStored<number>(RATE_KEY, 1);
    narrator.current = n;
    let alive = true;
    voicesReady.current = (async () => {
      try {
        const [server, browser] = await Promise.all([fetchGuideVoices(), ttsAvailable() ? loadVoices() : Promise.resolve([])]);
        if (!alive) return;
        browserVoices.current = browser;
        n.available = ttsAvailable() && browser.length > 0;
        n.voice = pickVoice(browser);
        const voices = server.provider !== "browser" ? server.voices : [];
        if (voices.length) n.useServer(synthesizeSpeech);
        const choice = speakerRef.current ?? chosenVoice(voiceChoices(voices, browser), server.default);
        if (choice) {
          applyVoice(n, choice, browser);
          setVoice(choice);
        }
      } catch {
        /* no voice list: the narrator speaks with the browser's default, or paces silently */
      }
    })();
    return () => {
      alive = false;
      n.dispose();
      if (narrator.current === n) narrator.current = null;
      cancelAutoScroll();
    };
  }, []);

  // The page may learn the voice later (or the student changes it): follow it.
  const speakerId = speaker?.id;
  useEffect(() => {
    const chosen = speakerRef.current;
    if (!chosen) return;
    setVoice(chosen);
    if (narrator.current) applyVoice(narrator.current, chosen, browserVoices.current);
  }, [speakerId]);

  // Say the question once its words are on screen. A question about words that have
  // gone isn't read out: the bubble explains instead.
  const question = current?.question ?? "";
  useEffect(() => {
    if (!currentId || found !== true || !question) return;
    let cancelled = false;
    void (async () => {
      await voicesReady.current;
      const n = narrator.current;
      if (cancelled || !n) return;
      setSpeaking(true);
      await n.speak(question);
      if (!cancelled) setSpeaking(false);
    })();
    return () => {
      cancelled = true;
      narrator.current?.cancel();
      setSpeaking(false);
    };
  }, [currentId, found, question]);

  // ------------------------------------------------------ pointer and bubble
  useEffect(() => {
    if (!host || !currentId) return;
    let cancelled = false;
    let frame = 0;
    let arrived: { x: number; y: number } | null = null;

    const place = () => {
      const cur = currentRef.current;
      const p = pointer.current;
      if (cancelled || !cur || !p) return;
      const hostBox = host.getBoundingClientRect();
      const toHost = (r: DOMRect): HostRect => ({ x: r.left - hostBox.left, y: r.top - hostBox.top, w: r.width, h: r.height });

      // Every open question is underlined; the one being asked about first, so its
      // highlighter sweep is the one that plays straight away.
      const range = safeLocate(cur);
      const lines = range ? rectsOf(range) : [];
      const marks: Array<HostRect & { color: MarkColor }> = lines.map((r) => ({ ...toHost(r), color: "pink" }));
      for (const other of openRef.current) {
        if (other.id === cur.id) continue;
        const r = safeLocate(other);
        if (r) rectsOf(r).forEach((line) => marks.push({ ...toHost(line), color: "yellow" }));
      }
      p.underline(marks);

      const bubbleHeight = bubbleRef.current?.offsetHeight || BUBBLE_H_GUESS;
      const box = range?.getBoundingClientRect();
      if (!range || !box || !lines.length || (box.width === 0 && box.height === 0)) {
        // Mid-answer the words may be gone for a moment (a fix has landed, and the
        // next question hasn't taken over yet): keep the bubble as it is.
        if (busyRef.current) return;
        // The words are gone (fixed by hand, or the tutor misquoted them). Say so where
        // the student is looking: at the top of the visible part of the notes.
        p.focus(null);
        setFound(false);
        const port = scrollParentOf(host)?.getBoundingClientRect();
        const top = Math.max(0, (port ? port.top : 0) - hostBox.top) + 16;
        const next = placeBubble({
          target: { x: (host.clientWidth - BUBBLE_W) / 2, y: top, w: 0, h: 0 },
          hostWidth: host.clientWidth,
          bubbleHeight,
          spaceBelow: Infinity,
          spaceAbove: 0,
        });
        next.y = top;
        setBubble((prev) => (sameBox(prev, next) ? prev : next));
        return;
      }
      setFound(true);

      const ring = toHost(box);
      p.focus(ring, cur.kind === "wrong" ? "pink" : "orange");

      // Rest just under the start of the phrase. The first time for this question it
      // flies there and presses; after that (a resize, a re-render) it only follows.
      const first = toHost(lines[0]);
      const at = { x: first.x + Math.min(first.w, 90), y: first.y + first.h + 2 };
      if (!arrived) p.moveTo(at, { gesture: "press" });
      else if (Math.hypot(at.x - arrived.x, at.y - arrived.y) > 2) p.moveTo(at, { gesture: "none", duration: 260 });
      arrived = at;

      const port = scrollParentOf(anchorOf(range) ?? host)?.getBoundingClientRect();
      const next = placeBubble({
        target: ring,
        hostWidth: host.clientWidth,
        bubbleHeight,
        spaceBelow: (port ? port.bottom : window.innerHeight) - box.bottom,
        spaceAbove: box.top - (port ? port.top : 0),
      });
      setBubble((prev) => (sameBox(prev, next) ? prev : next));
    };

    const schedule = () => {
      if (frame || cancelled) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };
    placeSoon.current = schedule;

    // Bring the phrase to reading height first, then point (the pointer's coordinates
    // are host-relative, so they hold while the page scrolls; the bubble's flip does not).
    const range = safeLocate(currentRef.current!);
    const anchor = range && anchorOf(range);
    let timer = 0;
    if (range && anchor) {
      void bringIntoView(anchor, range.getBoundingClientRect(), { align: 0.4 }).then(() => !cancelled && place());
      timer = window.setTimeout(place, 420); // in case the scroll is cancelled by the student
    } else {
      place();
    }

    // Anything that moves the words moves the pointer: the window, the sidebar folding,
    // quizzes and flashcards opening above, and the notes re-rendering after a save.
    window.addEventListener("resize", schedule);
    const sizes = new ResizeObserver(schedule);
    sizes.observe(host);
    const edits = new MutationObserver((records) => {
      const ours = (m: MutationRecord) =>
        isOverlay(m.target) ||
        (m.type === "childList" && [...Array.from(m.addedNodes), ...Array.from(m.removedNodes)].every(isOverlay));
      if (!records.every(ours)) schedule();
    });
    edits.observe(host, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("resize", schedule);
      sizes.disconnect();
      edits.disconnect();
      if (placeSoon.current === schedule) placeSoon.current = null;
    };
  }, [host, currentId, safeLocate]);

  // New checks from the page (an answer saved, a fix applied) can move or remove
  // underlines even when nothing resized. And once the bubble has rendered, place it
  // again with its real height (the first flip decision used a guess).
  const bubbleShown = bubble !== null;
  useEffect(() => {
    placeSoon.current?.();
  }, [checks, open.length, bubbleShown]);

  // Keyboard: the first button takes focus when a question appears (without scrolling
  // the page to it), and Escape means "finish later".
  const focusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!bubble || !currentId || focusedFor.current === currentId) return;
    focusedFor.current = currentId;
    bubbleRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [bubble, currentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || isTypingTarget(e.target)) return;
      e.preventDefault();
      finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  // ------------------------------------------------------------------ answers
  const act = async (choice: CheckAnswer) => {
    const check = currentRef.current;
    if (!check || busy) return;
    narrator.current?.cancel();
    setSpeaking(false);
    setBusy(choice);
    try {
      if (choice === "fixed") await onFix(check);
      else await onAnswer(check, choice);
      answeredAny.current = true;
      setDone((prev) => new Set(prev).add(check.id));
    } catch (e) {
      toast({
        title: choice === "fixed" ? "Couldn't fix that" : "Couldn't save that",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  if (!host || !current) return null;
  const left = open.length;

  return (
    <>
      <GuidePointer
        ref={pointer}
        host={host}
        speaking={speaking}
        caption={null}
        speaker={voice && { name: voice.name, kind: botKind(voice) }}
      />
      {bubble &&
        createPortal(
          <div
            ref={bubbleRef}
            data-note-review=""
            className="an-note-ask absolute z-[80]"
            style={{ left: bubble.x, top: bubble.y, width: bubble.width, transform: bubble.above ? "translateY(-100%)" : undefined }}
            role="dialog"
            aria-label="A question about your notes"
          >
            {found === false ? (
              <>
                <p className="text-sm leading-relaxed">I can't find these words any more.</p>
                <p className="mt-1 text-xs text-muted-foreground">“{current.quote}”</p>
              </>
            ) : (
              <p className="text-sm leading-relaxed" aria-live="polite">
                {current.question}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {found !== false && (
                <Button size="sm" variant="outline" onClick={() => void act("kept")} disabled={!!busy}>
                  {busy === "kept" ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Check className="mr-1.5 size-3.5" />}
                  It's right
                </Button>
              )}
              {found !== false && current.fix && (
                <Button size="sm" onClick={() => void act("fixed")} disabled={!!busy} title={`Change it to: ${current.fix}`}>
                  {busy === "fixed" && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                  Fix it
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => void act("skipped")} disabled={!!busy}>
                {busy === "skipped" && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Skip
              </Button>
            </div>
            {found !== false && current.fix && <p className="mt-2 text-xs text-muted-foreground">Fix: “{current.fix}”</p>}
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
              <span>
                {left} {left === 1 ? "question" : "questions"} left
              </span>
              <button
                type="button"
                onClick={finish}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <X className="size-3" />
                Finish later
              </button>
            </div>
          </div>,
          host,
        )}
    </>
  );
}
