import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
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
  type GuideLanguage,
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
import { detectLang } from "@/lib/guide/lang";
import {
  Narrator,
  splitSentences,
  type SpokenBy,
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
import { GuideBoard, type BoardHandle, type BoardPanel } from "./GuideBoard";
import type { StudyPanel } from "@/components/study/sections";
import { prefetchGuideImage } from "./GuideImage";
import { canShowPicture, isPictureBlocked, onBlockedChange } from "@/lib/guide/blocked";
import { trackAction } from "@/lib/analytics";
import { matchesVoiceKey, voiceKeyLabel } from "@/lib/voiceKey";
import { keyForStudyTool, useTalkKey } from "@/lib/useTalkKey";
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

  Open it from the "Teach me" button (students never see the name "Teach mode"). For the section you're looking at it
  asks the backend for a spoken, step-by-step script (streamed, so it starts
  talking within a second or two). For every step it scrolls the page at a
  human pace, flies the pink pointer to the block being discussed, underlines
  the quoted words and reads the explanation aloud. Scripts occasionally go back
  to an earlier block to connect ideas, then carry on. Tap the mic (or type) to
  ask anything: the answer streams back, is spoken as it arrives while the
  pointer jumps to the relevant part, and then the walkthrough resumes. Click any
  paragraph to continue from there; scroll yourself and Teach mode yields, then
  picks the page back up on the next step.

  When a section is done, its quiz comes up on the board: "Quiz time", with Start
  quiz and Skip for now. The pointer lands on Start quiz, the voice invites it and
  the lesson pauses. The quiz runs right there on the board (the page draws it,
  through `renderPanel`), and its Continue, Skip or play carries on with "Next up".
  A section whose quiz is already done only says so, with Retry, and moves on.
  With the board off or closed, the lesson points at the page's Quiz button at the
  top when it's on screen, or else says where it is (it never scrolls the page back
  up to it: the student would lose their place), and waits. The board's footer also
  opens the section's flashcards whenever they're wanted; the lesson pauses for them
  and picks up again when they're closed. While a quiz or cards are up, the keys are
  theirs (Space, the arrows, Esc, the digits and the talk key), a hint the quiz gives
  is said by the tutor too, a click in the notes doesn't take a quiz half done away,
  and a question asked then is answered over the notes, leaving the board as it is.
  One of the page's own study dialogs opening (its Quiz or Flashcards, an exam plan's,
  the wrong questions) stops the lesson until play is pressed.

  The mic can change the notes too: "make this simpler", "add an example". The tutor
  says it will, the section is rewritten through the page (`reviseNotes`, the same
  revise and structure guard as everywhere else), and the lesson starts that section
  again from the new notes. A change the guard refuses is explained, and the lesson
  stays where it was.

  (Internally the modules are still called "guide".)
*/

/** Just enough of a topic to find its notes (and whether its quiz is done) in the store's tree. */
interface NotedTopic {
  id: string;
  notes?: string | null;
  completed?: boolean;
  subtopics?: NotedTopic[];
}

/** The section's topic as the store has it now, found anywhere in the tree. */
function storeTopic(topicId: string): NotedTopic | null {
  const find = (list: NotedTopic[]): NotedTopic | null => {
    for (const t of list) {
      if (t.id === topicId) return t;
      const hit = t.subtopics ? find(t.subtopics) : null;
      if (hit) return hit;
    }
    return null;
  };
  return find(useAppStore.getState().currentSession?.extractedTopics ?? []);
}

/** Where a lesson opened by a click on the page begins: that section, and the block
 *  under the click when there was one (null: the section's start). */
export interface TeachStart {
  sectionIndex: number;
  blockId: string | null;
}

export interface TeachSection {
  topicId: string;
  dbId: number;
  title: string;
  index: number;
  /** It has a quiz and flashcards (not a PDF page, nor a note too short to quiz): the
   *  board offers them, and the section ends with its quiz. */
  studyTools?: boolean;
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
/** The server explains at most this many blocks in one request (MAX_BLOCKS in
 *  app/api/guide.py); a longer section is asked for in consecutive parts of this size,
 *  so a very long note is taught to its end rather than only up to block 80. */
const SCRIPT_PART_BLOCKS = 80;
/** Said while the pointer lands on a note the answer just added; taking turns, so it never sounds canned. */
const NOTE_ADDED_LINES = [
  "Right here, in your notes.",
  "It's in your notes now, just here.",
  "I've written it into your notes, here.",
  "You'll find it here whenever you come back.",
];
let noteAddedCount = 0;
/** The page's own Quiz button at the top (the whole session's quiz): where the lesson
 *  sends the student at the end of a section when the board is off. */
const QUIZ_TOP_ATTR = "data-guide-quiz-top";
/** Start quiz (or Carry on, for a quiz already done) in the board's invitation. */
const QUIZ_START_ATTR = "data-guide-quiz-start";
/** What the voice says as the board invites the quiz. */
const QUIZ_INVITE_LINE = "That's the end of this section. Try the quiz on the board, or press play to carry on.";
/** Said at a section's end with the board off, when the page's Quiz button is off screen. */
const QUIZ_TOP_LINE = "That's the end of this section. Press Quiz at the top of the page whenever you're ready, or press play to carry on.";
const QUIZ_TOP_LAST_LINE = "That's the end of this section. Press Quiz at the top of the page whenever you're ready.";
/** The page's study dialogs (its Quiz and Flashcards, an exam plan's, the wrong questions). */
const STUDY_DIALOG = "[data-study-dialog]";
/** Said when another change is asked for while the last one is still being made. Short:
 *  that change's "Done" cuts it off the moment it lands (see changeNotes). */
const STILL_CHANGING_LINE = "Still on your last change — ask again once it's done.";

/** What the page's `reviseNotes` answers: the notes changed, or why they didn't. */
export type ReviseNotesResult = { ok: true } | { ok: false; refused: boolean; message: string };

/** A message's first sentence, for saying why a change was refused. */
function firstSentence(message: string): string {
  const t = message.replace(/\s+/g, " ").trim();
  const one = (/^.*?[.!?](?=\s|$)/.exec(t)?.[0] ?? t).slice(0, 180).trim();
  return one && !/[.!?]$/.test(one) ? `${one}.` : one;
}

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
  startAt = null,
  boardEnabled = true,
  onBoardClose,
  source = "notes",
  renderPanel,
  reviseNotes,
}: {
  sessionId: string;
  sections: TeachSection[];
  hostRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  /** Begin here rather than with the section on screen (a click on the page opened the lesson). */
  startAt?: TeachStart | null;
  boardEnabled?: boolean;
  onBoardClose?: () => void;
  source?: TeachSource;
  /** Draws a section's quiz or flashcards on the board. The page does the drawing: the
   *  quiz belongs to the study store and its wrong-questions list. Without it, the
   *  section's end sends the student to the page's Quiz button instead. */
  renderPanel?: (panel: StudyPanel) => ReactNode;
  /** Rewrites a section's notes as the student asked by voice (`topicId` is
   *  TeachSection.topicId) and puts them in the store, so the page shows them.
   *  `refused`: the structure guard said no (HTTP 422), and `message` says why. Without
   *  it, the tutor says it can't change the notes here. */
  reviseNotes?: (topicId: string, instruction: string) => Promise<ReviseNotesResult>;
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
  // The section being taught, as state as well as secRef (the loop's): the board's
  // Flashcards button is for this one, so it has to follow along.
  const [secNow, setSecNow] = useState(0);
  /** Who is reading right now and in which language, from the server (Ismail, "ar"). */
  const [reading, setReading] = useState<SpokenBy | null>(null);
  /** The languages the voice reads, by base code, for naming them ("Arabic"). */
  const [languages, setLanguages] = useState<Record<string, GuideLanguage>>({});
  const [rate, setRateState] = useState<number>(() => {
    const r = readStored<number>(RATE_KEY, 1);
    return RATES.includes(r) ? r : 1;
  });
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [serverVoices, setServerVoices] = useState<GuideVoice[]>([]);
  const [voicesReady, setVoicesReady] = useState(false);
  // A short line said with the lesson standing still (a newly picked tutor saying hello,
  // a quiz hint): the tutor's mouth moves, and nothing carries on after it.
  const [aside, setAside] = useState(false);
  // The notes are being rewritten as the student asked (see changeNotes).
  const [revisingNow, setRevisingNow] = useState(false);
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
  const renderPanelRef = useRef(renderPanel);
  renderPanelRef.current = renderPanel;
  const reviseNotesRef = useRef(reviseNotes);
  reviseNotesRef.current = reviseNotes;
  const boardEnabledRef = useRef(boardEnabled);
  boardEnabledRef.current = boardEnabled;
  // The lesson was running when the student opened their flashcards: closing them picks it back up.
  const resumeAfterPanel = useRef(false);
  const voiceKeyRef = useRef(voiceKey);
  voiceKeyRef.current = voiceKey;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const runRef = useRef(0); // bumping this cancels whatever loop is running
  // The run the walkthrough itself (play) last started: while it's still runRef's, the
  // lesson is teaching, not answering a question or saying something aside.
  const lessonRun = useRef(0);
  const secRef = useRef(0);
  /** The language each section's notes are in, judged once from their text: the hint the
   *  narrator cuts every sentence's runs against (an Arabic section's lines go to the
   *  Arabic voice; an English name inside them is still one run of Arabic). */
  const sectionLangs = useRef(new Map<number, string>());
  const sectionLang = (sec: TeachSection): string => {
    const have = sectionLangs.current.get(sec.dbId);
    if (have) return have;
    const text = notesRoot(sec)?.textContent?.trim() ?? "";
    const lang = text ? detectLang(text.slice(0, 6000)).lang : "en";
    sectionLangs.current.set(sec.dbId, lang);
    return lang;
  };
  const enterSection = (i: number) => {
    secRef.current = i;
    setSecNow(i);
    const sec = sectionsRef.current[i];
    if (sec && narrator.current) narrator.current.lang = sectionLang(sec);
  };
  const stepRef = useRef(0);
  const scripts = useRef(new Map<number, ScriptEntry>());
  // The section whose notes were just changed by voice, until its new lesson starts. Its
  // old script is gone (see forgetScript), and Next would read a missing script as a
  // section with nothing left in it and skip to the next one.
  const startOver = useRef<number | null>(null);
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
  /** The page's Quiz button at the top, for when the board is off (null if it has none). */
  const quizButton = (): HTMLElement | null => document.querySelector<HTMLElement>(`[${QUIZ_TOP_ATTR}]`);
  /**
   * That button, but only while it's on screen and not covered (by the board, say). The
   * lesson never scrolls the page back up to it: at the end of a section the student is
   * far down the notes and would lose their place. The header isn't sticky, so this is
   * usually null there; were it made sticky, the button would be on screen and pointed at.
   */
  const quizButtonOnScreen = (): HTMLElement | null => {
    const el = quizButton();
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.top < 0 || r.left < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth) return null;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !hit || el.contains(hit) ? el : null;
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
    const payload = blocks.map(({ id, kind, text }) => ({ id, kind, text }));
    // A long section is written in parts of SCRIPT_PART_BLOCKS blocks, one request after
    // another: a part is asked for once the one before it is written (the model writes
    // far faster than the voice reads), and its steps join the same list, so the lesson
    // never waits and never stops short of the section's end.
    const parts: (typeof payload)[] = [];
    for (let at = 0; at < payload.length; at += SCRIPT_PART_BLOCKS) parts.push(payload.slice(at, at + SCRIPT_PART_BLOCKS));
    const onStep = (step: GuideStep) => {
      entry.steps.push(step);
      if (entry.steps.length <= 2) narrator.current?.prefetch(step.say, 1); // first words ready before we get there
      wake(entry);
    };
    (async () => {
      for (let part = 0; part < parts.length; part++) {
        try {
          await streamGuideScript(
            sessionId,
            sec.dbId,
            { title: sec.title, blocks: parts[part], outline, part, parts: parts.length },
            { onStep },
          );
        } catch (err) {
          if (!entry.steps.length) throw err;
          // A later part couldn't be written: what was written is taught, and the lesson
          // moves on from there rather than fail a section it is halfway through.
          console.warn(`[Teach] part ${part + 1} of ${parts.length} of "${sec.title}" couldn't be prepared`, err);
          break;
        }
      }
    })()
      .then(() => {
        entry.done = true;
        wake(entry);
      })
      .catch((err: unknown) => {
        entry.error = err instanceof Error ? err.message : "AnotherNotes AI couldn't prepare this section.";
        entry.done = true;
        // So pressing play tries again - unless the notes have changed since and a new
        // lesson has already been asked for (see forgetScript): that one stays.
        if (scripts.current.get(sec.dbId) === entry) scripts.current.delete(sec.dbId);
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
  // The picture the pointer is on (its picture_id), so a picture taken away while it's
  // being explained can send the pointer back to the notes.
  const pictureOnBoard = useRef<string | null>(null);
  const releaseBoard = () => {
    boardSeq.current++;
    boardAnchor.current?.();
    boardAnchor.current = null;
    captionHook.current = null;
    pictureOnBoard.current = null;
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
    // Still what the pointer is doing on the board: nothing else has taken it since.
    // Pressing the mic or asking a question ends the run without taking the pointer
    // away, so while that happens the pointer keeps following the part (stillOnBoard);
    // only new moves - a part being named, a late region - need the run itself (live).
    const stillOnBoard = () => boardSeq.current === seq && el.isConnected;
    const live = () => !cancelled(run) && stillOnBoard();
    const img = el.querySelector<HTMLImageElement>(BOARD_IMAGE);
    const whole: HTMLElement = img ?? el;
    // The picture's signed id: its parts are looked up by it, and a report of it sends
    // the pointer away (see the blocked-pictures effect below) - from a card over the
    // picture too, which goes with it.
    const pictureId = img ? talk.image?.picture_id || img.dataset.pictureId || "" : "";
    const under = el.classList.contains("guide-board-overlay") ? el.parentElement?.querySelector<HTMLImageElement>(BOARD_IMAGE) : null;
    pictureOnBoard.current = pictureId || under?.dataset.pictureId || null;
    const wanted = (Array.isArray(points) ? points : []).filter((pt) => pt && typeof pt.label === "string" && pt.label.trim()).slice(0, 3);
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
      // By the picture's signed id, as the prefetch asked: the server only keeps parts
      // for pictures it approved, stored by the file's sha.
      const lookup = fetchImageParts(
        pictureId,
        wanted.map((w) => w.label),
        imagePartsContext({ say: talk.say ?? "" }),
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
    // on the part it has reached, not the first, and still move to the parts named
    // later in the sentence it's saying now - its caption has gone by, so onSentence
    // won't see it. (lastCaption is cleared at every step, so it's this step's.)
    if (plan.length && lastCaption.current) {
      const now = lastCaption.current;
      const idx = sentences.indexOf(now);
      if (idx >= 0) {
        heard = idx;
        for (const e of plan) if (e.sentence < idx || (e.sentence === idx && e.at < 0.12)) want = e.point;
        for (const e of plan) {
          if (e.sentence !== idx || e.at < 0.12) continue;
          timers.push(window.setTimeout(() => moveOn(e.point), e.at * lineMs(now, rateRef.current)));
        }
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
    // Following needs only the pointer to still be here (stillOnBoard), not the run:
    // while the student talks or waits for an answer, it stays on the part.
    let raf = 0;
    const reaim = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!stillOnBoard()) return;
        const aim = aimFor(want);
        if (!aim || (sentTo && near(sentTo, aim.tip))) return;
        go(want, "follow");
      });
    };
    const boardEl = el.closest<HTMLElement>(".guide-board");
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(reaim) : null;
    if (boardEl) ro?.observe(boardEl);
    if (img) ro?.observe(img);
    // Dragging the board (or its own pull back on screen) moves it without resizing it:
    // no scroll, resize or animation event, only its style changes. Watch for that.
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(reaim) : null;
    if (boardEl) mo?.observe(boardEl, { attributes: true, attributeFilter: ["style", "class"] });
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
      mo?.disconnect();
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
   * has stopped animating. Null when the board is off or minimized, when the picture
   * can't be shown (the server no longer vouches for it, or it was reported), or when
   * it doesn't come in time.
   */
  const boardTarget = async (spec: VisualSpec, run: number): Promise<HTMLElement | null> => {
    const limit = Date.now() + (spec.kind === "image" ? 6000 : 1500);
    while (!cancelled(run) && board.current?.visible()) {
      if (spec.kind === "image" && !canShowPicture(spec.data)) return null; // taken away while it loaded
      const el = board.current.showing(spec);
      if (el) {
        const img = spec.kind === "image" ? el.querySelector<HTMLImageElement>(BOARD_IMAGE) : null;
        if (spec.kind !== "image" || (img?.complete && img.naturalWidth > 0)) {
          await settled(el);
          return !cancelled(run) && el.isConnected ? el : null;
        }
        if (!img && !el.querySelector(".guide-image-spinner")) return null; // no picture to show
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

  /**
   * Press a button that's already on screen: Start quiz in the board's panel, or the
   * page's Quiz button at the top. Ringed tightly, over the board. Unlike pointToElement
   * it never scrolls the page (the board is fixed to the screen, and the page's button is
   * only pointed at when it's in view), and it stays on the button while the page scrolls
   * or the window resizes, until the pointer is sent anywhere else.
   */
  const pointToButton = (el: HTMLElement) => {
    const p = pointer.current;
    const host = hostRef.current;
    if (!p || !host) return;
    releaseBoard();
    cancelAutoScroll();
    p.clearUnderline();
    const seq = boardSeq.current;
    const boardBox = () => el.closest<HTMLElement>(".guide-board")?.getBoundingClientRect() ?? null;
    let sentTo: Pt | null = null;
    const go = (gesture: Gesture, duration?: number) => {
      const spot = spotOf(el);
      if (spot) sentTo = pointAtPart(p, host, spot, { gesture, duration, board: boardBox() });
    };
    go("press");
    let raf = 0;
    const reaim = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (boardSeq.current !== seq || !el.isConnected) return;
        const spot = spotOf(el);
        if (!spot || (sentTo && near(sentTo, hostPt(host, aimPoint(spot.box, spot.at, spot.exact))))) return;
        go("none", 240);
      });
    };
    window.addEventListener("scroll", reaim, { capture: true, passive: true });
    window.addEventListener("resize", reaim, { passive: true });
    boardAnchor.current = () => {
      window.removeEventListener("scroll", reaim, { capture: true });
      window.removeEventListener("resize", reaim);
      cancelAnimationFrame(raf);
    };
  };

  /**
   * With the board off (or closed), the end of a section sends the student to the page's
   * Quiz button: pointed at when it's on screen, otherwise only said where it is - the
   * page isn't scrolled up to it, and the pointer stays on the notes. What to say, and
   * the caption to wait on; null when the page has no Quiz button.
   */
  const toQuizButton = (last: boolean): { line: string; caption: string } | null => {
    const top = quizButtonOnScreen();
    if (top) {
      pointToButton(top);
      return {
        line: `That's the end of this section. When you're ready, try the quiz, it's the Quiz button just here.${last ? "" : " Press play when you want me to carry on."}`,
        caption: last ? "Take the quiz when you're ready. That was the last section." : "Take the quiz, or press play to carry on.",
      };
    }
    if (!quizButton()) return null;
    return {
      line: last ? QUIZ_TOP_LAST_LINE : QUIZ_TOP_LINE,
      caption: last
        ? "Press Quiz at the top of the page whenever you're ready. That was the last section."
        : "Press Quiz at the top of the page whenever you're ready, or press play to carry on.",
    };
  };

  /** Once the board's quiz invitation is on screen and still, the pointer presses its Start quiz. */
  const pointToQuizStart = async (run: number) => {
    const limit = Date.now() + 2500;
    while (!cancelled(run)) {
      const panelEl = board.current?.panelEl();
      const start = panelEl?.querySelector<HTMLElement>(`[${QUIZ_START_ATTR}]`);
      if (panelEl && start) {
        await settled(panelEl); // the board sliding in, the panel fading up
        if (!cancelled(run) && start.isConnected) pointToButton(start);
        return;
      }
      if (Date.now() > limit) return;
      await sleep(80);
    }
  };

  /** The pointer steps off the board, beside its bottom-left corner, out of the way of a quiz being taken. */
  const stepAside = () => {
    releaseBoard();
    pointer.current?.focus(null);
    // once the board has drawn the panel: it may only just be opening
    window.setTimeout(() => {
      const p = pointer.current;
      const host = hostRef.current;
      const boardEl = board.current?.panelEl()?.closest<HTMLElement>(".guide-board");
      if (!p || !host || !boardEl || !board.current?.panel()) return;
      const r = boardEl.getBoundingClientRect();
      p.moveTo(hostPt(host, restSpot(r)), { gesture: "none", precise: true, keepClear: [hostRect(r)] });
    }, 80);
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
    lessonRun.current = run;
    const n = narrator.current;
    if (!n) return;
    n.cancel();
    askAbort.current?.abort();
    // Playing takes the board back: a quiz or cards still up there (Skip, play, the
    // arrows, a paragraph clicked) close, and the board shows the lesson's visual again.
    board.current?.closePanel();
    resumeAfterPanel.current = false;
    enterSection(Math.max(0, fromSection));
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
      enterSection(s);
      if (startOver.current === sec.dbId) startOver.current = null; // its new lesson has begun
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
        // The last sentence heard belongs to the step before: if this step happens to say
        // it too, the board's catch-up (pointToBoard) would think the voice is already there.
        lastCaption.current = null;
        const b = board.current;
        const visual = visualOf(step);
        let hasVisual = !!visual;
        // A step whose picture can't be shown (not an approved /img/ file, or taken away
        // since - carried forward from an earlier step, say) has no visual: the parts it
        // names were the picture's, so it follows the notes instead.
        const points = !visual && step.image ? [] : Array.isArray(step.point) ? step.point : [];
        // The parts of this step's picture are looked up while the picture itself loads.
        prefetchImageParts(step);
        // Take the pointer to the board's visual once it's really up (a picture once it
        // has loaded); if the board is closed, minimized or turned off, or no picture
        // was found, follow the notes block/quote instead of freezing on a stale spot.
        const pointAtBoard = async (first: boolean) => {
          const el = visual ? await boardTarget(visual, run) : null;
          if (cancelled(run)) return;
          if (el) await pointToBoard(el, first, points, run, { say: step.say, image: visual?.kind === "image" ? visual.data : null });
          else pointAt(sec, step.block, step.quote, speakMs(step.say, rateRef.current));
        };
        const onBoard = !visual && points.length && b?.visible() ? b.live() : null;
        if (visual && b) {
          // A list, facts, a table or a formula after a picture goes on a card over it -
          // but only while a real picture is up on the board right now (loaded, not
          // reported), whatever the script assumed. The board ignores `over` for anything else.
          const fresh = b.draw(visual, { over: !!b.picture() });
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
      // Section finished: its quiz. On the board, an invitation the lesson waits at (one
      // already done only says so, with Retry, and the lesson moves on); with the board
      // off or closed, the page's Quiz button at the top (see toQuizButton), and it waits.
      if (played > 0 && sec.studyTools) {
        stepRef.current = entry.steps.length; // "past the end" → play continues with the next section
        const last = !secs[s + 1];
        const done = !!storeTopic(sec.topicId)?.completed;
        setProgress({ step: entry.steps.length, count: entry.steps.length, title: sec.title });
        const onBoard =
          !!renderPanelRef.current && !!board.current?.openPanel({ kind: "invite", topicId: sec.topicId, title: sec.title, done });
        if (onBoard && done) {
          setPhase("speaking");
          const ok = await n.speak("You've already done this section's quiz, so let's keep going.");
          if (!ok || cancelled(run)) return;
          await sleep(900); // a moment to take a Retry before the board moves on
          if (cancelled(run)) return;
        } else if (onBoard) {
          setPhase("speaking");
          void pointToQuizStart(run);
          const ok = await n.speak(QUIZ_INVITE_LINE);
          if (!ok || cancelled(run)) return;
          setPhase("paused");
          if (!board.current?.panel()) {
            // Closed while the voice was inviting it (its ×, Esc, the board switched off):
            // the lesson still waits here, as panelClosed has it wait, but not for a quiz
            // on a board that no longer shows one.
            releaseBoard();
            pointer.current?.focus(null);
            const to = boardEnabledRef.current ? null : toQuizButton(last);
            setCaption(to ? to.caption : "Press play when you want to carry on.");
            return;
          }
          setCaption(last ? "Take the quiz on the board. That was the last section." : "Take the quiz on the board, or press play to carry on.");
          return;
        } else if (!done) {
          const to = toQuizButton(last);
          if (to) {
            setPhase("speaking");
            const ok = await n.speak(to.line);
            if (!ok || cancelled(run)) return;
            setPhase("paused");
            setCaption(to.caption);
            return;
          }
        }
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
  const pinVisual = async (given: VisualSpec) => {
    const sec = sectionsRef.current[secRef.current];
    if (!sec) return;
    // A picture is kept as its signed picture_id and its /img/ file, nothing else (the
    // notes show it only while the server still vouches for it); one that can't be
    // shown can't be pinned.
    let spec: VisualSpec = given;
    if (given.kind === "image") {
      const d = given.data;
      if (!canShowPicture(d)) {
        toast({ title: "Couldn't pin that", description: "That picture isn't available any more." });
        throw new Error("picture not pinnable"); // the board puts its button back
      }
      spec = {
        kind: "image",
        data: { query: d.query, caption: d.caption, picture_id: d.picture_id, url: d.url, source: d.source, attribution: d.attribution, licence: d.licence },
      };
    }
    const before = storeTopic(sec.topicId)?.notes ?? "";
    const after = `${before.trimEnd()}
${visualToMarkdown(spec)}`.trimStart();
    useAppStore.getState().updateTopic(sessionId, sec.topicId, { notes: after }); // show it straight away
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
    // The notes here were just changed: on to the first step of their new lesson (play
    // writes its script afresh), never past this section because its old script is gone.
    if (startOver.current === sectionsRef.current[s]?.dbId) return void play(s, 0);
    const entry = scripts.current.get(sectionsRef.current[s]?.dbId);
    if (entry && (k + 1 < entry.steps.length || !entry.done)) play(s, k + 1);
    else if (s + 1 < sectionsRef.current.length) play(s + 1, 0);
    else play(s, k);
  };
  const prev = () => {
    const s = secRef.current;
    const k = stepRef.current;
    // Likewise: the start of this section's new lesson, not the end of the section before.
    if (startOver.current === sectionsRef.current[s]?.dbId) return void play(s, 0);
    if (k > 0) play(s, k - 1);
    else if (s > 0) {
      const before = scripts.current.get(sectionsRef.current[s - 1].dbId);
      play(s - 1, before ? Math.max(0, before.steps.length - 1) : 0);
    } else play(s, 0);
  };

  // ---- the board's panel: the section's quiz and flashcards ----------------------
  const busy = (ph: GuidePhase) => ph === "speaking" || ph === "loading" || ph === "answering" || ph === "thinking";

  // The store's last quiz result as the quiz on the board began. Every finished quiz
  // leaves a new one (completeTopic), so a new one for that section means it's finished.
  const quizBegan = useRef<unknown>(null);
  /** A quiz is being taken on the board: started, not only invited, and not finished yet. */
  const quizUnderway = (): boolean => {
    const p = board.current?.panel();
    if (!p || p.kind !== "quiz") return false;
    const r = useAppStore.getState().lastTopicReward;
    return !(r && r !== quizBegan.current && r.topicId === p.topicId);
  };

  /** Done with the panel: the quiz's Continue, Skip for now, Carry on, or the last card's
   *  Finish. The quiz carries on with "Next up"; cards go back to the lesson as it was. */
  const panelDone = (p: BoardPanel) => {
    const again = p.kind !== "flashcards" || resumeAfterPanel.current;
    resumeAfterPanel.current = false;
    board.current?.closePanel();
    if (again) resume();
  };

  /** The invitation taken up (Start quiz, or Retry on one already done): the quiz runs on
   *  the board and the lesson waits for it, with the pointer out of the way. */
  const panelStart = (p: BoardPanel) => {
    if (phaseRef.current !== "paused") pause();
    quizBegan.current = useAppStore.getState().lastTopicReward;
    board.current?.openPanel({ ...p, kind: "quiz", done: false }, { focus: true });
    setCaption(null);
    stepAside();
  };

  /** Closed from the board (its ×, Esc, the board switched off): the lesson goes back to
   *  how it was when the panel opened - running again after flashcards, else waiting. */
  const panelClosed = (p: BoardPanel) => {
    const again = p.kind === "flashcards" && resumeAfterPanel.current;
    resumeAfterPanel.current = false;
    if (again) return void resume();
    if (phaseRef.current !== "paused") return;
    releaseBoard();
    pointer.current?.focus(null);
    // The board switched off under the quiz: it's still there, behind the page's Quiz button.
    const last = !sectionsRef.current[secRef.current + 1];
    const to = p.kind !== "flashcards" && !boardEnabledRef.current ? toQuizButton(last) : null;
    setCaption(to ? to.caption : "Press play when you want to carry on.");
  };

  /** The footer's Flashcards: the section's cards on the board. A lesson that was running waits for them. */
  const openFlashcards = () => {
    const sec = sectionsRef.current[secRef.current];
    if (!sec?.studyTools || !renderPanelRef.current) return;
    const ph = phaseRef.current;
    if (!board.current?.openPanel({ kind: "flashcards", topicId: sec.topicId, title: sec.title }, { focus: true })) return;
    if (ph !== "paused" && ph !== "done" && ph !== "error") pause(); // a question being asked too
    resumeAfterPanel.current = busy(ph);
    setCaption(null);
    stepAside();
  };

  // ---- a hint from the quiz on the board ------------------------------------------
  const asideSeq = useRef(0);
  /** Say one short line with the lesson standing still: nothing plays on after it. */
  const sayAside = (line: string) => {
    const n = narrator.current;
    if (!n) return;
    const seq = ++asideSeq.current;
    setAside(true);
    void n.speak(line).finally(() => {
      if (asideSeq.current === seq) setAside(false);
    });
  };
  const lastHint = useRef<{ text: string; at: number } | null>(null);
  /**
   * The quiz on the board showed a hint (a first wrong pick): the tutor says it, in its
   * bubble and out loud (paced silently with no voice), and the lesson stays where it
   * is, waiting for the quiz. Not over an answer being spoken, nor into an open mic:
   * the hint is under the question anyway.
   */
  const sayHint = (text: string) => {
    const hint = text.replace(/\s+/g, " ").trim();
    if (!hint) return;
    const now = Date.now();
    if (lastHint.current?.text === hint && now - lastHint.current.at < 2000) return; // the same one shown twice
    lastHint.current = { text: hint, at: now };
    const ph = phaseRef.current;
    if (ph !== "paused" && ph !== "done" && ph !== "error") return;
    sayAside(hint);
  };

  /** What the board draws in its panel: the page's study tool, told what its buttons do here. */
  const drawPanel = (p: BoardPanel): ReactNode =>
    renderPanel?.({
      kind: p.kind,
      topicId: p.topicId,
      onDone: () => panelDone(p),
      onStart: () => panelStart(p),
      onHint: sayHint,
    }) ?? null;

  /** "Continue from here": the person clicked a paragraph. */
  const continueFrom = async (sectionIndex: number, blockId: string) => {
    const sec = sectionsRef.current[sectionIndex];
    const n = narrator.current;
    if (!sec || !n) return;
    // A quiz being taken on the board isn't closed by a click in the notes: its answers
    // would be lost. (Play, Next and Prev still take it down, as they always have.)
    if (quizUnderway()) {
      setCaption("Finish the quiz or close it first.");
      return;
    }
    const entry = ensureScript(sec);
    const want = blockNum(blockId);
    const current = entry.steps[stepRef.current];
    if (sectionIndex === secRef.current && current?.block === blockId && phaseRef.current === "speaking") return; // already on it
    const run = ++runRef.current;
    n.cancel();
    askAbort.current?.abort();
    cancelAutoScroll();
    stopListening(false);
    // Asking to go on from a paragraph takes the board back too, as play does.
    board.current?.closePanel();
    resumeAfterPanel.current = false;
    enterSection(sectionIndex);
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

  // ---- changing the notes by voice -------------------------------------------------
  // A rewrite is running: only one at a time (the next waits for the student to ask again).
  // `run` is the turn it answers to: the question that asked for it, or a later one that
  // asked for another change meanwhile and was told it's still busy (see changeNotes).
  const revising = useRef<{ run: number } | null>(null);

  /** A section's lesson is about notes that are gone: the next time it plays, its script is
   *  written afresh from the new ones (the server's cache follows the notes text), and a
   *  lesson standing in that section goes back to its start - Next and Prev too. */
  const forgetScript = (sec: TeachSection) => {
    scripts.current.delete(sec.dbId);
    sectionLangs.current.delete(sec.dbId); // new notes may be in another language
    if (sectionsRef.current[secRef.current]?.dbId === sec.dbId) {
      stepRef.current = 0;
      startOver.current = sec.dbId;
    }
  };

  /** Once the page shows the section's new notes (its text is no longer `before`), or after
   *  a few seconds: their blocks get fresh ids, so nothing points at the old ones. */
  const notesRedrawn = async (sec: TeachSection, before: string) => {
    const limit = Date.now() + 3000;
    while (Date.now() < limit && (notesRoot(sec)?.textContent ?? before) === before) await sleep(80);
    // a frame or two for the rest of the notes (maths, pictures) to settle
    await Promise.race([new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))), sleep(150)]);
    const root = notesRoot(sec);
    if (root) indexBlocks(root);
  };

  /**
   * The student asked to change the section's notes ("make this simpler", "add an
   * example") and the tutor has said it will. The page rewrites them (the same revise and
   * structure guard as the notes page, which keeps formulas, tables and pinned pictures)
   * and shows them; then the lesson starts that section again from the new notes. A change
   * the guard refuses is explained, and the lesson stays where it was, paused.
   *
   * Asked for another change while one is still being made, the tutor says so in a few
   * words and hands the turn to the change underway: its "Done" (or why it couldn't) cuts
   * that line off as soon as it lands, rather than waiting behind it or going unsaid.
   */
  const changeNotes = async (si: number, instruction: string, run: number) => {
    const sec = sectionsRef.current[si];
    const n = narrator.current;
    if (!sec || !n) return;
    // The turn this change answers to; a second change asked for meanwhile moves it on.
    const job = { run };
    /** Say why nothing changed; the lesson waits where it was. */
    const waitWith = async (line: string) => {
      setPhase("speaking");
      setProgress({ step: 0, count: 0, title: sec.title });
      const said = await n.speak(line);
      if (!said || cancelled(job.run)) return;
      setPhase("paused");
      setCaption(line);
    };
    const revise = reviseNotesRef.current;
    if (pdf) return waitWith("I can't change the PDF itself. Switch to Notes and ask me there.");
    if (!revise) return waitWith("I can't change the notes from here, sorry.");
    const underway = revising.current;
    if (underway) {
      underway.run = run; // its outcome is now this turn's to say
      setPhase("speaking");
      setProgress({ step: 0, count: 0, title: sec.title });
      const said = await n.speak(STILL_CHANGING_LINE);
      // Cut off by that change landing, or by the student: either has taken over.
      if (!said || cancelled(run)) return;
      // Back to waiting for it, as before they asked: "Updating the notes…" in the dock.
      setPhase(revising.current === underway ? "loading" : "paused");
      return;
    }
    revising.current = job;
    setRevisingNow(true);
    setPhase("loading");
    setCaption("Updating the notes…");
    pointAt(sec, null, ""); // the section's title: where the change is about to show
    const before = notesRoot(sec)?.textContent ?? "";
    let result: ReviseNotesResult;
    try {
      result = await revise(sec.topicId, instruction);
    } catch (e) {
      result = { ok: false, refused: false, message: e instanceof Error ? e.message : "" };
    }
    // Still "updating" until the page shows the new notes.
    if (result.ok) await notesRedrawn(sec, before);
    revising.current = null;
    setRevisingNow(false);
    // Paused (or stopped) while it was being rewritten: the outcome is only shown, not said.
    const quiet = () => {
      const ph = phaseRef.current;
      return ph === "paused" || ph === "done" || ph === "error";
    };
    if (result.ok === false) {
      const why = result.refused ? firstSentence(result.message) : "";
      const line = result.refused
        ? `I couldn't change that safely.${why ? ` ${why}` : ""}`
        : "I couldn't update the notes just now. Try again in a moment.";
      if (!cancelled(job.run)) return waitWith(line);
      if (quiet()) setCaption(line);
      return;
    }
    // Whatever the student did meanwhile, the old lesson is about notes that are gone.
    // Forgotten only now the page shows the new ones: a lesson asked for before then (the
    // section before preparing this one, say) would be about the old notes again.
    forgetScript(sec);
    if (cancelled(job.run)) {
      // They moved on while it was being rewritten. A lesson teaching this section right
      // now is pointing at the old notes: it starts the section again.
      const now = sectionsRef.current[secRef.current];
      const teaching = lessonRun.current === runRef.current && busy(phaseRef.current);
      if (teaching && now?.dbId === sec.dbId) play(secRef.current, 0);
      else if (quiet()) setCaption("I've updated the notes. Press play to carry on.");
      return;
    }
    setPhase("speaking");
    setProgress({ step: 0, count: 0, title: sec.title });
    const said = await n.speak("Done — I've updated the notes.");
    if (!said || cancelled(job.run)) return;
    if (board.current?.panel()) {
      // A quiz or cards up on the board stay there, as after any question: the new
      // notes are taught from the top when the student presses play.
      setPhase("paused");
      setCaption("Press play to go through the new notes.");
      return;
    }
    // From the top of the new notes - unless the student has moved on to another section
    // since (and asked for a change there, which found this one still underway): then on
    // from where they are.
    if (sectionsRef.current[secRef.current]?.dbId === sec.dbId) play(secRef.current, 0);
    else resume();
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
    enterSection(si);
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
    // A change to the notes the student asked for ("make this simpler"): the answer is
    // only the tutor saying it will, and this is what to change (see changeNotes).
    const asked: { change: string | null } = { change: null };
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
            // A quiz or cards up on the board stay there: the answer points at the notes.
            if (board.current?.panel()) {
              pointAt(sec, t.block, t.quote);
              return;
            }
            // "Draw me that": the answer may come with a visual. Put it on the board
            // and point at it; if the board is off, fall back to the notes as usual.
            const points = Array.isArray(t.point) ? t.point : [];
            // (A picture never comes this way: see onTargetImage.)
            if (t.visual && t.visual.kind !== "image" && board.current) {
              const visual = t.visual;
              const fresh = board.current.draw(visual, { over: !!board.current.picture() });
              void boardTarget(visual, run).then((el) => {
                if (cancelled(run)) return;
                if (el) void pointToBoard(el, fresh, points, run);
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
          // The answer's picture, only once the server approved it (never searched for
          // here): up on the board, and the pointer moves from the notes to its parts.
          onTargetImage: ({ visual, point }) => {
            if (cancelled(run) || !board.current || board.current.panel() || !canShowPicture(visual.data)) return;
            const fresh = board.current.draw(visual);
            void boardTarget(visual, run).then((el) => {
              if (cancelled(run) || !el) return; // no picture after all: the pointer stays on the notes
              void pointToBoard(el, fresh, point, run, { image: visual.data });
            });
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
          onChangeNotes: (c) => {
            asked.change = c.instruction;
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
      if (asked.change) {
        // The tutor has said it will change the notes: now it does.
        setQuestion(null);
        return void changeNotes(si, asked.change, run);
      }
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
      if (board.current?.panel()) {
        // Asked over the quiz (or the cards) on the board: back to it, still paused -
        // carrying on would take it down.
        setPhase("paused");
        setCaption("Back to the board whenever you're ready. Press play to carry on.");
        return;
      }
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
    if (p === "paused" || p === "done" || p === "error") sayAside(`Hi, I'm ${choice.name}. I'll be your tutor. Press play when you're ready.`);
  };

  actions.current = { togglePlay, next, prev, mic, cancelListening, close, continueFrom, pause };

  // ---- lifecycle -----------------------------------------------------------------
  const startAtRef = useRef(startAt);
  startAtRef.current = startAt;

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
    n.onVoice = (v) => {
      if (!disposed) setReading(v);
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
        setLanguages(sv?.languages ?? {});
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
      const at = startAtRef.current;
      if (at?.blockId) actions.current?.continueFrom(at.sectionIndex, at.blockId);
      else play(at ? at.sectionIndex : start, 0);
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
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A picture taken away while the pointer is on it (the board's "Wrong picture", or the
  // server no longer vouching for it): the pointer leaves it for the notes the voice is
  // on, and the lesson carries on. Later steps carrying it forward drop it (visualOf).
  useEffect(
    () =>
      onBlockedChange(() => {
        const id = pictureOnBoard.current;
        if (!id || !isPictureBlocked({ picture_id: id })) return;
        releaseBoard();
        pointer.current?.focus(null);
        const sec = sectionsRef.current[secRef.current];
        const step = sec ? scripts.current.get(sec.dbId)?.steps[stepRef.current] : undefined;
        const talking = phaseRef.current === "speaking" || phaseRef.current === "answering";
        if (sec && step && talking) pointAt(sec, step.block, step.quote);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads refs only; set up once
    [],
  );

  // One of the page's study dialogs opening (its Quiz or Flashcards at the top, an exam
  // plan's, the wrong questions) while the lesson talks: it stops, rather than talk over
  // the quiz, and stays stopped when the dialog closes - the student presses play. Watched
  // here, so the page needs no wiring: any element marked data-study-dialog counts, in a
  // portal or not. Only added nodes are looked at, so the lesson's own busy DOM (the
  // pointer, the marks, the notes) costs next to nothing.
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const opened = (node: Node) => node instanceof Element && (node.matches(STUDY_DIALOG) || !!node.querySelector(STUDY_DIALOG));
    const mo = new MutationObserver((records) => {
      if (!records.some((r) => Array.from(r.addedNodes).some(opened))) return;
      const ph = phaseRef.current;
      if (ph === "listening") return; // the student is talking: the mic is theirs to close
      if (ph === "speaking" || ph === "answering" || ph === "loading" || ph === "thinking") {
        actions.current?.pause();
        setCaption("Paused while that's open. Press play when you want to carry on.");
      } else {
        narrator.current?.cancel(); // a hint or a hello still being said
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
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

  // Keyboard: space play/pause · ←/→ steps · Esc cancels the mic, otherwise closes.
  // The talk key is useTalkKey's (above). It is skipped here first, because the student
  // may have chosen a plain arrow as their talk key, and one press must not do both.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (t?.closest?.(".guide-voicemenu")) return; // picking a tutor: let the menu have the keys
      // The quiz or cards on the board, and the page's Quiz dialog, own their keys - and
      // while a quiz or cards are being worked on the board, so does a key pressed with
      // focus nowhere in particular (lib/useTalkKey). The invitation isn't being worked
      // in yet: Space there is still "press play to carry on". (The digits 1-4 that pick
      // an answer are never Teach mode's, so they always reach the quiz; nothing here
      // prevents their default.)
      const open = board.current?.panel();
      if (keyForStudyTool(t, !!open && open.kind !== "invite")) {
        // Except Esc for the microphone, opened over the quiz with focus nowhere in
        // particular (the talk key still works there): that is still "never mind".
        const micOpen = e.key === "Escape" && phaseRef.current === "listening" && !keyForStudyTool(t);
        if (!micOpen) return;
      }
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
          speaking={phase === "speaking" || phase === "answering" || aside}
          caption={phase === "listening" || phase === "thinking" ? null : caption}
          speaker={speaker && { name: speaker.name, kind: botKind(speaker) }}
        />
      )}
      {/* A PDF can't be written into, so there's nothing to pin a drawing to (and its
          pages have no quiz or flashcards: studyTools is false for them). */}
      <GuideBoard
        ref={board}
        enabled={boardEnabled}
        title={progress.title}
        onClose={onBoardClose}
        onPin={pdf ? undefined : pinVisual}
        renderPanel={renderPanel ? drawPanel : undefined}
        onPanelClose={panelClosed}
        onFlashcards={renderPanel && sections[secNow]?.studyTools ? openFlashcards : undefined}
      />
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
        reading={reading}
        languages={languages}
        greeting={aside}
        busyLabel={revisingNow ? "Updating the notes…" : null}
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
