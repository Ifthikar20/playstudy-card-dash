import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useAppStore } from "@/store/appStore";
import { usePresenceStore } from "@/store/presenceStore";
import {
  fetchGuideVoices,
  streamGuideAnswer,
  streamGuideScript,
  synthesizeSpeech,
  transcribeAudio,
  visualOf,
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
import { GuideDock, botKind, type GuidePhase, type VoiceOption } from "./GuideDock";
import { GuideBoard, type BoardHandle } from "./GuideBoard";
import { prefetchGuideImage } from "./GuideImage";
import { visualToMarkdown } from "./GuideVisual";

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

interface ScriptEntry {
  steps: GuideStep[];
  done: boolean;
  error: string | null;
  blocks: GuideBlock[];
  waiters: Array<() => void>;
}

const RATE_KEY = "an-guide-rate";
const VOICE_KEY = "an-guide-voice2"; // { id: "server:<voice id>" | "browser:<voice name>", gender }
const RATES = [0.85, 1, 1.15, 1.3];
const NOT_READY = new Set(["notes-missing", "notes-empty"]);
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
function lastSentenceEnd(s: string): number {
  const re = /[.!?…]["”’)]?(?=\s)|\n/g;
  let end = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) end = m.index + m[0].length;
  return end;
}

const speakMs = (text: string, rate: number) => Math.max(1500, (text.split(/\s+/).length * 340) / rate);

function readStored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

/** The voice the student picked last time, and whose voice it was. The gender matters
 *  on its own: when the voices on offer change - a natural voice provider falls over,
 *  or they open the lesson on another machine - a student who chose the man's voice
 *  gets the man's voice again, and the character on screen still matches. */
interface StoredVoice {
  id: string;
  gender: VoiceGender | null;
}

function readVoicePref(): StoredVoice | null {
  const raw = readStored<string | { id?: string; gender?: string } | null>(VOICE_KEY, null);
  if (typeof raw === "string") return { id: raw, gender: raw.startsWith("browser:") ? voiceGender(raw.slice(8)) : null };
  if (raw && typeof raw.id === "string") {
    return { id: raw.id, gender: raw.gender === "female" || raw.gender === "male" ? raw.gender : null };
  }
  return null;
}

/** The two voices on offer: the natural ones when the server has them, else the browser's own. */
function voiceChoices(server: GuideVoice[], browser: SpeechSynthesisVoice[]): VoiceOption[] {
  if (server.length) {
    return server.map((v) => ({ id: `server:${v.id}`, name: v.name, gender: v.gender ?? null, desc: v.desc }));
  }
  return browserVoicePair(browser).map((v) => ({
    id: `browser:${v.name}`,
    name: browserVoiceName(v.name),
    gender: voiceGender(v.name),
    desc: "your device's own voice",
  }));
}

/** The browser voice behind a choice. For a natural voice it's the stand-in if that voice
 *  fails mid-lesson, so it's the same gender and the face on screen still matches. */
function browserVoiceFor(choice: VoiceOption, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (choice.id.startsWith("browser:")) return voices.find((v) => v.name === choice.id.slice(8)) ?? null;
  return browserVoicePair(voices).find((v) => voiceGender(v.name) === choice.gender) ?? pickVoice(voices);
}

function applyVoice(n: Narrator, choice: VoiceOption, voices: SpeechSynthesisVoice[]) {
  n.serverVoice = choice.id.startsWith("server:") ? choice.id.slice(7) : null;
  n.voice = browserVoiceFor(choice, voices) ?? n.voice;
}

export function TeachMode({
  sessionId,
  sections,
  hostRef,
  onClose,
  boardEnabled = true,
  onBoardClose,
}: {
  sessionId: string;
  sections: TeachSection[];
  hostRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  boardEnabled?: boolean;
  onBoardClose?: () => void;
}) {
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

  // Mutable state for the async flows — refs, so callbacks never go stale.
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
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
    close(): void;
    continueFrom(sectionIndex: number, blockId: string): void;
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

  /** Scroll to and point at an arbitrary element (e.g. a heading or the quiz button). */
  const pointToElement = (el: HTMLElement, gesture: Gesture = "click", color: MarkColor = "pink") => {
    const p = pointer.current;
    if (!p || !hostRef.current) return;
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
    const root = notesRoot(sec);
    if (!root) {
      p.clearUnderline();
      return;
    }
    if (!blockId) {
      // A framing/recap step with no particular block: rest on the section title,
      // or the first real block — never the whole notes container.
      const heading = host.querySelector<HTMLElement>(`#section-${CSS.escape(sec.topicId)} h2`) ?? root.querySelector<HTMLElement>(`[${BLOCK_ATTR}]`) ?? root;
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
      setError("There are no sections with notes to explain yet.");
      return;
    }
    let spoke = false;
    let resumedPastEnd = false;
    let announceNext = false;
    for (let s = Math.max(0, fromSection); s < secs.length; s++) {
      const sec = secs[s];
      const entry = ensureScript(sec);
      if (secs[s + 1]) ensureScript(secs[s + 1]); // prefetch the next section while this one plays
      const startStep = s === fromSection ? Math.max(0, fromStep) : 0;
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
        const ok = await n.speak(`Next up: ${sec.title}.`);
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
        // Aim the pointer at the board's visual; but if the board is closed,
        // minimized or turned off there's nothing to point at, so follow the
        // notes block/quote instead of freezing on a stale, unrelated spot.
        const pointAtBoard = () =>
          requestAnimationFrame(() => {
            if (cancelled(run)) return;
            const el = board.current?.lastLine();
            if (el) pointToElement(el, "press", "pink");
            else pointAt(sec, step.block, step.quote, speakMs(step.say, rateRef.current));
          });
        if (visual && b) {
          const fresh = b.draw(visual);
          if (visual.kind === "list" && (!fresh || visual.data.auto)) {
            // The list is already up and only its highlight moved on - or it's the
            // notes' own bullets, which the voice reads without announcing - so the
            // pointer follows the notes at normal pace while the board keeps track.
            hasVisual = false;
            pointAt(sec, step.block, step.quote, speakMs(step.say, rateRef.current));
          } else {
            pointAtBoard();
          }
        } else {
          pointAt(sec, step.block, step.quote, speakMs(step.say, rateRef.current));
        }
        for (let j = 1; j <= 3; j++) {
          const upcoming = entry.steps[k + j];
          if (!upcoming) continue;
          n.prefetch(upcoming.say, j === 1 ? 2 : 1); // keeps the natural voice gap-free
          // Find and decode a coming photo now, so the board never shows a
          // half-painted picture while the voice is introducing it.
          prefetchGuideImage(upcoming.image?.query);
        }
        if (hasVisual && board.current?.visible()) {
          await sleep(300); // a beat so the drawing appears before "take a look at this…"
          if (cancelled(run)) return;
        }
        const finished = await n.speak(step.say);
        if (cancelled(run) || !finished) return;
        await sleep(hasVisual ? 850 : 400); // let a visual linger a moment before moving on
        if (cancelled(run)) return;
      }
      if (played === 0 && entry.error) {
        if (NOT_READY.has(entry.error)) {
          setCaption(`Skipping “${sec.title}” — its notes aren't ready yet.`);
          await sleep(1200);
          if (cancelled(run)) return;
          continue;
        }
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
      setError("The notes are still being written. Try again in a moment.");
      return;
    }
    setPhase("done");
    board.current?.hide();
    pointer.current?.clearUnderline();
    pointer.current?.focus(null);
    await n.speak("That's the end of your notes. Nice work. Tap the mic if you'd like to ask me anything.");
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
    await ask(`Explain this part of the notes in detail, as the next step of the lesson: "${text.slice(0, 220)}". Don't mention block ids.`, {
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
            if (t.visual && board.current) {
              board.current.draw(t.visual);
              requestAnimationFrame(() => {
                if (cancelled(run)) return;
                const el = board.current?.lastLine();
                if (el) pointToElement(el, "press", "pink");
                else pointAt(sec, t.block, t.quote);
              });
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
        const said = await n.speak("Right here, in your notes.");
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

  const close = () => {
    runRef.current++;
    narrator.current?.cancel();
    askAbort.current?.abort();
    cancelAutoScroll();
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

  actions.current = { togglePlay, next, prev, mic, close, continueFrom };

  // ---- lifecycle -----------------------------------------------------------------
  useEffect(() => {
    const n = new Narrator({ onCaption: setCaption });
    n.rate = rateRef.current;
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
      applyVoices(sv, await browserReady);
      play(start, 0);
    })();

    const uninstallScroll = installScrollTakeover();

    // Time spent listening counts as studying.
    const presence = window.setInterval(() => {
      if (document.visibilityState === "visible") usePresenceStore.setState({ lastActivityAt: Date.now(), status: "active" });
    }, 30_000);

    return () => {
      runRef.current++;
      n.cancel();
      cancelAutoScroll();
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

  // Keyboard: space play/pause · ←/→ steps · M mic · Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (t?.closest?.(".guide-voicemenu")) return; // picking a tutor: let the menu have the keys
      const a = actions.current;
      if (!a) return;
      if (e.key === " ") {
        e.preventDefault();
        a.togglePlay();
      } else if (e.key === "ArrowRight") a.next();
      else if (e.key === "ArrowLeft") a.prev();
      else if (e.key === "m" || e.key === "M") a.mic();
      else if (e.key === "Escape") a.close();
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
      <GuideBoard ref={board} enabled={boardEnabled} onClose={onBoardClose} onPin={pinVisual} />
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
        sttMode={sttMode}
        onPlayPause={togglePlay}
        onMic={mic}
        onClose={close}
      />
    </>
  );
}
