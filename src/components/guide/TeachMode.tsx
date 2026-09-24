import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useAppStore } from "@/store/appStore";
import { usePresenceStore } from "@/store/presenceStore";
import {
  fetchGuideVoices,
  fetchImageParts,
  imagePartsContext,
  prefetchImageParts,
  streamGuideAnswer,
  streamGuideScript,
  synthesizeSpeech,
  transcribeAudio,
  visualOf,
  type GuideImage,
  type GuidePoint,
  type GuideRegion,
  type GuideStep,
  type GuideTurn,
  type GuideVoice,
  type GuideVoices,
  type VisualSpec,
} from "@/services/guide";
import { updateTopicDetails } from "@/services/api";
import {
  BLOCKS_ROOT_ATTR,
  BLOCK_ATTR,
  findBlockEl,
  findQuoteRange,
  indexBlocks,
  rectsOf,
  type GuideBlock,
} from "@/lib/guide/blocks";
import { bringIntoView, cancelAutoScroll, installScrollTakeover } from "@/lib/guide/scroll";
import {
  Narrator,
  splitSentences,
  browserVoiceName,
  browserVoicePair,
  createNativeRecognizer,
  loadVoices,
  micBlockedByInsecurePage,
  pickVoice,
  secureUrlForThisPage,
  startRecording,
  sttSupport,
  voiceGender,
  type Recognizer,
  type Recording,
  type VoiceGender,
} from "@/lib/guide/speech";
import { GuidePointer, type Gesture, type MarkColor, type PointerHandle } from "./GuidePointer";
import { GuideDock, botKind, type GuidePhase } from "./GuideDock";
import {
  RATES,
  RATE_KEY,
  VOICE_KEY,
  applyVoice,
  browserVoiceFor,
  chosenVoice,
  readStored,
  readVoicePref,
  voiceChoices,
  writeStored,
  type VoiceOption,
} from "@/lib/guide/voice";
import { GuideBoard, type BoardHandle } from "./GuideBoard";
import { prefetchGuideImage } from "./GuideImage";
import { trackAction } from "@/lib/analytics";
import { matchesVoiceKey, voiceKeyLabel } from "@/lib/voiceKey";
import { useTalkKey } from "@/lib/useTalkKey";
import { visualToMarkdown } from "./GuideVisual";
import {
  BOARD_IMAGE,
  hostPt,
  labelSchedule,
  locatePart,
  partGesture,
  pointAtPart,
  restBeside,
  restSpot,
  spotOf,
  aimPoint,
  type PartSpot,
  type Pt,
  type ScheduledPart,
} from "@/lib/guide/boardParts";

/*
  Teach mode — AnotherNotes AI takes the wheel and teaches you your own notes.

  Open it from the "Teach mode" button. For the section you're looking at it
  asks the backend for a spoken, step-by-step script (streamed, so it starts
  talking within a second or two). For every step it scrolls the page at a
  human pace, flies the pink pointer to the block being discussed, underlines
  the quoted words and reads the explanation aloud. Scripts occasionally go back
  to an earlier block to connect ideas, then carry on. When a section is done it
  points at that section's quiz and pauses so you can take it; press play to
  move on. Tap the mic (or type) to ask anything: the answer streams back, is
  spoken as it arrives while the pointer jumps to the relevant part, and then
  the walkthrough resumes. Click any paragraph to continue from there; scroll
  yourself and Teach mode yields, then picks the page back up on the next step.

  (Internally the modules are still called "guide".)
*/

/** Just enough of a topic to find its notes in the store's tree. */
interface NotedTopic {
  id: string;
  notes?: string | null;
  subtopics?: NotedTopic[];
}

export interface TeachSection {
  topicId: string;
  dbId: number;
  title: string;
  index: number;
}

/**
 * What the lesson walks through: the session's notes, or the uploaded PDF itself,
 * one page per section (dbId -N for page N, which the backend knows as a PDF page).
 */
export type TeachSource = "notes" | "pdf";

/** Said when the lesson moves on to the next page of a PDF; taking turns. */
const PAGE_TURN_LINES = [(n: number) => `On to page ${n}.`, (n: number) => `Page ${n} now.`, (n: number) => `Turning to page ${n}.`];

interface ScriptEntry {
  steps: GuideStep[];
  done: boolean;
  error: string | null;
  blocks: GuideBlock[];
  waiters: Array<() => void>;
}

const NOT_READY = new Set(["notes-missing", "notes-empty"]);
/** Said while the pointer lands on a note the answer just added; taking turns, so it never sounds canned. */
const NOTE_ADDED_LINES = [
  "Right here, in your notes.",
  "It's in your notes now, just here.",
  "I've written it into your notes, here.",
  "You'll find it here whenever you come back.",
];
let noteAddedCount = 0;
const QUIZ_ATTR = "data-guide-quiz";
const QUIZ_BUTTON_ATTR = "data-guide-quiz-button";

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const blockNum = (id: string | null) => (id ? Number(id.slice(1)) : -1);

interface AskOptions {
  /** Don't show the question in the dock or keep it in the conversation history. */
  hidden?: boolean;
  /** The block the question is about (defaults to the current step's block). */
  block?: string | null;
  sectionIndex?: number;
  /** Where to resume once the answer is spoken; null = past the end of the section. */
  resumeAt?: (run: number) => Promise<number | null>;
}

/** Index just past the last sentence end in `s`, or 0 if there isn't one yet. */
/** A fragment of the answer's JSON header (block/quote/visual…) must never be read aloud or
 *  captioned. The backend strips the header itself; this is the last line of defence. */
function looksLikeGuideJson(s: string): boolean {
  return /^\s*[[{]\s*"/.test(s) || /"(block|quote|in_notes|visual|kind|items|label|detail|title|point)"\s*:/.test(s);
}

function lastSentenceEnd(s: string): number {
  const re = /[.!?…]["”’)]?(?=\s)|\n/g;
  let end = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) end = m.index + m[0].length;
  return end;
}

const speakMs = (text: string, rate: number) => Math.max(1500, (text.split(/\s+/).length * 340) / rate);
/** Roughly how long one sentence takes to say, with no floor: for moving partway into it. */
const lineMs = (text: string, rate: number) => (text.split(/\s+/).length * 340) / rate;
/** Close enough that re-sending the pointer there would be a no-op (host px). */
const near = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) < 1.5;

export function TeachMode({
  sessionId,
  sections,
  hostRef,
  onClose,
  boardEnabled = true,
  onBoardClose,
  source = "notes",
}: {
  sessionId: string;
  sections: TeachSection[];
  hostRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  boardEnabled?: boolean;
  onBoardClose?: () => void;
  source?: TeachSource;
}) {
  const pdf = source === "pdf";
  const { toast } = useToast();
  const [phase, setPhase] = useState<GuidePhase>("loading");
  const [caption, setCaption] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [interim, setInterim] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ step: 0, count: 0, title: "" });
  const [askOpen, setAskOpen] = useState(false);
  const [rate, setRateState] = useState<number>(() => {
    const r = readStored<number>(RATE_KEY, 1);
    return RATES.includes(r) ? r : 1;
  });
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [serverVoices, setServerVoices] = useState<GuideVoice[]>([]);
  const [voicesReady, setVoicesReady] = useState(false);
  const [greeting, setGreeting] = useState(false); // a newly picked tutor saying hello
  const [voiceId, setVoiceIdState] = useState<string | null>(() => readVoicePref()?.id ?? null);
  const sttMode = useMemo(() => sttSupport(), []);
  // The student's own talk key (onboarding / Settings) opens the mic, and sends. The
  // shared hook owns the rule for when it counts: a plain key never fires while they
  // type, a key with a modifier fires anywhere. `actions` is set further down; the
  // hook only calls this on a keypress, long after.
  const voiceKey = useTalkKey(() => actions.current?.mic());

  // Mutable state for the async flows — refs, so callbacks never go stale.
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const voiceKeyRef = useRef(voiceKey);
  voiceKeyRef.current = voiceKey;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const runRef = useRef(0); // bumping this cancels whatever loop is running
  const secRef = useRef(0);
  const stepRef = useRef(0);
  const scripts = useRef(new Map<number, ScriptEntry>());
  const narrator = useRef<Narrator | null>(null);
  const pointer = useRef<PointerHandle | null>(null);
  const board = useRef<BoardHandle | null>(null);
  const history = useRef<GuideTurn[]>([]);
  const recognizer = useRef<Recognizer | null>(null);
  const recording = useRef<Recording | null>(null);
  const askAbort = useRef<AbortController | null>(null);
  const actions = useRef<{
    togglePlay(): void;
    next(): void;
    prev(): void;
    mic(): void;
    cancelListening(): void;
    close(): void;
    continueFrom(sectionIndex: number, blockId: string): void;
    pause(): void;
  }>();

  const notesRoot = (sec: TeachSection) =>
    hostRef.current?.querySelector<HTMLElement>(`[${BLOCKS_ROOT_ATTR}="${sec.dbId}"]`) ?? null;
  const quizTarget = (sec: TeachSection): HTMLElement | null => {
    const card = hostRef.current?.querySelector<HTMLElement>(`[${QUIZ_ATTR}="${sec.dbId}"]`) ?? null;
    return card?.querySelector<HTMLElement>(`[${QUIZ_BUTTON_ATTR}]`) ?? card;
  };
  const cancelled = (run: number) => run !== runRef.current;
  const wake = (e: ScriptEntry) => e.waiters.splice(0).forEach((fn) => fn());

  // ---- scripts ----------------------------------------------------------------
  /** The (possibly still streaming) script for a section; kicks off the request once. */
  const ensureScript = (sec: TeachSection): ScriptEntry => {
    const have = scripts.current.get(sec.dbId);
    if (have) return have;
    const root = notesRoot(sec);
    if (!root) return { steps: [], done: true, error: "notes-missing", blocks: [], waiters: [] };
    const blocks = indexBlocks(root);
    if (!blocks.length) return { steps: [], done: true, error: "notes-empty", blocks: [], waiters: [] };
    const entry: ScriptEntry = { steps: [], done: false, error: null, blocks, waiters: [] };
    scripts.current.set(sec.dbId, entry);
    const outline = sectionsRef.current.filter((s) => s.dbId !== sec.dbId).map((s) => s.title);
    streamGuideScript(
      sessionId,
      sec.dbId,
      { title: sec.title, blocks: blocks.map(({ id, kind, text }) => ({ id, kind, text })), outline },
      {
        onStep: (step) => {
          entry.steps.push(step);
          if (entry.steps.length <= 2) narrator.current?.prefetch(step.say, 1); // first words ready before we get there
          wake(entry);
        },
      },
    )
      .then(() => {
        entry.done = true;
        wake(entry);
      })
      .catch((err: unknown) => {
        entry.error = err instanceof Error ? err.message : "AnotherNotes AI couldn't prepare this section.";
        entry.done = true;
        scripts.current.delete(sec.dbId); // so pressing play tries again
        wake(entry);
      });
    return entry;
  };

  const waitForStep = async (entry: ScriptEntry, k: number, run: number): Promise<GuideStep | null> => {
    for (;;) {
      if (entry.steps[k]) return entry.steps[k];
      if (entry.done) return null;
      await new Promise<void>((resolve) => entry.waiters.push(resolve));
      if (cancelled(run)) return null;
    }
  };

  // ---- pointing & scrolling --------------------------------------------------------
  const hostPoint = (x: number, y: number) => {
    const hr = hostRef.current!.getBoundingClientRect();
    return { x: x - hr.left, y: y - hr.top };
  };
  const hostRect = (r: DOMRect) => {
    const o = hostPoint(r.left, r.top);
    return { x: o.x, y: o.y, w: r.width, h: r.height };
  };

  /** Highlighter colour by what kind of block this is, so marks vary and mean something. */
  const colorFor = (el: HTMLElement): MarkColor => {
    const tag = el.tagName;
    if (tag === "LI") return "green";
    if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4") return "orange";
    if (el.parentElement?.tagName === "BLOCKQUOTE") return "blue";
    return "yellow";
  };

  // While the pointer is on something on the whiteboard, this undoes the "stay on the
  // board" listeners (see pointToBoard). Every other kind of pointing calls it first.
  const boardAnchor = useRef<(() => void) | null>(null);
  // Bumped whenever the pointer leaves what it was doing on the board, so a part lookup
  // that answers after the lesson has moved on can't pull the pointer back.
  const boardSeq = useRef(0);
  // Called with each sentence as the voice starts it, while the board is being explained
  // (pointToBoard moves from part to part as each is named), and the last one started,
  // for a hook that's only set once the step is already being spoken.
  const captionHook = useRef<((sentence: string) => void) | null>(null);
  const lastCaption = useRef<string | null>(null);
  const releaseBoard = () => {
    boardSeq.current++;
    boardAnchor.current?.();
    boardAnchor.current = null;
    captionHook.current = null;
  };

  /**
   * The explainer goes to the board and points at the exact part being talked about -
   * the third colour band, side c, the resistor. Each part named in `points` is found on
   * screen (a picture's from the regions the server located, a drawn visual's from its
   * data-board-part anchors; a list's highlighted item when none is named), ringed
   * tightly and touched with the tip, and as the voice names the next part the pointer
   * moves on to it. When nothing can be found (the locator is off, a name is ambiguous)
   * the whole visual is outlined and the pointer glides once to rest just outside its
   * bottom-left corner and stays still: a press at a random spot would claim a part
   * nobody located.
   *
   * The board is fixed to the screen, so the page isn't scrolled for it. Whenever
   * anything moves - the page scrolls, the window or the board resizes, the board
   * finishes sliding in - the pointer re-aims, so it stays on the part rather than
   * riding off with the notes. The next step about the notes brings it back.
   */
  const pointToBoard = async (
    el: HTMLElement,
    first: boolean,
    points: GuidePoint[],
    run: number,
    talk: { say?: string; image?: GuideImage | null } = {},
  ) => {
    const p = pointer.current;
    const host = hostRef.current;
    if (!p || !host) return;
    releaseBoard();
    cancelAutoScroll();
    p.clearUnderline();
    const seq = boardSeq.current;
    const live = () => !cancelled(run) && boardSeq.current === seq && el.isConnected;
    const img = el.querySelector<HTMLImageElement>(BOARD_IMAGE);
    const whole: HTMLElement = img ?? el;
    const wanted = (points ?? []).filter((pt) => pt && typeof pt.label === "string" && pt.label.trim()).slice(0, 3);
    // A list's highlighted item is the part being explained, even when the step names none.
    const focusEl = wanted.length ? null : el.querySelector<HTMLElement>("[data-board-focus]");
    const count = wanted.length || (focusEl ? 1 : 0);
    let regions: Record<string, GuideRegion> = {};
    const boardBox = () => el.closest<HTMLElement>(".guide-board")?.getBoundingClientRect() ?? null;

    /** Part i on screen right now, or null. Measured afresh every time: things move. */
    const partAt = (i: number): PartSpot | null => {
      if (i < 0 || i >= count) return null;
      if (!wanted.length) return focusEl ? spotOf(focusEl) : null;
      return locatePart(el, wanted[i], regions);
    };
    /** Where the tip goes for part i (host px): on it, or beside the whole visual when it isn't found. */
    const aimFor = (i: number): { spot: PartSpot | null; tip: Pt } | null => {
      const spot = partAt(i);
      if (spot) return { spot, tip: hostPt(host, aimPoint(spot.box, spot.at, spot.exact)) };
      const r = whole.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      return { spot: null, tip: hostPt(host, restSpot(r)) };
    };

    let want = 0; // the part the voice is on
    let sentTo: Pt | null = null; // where the tip was last sent (host px)
    let resting = false; // beside the whole visual rather than on a part
    let circled = !first; // a fresh visual gets one loop round its first part, then taps
    /** "arrive": a real move, with a gesture. "follow": the same target moved on screen, catch up quietly. */
    const go = (i: number, mode: "arrive" | "follow") => {
      const aim = aimFor(i);
      if (!aim) return;
      const board = boardBox();
      if (aim.spot) {
        let gesture: Gesture = "none";
        if (mode === "arrive") {
          gesture = partGesture(aim.spot.box, !circled);
          if (gesture === "circle") circled = true;
        }
        pointAtPart(p, host, aim.spot, { gesture, board, duration: mode === "follow" ? 240 : undefined });
        resting = false;
      } else {
        // Already resting beside it: stay exactly where it is rather than glide there again.
        if (mode === "arrive" && resting && sentTo && near(sentTo, aim.tip)) return;
        restBeside(p, host, whole.getBoundingClientRect(), { board, duration: mode === "follow" ? 240 : 900 });
        resting = true;
      }
      sentTo = aim.tip;
    };

    // A picture's parts come from the server's locator. Usually they're in already
    // (asked for while the step before was being spoken); if not, the whole picture is
    // outlined while we wait a little, and an answer that comes later still counts for
    // as long as this step is being explained.
    let late: Promise<Record<string, GuideRegion>> | null = null;
    if (img && wanted.length) {
      // The address exactly as the server issued it (the locator only works on those,
      // and it's what the prefetch asked with), not the browser's normalised img.src.
      const url = talk.image?.url || img.getAttribute("src") || img.currentSrc;
      const lookup = fetchImageParts(
        url,
        wanted.map((w) => w.label),
        imagePartsContext({ image: talk.image ?? null, say: talk.say ?? "" }),
      );
      let got = await Promise.race([lookup, sleep(150).then(() => null)]);
      if (!live()) return;
      if (!got) {
        const r = img.getBoundingClientRect();
        if (r.width >= 2 && r.height >= 2) p.focus(hostRect(r), "pink", { above: true });
        got = await Promise.race([lookup, sleep(1650).then(() => null)]);
        if (!live()) return;
      }
      if (got) regions = got;
      else late = lookup;
    }

    // Moving from part to part as each is named. A lesson step's words are known in
    // advance, so the moves are planned from them (and timed partway into a sentence
    // when the name comes late in it); an answer streams in, so it's followed sentence
    // by sentence, moving whenever one mentions a part.
    const say = talk.say?.trim() ? talk.say : null;
    const sentences = say ? splitSentences(say) : [];
    const plan: ScheduledPart[] = say && wanted.length > 1 ? labelSchedule(say, wanted) : [];
    let heard = 0;
    const timers: number[] = [];
    const moveOn = (i: number) => {
      if (!live() || i === want) return;
      want = i;
      go(i, "arrive");
    };
    const onSentence = (sentence: string) => {
      if (!live() || wanted.length < 2) return;
      let due: ScheduledPart[];
      if (say) {
        let idx = sentences.indexOf(sentence, heard);
        if (idx < 0) idx = sentences.indexOf(sentence);
        if (idx < 0) return;
        heard = idx;
        due = plan.filter((e) => e.sentence === idx);
      } else {
        due = labelSchedule(sentence, wanted).filter((e) => e.heard);
      }
      for (const e of due) {
        const ms = e.at < 0.12 ? 0 : e.at * lineMs(sentence, rateRef.current);
        if (ms > 0) timers.push(window.setTimeout(() => moveOn(e.point), ms));
        else moveOn(e.point);
      }
    };
    // The voice may already be a sentence or two in (the picture took a moment): start
    // on the part it has reached, not the first.
    if (plan.length && lastCaption.current) {
      const idx = sentences.indexOf(lastCaption.current);
      if (idx > 0) {
        heard = idx;
        for (const e of plan) if (e.sentence < idx || (e.sentence === idx && e.at < 0.12)) want = e.point;
      }
    }
    go(want, "arrive");
    captionHook.current = onSentence;
    if (late) {
      void late.then((found) => {
        if (!live() || !Object.keys(found).length) return;
        regions = found;
        go(want, "arrive");
      });
    }

    // Stay on the part while things move. One re-aim per frame at most, and only when
    // the target really moved - re-sending the same spot would cut a gesture short.
    let raf = 0;
    const reaim = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!live()) return;
        const aim = aimFor(want);
        if (!aim || (sentTo && near(sentTo, aim.tip))) return;
        go(want, "follow");
      });
    };
    const boardEl = el.closest<HTMLElement>(".guide-board");
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(reaim) : null;
    if (boardEl) ro?.observe(boardEl);
    if (img) ro?.observe(img);
    window.addEventListener("scroll", reaim, { capture: true, passive: true });
    window.addEventListener("resize", reaim, { passive: true });
    boardEl?.addEventListener("animationend", reaim);
    boardEl?.addEventListener("transitionend", reaim);
    boardAnchor.current = () => {
      window.removeEventListener("scroll", reaim, { capture: true });
      window.removeEventListener("resize", reaim);
      boardEl?.removeEventListener("animationend", reaim);
      boardEl?.removeEventListener("transitionend", reaim);
      ro?.disconnect();
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
    };
  };

  /**
   * Resolves once the board and what's on it have stopped moving - sliding in, widening
   * for a picture, a drawing writing itself on - or after `ms`. Measured mid-animation,
   * the tip would land a few pixels off the part.
   */
  const settled = async (el: HTMLElement, ms = 700) => {
    const boardEl = el.closest<HTMLElement>(".guide-board");
    const moving = [...(boardEl?.getAnimations?.() ?? []), ...(el.getAnimations?.({ subtree: true }) ?? [])].filter(
      (a) => a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity,
    );
    if (moving.length) await Promise.race([Promise.all(moving.map((a) => a.finished.catch(() => undefined))), sleep(ms)]);
  };

  /**
   * The board element showing `spec` once it's really there and still: after the
   * previous visual has been wiped off, for a picture once it has loaded, and once it
   * has stopped animating. Null when the board is off or minimized, when no picture
   * was found, or when it doesn't come in time.
   */
  const boardTarget = async (spec: VisualSpec, run: number): Promise<HTMLElement | null> => {
    const limit = Date.now() + (spec.kind === "image" ? 6000 : 1500);
    while (!cancelled(run) && board.current?.visible()) {
      const el = board.current.showing(spec);
      if (el) {
        const img = spec.kind === "image" ? el.querySelector<HTMLImageElement>(BOARD_IMAGE) : null;
        if (spec.kind !== "image" || (img?.complete && img.naturalWidth > 0)) {
          await settled(el);
          return !cancelled(run) && el.isConnected ? el : null;
        }
        if (!img && !el.querySelector(".guide-image-spinner")) return null; // no picture found
      }
      if (Date.now() > limit) return null;
      await sleep(120);
    }
    return null;
  };

  /** Scroll to and point at an arbitrary element (e.g. a heading or the quiz button). */
  const pointToElement = (el: HTMLElement, gesture: Gesture = "click", color: MarkColor = "pink") => {
    const p = pointer.current;
    if (!p || !hostRef.current) return;
    releaseBoard();
    const r = el.getBoundingClientRect();
    void bringIntoView(el, r, { align: 0.4 });
    p.clearUnderline();
    const around = hostRect(r);
    p.focus(around, color);
    p.moveTo(hostPoint(r.left + Math.min(r.width * 0.5, 60), r.top + r.height * 0.55), { gesture, around });
  };

  /** Scroll to, fly the pointer to, and underline `quote` inside a block. */
  const pointAt = (sec: TeachSection, blockId: string | null, quote: string, glideMs = 0) => {
    const host = hostRef.current;
    const p = pointer.current;
    if (!host || !p) return;
    releaseBoard(); // back from the board to the notes
    const root = notesRoot(sec);
    if (!root) {
      p.clearUnderline();
      return;
    }
    if (!blockId) {
      // A framing/recap step with no particular block: rest on the section title (a
      // PDF page's first heading), or the first real block — never the whole container.
      const heading =
        host.querySelector<HTMLElement>(`#section-${CSS.escape(sec.topicId)} h2`) ??
        (pdf ? root.querySelector<HTMLElement>(`h2[${BLOCK_ATTR}]`) : null) ??
        root.querySelector<HTMLElement>(`[${BLOCK_ATTR}]`) ??
        root;
      pointToElement(heading, Math.random() < 0.6 ? "circle" : "double", "orange");
      return;
    }
    let el = findBlockEl(root, blockId);
    if (!el) {
      // React re-rendered the notes and dropped our ids — re-index (same order, same ids).
      const fresh = indexBlocks(root);
      const entry = scripts.current.get(sec.dbId);
      if (entry) entry.blocks = fresh;
      el = findBlockEl(root, blockId);
    }
    if (!el) {
      p.clearUnderline();
      return;
    }
    let range = quote ? findQuoteRange(el, quote) : null;
    if (quote && !range) {
      // The phrase isn't in this block (rendered text can differ a little from
      // what the model saw): follow it to the block that does contain it, so the
      // underline always sits under the words being spoken about.
      for (const other of Array.from(root.querySelectorAll<HTMLElement>(`[${BLOCK_ATTR}]`))) {
        if (other === el) continue;
        const r = findQuoteRange(other, quote);
        if (r) {
          el = other;
          range = r;
          break;
        }
      }
    }
    const rects = rectsOf(range ?? el);
    const first = rects[0];
    if (!first) return;
    const color = colorFor(el);
    const blockRect = hostRect(el.getBoundingClientRect());
    p.focus(blockRect, color);
    // Teach mode drives the page: bring the block to reading height at a human
    // pace. Pointer coordinates are host-relative, so they stay correct while
    // the page is still moving.
    void bringIntoView(el, range ? first : el.getBoundingClientRect());
    if (range) {
      // Ride just BELOW the phrase (the highlighter sits on the words), so the
      // pink pointer never covers the text it's pointing at.
      const y = first.top + first.height + 2;
      const words = quote.trim().split(/\s+/).length;
      const oneLine = rects.length === 1;
      // Vary the gesture: a quick double-tap on a key term, a press-and-hold to
      // "select" a phrase that wraps, otherwise a click (sometimes doubled).
      let gesture: Gesture = "click";
      if (words <= 3) gesture = "double";
      else if (!oneLine) gesture = "press";
      else if (Math.random() < 0.25) gesture = "double";
      p.moveTo(hostPoint(first.left + 1, y), { gesture });
      p.underline(rects.map(hostRect), color);
      if (oneLine && first.width > 80 && glideMs > 0) p.glide(hostPoint(first.right - 2, y), Math.min(glideMs, 9000)); // trace the phrase as it's read
    } else {
      p.clearUnderline();
      const gesture: Gesture = Math.random() < 0.45 ? "press" : Math.random() < 0.5 ? "double" : "click";
      p.moveTo(hostPoint(first.left + Math.min(24, first.width * 0.12), first.top + Math.min(first.height * 0.5, 16)), { gesture, around: blockRect });
    }
  };

  // ---- the walkthrough loop -------------------------------------------------------
  const play = async (fromSection: number, fromStep: number) => {
    const run = ++runRef.current;
    const n = narrator.current;
    if (!n) return;
    n.cancel();
    askAbort.current?.abort();
    secRef.current = Math.max(0, fromSection);
    stepRef.current = Math.max(0, fromStep);
    setError(null);
    setQuestion(null);
    setInterim(null);
    setPhase("loading");
    const secs = sectionsRef.current;
    if (!secs.length) {
      setPhase("error");
      setError(pdf ? "The PDF is still opening. Try again in a moment." : "There are no sections with notes to explain yet.");
      return;
    }
    let spoke = false;
    let resumedPastEnd = false;
    let announceNext = false;
    for (let s = Math.max(0, fromSection); s < secs.length; s++) {
      const sec = secs[s];
      const entry = ensureScript(sec);
      // Prefetch the next section while this one plays - the next one with something in
      // it, so a picture-only PDF page doesn't leave the page after it unprepared.
      for (let j = s + 1; j < Math.min(secs.length, s + 6); j++) {
        const upcoming = ensureScript(secs[j]);
        if (!upcoming.error || !NOT_READY.has(upcoming.error)) break;
      }
      const startStep = s === fromSection ? Math.max(0, fromStep) : 0;
      // Nothing here to explain (a PDF page that's only a picture, notes not written
      // yet): say so and move on - before announcing it, so the announcement goes to
      // the next page that does have something.
      if (entry.error && NOT_READY.has(entry.error)) {
        setCaption(pdf ? `Skipping page ${sec.index} — there's no text on it I can read.` : `Skipping “${sec.title}” — its notes aren't ready yet.`);
        await sleep(1200);
        if (cancelled(run)) return;
        continue;
      }
      // Resuming after the quiz invitation: this section is finished, roll on.
      if (entry.done && entry.steps.length > 0 && startStep >= entry.steps.length) {
        resumedPastEnd = true;
        announceNext = true;
        continue;
      }
      secRef.current = s;
      if (startStep === 0) board.current?.hide();
      if (announceNext) {
        setPhase("speaking");
        setProgress({ step: 0, count: 0, title: sec.title });
        const ok = await n.speak(pdf ? PAGE_TURN_LINES[s % PAGE_TURN_LINES.length](sec.index) : `Next up: ${sec.title}.`);
        if (!ok || cancelled(run)) return;
        announceNext = false;
      }
      let played = 0;
      for (let k = startStep; ; k++) {
        const step = await waitForStep(entry, k, run);
        if (cancelled(run)) return;
        if (!step) break;
        stepRef.current = k;
        played++;
        spoke = true;
        setPhase("speaking");
        setProgress({ step: k + 1, count: entry.done ? entry.steps.length : 0, title: sec.title });
        const b = board.current;
        const visual = visualOf(step);
        let hasVisual = !!visual;
        const points = step.point ?? [];
        // The parts of this step's picture are looked up while the picture itself loads.
        prefetchImageParts(step);
        // Take the pointer to the board's visual once it's really up (a picture once it
        // has loaded); if the board is closed, minimized or turned off, or no picture
        // was found, follow the notes block/quote instead of freezing on a stale spot.
        const pointAtBoard = async (first: boolean) => {
          const el = visual ? await boardTarget(visual, run) : null;
          if (cancelled(run)) return;
          if (el) await pointToBoard(el, first, points, run, { say: step.say, image: step.image });
          else pointAt(sec, step.block, step.quote, speakMs(step.say, rateRef.current));
        };
        const onBoard = !visual && points.length && b?.visible() ? b.live() : null;
        if (visual && b) {
          const fresh = b.draw(visual);
          if (visual.kind === "list" && (!fresh || visual.data.auto) && !points.length) {
            // The list is already up and only its highlight moved on - or it's the
            // notes' own bullets, which the voice reads without announcing - so the
            // pointer follows the notes at normal pace while the board keeps track.
            // (A step that names one of its items goes to the board to point at it.)
            hasVisual = false;
            pointAt(sec, step.block, step.quote, speakMs(step.say, rateRef.current));
          } else {
            void pointAtBoard(fresh);
          }
        } else if (onBoard) {
          // It names a part of what's already on the board without drawing anything
          // new: point at that part there, rather than wander back to the notes.
          void pointToBoard(onBoard, false, points, run, { say: step.say });
        } else {
          pointAt(sec, step.block, step.quote, speakMs(step.say, rateRef.current));
        }
        for (let j = 1; j <= 3; j++) {
          const upcoming = entry.steps[k + j];
          if (!upcoming) continue;
          n.prefetch(upcoming.say, j === 1 ? 2 : 1); // keeps the natural voice gap-free
          // Find and decode a coming photo now, so the board never shows a
          // half-painted picture while the voice is introducing it - and find the
          // parts it will point at, so the pointer goes straight to them.
          prefetchGuideImage(upcoming.image);
          prefetchImageParts(upcoming);
        }
        if (hasVisual && board.current?.visible()) {
          await sleep(300); // a beat so the drawing appears before "take a look at this…"
          if (cancelled(run)) return;
        }
        const finished = await n.speak(step.say, step.tone);
        if (cancelled(run) || !finished) return;
        await sleep(hasVisual ? 850 : 400); // let a visual linger a moment before moving on
        if (cancelled(run)) return;
      }
      if (played === 0 && entry.error) {
        setPhase("error");
        setError(entry.error);
        return;
      }
      // Section finished: hand over to its quiz and wait there.
      const quiz = played > 0 ? quizTarget(sec) : null;
      if (quiz) {
        stepRef.current = entry.steps.length; // "past the end" → play continues with the next section
        const nextSec = secs[s + 1];
        pointToElement(quiz, "press", "pink");
        setPhase("speaking");
        setProgress({ step: entry.steps.length, count: entry.steps.length, title: sec.title });
        const ok = await n.speak(
          `That's the end of this section. When you're ready, try the quiz for it, it's right here.${
            nextSec ? " Press play when you want me to continue with the next section." : ""
          }`,
        );
        if (!ok || cancelled(run)) return;
        setPhase("paused");
        setCaption(nextSec ? "Take the quiz, or press play to continue." : "Take the quiz when you're ready. That was the last section.");
        return;
      }
      announceNext = true;
    }
    if (cancelled(run)) return;
    if (!spoke && !resumedPastEnd) {
      setPhase("error");
      setError(
        pdf
          ? "There's no text in this PDF I can read — it may be a scan. Switch to Notes to learn from it."
          : "The notes are still being written. Try again in a moment.",
      );
      return;
    }
    setPhase("done");
    board.current?.hide();
    pointer.current?.clearUnderline();
    pointer.current?.focus(null);
    await n.speak(
      pdf
        ? "And that's the whole PDF. Nice work. Tap the mic if you'd like to ask me anything."
        : "That's the end of your notes. Nice work. Tap the mic if you'd like to ask me anything.",
    );
  };

  /**
   * "Pin": write the visual into the section's notes so it survives the erase and is
   * still there at the next revision. Maths and tables become ordinary Markdown; the
   * rest ride in a fenced block the notes renderer draws (see GuideVisual).
   */
  const pinVisual = async (spec: VisualSpec) => {
    const sec = sectionsRef.current[secRef.current];
    if (!sec) return;
    const find = (list: NotedTopic[]): NotedTopic | null => {
      for (const t of list) {
        if (t.id === sec.topicId) return t;
        const hit = t.subtopics ? find(t.subtopics) : null;
        if (hit) return hit;
      }
      return null;
    };
    const store = useAppStore.getState();
    const before = find(store.currentSession?.extractedTopics ?? [])?.notes ?? "";
    const after = `${before.trimEnd()}
${visualToMarkdown(spec)}`.trimStart();
    store.updateTopic(sessionId, sec.topicId, { notes: after }); // show it straight away
    try {
      await updateTopicDetails(sessionId, sec.dbId, { notes: after });
      toast({ title: "Pinned to your notes", description: `Saved in “${sec.title}”.` });
    } catch (e) {
      useAppStore.getState().updateTopic(sessionId, sec.topicId, { notes: before });
      toast({ title: "Couldn't pin that", description: "The note didn't save. Try again in a moment.", variant: "destructive" });
      throw e; // the board puts its button back
    }
  };

  const pause = () => {
    runRef.current++;
    narrator.current?.cancel();
    askAbort.current?.abort();
    cancelAutoScroll();
    releaseBoard();
    pointer.current?.freeze(); // stop mid-flight: nothing keeps moving after pause
    stopListening(false);
    setPhase("paused");
  };
  const resume = () => play(secRef.current, stepRef.current);
  const togglePlay = () => {
    const p = phaseRef.current;
    if (p === "paused" || p === "error") resume();
    else if (p === "done") play(0, 0);
    else pause();
  };
  const next = () => {
    const s = secRef.current;
    const k = stepRef.current;
    const entry = scripts.current.get(sectionsRef.current[s]?.dbId);
    if (entry && (k + 1 < entry.steps.length || !entry.done)) play(s, k + 1);
    else if (s + 1 < sectionsRef.current.length) play(s + 1, 0);
    else play(s, k);
  };
  const prev = () => {
    const s = secRef.current;
    const k = stepRef.current;
    if (k > 0) play(s, k - 1);
    else if (s > 0) {
      const before = scripts.current.get(sectionsRef.current[s - 1].dbId);
      play(s - 1, before ? Math.max(0, before.steps.length - 1) : 0);
    } else play(s, 0);
  };

  /** "Continue from here": the person clicked a paragraph. */
  const continueFrom = async (sectionIndex: number, blockId: string) => {
    const sec = sectionsRef.current[sectionIndex];
    const n = narrator.current;
    if (!sec || !n) return;
    const entry = ensureScript(sec);
    const want = blockNum(blockId);
    const current = entry.steps[stepRef.current];
    if (sectionIndex === secRef.current && current?.block === blockId && phaseRef.current === "speaking") return; // already on it
    const run = ++runRef.current;
    n.cancel();
    askAbort.current?.abort();
    cancelAutoScroll();
    stopListening(false);
    secRef.current = sectionIndex;
    setPhase("loading");
    setCaption("Continuing from here.");
    pointAt(sec, blockId, ""); // show where we are right away
    // First step about this block or anything after it (steps stream in reading order).
    const find = async (): Promise<number> => {
      for (let i = 0; ; i++) {
        const st = await waitForStep(entry, i, run);
        if (cancelled(run)) return -1;
        if (!st) return -2;
        if (st.block && blockNum(st.block) >= want) return i;
      }
    };
    const k = await Promise.race([find(), sleep(1500).then(() => -3)]);
    if (cancelled(run)) return;
    if (k >= 0) return void play(sectionIndex, k);
    if (k === -2) return void play(sectionIndex, Math.max(0, entry.steps.length - 1)); // nothing after it: the recap
    // The script hasn't reached this block yet. Don't make the student wait for
    // it: explain the block right now, then rejoin the script past this point.
    const text = entry.blocks.find((b) => b.id === blockId)?.text ?? "";
    await ask(`Explain this part of the ${pdf ? "page" : "notes"} in detail, as the next step of the lesson: "${text.slice(0, 220)}". Don't mention block ids.`, {
      hidden: true,
      block: blockId,
      sectionIndex,
      resumeAt: async (r) => {
        for (let i = 0; ; i++) {
          const st = await waitForStep(entry, i, r);
          if (!st || cancelled(r)) return null;
          if (st.block && blockNum(st.block) > want) return i;
        }
      },
    });
  };

  // ---- questions ---------------------------------------------------------------
  const ask = async (raw: string, opts: AskOptions = {}) => {
    const text = raw.trim();
    const n = narrator.current;
    if (!text || !n) return;
    const run = ++runRef.current;
    n.cancel();
    stopListening(false);
    setAskOpen(false);
    setQuestion(opts.hidden ? null : text);
    setCaption(null);
    setError(null);
    setPhase("thinking");
    const si = opts.sectionIndex ?? secRef.current;
    const sec = sectionsRef.current[si];
    if (!sec) return;
    secRef.current = si;
    const entry = ensureScript(sec);
    const root = notesRoot(sec);
    const blocks = entry.blocks.length ? entry.blocks : root ? indexBlocks(root) : [];
    const aboutBlock = opts.block !== undefined ? opts.block : (entry.steps[stepRef.current]?.block ?? null);
    const abort = new AbortController();
    askAbort.current = abort;

    // Speak complete sentences the moment they arrive, in order.
    let pending = "";
    let spoken = "";
    let chain: Promise<boolean> = Promise.resolve(true);
    const added: { update: { notes: string; addition: string } | null } = { update: null };
    const enqueue = (chunk: string) => {
      const s = chunk.trim();
      if (!s) return;
      if (looksLikeGuideJson(s)) {
        console.warn("[TeachMode] dropped a JSON-looking fragment from the spoken answer:", s.slice(0, 120));
        return;
      }
      spoken += (spoken ? " " : "") + s;
      setPhase("answering");
      chain = chain.then((ok) => (ok && !cancelled(run) ? n.speak(s) : false));
    };

    try {
      const full = await streamGuideAnswer(
        sessionId,
        sec.dbId,
        {
          title: sec.title,
          blocks: blocks.map(({ id, kind, text: t }) => ({ id, kind, text: t })),
          question: text,
          current_block: aboutBlock,
          history: opts.hidden ? [] : history.current.slice(-8),
        },
        {
          signal: abort.signal,
          onTarget: (t) => {
            if (cancelled(run)) return;
            // "Draw me that": the answer may come with a visual. Put it on the board
            // and point at it; if the board is off, fall back to the notes as usual.
            const points = t.point ?? [];
            if (t.visual && board.current) {
              const visual = t.visual;
              const fresh = board.current.draw(visual);
              void boardTarget(visual, run).then((el) => {
                if (cancelled(run)) return;
                if (el) void pointToBoard(el, fresh, points, run, { image: visual.kind === "image" ? visual.data : null });
                else pointAt(sec, t.block, t.quote);
              });
              return;
            }
            // "Point at the gold band": a part of what's already on the board.
            const onBoard = points.length && board.current?.visible() ? board.current.live() : null;
            if (onBoard) {
              void pointToBoard(onBoard, false, points, run);
              return;
            }
            pointAt(sec, t.block, t.quote);
          },
          onText: (delta) => {
            if (cancelled(run)) return;
            pending += delta;
            const cut = lastSentenceEnd(pending);
            if (cut > 0) {
              enqueue(pending.slice(0, cut));
              pending = pending.slice(cut);
            }
          },
          onNotesUpdated: (u) => {
            added.update = u;
            // Show the saved note straight away (don't wait for the speech to finish):
            // even if the student pauses or clicks elsewhere, the page already has it.
            useAppStore.getState().updateTopic(sessionId, sec.topicId, { notes: u.notes });
          },
        },
      );
      if (cancelled(run)) return;
      if (pending.trim()) enqueue(pending);
      pending = "";
      if (!opts.hidden) {
        history.current.push({ role: "user", text }, { role: "assistant", text: full || spoken });
        if (history.current.length > 12) history.current.splice(0, history.current.length - 12);
      }
      const ok = await chain;
      if (!ok || cancelled(run)) return;
      if (added.update) {
        // The notes didn't have this answer, so the backend appended it to the section
        // (already on the page, see onNotesUpdated). Now take the student to it.
        await sleep(250);
        if (cancelled(run)) return;
        const freshRoot = notesRoot(sec);
        if (freshRoot) {
          const fresh = indexBlocks(freshRoot);
          entry.blocks = fresh;
          const headline =
            added.update.addition
              .split("\n")
              .map((l) => l.replace(/^[#>*\s-]+/, "").replace(/<[^>]+>/g, "").trim())
              .find(Boolean) ?? "";
          const key = headline.toLowerCase().slice(0, 40);
          const block = [...fresh].reverse().find((b) => key && b.text.toLowerCase().includes(key)) ?? fresh[fresh.length - 1];
          if (block) pointAt(sec, block.id, "");
        }
        const said = await n.speak(NOTE_ADDED_LINES[noteAddedCount++ % NOTE_ADDED_LINES.length]);
        if (!said || cancelled(run)) return;
      }
      await sleep(700);
      if (cancelled(run)) return;
      setQuestion(null);
      let k: number | null = stepRef.current;
      if (opts.resumeAt) {
        setPhase("loading");
        k = await opts.resumeAt(run);
        if (cancelled(run)) return;
      }
      play(si, k ?? entry.steps.length); // pick the walkthrough back up
    } catch (e) {
      if (abort.signal.aborted || cancelled(run)) return;
      setError(e instanceof Error ? e.message : "AnotherNotes AI couldn't answer that.");
      setPhase("paused");
    }
  };

  // ---- listening ------------------------------------------------------------------
  const transcribeAndAsk = async (blob: Blob) => {
    setPhase("thinking");
    setInterim(null);
    try {
      const t = await transcribeAudio(blob, navigator.language);
      if (t.trim()) ask(t);
      else {
        setPhase("paused");
        setCaption("I didn't catch that — tap the mic and try again.");
      }
    } catch (e) {
      setPhase("paused");
      setError(e instanceof Error ? e.message : "Couldn't transcribe that.");
    }
  };

  const stopListening = (submit: boolean) => {
    const rec = recognizer.current;
    recognizer.current = null;
    if (rec) {
      if (submit) rec.stop();
      else rec.abort();
    }
    const r = recording.current;
    recording.current = null;
    if (r) {
      if (submit) r.stop().then(transcribeAndAsk);
      else r.cancel();
    }
    setInterim(null);
  };

  const startRecorder = async (): Promise<boolean> => {
    try {
      const r = await startRecording({
        maxMs: 15_000,
        onAutoStop: (blob) => {
          recording.current = null;
          transcribeAndAsk(blob);
        },
      });
      recording.current = r;
      setPhase("listening");
      setInterim("");
      return true;
    } catch {
      return false;
    }
  };

  const startListening = async () => {
    if (sttMode === "none") {
      setAskOpen(true);
      if (micBlockedByInsecurePage()) {
        // The browser, not us, is refusing the microphone. The same page over
        // https is a secure context, so offer to take them straight there.
        const secure = secureUrlForThisPage();
        toast({
          title: "Voice input needs a secure (https) connection",
          description: secure
            ? "Browsers only hand out the microphone on https pages. Switch over and the mic works — type your question meanwhile."
            : "Browsers block the microphone on plain http pages. Open the app over https, or type your question meanwhile.",
          action: secure ? (
            <ToastAction altText="Reopen this page over https" onClick={() => window.location.assign(secure)}>
              Switch to https
            </ToastAction>
          ) : undefined,
        });
      } else {
        toast({ title: "Voice input isn't available in this browser", description: "Type your question instead." });
      }
      return;
    }
    runRef.current++;
    narrator.current?.cancel();
    askAbort.current?.abort();
    cancelAutoScroll();
    setPhase("listening");
    setInterim("");
    setError(null);
    setCaption(null);
    if (sttMode === "recorder") {
      if (!(await startRecorder())) {
        setPhase("paused");
        setAskOpen(true);
        toast({ title: "Couldn't use the microphone", description: "Type your question instead." });
      }
      return;
    }
    const rec = createNativeRecognizer({
      lang: navigator.language || "en-US",
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        recognizer.current = null;
        setInterim(null);
        if (t.trim()) ask(t);
        else {
          setPhase("paused");
          setCaption("I didn't catch that — tap the mic and try again.");
        }
      },
      onError: async (code) => {
        recognizer.current = null;
        if (code === "no-speech") {
          setPhase("paused");
          setCaption("I didn't hear anything. Tap the mic to try again.");
          return;
        }
        // Chromium builds without Google's speech service (e.g. Electron) fail
        // with "network"; permission problems land here too. Record + local whisper.
        if (await startRecorder()) return;
        setPhase("paused");
        setAskOpen(true);
        toast({ title: "Couldn't use the microphone", description: "Type your question instead." });
      },
    });
    recognizer.current = rec;
    try {
      rec.start();
    } catch {
      recognizer.current = null;
      if (!(await startRecorder())) {
        setPhase("paused");
        setAskOpen(true);
      }
    }
  };

  const mic = () => {
    if (phaseRef.current === "listening") stopListening(true);
    else startListening();
  };

  /** Esc while the mic is open: throw the recording away and stay in the lesson. */
  const cancelListening = () => {
    if (phaseRef.current !== "listening") return;
    stopListening(false);
    setPhase("paused");
    setCaption(`Never mind. Press ${voiceKeyLabel(voiceKeyRef.current)} whenever you want to ask something.`);
  };

  const close = () => {
    runRef.current++;
    narrator.current?.cancel();
    askAbort.current?.abort();
    cancelAutoScroll();
    releaseBoard();
    stopListening(false);
    hostRef.current?.classList.remove("guide-driving");
    onClose();
  };

  const cycleRate = () => {
    const r = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRateState(r);
    if (narrator.current) narrator.current.rate = r;
    writeStored(RATE_KEY, r);
  };
  // Nothing to choose from until we know whether the natural voices came through,
  // so the picker never flashes the browser's voices first.
  const voiceOptions = useMemo(
    () => (voicesReady ? voiceChoices(serverVoices, browserVoices) : []),
    [voicesReady, serverVoices, browserVoices],
  );
  const speaker = voiceOptions.find((v) => v.id === voiceId) ?? null;
  const setVoice = (id: string) => {
    const choice = voiceOptions.find((v) => v.id === id);
    if (!choice) return;
    setVoiceIdState(id);
    writeStored(VOICE_KEY, { id, gender: choice.gender });
    const n = narrator.current;
    if (!n) return;
    applyVoice(n, choice, browserVoices);
    if (n.serverVoice) n.resetServer(); // they asked for this voice: try it even if an earlier one failed

    // Let the student hear the voice they just picked (the lesson picks it up on its next sentence).
    const p = phaseRef.current;
    if (p === "paused" || p === "done" || p === "error") {
      setGreeting(true);
      void n.speak(`Hi, I'm ${choice.name}. I'll be your tutor. Press play when you're ready.`).finally(() => setGreeting(false));
    }
  };

  actions.current = { togglePlay, next, prev, mic, cancelListening, close, continueFrom, pause };

  // ---- lifecycle -----------------------------------------------------------------
  useEffect(() => {
    // Set when this Teach mode closes. The first lesson only starts once the voice
    // list arrives (up to 6 s); a Teach mode closed and reopened in that window used
    // to start its lesson anyway, talking over the new one.
    let disposed = false;
    const openedAt = Date.now();
    trackAction("teach_start", { source, sections: sectionsRef.current.length });
    // Each sentence is also handed to the board, which moves from part to part as each is named.
    const n = new Narrator({
      onCaption: (text) => {
        setCaption(text);
        lastCaption.current = text;
        if (text) captionHook.current?.(text);
      },
    });
    n.rate = rateRef.current;
    // Another narrator (another tab, say) started talking: stop and show "paused"
    // rather than leaving a silent "speaking" state behind.
    n.onPreempted = () => {
      if (!disposed) actions.current?.pause();
    };
    narrator.current = n;
    if (import.meta.env.DEV) (window as unknown as { __gb?: unknown }).__gb = board;
    const stored = readVoicePref();
    const browserReady = loadVoices().then((vs) => {
      setBrowserVoices(vs);
      n.available = n.available && vs.length > 0; // a voiceless synthesizer never speaks: pace captions instead
      n.voice = pickVoice(vs);
      return vs;
    });

    // Give every section's blocks their ids up front so a click anywhere works.
    const secs = sectionsRef.current;
    secs.forEach((s) => {
      const r = notesRoot(s);
      if (r) indexBlocks(r);
    });

    // Start with the section the reader is looking at.
    let start = secs.findIndex((s) => {
      const r = notesRoot(s)?.getBoundingClientRect();
      return !!r && r.bottom > 120 && r.top < window.innerHeight * 0.66;
    });
    if (start < 0) start = Math.max(0, secs.findIndex((s) => notesRoot(s)));

    // One voice per lesson. We wait for the natural voice before the first word
    // rather than starting in the browser's and swapping over when the list
    // lands - a second of silence at the start is much easier to follow than an
    // explanation that changes voice halfway through. If it really doesn't
    // arrive, the whole lesson stays in the browser voice.
    const applyVoices = (sv: GuideVoices | null, vs: SpeechSynthesisVoice[]) => {
      const server = sv && sv.provider !== "browser" ? sv.voices : [];
      if (server.length) {
        setServerVoices(server);
        n.useServer(synthesizeSpeech);
      }
      setVoicesReady(true);
      const choices = voiceChoices(server, vs);
      if (!choices.length) return;
      // Their earlier pick if it's still on offer, else whoever else is the same gender
      // (a browser voice, or a natural voice from a provider that's down today), else the default.
      const sameGender = stored?.gender ? choices.find((c) => c.gender === stored.gender) : undefined;
      const choice =
        choices.find((c) => c.id === stored?.id) ?? sameGender ?? choices.find((c) => c.id === `server:${sv?.default}`) ?? choices[0];
      applyVoice(n, choice, vs);
      setVoiceIdState(choice.id);
    };
    (async () => {
      const sv = await Promise.race([fetchGuideVoices(), sleep(6000).then(() => null)]);
      const vs = await browserReady;
      if (disposed) return;
      applyVoices(sv, vs);
      play(start, 0);
    })();

    const uninstallScroll = installScrollTakeover();

    // Time spent listening counts as studying.
    const presence = window.setInterval(() => {
      if (document.visibilityState === "visible") usePresenceStore.setState({ lastActivityAt: Date.now(), status: "active" });
    }, 30_000);

    return () => {
      disposed = true;
      trackAction("teach_end", { source, seconds: Math.round((Date.now() - openedAt) / 1000) });
      runRef.current++;
      n.dispose(); // silent for good, even if something still holds it
      cancelAutoScroll();
      boardAnchor.current?.();
      uninstallScroll();
      askAbort.current?.abort();
      recognizer.current?.abort();
      recording.current?.cancel();
      window.clearInterval(presence);
      hostRef.current?.classList.remove("guide-driving");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click a paragraph → continue the lesson from there.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      // A click inside an open line of notes is the student placing a caret,
      // not asking the lesson to continue from there.
      if (target?.closest?.("[data-an-input],[data-an-ink],[data-an-chrome]")) return;
      const root = target?.closest?.(`[${BLOCKS_ROOT_ATTR}]`) as HTMLElement | null;
      if (!root) return;
      let blockEl = target?.closest(`[${BLOCK_ATTR}]`) as HTMLElement | null;
      if (!blockEl) {
        indexBlocks(root); // a section we haven't reached yet: give its blocks ids now
        blockEl = target?.closest(`[${BLOCK_ATTR}]`) as HTMLElement | null;
      }
      if (!blockEl) return;
      const dbId = Number(root.getAttribute(BLOCKS_ROOT_ATTR));
      const si = sectionsRef.current.findIndex((s) => s.dbId === dbId);
      const id = blockEl.getAttribute(BLOCK_ATTR);
      if (si < 0 || !id) return;
      actions.current?.continueFrom(si, id);
    };
    host.addEventListener("click", onClick);
    return () => host.removeEventListener("click", onClick);
  }, [hostRef]);

  // While the AI is talking and the mouse is still, hide the real cursor so the
  // pink one reads as "in control". Any movement brings it straight back.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let timer: number | undefined;
    const driving = () => phaseRef.current === "speaking" || phaseRef.current === "answering";
    const arm = () => {
      host.classList.remove("guide-driving");
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (driving()) host.classList.add("guide-driving");
      }, 1800);
    };
    arm();
    window.addEventListener("pointermove", arm, { passive: true });
    const tick = window.setInterval(() => {
      if (!driving()) host.classList.remove("guide-driving");
    }, 500);
    return () => {
      window.removeEventListener("pointermove", arm);
      if (timer) window.clearTimeout(timer);
      window.clearInterval(tick);
      host.classList.remove("guide-driving");
    };
  }, [hostRef]);

  // Keyboard: space play/pause · ←/→ steps · Esc cancels the mic, otherwise closes.
  // The talk key is useTalkKey's (above). It is skipped here first, because the student
  // may have chosen a plain arrow as their talk key, and one press must not do both.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (t?.closest?.(".guide-voicemenu")) return; // picking a tutor: let the menu have the keys
      const a = actions.current;
      if (!a) return;
      if (matchesVoiceKey(e, voiceKeyRef.current)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return; // browser and OS shortcuts are not ours
      if (e.key === " ") {
        e.preventDefault();
        if (!e.repeat) a.togglePlay();
      } else if (e.key === "ArrowRight") a.next();
      else if (e.key === "ArrowLeft") a.prev();
      else if (e.key === "Escape") {
        if (phaseRef.current === "listening") a.cancelListening();
        else a.close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {hostRef.current && (
        <GuidePointer
          ref={pointer}
          host={hostRef.current}
          speaking={phase === "speaking" || phase === "answering"}
          caption={phase === "listening" || phase === "thinking" ? null : caption}
          speaker={speaker && { name: speaker.name, kind: botKind(speaker) }}
        />
      )}
      {/* A PDF can't be written into, so there's nothing to pin a drawing to. */}
      <GuideBoard ref={board} enabled={boardEnabled} title={progress.title} onClose={onBoardClose} onPin={pdf ? undefined : pinVisual} />
      <GuideDock
        phase={phase}
        question={question}
        interim={interim}
        error={error}
        progress={progress}
        rate={rate}
        onCycleRate={cycleRate}
        voices={voiceOptions}
        voiceId={voiceId}
        onVoice={setVoice}
        greeting={greeting}
        askOpen={askOpen}
        onToggleAsk={() => setAskOpen((v) => !v)}
        onAsk={ask}
        unit={pdf ? "page" : "section"}
        sttMode={sttMode}
        onPlayPause={togglePlay}
        onMic={mic}
        onClose={close}
      />
    </>
  );
}
