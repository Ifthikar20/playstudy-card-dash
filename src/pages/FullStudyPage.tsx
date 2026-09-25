import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem.mjs"; // \ce{...} chemistry in notes
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BookText,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Layers,
  ListChecks,
  Presentation,
  Loader2,
  Moon,
  NotebookText,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  SearchCheck,
  Sparkles,
  StickyNote,
  Sun,
  Trash2,
  Youtube,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";
import { ExamPlanStrip } from "@/components/exam/ExamPlanStrip";
import { SITTING_TOOL, type SittingMode } from "@/lib/examPlan";
import { primeSpeechAudio } from "@/lib/guide/speech";
import { StudyContentUpload } from "@/components/StudyContentUpload";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAppStore, type StudySession, type Topic } from "@/store/appStore";
import { usePresenceStore } from "@/store/presenceStore";
import {
  fetchSessionPdf,
  generateTopicNotes,
  getStudySession,
  reviseTopicNotes,
  updateTopicDetails,
  type HttpError,
} from "@/services/api";
import { QuizQuestion } from "@/components/study/QuizQuestion";
import { SectionQuiz } from "@/components/study/SectionQuiz";
import { SectionFlashcards } from "@/components/study/SectionFlashcards";
import { SectionStudyDialog, type StudyTarget, type StudyTool } from "@/components/study/SectionStudyDialog";
import { SessionQuizDialog } from "@/components/study/SessionQuizDialog";
import { SessionFlashcardsDialog } from "@/components/study/SessionFlashcardsDialog";
import { flattenSections, type Section, type StudyPanel, type WrongEntry } from "@/components/study/sections";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TeachMode, type ReviseNotesResult, type TeachSection } from "@/components/guide/TeachMode";
import { TeachMeButton } from "@/components/TeachMeButton";
import { StickySelection, StickySessionDialog } from "@/components/StickyNotes";
import { useStickyStore } from "@/store/stickyStore";
import { LoadingFacts } from "@/components/LoadingFacts";
import { BASE_NOTE_COMPONENTS, headingFactory, sanitizeNotes } from "@/lib/notes/render";
import { NoteParagraph } from "@/lib/notes/formula";
import { NOTE_PROSE, READ_PROSE } from "@/lib/notes/prose";
import { MATH_OPTS } from "@/lib/notes/units";
import { PaperNotes, type PaperNotesHandle } from "@/components/notes/PaperNotes";
import { ShellTrigger } from "@/components/AppShell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SHEETS, setSheet, useSheet } from "@/lib/studySurface";
import type { PdfPageInfo } from "@/components/pdf/PdfDocument";
import { trackAction } from "@/lib/analytics";
import { isNote, isNoteRoute, notePath } from "@/lib/notes/isNote";
import { joinPhrase, useDictation } from "@/lib/guide/dictation";
import { useTalkKey } from "@/lib/useTalkKey";
import { voiceKeyLabel } from "@/lib/voiceKey";
import { locateQuote } from "@/lib/guide/blocks";
import { DictateButton } from "@/components/notes/DictateButton";
import { NoteReview } from "@/components/notes/NoteReview";
import { answerCheck, deleteNote, fixCheck, renameNote, type CheckAnswer, type NoteCheck } from "@/services/notes";

// PDF.js is big: it only loads when someone opens the PDF view.
const PdfDocument = lazy(() => import("@/components/pdf/PdfDocument").then((m) => ({ default: m.PdfDocument })));

/** What the page shows: the notes, or the uploaded PDF itself. Remembered per session on this device. */
type StudyView = "notes" | "pdf";
const viewKey = (sessionId: string) => `an-study-view:${sessionId}`;
const NO_PAGES: PdfPageInfo[] = [];

/*
  Full Study — the one way to study. A session is a single scrolling note:
  every section has readable, auto-written notes (headings + highlights, editable
  by clicking into them) that run on into the next section with nothing in
  between, not even a toolbar. One Quiz button at the top of the page takes the
  student through every section's questions in turn, in a dialog, and a
  Flashcards button beside it deals every section's cards as one deck. In Teach
  mode the board offers each section's quiz at the end of that section and runs
  it there, and the student can ask the tutor out loud to change the notes
  ("make this simpler", "add an example"). Answer one at a time: a wrong first
  pick gets a hint and a second go, and anything got wrong is collected in
  "Wrong questions" at the top so it can be retried on its own.
*/

/* Shared Markdown renderer: pastel-highlighted headings (cycled in document
   order), <mark> highlights, and safe raw HTML (mark only). Used by both the
   notes card and Read mode so they render identically. */
function Markdown({ md }: { md: string }) {
  const counter = useRef(0);
  counter.current = 0;
  const heading = headingFactory(counter);
  const components = { ...BASE_NOTE_COMPONENTS, p: NoteParagraph, h2: heading("h2"), h3: heading("h3") };
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, [remarkMath, MATH_OPTS]]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      components={components as Components}
    >
      {sanitizeNotes(md)}
    </ReactMarkdown>
  );
}

/* --------------------------------------------------------------------------
   Read mode — a distraction-free reader. No app chrome; just the notes in a
   comfortable column on a dark or paper background. Controls fade out until you
   move; time spent here counts as reading.
-------------------------------------------------------------------------- */
function ReadMode({
  session,
  sections,
  theme,
  onToggleTheme,
  onClose,
}: {
  session: StudySession;
  sections: Section[];
  theme: "paper" | "night";
  onToggleTheme: () => void;
  onClose: () => void;
}) {
  const [showControls, setShowControls] = useState(true);

  // Controls fade out after a couple seconds of stillness, back on any input.
  useEffect(() => {
    let t: number | undefined;
    const ping = () => {
      setShowControls(true);
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => setShowControls(false), 2600);
    };
    ping();
    const evs: (keyof WindowEventMap)[] = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, ping, { passive: true }));
    return () => {
      if (t) window.clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, ping));
    };
  }, []);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep presence "active" while reading so quiet reading still counts as read
  // time; lock the page behind the overlay.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") usePresenceStore.setState({ lastActivityAt: Date.now(), status: "active" });
    }, 30_000);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearInterval(id);
      document.body.style.overflow = prev;
    };
  }, []);

  const paper = theme === "paper";
  const withNotes = sections.filter((s) => s.topic.notes);
  const ctrlBtn = cn(
    "flex size-9 items-center justify-center rounded-full border backdrop-blur transition-colors",
    paper ? "border-black/10 bg-black/5 text-black/70 hover:bg-black/10" : "border-white/15 bg-white/10 text-white/80 hover:bg-white/20",
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-y-auto"
      style={paper ? { backgroundColor: "#faf5ea", color: "#2b2a26" } : { backgroundColor: "#0c0c0e", color: "#e7e5df" }}
    >
      <div className={cn("fixed right-4 top-4 z-10 flex items-center gap-2 transition-opacity duration-300", showControls ? "opacity-100" : "pointer-events-none opacity-0")}>
        <button type="button" onClick={onToggleTheme} title="Background" aria-label="Toggle background" className={ctrlBtn}>
          {paper ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </button>
        <button type="button" onClick={onClose} title="Close (Esc)" aria-label="Close read mode" className={ctrlBtn}>
          <X className="size-4" />
        </button>
      </div>

      <article className="mx-auto max-w-[44rem] px-6 py-16 md:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-50">Reading · {session.title}</p>
        {withNotes.length === 0 ? (
          <p className="mt-10 text-base opacity-70">Notes are still being written for this session — give it a moment, then reopen Read mode.</p>
        ) : (
          withNotes.map((s) => (
            <section key={s.topic.id} className="mb-14 mt-10 first:mt-8">
              <h2 className="mb-2 text-2xl font-semibold tracking-tight md:text-[27px]">{s.topic.title}</h2>
              {s.topic.description && <p className="mb-5 text-base opacity-60">{s.topic.description}</p>}
              <div className={cn(READ_PROSE, paper ? "" : "prose-invert")}>
                <Markdown md={s.topic.notes!} />
              </div>
            </section>
          ))
        )}
        <div className="h-24" />
      </article>
    </div>,
    document.body,
  );
}

/*
  The page used to paint its own backdrop here: a base fill, a purple glow, a
  faint dot grid and — the reason light mode looked cream while dark mode did
  not — a HARD-CODED `hsl(32 95% 60% / 0.08)` amber that is not a token and
  never adapted to the theme. Because this div is `absolute inset-0` INSIDE the
  scrollport, it could never reach up behind the top strip, which is what made
  the page read as three stacked materials.

  The colour now comes from the chosen sheet, declared once on the content card
  and on <html> (index.css, `.an-sheet-surface` / `html[data-an-sheet]`), so it
  runs unbroken from the top of the card through overscroll. All that is left
  here is the grain, keyed off the sheet's OWN ink so it works on every swatch.
*/

/**
 * The background picker. The student's choice of paper, kept where they are
 * looking at it — in the page's own control row next to Read mode, not buried
 * in Profile & Settings, because it is a property of THIS page.
 */
function BackgroundPicker() {
  const sheet = useSheet();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Background — the paper these notes are written on"
          aria-label="Choose the background"
          className="flex items-center gap-1.5 rounded-full border border-border bg-foreground/[0.04] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.08]"
        >
          <Palette className="size-3.5" />
          Background
        </button>
      </PopoverTrigger>
      {/* The popover portals to <body>, outside the surface that carries the
          swatch tokens, so it is given them directly — otherwise the menu would
          be the only thing on screen still wearing the app palette. */}
      <PopoverContent align="end" data-an-sheet={sheet} className="an-sheet-surface w-60 p-1.5">
        <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Background
        </p>
        {SHEETS.map((sw) => (
          <button
            key={sw.id}
            type="button"
            onClick={() => setSheet(sw.id)}
            aria-pressed={sheet === sw.id}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
              sheet === sw.id && "bg-muted",
            )}
          >
            <span
              aria-hidden
              className="size-5 shrink-0 rounded-full border border-border"
              style={{
                background: sw.css ?? "linear-gradient(135deg, #ffffff 0 50%, #111111 50% 100%)",
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{sw.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{sw.hint}</span>
            </span>
            {sheet === sw.id && <Check className="size-3.5 shrink-0" />}
          </button>
        ))}
        <p className="px-2 pb-1 pt-2 text-[11px] leading-relaxed text-muted-foreground">
          Changes this page only, and is kept on this device — like Read mode's paper. Use the
          theme switch in the sidebar for the whole app.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/** Where the PDF will be while it downloads and PDF.js loads: a page-shaped placeholder. */
function PdfOpening({ label }: { label: string }) {
  return (
    <div className="mx-auto w-full max-w-[980px]">
      <div className="flex aspect-[1/1.294] w-full flex-col items-center justify-center gap-2 rounded-md bg-foreground/[0.04] text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Opening your {label === "Slides" ? "slides" : label}…
      </div>
    </div>
  );
}

/** A note with no words in it yet. */
const wordsIn = (md: string | null | undefined): number => {
  const text = (md ?? "").replace(/<[^>]+>/g, " ").replace(/[#*_>`~|[\]()-]/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
};
/** Below this, a note is too short to teach from or to quiz on. */
const NOTE_MIN_WORDS = 25;
/** The title a note has until it is given one; shown as an empty title field. */
const UNTITLED = "Untitled note";

/** A section with a quiz and flashcards: one the server has (a db id), and, in the
 *  student's own note, enough words to ask about. A PDF page never has them. One rule
 *  for the top Quiz and Flashcards, Teach mode's board and the sections it offers. */
const hasStudyTools = (topic: Topic, noteMode: boolean): boolean =>
  !!topic.db_id && (!noteMode || wordsIn(topic.notes) >= NOTE_MIN_WORDS);

/**
 * The whole session's Quiz and Flashcards, at the top of the page (in a note, in its top
 * bar). Only the sections with study tools are counted. Quiz says how far through them
 * the student is: "Quiz · 3/8" once one is done, "✓ Quiz" when every one is. Teach mode
 * points at the Quiz button (data-guide-quiz-top) at the end of a section when its
 * board is off, so it keeps that attribute.
 */
function SessionStudyButtons({
  sections,
  onQuiz,
  onFlashcards,
  tall = false,
}: {
  sections: Section[];
  onQuiz: () => void;
  onFlashcards: () => void;
  /** The note's top bar, whose buttons are a fixed height. */
  tall?: boolean;
}) {
  const n = sections.length;
  const done = sections.filter((s) => s.topic.completed).length;
  const all = n > 0 && done === n;
  const pill = cn("flex items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors", tall ? "h-8" : "py-1.5");
  const plain = "border-border bg-foreground/[0.04] text-foreground hover:bg-foreground/[0.08]";
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        data-guide-quiz-top=""
        onClick={onQuiz}
        title={
          all
            ? "Every section's quiz is done: review them, retry one or get fresh questions"
            : "Quiz yourself on every section, one after another"
        }
        aria-label={all ? "Quiz, every section done" : done > 0 ? `Quiz, ${done} of ${n} sections done` : "Quiz"}
        className={cn(pill, all ? "border-success/40 bg-success/10 text-success hover:bg-success/15" : plain)}
      >
        {all ? <Check className="size-3.5" /> : <ListChecks className="size-3.5" />}
        Quiz
        {!all && done > 0 && (
          <span className="font-medium tabular-nums text-muted-foreground">
            · {done}/{n}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onFlashcards}
        title={n > 1 ? "Every section's flashcards, in one deck" : "Flashcards from these notes"}
        className={cn(pill, plain)}
      >
        <Layers className="size-3.5" />
        Flashcards
      </button>
    </div>
  );
}

/*
  One screen per session. Keyed by the id in the URL, so going from one session or
  note to another starts clean: no wrong questions, open review, dictation or title
  edit carried over from the last one.
*/
export default function FullStudyPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  return <FullStudyScreen key={sessionId ?? "picker"} />;
}

function FullStudyScreen() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const currentSession = useAppStore((s) => s.currentSession);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const studySessions = useAppStore((s) => s.studySessions);
  const processStudyContent = useAppStore((s) => s.processStudyContent);
  const updateTopic = useAppStore((s) => s.updateTopic);
  const updateTopicByDbId = useAppStore((s) => s.updateTopicByDbId);
  const patchSession = useAppStore((s) => s.patchSession);
  const removeSession = useAppStore((s) => s.removeSession);
  const syncPendingProgress = useAppStore((s) => s.syncPendingProgress);

  /* A note of the student's own is this very screen, with the study scaffolding
     (progress, outline, exam plan, section numbering) taken away and a page title
     in its place. Decided by the URL first, so it looks right before it loads. */
  const noteRoute = isNoteRoute(location.pathname);
  const noteMode = noteRoute || isNote(currentSession);

  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [notesPending, setNotesPending] = useState<Set<string>>(new Set());
  const notesRunning = useRef(false);

  // Wrong questions collected across the whole session.
  const [wrong, setWrong] = useState<WrongEntry[]>([]);
  const [showWrong, setShowWrong] = useState(false);
  const [readMode, setReadMode] = useState(false);
  const [showStickies, setShowStickies] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [boardOn, setBoardOn] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // ---- every section's notes, by db id -------------------------------------------
  // Anything that locks the notes (Teach mode today) unmounts an open writing
  // surface, so it first has to know that what was typed is saved. Each section
  // registers its PaperNotes here; `flushNotes` saves them all and says which one
  // could not be saved, and why.
  const notesHandles = useRef(new Map<number, PaperNotesHandle>());
  const registerNotes = useCallback((dbId: number, handle: PaperNotesHandle | null) => {
    if (handle) notesHandles.current.set(dbId, handle);
    else notesHandles.current.delete(dbId);
  }, []);
  const [flushing, setFlushing] = useState(false);

  // ---- notes or the PDF ---------------------------------------------------------
  // A session built from a PDF (or slides, converted to one) can show the file
  // itself, and Teach mode then explains it page by page right on the page.
  const [view, setViewState] = useState<StudyView>("notes");
  const [fetchedPdf, setFetchedPdf] = useState<{ sessionId: string; file: ArrayBuffer } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  // The pages of the PDF on screen, once its text is in place - tied to that file, so
  // pages reported for another session's PDF are never taken for this one's.
  const [pdfReady, setPdfReady] = useState<{ file: string | ArrayBuffer; pages: PdfPageInfo[] } | null>(null);
  const currentId = currentSession?.id;
  // A new upload's response carries the file; the session list only says there is one.
  const inlinePdf =
    currentSession?.pdfContent || (currentSession?.fileType === "pdf" ? currentSession.fileContent : undefined) || undefined;
  const hasPdf = !!currentSession && (!!currentSession.hasPdf || !!inlinePdf);
  const showPdf = view === "pdf" && hasPdf;
  const pdfFile: string | ArrayBuffer | null = inlinePdf ?? (fetchedPdf && fetchedPdf.sessionId === currentId ? fetchedPdf.file : null);
  const pdfPages = showPdf && pdfReady && pdfReady.file === pdfFile ? pdfReady.pages : NO_PAGES;

  useEffect(() => {
    if (!sessionId) return;
    let stored: StudyView = "notes";
    try {
      stored = localStorage.getItem(viewKey(sessionId)) === "pdf" ? "pdf" : "notes";
    } catch {
      /* private mode */
    }
    setViewState(stored);
    setPdfError(null);
  }, [sessionId]);

  const setView = useCallback(
    (next: StudyView) => {
      setGuideOpen(false); // a lesson belongs to what was on screen when it started
      setViewState(next);
      trackAction("study_view", { view: next });
      setPdfReady(null); // the PDF lays itself out again when it comes back
      setPdfError(null);
      try {
        if (sessionId) localStorage.setItem(viewKey(sessionId), next);
      } catch {
        /* private mode */
      }
    },
    [sessionId],
  );

  useEffect(() => {
    if (!showPdf || !currentId || inlinePdf || fetchedPdf?.sessionId === currentId) return;
    const ctrl = new AbortController();
    setPdfError(null);
    fetchSessionPdf(currentId, ctrl.signal).then(
      (file) => setFetchedPdf({ sessionId: currentId, file }),
      (e: unknown) => {
        if (!ctrl.signal.aborted) setPdfError(e instanceof Error ? e.message : "Couldn't load the PDF.");
      },
    );
    return () => ctrl.abort();
  }, [showPdf, currentId, inlinePdf, fetchedPdf?.sessionId]);
  const [readTheme, setReadTheme] = useState<"paper" | "night">(() => {
    try {
      return (localStorage.getItem("an-read-theme") as "paper" | "night") || "paper";
    } catch {
      return "paper";
    }
  });
  const toggleReadTheme = useCallback(() => {
    setReadTheme((t) => {
      const next = t === "paper" ? "night" : "paper";
      try {
        localStorage.setItem("an-read-theme", next);
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);
  const addWrong = useCallback((e: WrongEntry) => {
    setWrong((list) => (list.some((w) => w.key === e.key) ? list : [...list, e]));
  }, []);
  const clearWrong = useCallback((key: string) => {
    setWrong((list) => list.filter((w) => w.key !== key));
  }, []);

  // ---- load the session named in the URL ------------------------------------
  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const existing = studySessions.find((s) => s.id === sessionId);
      if ((!currentSession || currentSession.id !== sessionId) && existing) setCurrentSession(existing);
      if (currentSession?.id === sessionId && currentSession.extractedTopics?.length) return;
      setIsLoadingSession(true);
      try {
        const full = await getStudySession(sessionId);
        setCurrentSession(full);
      } catch {
        /* session not found → the empty state below handles it */
        setLoadFailed(true);
      } finally {
        setIsLoadingSession(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // flush answers / progress when leaving
  useEffect(() => () => void syncPendingProgress(), [syncPendingProgress]);

  const sections = useMemo(() => flattenSections(currentSession?.extractedTopics), [currentSession?.extractedTopics]);
  const done = sections.filter((s) => s.topic.completed).length;
  const pct = sections.length ? Math.round((done / sections.length) * 100) : 0;

  // ---- the whole session's quiz and flashcards, from the buttons at the top ------
  // Only the sections with study tools, in reading order; the dialogs take the list as
  // it is and never work the rule out again. Both dialogs stay mounted, so a deck of
  // flashcards already dealt is still there when they're opened again.
  const studySections = useMemo(() => sections.filter((s) => hasStudyTools(s.topic, noteMode)), [sections, noteMode]);
  const [quizOpen, setQuizOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);

  // Sticky notes kept from this session (the wall itself lives on the dashboard).
  const stickyNotes = useStickyStore((s) => s.notes);
  const loadStickies = useStickyStore((s) => s.load);
  useEffect(() => {
    void loadStickies();
  }, [loadStickies]);
  const stickyCount = stickyNotes.filter((n) => n.study_session_id === sessionId).length;
  // Arriving from a sticky note: go to the section it was kept from, once its notes exist.
  const focusTopic = (location.state as { focusTopic?: number } | null)?.focusTopic ?? null;
  useEffect(() => {
    if (!focusTopic) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      const el = document.querySelector<HTMLElement>(`[data-guide-notes="${focusTopic}"]`);
      if (el) {
        window.clearInterval(timer);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("sticky-jump");
        window.setTimeout(() => el.classList.remove("sticky-jump"), 1800);
      } else if (++tries > 30) {
        window.clearInterval(timer);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [focusTopic]);

  /** Which section a highlighted phrase came from, by the id on its notes block. */
  const sectionOfNotes = useCallback(
    (notesKey: string) => {
      const page = Number(notesKey);
      if (page < 0) return { topicId: null, title: `Page ${-page}` }; // kept from the PDF itself
      const hit = sections.find((s) => String(s.topic.db_id) === notesKey);
      return hit?.topic.db_id ? { topicId: hit.topic.db_id, title: hit.topic.title } : null;
    },
    [sections],
  );

  // ---- auto-write notes for every section that doesn't have them yet --------
  // Sequential (one at a time) so we never overwhelm the single-worker dev API;
  // the backend call is idempotent, so re-opening a session costs nothing.
  useEffect(() => {
    if (!currentSession || notesRunning.current) return;
    // A note is the student's own writing: the AI never fills it in.
    if (noteRoute || isNote(currentSession)) return;
    const todo = flattenSections(currentSession.extractedTopics).filter((s) => s.topic.db_id && !s.topic.notes);
    if (!todo.length) return;
    const sessionId = currentSession.id;
    notesRunning.current = true;
    setNotesPending(new Set(todo.map((s) => s.topic.id)));
    (async () => {
      for (const s of todo) {
        try {
          const notes = await generateTopicNotes(sessionId, s.topic.db_id!, false);
          updateTopic(sessionId, s.topic.id, { notes });
        } catch {
          /* leave this one for the manual button */
        }
        setNotesPending((prev) => {
          const next = new Set(prev);
          next.delete(s.topic.id);
          return next;
        });
      }
      notesRunning.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id, currentSession?.extractedTopics?.length]);

  const scrollTo = useCallback((topicId: string) => {
    document.getElementById(`section-${topicId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /** On past a section: to the next one, or to the end of the session after the last. */
  const scrollPast = useCallback(
    (topicId: string) => {
      const at = sections.findIndex((s) => s.topic.id === topicId);
      const next = at >= 0 ? sections[at + 1] : undefined;
      if (next) scrollTo(next.topic.id);
      else document.getElementById("session-end")?.scrollIntoView({ behavior: "smooth" });
    },
    [sections, scrollTo],
  );

  // ---- one section's quiz or flashcards, in a dialog over the notes ---------------
  // Opened by the exam plan, whose sittings are each for one section.
  const [study, setStudy] = useState<StudyTarget | null>(null);
  const openStudy = useCallback((kind: StudyTool, topicId: string) => setStudy({ kind, topicId }), []);

  // The exam plan names sections by their server id; the page knows them by their
  // own. These two keep the strip able to name a section, go to it, and open the
  // quiz or the flashcards a sitting is for.
  const planSections = useMemo(() => sections.map((s) => ({ dbId: s.topic.db_id, title: s.topic.title })), [sections]);
  const openPlanSection = useCallback(
    (dbId: number, mode: SittingMode) => {
      const found = sections.find((s) => s.topic.db_id === dbId);
      if (!found) return;
      scrollTo(found.topic.id);
      const tool = SITTING_TOOL[mode];
      if (tool) openStudy(tool, found.topic.id);
    },
    [sections, scrollTo, openStudy],
  );

  // ---- the same tools on Teach mode's board -------------------------------------
  // The board draws whatever this returns in its panel; the page does the drawing
  // because the quiz belongs to the study store and the wrong-questions list here.
  // Null for anything without study tools: a PDF page, or a note too short to quiz.
  const renderStudyPanel = useCallback(
    (panel: StudyPanel): ReactNode => {
      const topic = sections.find((s) => s.topic.id === panel.topicId)?.topic;
      if (!currentSession || !topic || !hasStudyTools(topic, noteMode)) return null;
      if (panel.kind === "flashcards") {
        return <SectionFlashcards key={`cards:${topic.id}`} session={currentSession} topic={topic} compact onClose={panel.onDone} />;
      }
      // Keyed by the section alone: an invitation the board relabels "quiz" once it is
      // taken up carries on as the same quiz, not a second one starting over. A hint
      // the quiz shows goes to the board too, which says it in the tutor's bubble.
      return (
        <SectionQuiz
          key={`quiz:${topic.id}`}
          session={currentSession}
          topic={topic}
          onWrong={addWrong}
          onRight={clearWrong}
          onDone={panel.onDone}
          onStart={panel.onStart}
          onHint={panel.onHint}
          invite={panel.kind === "invite"}
          compact
        />
      );
    },
    [sections, currentSession, noteMode, addWrong, clearWrong],
  );

  // ---- the tutor's questions about a section's notes ------------------------------
  // Asked by an earlier check and not all answered yet: the section says so, and
  // `reviewing` is while the pointer goes through them. That locks the notes, like
  // Teach mode, so nothing moves under it.
  const [reviewing, setReviewing] = useState<number | null>(null);
  const frozen = guideOpen || reviewing != null;

  // ---- dictation: one microphone, for the student's own note --------------------
  // Words go into the note's one section. Study notes have no Dictate: the tutor's
  // mic in Teach mode changes those. The talk key (chosen at onboarding) starts it too.
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const dictTarget = useRef<number | null>(null);
  const [dictFor, setDictFor] = useState<number | null>(null);
  const touched = useRef(false);
  const insertDictated = useCallback((phrase: string) => {
    const dbId = dictTarget.current;
    const handle = dbId != null ? notesHandles.current.get(dbId) : undefined;
    if (dbId == null || !handle) throw new Error("There is no page to write into.");
    const sheet = pageRef.current?.querySelector<HTMLTextAreaElement>(`[data-guide-notes="${dbId}"] textarea[data-an-input]`);
    const before = sheet
      ? sheet.value.slice(0, sheet.selectionStart ?? sheet.value.length)
      : (sectionsRef.current.find((s) => s.topic.db_id === dbId)?.topic.notes ?? "");
    if (!handle.insertText(joinPhrase(before, phrase))) throw new Error("These notes can't be written in right now.");
  }, []);
  const dictation = useDictation(insertDictated, { markdown: true });

  const toggleDictation = () => {
    if (dictation.state !== "off") {
      dictation.stop();
      return;
    }
    if (frozen || !noteMode) return;
    if (dictation.mode === "none") {
      toast({ title: "Voice input isn't available here", description: "This browser or page can't use the microphone — type instead." });
      return;
    }
    const target = sectionsRef.current[0]?.topic.db_id;
    if (target == null || !notesHandles.current.has(target)) {
      toast({ title: "Nothing to write into yet", description: "The note is still opening. Try again in a moment." });
      return;
    }
    dictTarget.current = target;
    setDictFor(target);
    touched.current = true;
    void dictation.start();
  };
  const voiceKey = useTalkKey(() => toggleDictation(), { enabled: !frozen && noteMode });

  useEffect(() => {
    if (dictation.error) toast({ title: "Dictation", description: dictation.error, variant: "destructive" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictation.error]);
  // Nothing may write into notes that something else is going through.
  useEffect(() => {
    if (frozen && dictation.state !== "off") dictation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen]);
  useEffect(() => {
    if (dictation.state === "off") setDictFor(null);
  }, [dictation.state]);

  // ---- the note's title, saved as it is typed -------------------------------------
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const pendingTitle = useRef<string | null>(null);
  const saveTitle = useCallback(async () => {
    const title = pendingTitle.current;
    const id = sessionId;
    if (title == null || !id) return;
    pendingTitle.current = null;
    try {
      const res = await renameNote(id, title.trim());
      patchSession(id, { title: res.title, updatedAt: res.updatedAt ?? Date.now() });
      const leaf = sectionsRef.current[0]?.topic.db_id;
      if (leaf) updateTopicByDbId(id, leaf, { title: res.title });
    } catch (e) {
      toast({ title: "Couldn't rename this note", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, patchSession, updateTopicByDbId]);
  useEffect(() => {
    if (titleDraft == null) return;
    pendingTitle.current = titleDraft;
    const timer = window.setTimeout(() => void saveTitle(), 600);
    return () => window.clearTimeout(timer);
  }, [titleDraft, saveTitle]);
  // Leaving mid-word still saves it.
  useEffect(() => () => void saveTitle(), [saveTitle]);

  // ---- a note made and left without a word in it goes away ----------------------
  // Only one made on this visit ("New note" → here), so nothing the student kept
  // on purpose is ever removed. Typing, dictating or naming it keeps it.
  const fresh = !!(location.state as { fresh?: boolean } | null)?.fresh;
  useEffect(() => {
    const page = pageRef.current;
    if (!fresh || !page) return;
    const mark = () => {
      touched.current = true;
    };
    page.addEventListener("input", mark, true);
    return () => page.removeEventListener("input", mark, true);
  });
  useEffect(() => {
    if (!fresh || !sessionId) return;
    return () => {
      if (touched.current) return;
      // Only when they have gone somewhere else: the router has already moved the URL by
      // now. A remount on the same page (an error boundary, a hot reload) is not leaving.
      if (window.location.pathname === notePath(sessionId)) return;
      const state = useAppStore.getState();
      const note = state.currentSession?.id === sessionId ? state.currentSession : state.studySessions.find((s) => s.id === sessionId);
      const text = flattenSections(note?.extractedTopics).map((s) => s.topic.notes ?? "").join("");
      if (!note || text.trim() || (note.title && note.title !== UNTITLED)) return;
      state.removeSession(sessionId);
      void deleteNote(sessionId).catch(() => undefined);
    };
  }, [fresh, sessionId]);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const removeNote = async () => {
    if (!sessionId) return;
    setDeleting(true);
    try {
      if (dictation.state !== "off") dictation.stop();
      pendingTitle.current = null;
      touched.current = true; // it's going anyway; the leave-empty sweep must not race it
      await deleteNote(sessionId);
      removeSession(sessionId);
      navigate("/dashboard");
      toast({ title: "Note deleted" });
    } catch (e) {
      toast({ title: "Couldn't delete this note", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
      setDeleting(false);
    }
  };

  // ------------------------------------------------------------------ states
  if (sessionId && currentSession && currentSession.id !== sessionId) {
    // The store still holds the last session while this one loads.
    if (loadFailed && !isLoadingSession) return <GoneState note={noteRoute} />;
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-3 w-full" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (noteRoute && !currentSession && !isLoadingSession) return <GoneState note />;

  if (!sessionId || (!currentSession && !isLoadingSession)) {
    return (
      <SessionPicker
        sessions={studySessions.filter((s) => !isNote(s))}
        onCreate={() => setShowCreate(true)}
        onOpen={(s) => {
          setCurrentSession(s);
          navigate(`/dashboard/${s.id}/full-study`);
        }}
        create={<CreateStudySessionDialog open={showCreate} onOpenChange={setShowCreate} />}
      />
    );
  }

  if (isLoadingSession && !currentSession?.extractedTopics?.length) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-3 w-full" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
        <LoadingSpinner message="Opening your notes…" size="sm" />
      </div>
    );
  }

  if (currentSession && (!currentSession.extractedTopics || currentSession.extractedTopics.length === 0)) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">{currentSession.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This session has no content yet. Paste your material and AnotherNotes will write the notes, and a quiz to go with them.
        </p>
        <div className="mt-6">
          <StudyContentUpload onContentSubmit={(c) => processStudyContent(currentSession.id, c)} isProcessing={false} />
        </div>
      </div>
    );
  }

  const session = currentSession!;
  // In the PDF view every page is a "section": dbId -N is page N (its text layer
  // carries data-guide-notes="-N", and the backend reads -N as that page).
  // `studyTools`: the section has a quiz and flashcards for the board to offer (the
  // same rule as the Quiz and Flashcards at the top). A PDF page has neither.
  const teachSections: TeachSection[] = showPdf
    ? pdfPages.map((p) => ({ topicId: `pdf-${p.page}`, dbId: -p.page, title: `Page ${p.page}`, index: p.page, studyTools: false }))
    : sections
        .filter((s) => s.topic.db_id)
        .map((s) => ({
          topicId: s.topic.id,
          dbId: s.topic.db_id!,
          title: s.topic.title,
          index: s.index,
          studyTools: hasStudyTools(s.topic, noteMode),
        }));
  const pdfLabel = session.fileType === "pptx" ? "Slides" : "PDF";
  const pdfNoun = pdfLabel === "Slides" ? "slides" : "PDF"; // mid-sentence
  const teachReady = !showPdf || pdfPages.length > 0;

  /** Save every open writing surface. Null when all of it is saved, otherwise a
   *  sentence naming the section that isn't and why — for the toast. */
  const flushNotes = async (): Promise<string | null> => {
    const handles = [...notesHandles.current];
    const results = await Promise.all(handles.map(async ([dbId, h]) => ((await h.flush()) ? null : { dbId, why: h.problem() })));
    const failed = results.find((r) => r !== null);
    if (!failed) return null;
    const title = sections.find((s) => s.topic.db_id === failed.dbId)?.topic.title;
    const why = (failed.why ?? "it couldn't be saved").replace(/[.\s]+$/, "");
    return `${title ? `“${title}”` : "A section"} has changes that aren't saved yet — ${why.charAt(0).toLowerCase()}${why.slice(1)}.`;
  };

  const openTeach = async () => {
    // Before any await: the audio unlock has to happen inside the click itself.
    primeSpeechAudio();
    setFlushing(true);
    try {
      const problem = await flushNotes();
      if (problem) {
        // Locking would close the surface and lose those words, so it waits.
        toast({ title: "The lesson can't start yet", description: problem, variant: "destructive" });
        return;
      }
      setGuideOpen(true);
    } finally {
      setFlushing(false);
    }
  };

  /** Save what is typed, then lock the notes. False (after saying why) when it can't be saved. */
  const saveThenLock = async (what: string): Promise<boolean> => {
    if (dictation.state !== "off") dictation.stop();
    setFlushing(true);
    try {
      const problem = await flushNotes();
      if (problem) toast({ title: `${what} can't start yet`, description: problem, variant: "destructive" });
      return !problem;
    } finally {
      setFlushing(false);
    }
  };

  /**
   * Teach mode's mic changing a section's notes ("make this simpler"): the same revise
   * and structure guard the notes have always gone through, then the new notes go into
   * the store, which redraws them under the lesson. `topicId` is the section's store id.
   * Never while something else has those notes open (a hand edit still being written,
   * the tutor's questions): the rewrite would land under it.
   */
  const reviseNotes = async (topicId: string, instruction: string): Promise<ReviseNotesResult> => {
    const topic = sectionsRef.current.find((s) => s.topic.id === topicId)?.topic;
    if (!topic?.db_id) return { ok: false, refused: false, message: "This section can't be changed here." };
    if (reviewing != null || notesHandles.current.get(topic.db_id)?.isEditing()) {
      return { ok: false, refused: false, message: "These notes are open for editing right now." };
    }
    try {
      const { notes, noteChecks } = await reviseTopicNotes(session.id, topic.db_id, instruction);
      updateTopic(session.id, topic.id, { notes });
      // The rewrite can move or remove the words the tutor asked about; the server
      // re-placed its questions over the new notes, as it does after a hand edit.
      if (noteChecks) updateTopicByDbId(session.id, topic.db_id, { noteChecks });
      patchSession(session.id, { updatedAt: Date.now() });
      return { ok: true };
    } catch (e) {
      // 422: the guard turned the change down (it would have lost a formula, a table or
      // a pinned picture), and the message says why. Anything else may work next time.
      return { ok: false, refused: (e as HttpError).status === 422, message: e instanceof Error ? e.message : "" };
    }
  };

  /** Back to the questions left open last time. */
  const resumeReview = async (dbId: number) => {
    primeSpeechAudio();
    if (await saveThenLock("The questions")) setReviewing(dbId);
  };

  const reviewTopic = reviewing != null ? sections.find((s) => s.topic.db_id === reviewing)?.topic : undefined;
  const noteTopic = noteMode ? sections[0]?.topic : undefined;
  const noteWords = wordsIn(noteTopic?.notes);
  const noteTitle = titleDraft ?? (session.title === UNTITLED ? "" : session.title);
  const bareTalkKey = !voiceKey.alt && !voiceKey.ctrl && !voiceKey.meta;

  return (
    <div ref={pageRef} className="relative -m-4 min-h-full md:-m-6">
      {/* Grain only — the colour is the sheet, which reaches the top of the
          content card and the overscroll beyond it. */}
      <div aria-hidden className="an-sheet-grain pointer-events-none absolute inset-0" />
      <div className="guide-shift relative p-4 md:p-6">
        <div className={cn("fade-in mx-auto w-full", noteMode ? "max-w-[64rem]" : "max-w-[76rem]")}>
      {noteMode ? (
        /* A note: Notion's shape. A quiet top bar (where you are · what you can do),
           then the page's own title, big and editable in place, lined up with the
           text below it. Everything under the title is the same Full Study section. */
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="-ml-1 flex min-w-0 items-center gap-0.5">
              <ShellTrigger />
              <Link
                to="/dashboard"
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <ChevronLeft className="size-3.5" />
                Dashboard
              </Link>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">/ Notes</span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="mr-1 hidden text-xs tabular-nums text-muted-foreground sm:inline">
                {noteWords} word{noteWords === 1 ? "" : "s"}
              </span>
              {/* A note's only writing tools: talk it in, or put the caret in it
                  (clicking anywhere in the text does that too). */}
              <DictateButton
                dictation={dictation}
                disabled={frozen || !noteTopic?.db_id}
                onToggle={toggleDictation}
                className="h-8"
              />
              <button
                type="button"
                disabled={frozen || !noteTopic?.db_id}
                onClick={() => noteTopic?.db_id && notesHandles.current.get(noteTopic.db_id)?.startEditing()}
                title={
                  frozen
                    ? "Writing pauses while AnotherNotes is going through this note"
                    : "Put the caret in this note (or just click where you want to write)"
                }
                className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-foreground/[0.04] px-3 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Pencil className="size-3.5" />
                Write
              </button>
              {/* A note's header is this bar, so its Quiz and Flashcards are here, once
                  there is enough in it to be asked about. */}
              {studySections.length > 0 && (
                <SessionStudyButtons sections={studySections} onQuiz={() => setQuizOpen(true)} onFlashcards={() => setCardsOpen(true)} tall />
              )}
              <TeachMeButton
                tall
                disabled={flushing || frozen || noteWords < NOTE_MIN_WORDS}
                onClick={() => void openTeach()}
                title={
                  noteWords < NOTE_MIN_WORDS
                    ? "Write a little more first — the tutor needs something to explain"
                    : "Teach me: AnotherNotes AI scrolls, points and explains these notes out loud"
                }
              />
              {guideOpen && (
                <button
                  type="button"
                  onClick={() => setBoardOn((v) => !v)}
                  title={boardOn ? "Hide the working-out board" : "Show the working-out board"}
                  aria-pressed={boardOn}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
                    boardOn
                      ? "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300"
                      : "border-border bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08]",
                  )}
                >
                  <Presentation className="size-3.5" />
                  Board
                </button>
              )}
              <button
                type="button"
                onClick={() => setReadMode(true)}
                disabled={noteWords === 0}
                title="Distraction-free reading"
                aria-label="Read mode"
                className="flex size-8 items-center justify-center rounded-full border border-border bg-foreground/[0.04] text-foreground transition-colors hover:bg-foreground/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <BookText className="size-3.5" />
              </button>
              <BackgroundPicker />
              <Popover open={confirmDelete} onOpenChange={setConfirmDelete}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={frozen || deleting}
                    title="Delete this note"
                    aria-label="Delete this note"
                    className="flex size-8 items-center justify-center rounded-full border border-border bg-foreground/[0.04] text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3">
                  <p className="text-sm font-semibold">Delete this note?</p>
                  <p className="mt-1 text-xs text-muted-foreground">It goes for good, with anything the tutor asked about it.</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8" disabled={deleting} onClick={() => void removeNote()}>
                      {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      Delete
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Same margins as the text under it, so the title sits over the first letter. */}
          <div className="px-6 pt-10 sm:px-12 sm:pt-14 lg:px-16">
            <div className="mx-auto max-w-[78ch]">
              <input
                value={noteTitle}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter goes on to the page, as in Notion.
                  if (e.key === "Enter" && noteTopic?.db_id) {
                    e.preventDefault();
                    notesHandles.current.get(noteTopic.db_id)?.startEditing(0);
                  }
                }}
                onBlur={() => void saveTitle()}
                placeholder="Untitled"
                aria-label="Note title"
                // A note just made starts at its title, as in Notion; Enter goes on to the page.
                autoFocus={fresh && !session.title.trim().replace(UNTITLED, "")}
                maxLength={200}
                disabled={frozen}
                className="w-full bg-transparent text-3xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 disabled:opacity-100 md:text-[40px] md:leading-tight"
              />
            </div>
          </div>
        </div>
      ) : (
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {/* What the removed top strip carried, in the page itself: the
              sidebar trigger (the only touch affordance for navigation, and
              therefore for search, on a phone or a collapsed rail — it still
              renders NOTHING on a hover-capable desktop with the sidebar open)
              and a real link back to the dashboard. Both are in normal flow, so
              they cost nothing at 360px and overlap nothing. */}
          <div className="-ml-1 flex items-center gap-0.5">
            <ShellTrigger />
            <Link
              to="/dashboard"
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
              Dashboard
            </Link>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              / Full Study
            </span>
          </div>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight md:text-[28px]">{session.title}</h1>
        </div>
        {/* Wraps: this cluster gained a control and a 360px phone cannot
            hold the modes, the picker and the progress meter on one line. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          {hasPdf && (
            <div
              role="radiogroup"
              aria-label="Study from"
              className="flex items-center rounded-full border border-border bg-foreground/[0.04] p-0.5"
            >
              {(["notes", "pdf"] as const).map((v) => {
                const on = (v === "pdf") === showPdf;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => !on && setView(v)}
                    title={
                      v === "pdf"
                        ? `The ${pdfNoun} you uploaded. Press Teach me and it's explained right on the page.`
                        : `The notes written from your ${pdfNoun}`
                    }
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v === "pdf" ? <FileText className="size-3.5" /> : <NotebookText className="size-3.5" />}
                    {v === "pdf" ? pdfLabel : "Notes"}
                  </button>
                );
              })}
            </div>
          )}
          <TeachMeButton
            disabled={!teachReady || flushing}
            onClick={() => void openTeach()}
            title={
              !teachReady
                ? `Opening the ${pdfNoun}…`
                : flushing
                  ? "Saving your notes first…"
                  : showPdf
                    ? `Teach me: AnotherNotes AI goes through your ${pdfNoun} page by page, pointing at each part as it explains it`
                    : "Teach me: AnotherNotes AI scrolls, points and explains these notes out loud"
            }
            // only ever off for a moment here (the PDF opening, the notes saving)
            className="disabled:cursor-wait"
          />
          {guideOpen && (
            <button
              type="button"
              onClick={() => setBoardOn((v) => !v)}
              title={boardOn ? "Hide the working-out board" : "Show the working-out board"}
              aria-pressed={boardOn}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                boardOn
                  ? "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300"
                  : "border-border bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08]",
              )}
            >
              <Presentation className="size-3.5" />
              Board
            </button>
          )}
          {/* The session's one Quiz (every section in turn) and one deck of flashcards,
              up here rather than on each section, so the notes read as one document. */}
          {studySections.length > 0 && (
            <SessionStudyButtons sections={studySections} onQuiz={() => setQuizOpen(true)} onFlashcards={() => setCardsOpen(true)} />
          )}
          <button
            type="button"
            onClick={() => setReadMode(true)}
            title="Distraction-free reading"
            className="flex items-center gap-1.5 rounded-full border border-border bg-foreground/[0.04] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.08]"
          >
            <BookText className="size-3.5" />
            Read mode
          </button>
          <BackgroundPicker />
          {/* Where these notes came from: a link, not a banner across the page. */}
          {session.sourceKind === "youtube" && session.sourceUrl && (
            <a
              href={session.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Built from this video's transcript — ${session.sourceUrl}`}
              aria-label="Open the video these notes were built from"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-foreground/[0.04] text-muted-foreground transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-600"
            >
              <Youtube className="size-4" />
            </a>
          )}
          {stickyCount > 0 && (
            <button
              type="button"
              onClick={() => setShowStickies(true)}
              title="Everything you've kept from this session"
              className="flex items-center gap-2 rounded-full border border-border bg-foreground/[0.04] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.08]"
            >
              <StickyNote className="size-3.5" />
              Sticky notes
              <span className="flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-bold text-background tabular-nums">
                {stickyCount}
              </span>
            </button>
          )}
          {wrong.length > 0 && (
            <button
              type="button"
              onClick={() => setShowWrong(true)}
              className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
            >
              <AlertTriangle className="size-3.5" />
              Wrong questions
              <span className="flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white tabular-nums">
                {wrong.length}
              </span>
            </button>
          )}
          <div className="w-full min-w-0 sm:w-56">
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span className="tabular-nums">
                {done} of {sections.length} sections
              </span>
              <span className="tabular-nums font-semibold text-foreground">{pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-[width] duration-500", pct >= 100 ? "bg-success" : "bg-chart-1")}
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Studying for an exam: what today is for, and whether they're keeping up. */}
      {!noteMode && (
        <ExamPlanStrip
          sessionId={session.id}
          sessionTitle={session.title}
          sections={planSections}
          onOpenSection={openPlanSection}
        />
      )}

      <div
        className={cn(
          "guide-grid grid gap-x-10 gap-y-6",
          noteMode ? "mt-0" : "mt-6 lg:grid-cols-[minmax(0,1fr)_15rem]",
        )}
      >
        {/* Document: the uploaded PDF itself… */}
        {showPdf ? (
          <div className="order-2 min-w-0 lg:order-1">
            {/* The view choice is remembered per session, so a student who
                picked the PDF once comes back to a page with none of the
                editing tools on it. This says where they went, one click away. */}
            {!pdfError && (
              <div
                data-an-chrome=""
                className="mx-auto mb-4 flex w-full max-w-[980px] flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-border bg-foreground/[0.03] px-4 py-2 text-xs text-muted-foreground"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <NotebookText className="size-3.5 shrink-0" />
                  The notes written from your {pdfNoun}, and editing them, are in Notes view
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setView("notes")}>
                  Switch to Notes
                </Button>
              </div>
            )}
            {pdfError ? (
              <div className="rounded-2xl border border-border bg-foreground/[0.03] p-6 text-center">
                <p className="text-sm font-semibold">{pdfError}</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => setView("notes")}>
                  Back to the notes
                </Button>
              </div>
            ) : pdfFile ? (
              <Suspense fallback={<PdfOpening label={pdfLabel} />}>
                <PdfDocument file={pdfFile} onReady={(pages) => setPdfReady({ file: pdfFile, pages })} />
              </Suspense>
            ) : (
              <PdfOpening label={pdfLabel} />
            )}
          </div>
        ) : (
        /* …or the notes written from it */
        <div className="order-2 min-w-0 space-y-12 lg:order-1">
          {sections.map((s) => (
            <StudySection
              key={s.topic.id}
              section={s}
              total={sections.length}
              session={session}
              notesLoading={notesPending.has(s.topic.id)}
              frozen={frozen}
              registerNotes={registerNotes}
              noteMode={noteMode}
              fresh={fresh}
              placeholder={
                bareTalkKey
                  ? "Start writing, or click Dictate and talk. Type / for headings, lists and more."
                  : `Start writing, or press ${voiceKeyLabel(voiceKey)} and talk. Type / for headings, lists and more.`
              }
              interim={dictFor != null && dictFor === s.topic.db_id ? dictation.interim : undefined}
              onResume={resumeReview}
            />
          ))}

          {!noteMode && (
          <div id="session-end" className="rounded-2xl border border-border bg-foreground/[0.03] p-6 text-center">
            {pct >= 100 ? (
              <>
                <p className="text-sm font-semibold">You've finished every section.</p>
                <p className="mt-1 text-xs text-muted-foreground">Come back to review, or start something new.</p>
                <Button asChild size="sm" className="mt-4">
                  <Link to="/dashboard">Back to dashboard</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">
                  {sections.length - done} section{sections.length - done === 1 ? "" : "s"} to go
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Read the notes, then press Quiz at the top of the page: it goes through each section's questions in turn.
                </p>
              </>
            )}
          </div>
          )}
        </div>
        )}

        {/* Outline */}
        <nav className={cn("order-1 hidden lg:order-2", !noteMode && "lg:block")}>
          <div className={cn("sticky top-2 space-y-1", showPdf && "max-h-[calc(100vh-1rem)] overflow-y-auto pb-2")}>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {showPdf ? "Pages" : "On this page"}
            </p>
            {showPdf && pdfPages.map((p) => (
              <button
                key={p.page}
                type="button"
                onClick={() => document.getElementById(`pdf-page-${p.page}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <FileText className="mt-px size-3.5 shrink-0 text-muted-foreground/60" />
                <span className="min-w-0">
                  <span className="block tabular-nums text-foreground">Page {p.page}</span>
                  {p.heading && <span className="line-clamp-1 text-muted-foreground">{p.heading}</span>}
                </span>
              </button>
            ))}
            {!showPdf && sections.map((s) => (
              <button
                key={s.topic.id}
                type="button"
                onClick={() => scrollTo(s.topic.id)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                {s.topic.completed ? (
                  <CheckCircle2 className="mt-px size-3.5 shrink-0 text-success" />
                ) : (
                  <Circle className="mt-px size-3.5 shrink-0 text-muted-foreground/60" />
                )}
                <span className={cn("line-clamp-2", s.topic.completed ? "text-muted-foreground" : "text-foreground")}>
                  <span className="tabular-nums text-muted-foreground">{s.index}. </span>
                  {s.topic.title}
                </span>
              </button>
            ))}
          </div>
        </nav>
      </div>

          <WrongQuestionsDialog open={showWrong} onOpenChange={setShowWrong} entries={wrong} onClear={clearWrong} />
          <SessionQuizDialog
            session={session}
            sections={studySections}
            open={quizOpen}
            onOpenChange={setQuizOpen}
            onWrong={addWrong}
            onRight={clearWrong}
          />
          <SessionFlashcardsDialog session={session} sections={studySections} open={cardsOpen} onOpenChange={setCardsOpen} />
          <SectionStudyDialog
            session={session}
            target={study}
            onClose={() => setStudy(null)}
            onWrong={addWrong}
            onRight={clearWrong}
            onContinue={scrollPast}
          />
          <StickySessionDialog open={showStickies} onOpenChange={setShowStickies} sessionId={session.id} />
          {/* highlight anything in the notes → "Save to sticky" */}
          <StickySelection sessionId={session.id} resolve={sectionOfNotes} />
        </div>
      </div>
      {readMode && (
        <ReadMode
          session={session}
          sections={sections}
          theme={readTheme}
          onToggleTheme={toggleReadTheme}
          onClose={() => setReadMode(false)}
        />
      )}
      {guideOpen && teachReady && (
        <TeachMode
          key={showPdf ? "pdf" : "notes"}
          sessionId={session.id}
          sections={teachSections}
          hostRef={pageRef}
          onClose={() => setGuideOpen(false)}
          boardEnabled={boardOn}
          onBoardClose={() => setBoardOn(false)}
          source={showPdf ? "pdf" : "notes"}
          // The board draws a section's quiz (at the end of the section) and its
          // flashcards (from the board's footer) with this.
          renderPanel={renderStudyPanel}
          // "Make this simpler", asked out loud: the section's notes are rewritten here.
          reviseNotes={reviseNotes}
        />
      )}
      {reviewing != null && reviewTopic && (
        <NoteReview
          key={reviewing}
          host={pageRef.current}
          checks={reviewTopic.noteChecks ?? []}
          locate={(c: NoteCheck) => {
            // Looked up fresh every time: a fix re-renders the notes.
            const root = pageRef.current?.querySelector<HTMLElement>(`[data-guide-notes="${reviewing}"]`);
            return root ? locateQuote(root, c.quote, c.start) : null;
          }}
          onAnswer={async (c: NoteCheck, answer: CheckAnswer) => {
            const checks = await answerCheck(session.id, reviewing, c.id, answer);
            updateTopicByDbId(session.id, reviewing, { noteChecks: checks });
          }}
          onFix={async (c: NoteCheck) => {
            try {
              const res = await fixCheck(session.id, reviewing, c.id);
              updateTopicByDbId(session.id, reviewing, { notes: res.notes, noteChecks: res.checks });
              patchSession(session.id, { updatedAt: Date.now() });
            } catch (e) {
              if ((e as { status?: number }).status === 409) {
                throw new Error("Those words have changed since the check — fix this one yourself.");
              }
              throw e;
            }
          }}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}

/** A note or session that isn't there (deleted, or never was). */
function GoneState({ note }: { note?: boolean }) {
  return (
    <div className="mx-auto mt-16 w-full max-w-sm text-center">
      <p className="text-sm font-semibold">{note ? "This note isn't here any more" : "This session isn't here any more"}</p>
      <p className="mt-1 text-xs text-muted-foreground">It may have been deleted, or the link is wrong.</p>
      <Button asChild size="sm" variant="outline" className="mt-4">
        <Link to="/dashboard">Back to the dashboard</Link>
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------------------
   One section: heading · notes. No toolbar and no study tools: the notes are
   written in by clicking into them, the Quiz and Flashcards are at the top of
   the page, and Teach mode's mic changes the notes when asked.
-------------------------------------------------------------------------- */
function StudySection({
  section,
  total,
  session,
  notesLoading,
  frozen,
  registerNotes,
  noteMode,
  fresh,
  placeholder,
  interim,
  onResume,
}: {
  section: Section;
  total: number;
  session: StudySession;
  notesLoading: boolean;
  /** Something is going through these notes (Teach mode, the tutor's questions):
   *  nothing may change them or reflow them until it is done, so every tool that
   *  writes is disabled and the notes are read-only. */
  frozen: boolean;
  /** Tells the page where this section's notes are, so it can save them before
   *  anything locks them. Called with null when they go. */
  registerNotes: (dbId: number, handle: PaperNotesHandle | null) => void;
  /** The student's own note: no section heading (the page title is it), may be
   *  empty and is never written by the AI. */
  noteMode: boolean;
  /** A note made on this visit: its title has the caret, so the page waits to be clicked into. */
  fresh: boolean;
  /** What an empty page says. */
  placeholder: string;
  /** What dictation has heard so far and not yet written, while it writes into THIS section. */
  interim?: string;
  /** Go through the questions left open from the last check. */
  onResume: (dbId: number) => void;
}) {
  const { toast } = useToast();
  const { topic, index, category } = section;

  const updateTopic = useAppStore((s) => s.updateTopic);
  const updateTopicByDbId = useAppStore((s) => s.updateTopicByDbId);
  const patchSession = useAppStore((s) => s.patchSession);

  // Notes editing
  const notesRef = useRef<PaperNotesHandle | null>(null);
  /* A callback ref, so the page's register follows the handle through every
     change: PaperNotes only mounts once notes exist, and rebuilds its handle
     each time it opens or closes the writing surface. */
  const dbId = topic.db_id;
  const bindNotes = useCallback(
    (handle: PaperNotesHandle | null) => {
      notesRef.current = handle;
      if (dbId) registerNotes(dbId, handle);
    },
    [dbId, registerNotes],
  );
  // The title and summary, edited in place. (The notes are written straight into the
  // page, through PaperNotes, so they have no draft here.)
  const [editingHead, setEditingHead] = useState(false);
  const [draftTitle, setDraftTitle] = useState(topic.title);
  const [draftDesc, setDraftDesc] = useState(topic.description ?? "");
  const [saving, setSaving] = useState(false);
  const [writing, setWriting] = useState(false);

  const save = async () => {
    if (!topic.db_id) return;
    setSaving(true);
    try {
      const patch = { title: draftTitle.trim() || topic.title, description: draftDesc.trim() };
      await updateTopicDetails(session.id, topic.db_id, patch);
      updateTopic(session.id, topic.id, patch);
      setEditingHead(false);
    } catch (e) {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /** One line of the notes changed: persist the whole body, adopt the server's
   *  copy. The candidate document has already been proven safe by guardSplice. */
  const saveNotes = useCallback(
    async (next: string) => {
      if (!topic.db_id) return;
      const res = await updateTopicDetails(session.id, topic.db_id, { notes: next });
      const adopted = typeof res?.notes === "string" ? res.notes : next;
      updateTopic(session.id, topic.id, { notes: adopted });
      // An edit can move or remove the words the tutor asked about; the server
      // re-places its questions and says which are still there.
      if (Array.isArray(res?.noteChecks)) updateTopicByDbId(session.id, topic.db_id, { noteChecks: res.noteChecks });
      patchSession(session.id, { updatedAt: res?.updatedAt ?? Date.now() });
      return adopted;
    },
    [session.id, topic.db_id, topic.id, updateTopic, updateTopicByDbId, patchSession],
  );

  const openChecks = (topic.noteChecks ?? []).filter((c) => c.answer == null).length;

  const writeNotes = async (force = false) => {
    if (!topic.db_id) return;
    setWriting(true);
    try {
      const notes = await generateTopicNotes(session.id, topic.db_id, force);
      updateTopic(session.id, topic.id, { notes });
    } catch (e) {
      toast({ title: "Couldn't write notes", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setWriting(false);
    }
  };

  return (
    <section id={`section-${topic.id}`} className="scroll-mt-4">
      {/* Heading — a note's is the page title above it */}
      {!noteMode && (
      <div className="group">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Section {index} of {total}
          {category ? <span className="normal-case tracking-normal"> · {category}</span> : null}
        </p>
        {editingHead ? (
          <div className="mt-2 space-y-2">
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xl font-semibold tracking-tight outline-none focus:border-foreground"
              autoFocus
            />
            <Textarea value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} rows={2} placeholder="One-line summary of this section" className="text-sm" />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving || frozen}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingHead(false)}>
                <X className="size-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
                {topic.completed && <CheckCircle2 className="mr-2 inline size-5 align-[-3px] text-success" />}
                {topic.title}
              </h2>
              {topic.description && <p className="mt-1 text-sm text-muted-foreground">{topic.description}</p>}
            </div>
            {topic.db_id && (
              <button
                type="button"
                disabled={frozen}
                onClick={() => {
                  setDraftTitle(topic.title);
                  setDraftDesc(topic.description ?? "");
                  setEditingHead(true);
                }}
                // Faint rather than invisible: a control nobody can see is one
                // nobody finds, and on touch there is no hover to reveal it.
                className={cn(
                  "mt-1 rounded p-1 text-muted-foreground transition-opacity",
                  frozen
                    ? "cursor-not-allowed opacity-20"
                    : "opacity-40 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100",
                )}
                aria-label="Edit section"
                title={frozen ? "Paused while AnotherNotes is going through these notes" : "Edit the title and summary"}
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      )}

      {/* Notes — a page, not a card. No border, no radius, no shadow, no
          toolbar AND NO FILL OF ITS OWN: this block used to paint
          `bg-[hsl(var(--paper))]`, which punched an opaque rectangle through the
          page's grain and read as a third material. The text now sits directly
          on the chosen sheet, with a real page margin, and the 78ch measure is
          centred so the slack falls on both sides. There is no edit MODE:
          writing starts wherever the student clicks or taps. (The toolbar that
          sat above the notes went too; a note keeps Dictate and Write in its
          top bar, and Teach mode's mic changes study notes when asked.) */}
      <div className={cn("relative px-6 sm:px-12 lg:px-16", noteMode ? "pb-8 pt-3" : "mt-5 py-5 sm:py-8")}>
        {/* The tutor asked about these notes and not everything is answered yet. */}
        {openChecks > 0 && !frozen && topic.db_id && (
          <div
            data-an-chrome=""
            className="mx-auto mb-3 flex max-w-[78ch] flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-pink-500/30 bg-pink-500/[0.06] px-3.5 py-2 text-xs"
          >
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <SearchCheck className="size-3.5 shrink-0 text-pink-600 dark:text-pink-300" />
              Your tutor has {openChecks} question{openChecks === 1 ? "" : "s"} about these notes
            </span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onResume(topic.db_id!)}>
              Go through {openChecks === 1 ? "it" : "them"}
            </Button>
          </div>
        )}
        {topic.notes || (noteMode && topic.db_id) ? (
          <PaperNotes
            ref={bindNotes}
            md={topic.notes ?? ""}
            guideKey={topic.db_id}
            prose={NOTE_PROSE}
            canEdit={!!topic.db_id}
            locked={frozen}
            onCommit={saveNotes}
            allowEmpty={noteMode}
            placeholder={noteMode ? placeholder : undefined}
            openOnMount={noteMode && !fresh && !topic.notes?.trim()}
            interim={interim}
          />
        ) : notesLoading || writing ? (
          <div className="mx-auto max-w-[78ch] space-y-2.5 py-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Writing readable notes from your material…
            </div>
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-10/12" />
            <LoadingFacts compact className="pt-1" />
          </div>
        ) : (
          <div className="mx-auto flex max-w-[78ch] flex-col items-start gap-3 py-2">
            <p className="text-sm text-muted-foreground">Notes couldn't be written automatically.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => writeNotes(false)} disabled={!topic.db_id || writing || frozen}>
                <Sparkles className="size-3.5" />
                Write notes with AI
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!topic.db_id || writing || frozen}
                onClick={async () => {
                  // Seed one line so there is something to put a caret in, then
                  // put it there. There is no raw-Markdown mode to fall back to.
                  await saveNotes("Write your notes for this section here.");
                  window.setTimeout(() => notesRef.current?.startEditing(), 0);
                }}
              >
                <Pencil className="size-3.5" />
                Write them myself
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Wrong questions — retry only the ones you missed, from anywhere in the session.
-------------------------------------------------------------------------- */
function WrongQuestionsDialog({
  open,
  onOpenChange,
  entries,
  onClear,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entries: WrongEntry[];
  onClear: (key: string) => void;
}) {
  const [queue, setQueue] = useState<WrongEntry[]>([]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  // Snapshot the wrong list when the dialog opens so clearing a question mid-run
  // doesn't reshuffle what we're stepping through.
  useEffect(() => {
    if (open) {
      setQueue(entries);
      setI(0);
      setAnswers({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cur = queue[i];
  const choose = (ai: number) => {
    if (!cur || answers[cur.key] !== undefined) return;
    setAnswers((a) => ({ ...a, [cur.key]: ai }));
    if (ai === cur.question.correctAnswer) onClear(cur.key); // removed from the session's wrong list
  };

  const answeredAll = queue.length > 0 && queue.every((e) => answers[e.key] !== undefined);
  const cleared = queue.filter((e) => answers[e.key] === e.question.correctAnswer).length;
  const stillWrong = queue.filter((e) => answers[e.key] !== undefined && answers[e.key] !== e.question.correctAnswer);

  const retryRemaining = () => {
    setQueue(stillWrong);
    setI(0);
    setAnswers({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A study dialog like the Quiz: Teach mode stops talking when it opens, leaves
          its keys alone in here and lowers the board under it. */}
      <DialogContent data-study-dialog="" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            Wrong questions
          </DialogTitle>
          <DialogDescription>
            Retry only what you missed. Get one right and it leaves this list.
          </DialogDescription>
        </DialogHeader>

        {queue.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto size-7 text-success" />
            <p className="mt-3 text-sm font-semibold">Nothing to retry</p>
            <p className="mt-1 text-xs text-muted-foreground">You've cleared every question you missed.</p>
          </div>
        ) : answeredAll ? (
          <div className="py-8 text-center">
            <p className="text-2xl font-semibold tabular-nums">
              {cleared} <span className="text-base font-normal text-muted-foreground">/ {queue.length} cleared</span>
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {stillWrong.length === 0
                ? "All cleared — nicely done."
                : `${stillWrong.length} still to nail. The ones you got right have been removed.`}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              {stillWrong.length > 0 && (
                <Button size="sm" onClick={retryRemaining}>
                  <RotateCcw className="size-3.5" />
                  Retry the {stillWrong.length} remaining
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : cur ? (
          <div>
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="tabular-nums">
                Question {i + 1} of {queue.length}
              </span>
              <span className="truncate pl-3">
                {cur.sectionIndex}. {cur.sectionTitle}
              </span>
            </div>
            <QuizQuestion q={cur.question} chosen={answers[cur.key]} onChoose={choose} />
            <div className="mt-5 flex items-center justify-between">
              <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => setI((n) => Math.max(0, n - 1))}>
                Back
              </Button>
              {answers[cur.key] !== undefined &&
                (i < queue.length - 1 ? (
                  <Button size="sm" onClick={() => setI((n) => n + 1)}>
                    Next
                    <ChevronRight className="size-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setI((n) => n)}>
                    See results
                  </Button>
                ))}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------------------
   No session in the URL: pick one or create one
-------------------------------------------------------------------------- */
function SessionPicker({
  sessions,
  onOpen,
  onCreate,
  create,
}: {
  sessions: StudySession[];
  onOpen: (s: StudySession) => void;
  onCreate: () => void;
  create: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Full Study</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pick a session to study</h1>
      <p className="mt-1 text-sm text-muted-foreground">Each session is one scrolling note, with one Quiz at the top for all of it.</p>

      {sessions.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <BookOpen className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">No sessions yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Paste notes, drop a PDF, or add a YouTube link and AnotherNotes writes the sections and quizzes.
          </p>
          <Button size="sm" className="mt-4" onClick={onCreate}>
            <Plus className="size-3.5" />
            Create study session
          </Button>
        </div>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
            {sessions.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onOpen(s)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.topics} section{s.topics === 1 ? "" : "s"}
                      {s.time ? ` · ${s.time}` : ""}
                    </span>
                  </span>
                  <span className="text-xs font-semibold tabular-nums">{Math.round(s.progress ?? 0)}%</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-4" onClick={onCreate}>
            <Plus className="size-3.5" />
            New session
          </Button>
        </>
      )}
      {create}
    </div>
  );
}
