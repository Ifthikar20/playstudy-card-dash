import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import { KATEX_OPTS, NOTE_SCHEMA } from "@/lib/notes/sanitizeSchema";
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
  GraduationCap,
  Presentation,
  Layers,
  ListChecks,
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
  Wand2,
  Youtube,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";
import { ExamPlanStrip } from "@/components/exam/ExamPlanStrip";
import { primeSpeechAudio } from "@/lib/guide/speech";
import { StudyContentUpload } from "@/components/StudyContentUpload";
import { TopicSummary } from "@/components/TopicSummary";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAppStore, type Question, type StudySession, type Topic } from "@/store/appStore";
import { usePresenceStore } from "@/store/presenceStore";
import { fetchSessionPdf, generateSectionFlashcards, generateSectionQuiz, generateTopicNotes, getStudySession, reviseTopicNotes, updateTopicDetails, type Flashcard } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TeachMode, type TeachSection } from "@/components/guide/TeachMode";
import { StickySelection, StickySessionDialog, keyIdeasOf } from "@/components/StickyNotes";
import { useStickyStore } from "@/store/stickyStore";
import { LoadingFacts } from "@/components/LoadingFacts";
import { BASE_NOTE_COMPONENTS, HEADING_COLORS, headingFactory, sanitizeNotes } from "@/lib/notes/render";
import { MATH_OPTS } from "@/lib/notes/units";
import { PaperNotes, type PaperNotesHandle } from "@/components/notes/PaperNotes";
import { ShellTrigger } from "@/components/AppShell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SHEETS, setSheet, useSheet } from "@/lib/studySurface";
import type { PdfPageInfo } from "@/components/pdf/PdfDocument";
import { trackAction } from "@/lib/analytics";
import { isNote, isNoteRoute, notePath } from "@/lib/notes/isNote";
import { joinPhrase, useDictation, type Dictation } from "@/lib/guide/dictation";
import { useTalkKey } from "@/lib/useTalkKey";
import { voiceKeyLabel } from "@/lib/voiceKey";
import { locateQuote } from "@/lib/guide/blocks";
import { DictateButton } from "@/components/notes/DictateButton";
import { NoteReview } from "@/components/notes/NoteReview";
import { answerCheck, checkSection, deleteNote, fixCheck, renameNote, type CheckAnswer, type NoteCheck } from "@/services/notes";

// PDF.js is big: it only loads when someone opens the PDF view.
const PdfDocument = lazy(() => import("@/components/pdf/PdfDocument").then((m) => ({ default: m.PdfDocument })));

/** What the page shows: the notes, or the uploaded PDF itself. Remembered per session on this device. */
type StudyView = "notes" | "pdf";
const viewKey = (sessionId: string) => `an-study-view:${sessionId}`;
const NO_PAGES: PdfPageInfo[] = [];

/*
  Full Study — the one way to study. A session is a single scrolling note:
  every section has readable, auto-written notes (headings + highlights, editable
  in place) and, under it, a "Quiz this section" button that writes a small set
  of challenging questions. Answer them one at a time; anything you get wrong is
  collected in "Wrong questions" at the top so you can retry just those.
*/

interface Section {
  topic: Topic;
  index: number; // 1-based
  category: string;
}

/** A question the learner got wrong, remembered across the whole session. */
interface WrongEntry {
  key: string;
  topicId: string;
  sectionTitle: string;
  sectionIndex: number;
  question: Question;
}

function flattenSections(topics: Topic[] | undefined): Section[] {
  const out: Section[] = [];
  const walk = (list: Topic[], category: string) => {
    for (const t of list) {
      if (t.subtopics && t.subtopics.length) walk(t.subtopics, t.title);
      else if (!t.isCategory) out.push({ topic: t, index: out.length + 1, category });
    }
  };
  walk(topics ?? [], "");
  return out;
}

/* Shared Markdown renderer: pastel-highlighted headings (cycled in document
   order), <mark> highlights, and safe raw HTML (mark only). Used by both the
   notes card and Read mode so they render identically. */
function Markdown({ md }: { md: string }) {
  const counter = useRef(0);
  counter.current = 0;
  const heading = headingFactory(counter);
  const components = { ...BASE_NOTE_COMPONENTS, h2: heading("h2"), h3: heading("h3") };
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, [remarkMath, MATH_OPTS]]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, NOTE_SCHEMA], [rehypeKatex, KATEX_OPTS]]}
      components={components as any}
    >
      {sanitizeNotes(md)}
    </ReactMarkdown>
  );
}

const NOTE_PROSE =
  "prose prose-base mx-auto max-w-[78ch] text-[16px] leading-[1.75] text-foreground/90 dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mb-2.5 prose-h2:mt-7 prose-h2:text-[18px] prose-h2:leading-[1.4] prose-h3:mt-5 prose-h3:text-[16px] prose-h3:leading-[1.5] prose-p:my-3 prose-p:leading-[1.75] prose-li:my-1 prose-li:leading-[1.7] prose-strong:font-semibold prose-strong:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-[''] prose-code:after:content-[''] prose-blockquote:my-4 prose-blockquote:rounded-r-lg prose-blockquote:border-l-[3px] prose-blockquote:border-chart-1 prose-blockquote:bg-chart-1/[0.07] prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-foreground";

// Book-like reading measure for Read mode; `prose`/`prose-invert` is added per theme.
const READ_PROSE =
  "prose prose-lg max-w-none text-[17px] leading-[1.85] prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-8 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-lg prose-p:my-4 prose-p:leading-[1.85] prose-li:my-1.5 prose-code:rounded prose-code:bg-black/10 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-[''] prose-code:after:content-[''] prose-blockquote:my-5 prose-blockquote:rounded-r-lg prose-blockquote:border-l-[3px] prose-blockquote:border-chart-1 prose-blockquote:bg-chart-1/[0.08] prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:font-normal prose-blockquote:not-italic";

function RichNotes({ md, guideKey }: { md: string; guideKey?: number }) {
  return (
    <div className={NOTE_PROSE} data-guide-notes={guideKey}>
      <Markdown md={md} />
    </div>
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

  // The exam plan names sections by their server id; the page knows them by their
  // own. These two keep the strip able to name a section and scroll to it.
  const planSections = useMemo(() => sections.map((s) => ({ dbId: s.topic.db_id, title: s.topic.title })), [sections]);
  const openPlanSection = useCallback(
    (dbId: number) => {
      const found = sections.find((s) => s.topic.db_id === dbId);
      if (found) scrollTo(found.topic.id);
    },
    [sections, scrollTo],
  );

  // ---- the tutor checking a section's notes ------------------------------------
  // `checking` while it reads them, `reviewing` while the pointer goes through what
  // it asked. Both lock the notes, like Teach mode, so nothing moves under it.
  const [checking, setChecking] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const frozen = guideOpen || checking != null || reviewing != null;

  // ---- dictation: one microphone for the page -----------------------------------
  // Words go into ONE section's notes: the one being written in, else the only one,
  // else the one most on screen. The talk key (chosen at onboarding) starts it too.
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

  const pickDictTarget = (): number | null => {
    const handles = notesHandles.current;
    for (const [dbId, h] of handles) if (h.isEditing()) return dbId;
    if (handles.size === 1) return [...handles.keys()][0];
    let best: number | null = null;
    let most = 0;
    for (const dbId of handles.keys()) {
      const el = pageRef.current?.querySelector<HTMLElement>(`[data-guide-notes="${dbId}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const seen = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (seen > most) {
        most = seen;
        best = dbId;
      }
    }
    return best;
  };

  const toggleDictation = (dbId?: number) => {
    if (dictation.state !== "off") {
      dictation.stop();
      return;
    }
    if (frozen) return;
    if (dictation.mode === "none") {
      toast({ title: "Voice input isn't available here", description: "This browser or page can't use the microphone — type instead." });
      return;
    }
    const target = dbId ?? pickDictTarget();
    if (target == null) {
      toast({ title: "Nothing to write into yet", description: "Scroll to a section's notes first." });
      return;
    }
    dictTarget.current = target;
    setDictFor(target);
    touched.current = true;
    void dictation.start();
  };
  const voiceKey = useTalkKey(() => toggleDictation(), { enabled: !frozen });

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
          This session has no content yet. Paste your material and AnotherNotes will build the sections and quizzes.
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
  const teachSections: TeachSection[] = showPdf
    ? pdfPages.map((p) => ({ topicId: `pdf-${p.page}`, dbId: -p.page, title: `Page ${p.page}`, index: p.page }))
    : sections
        .filter((s) => s.topic.db_id)
        .map((s) => ({ topicId: s.topic.id, dbId: s.topic.db_id!, title: s.topic.title, index: s.index }));
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
        toast({ title: "Teach mode can't start yet", description: problem, variant: "destructive" });
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

  /** The tutor reads a section's notes back and asks about anything that looks wrong. */
  const startCheck = async (dbId: number) => {
    primeSpeechAudio(); // inside the click: the questions are spoken
    if (!(await saveThenLock("The check"))) return;
    setChecking(dbId);
    try {
      const res = await checkSection(session.id, dbId);
      if (res.checkedAt) updateTopicByDbId(session.id, dbId, { noteChecks: res.checks, notesCheckedAt: res.checkedAt });
      if (res.checks.some((c) => c.answer == null)) setReviewing(dbId);
      else toast({ title: res.message || "Nothing looks wrong in there." });
    } catch (e) {
      toast({ title: "Couldn't check these notes", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setChecking(null);
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
              <DictateButton
                dictation={dictation}
                disabled={frozen || !noteTopic?.db_id}
                onToggle={() => toggleDictation(noteTopic?.db_id ?? undefined)}
                className="h-8"
              />
              <button
                type="button"
                disabled={frozen || flushing || !noteTopic?.db_id || noteWords === 0}
                onClick={() => noteTopic?.db_id && void startCheck(noteTopic.db_id)}
                title={noteWords === 0 ? "Write something first" : "Your tutor reads these notes and asks about anything that looks wrong"}
                className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-foreground/[0.04] px-3 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checking != null ? <Loader2 className="size-3.5 animate-spin" /> : <SearchCheck className="size-3.5" />}
                {checking != null ? "Checking…" : "Check my notes"}
              </button>
              <button
                type="button"
                disabled={flushing || frozen || noteWords < NOTE_MIN_WORDS}
                onClick={() => void openTeach()}
                title={
                  noteWords < NOTE_MIN_WORDS
                    ? "Write a little more first — Teach mode needs something to explain"
                    : "Teach mode: AnotherNotes AI scrolls, points and explains these notes out loud"
                }
                className="flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3.5 text-xs font-semibold text-white shadow-sm shadow-pink-500/30 transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                <GraduationCap className="size-3.5" />
                Teach mode
              </button>
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
                        ? `The ${pdfNoun} you uploaded. Teach mode explains it right on the page.`
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
          <button
            type="button"
            disabled={!teachReady || flushing}
            onClick={() => void openTeach()}
            title={
              !teachReady
                ? `Opening the ${pdfNoun}…`
                : flushing
                  ? "Saving your notes first…"
                  : showPdf
                    ? `Teach mode: AnotherNotes AI goes through your ${pdfNoun} page by page, pointing at each part as it explains it`
                    : "Teach mode: AnotherNotes AI scrolls, points and explains these notes out loud"
            }
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-pink-500/30 transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 disabled:hover:scale-100"
          >
            <GraduationCap className="size-3.5" />
            Teach mode
          </button>
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
                  Editing, dictation, checks and quizzes are in Notes view
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
              dictation={dictation}
              dictating={dictFor != null && dictFor === s.topic.db_id}
              onDictate={toggleDictation}
              onCheck={startCheck}
              checking={checking === s.topic.db_id}
              onResume={resumeReview}
              onWrong={addWrong}
              onRight={clearWrong}
              onNext={() => {
                const next = sections[s.index]; // index is 1-based → next section
                if (next) scrollTo(next.topic.id);
                else document.getElementById("session-end")?.scrollIntoView({ behavior: "smooth" });
              }}
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
                <p className="mt-1 text-xs text-muted-foreground">Read each section's notes, then quiz yourself on it.</p>
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
   One section: heading · notes · quiz
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
  dictation,
  dictating,
  onDictate,
  onCheck,
  checking,
  onResume,
  onWrong,
  onRight,
  onNext,
}: {
  section: Section;
  total: number;
  session: StudySession;
  notesLoading: boolean;
  /** Something is going through these notes (Teach mode, a check): nothing may
   *  change them or reflow them until it is done, so every tool that writes is
   *  disabled and the notes are read-only. */
  frozen: boolean;
  /** Tells the page where this section's notes are, so it can save them before
   *  anything locks them. Called with null when they go. */
  registerNotes: (dbId: number, handle: PaperNotesHandle | null) => void;
  /** The student's own note: no section heading (the page title is it), may be
   *  empty, never written by the AI, and quizzes wait until there is enough in it. */
  noteMode: boolean;
  /** A note made on this visit: its title has the caret, so the page waits to be clicked into. */
  fresh: boolean;
  /** What an empty page says. */
  placeholder: string;
  /** The page's one microphone. */
  dictation: Dictation;
  /** Dictation is writing into THIS section. */
  dictating: boolean;
  onDictate: (dbId: number) => void;
  /** The tutor checks this section's notes. */
  onCheck: (dbId: number) => void;
  checking: boolean;
  /** Go through the questions left open from the last check. */
  onResume: (dbId: number) => void;
  onWrong: (e: WrongEntry) => void;
  onRight: (key: string) => void;
  onNext: () => void;
}) {
  const { toast } = useToast();
  const { topic, index, category } = section;

  const answerQuestion = useAppStore((s) => s.answerQuestion);
  const completeTopic = useAppStore((s) => s.completeTopic);
  const setTopicQuestions = useAppStore((s) => s.setTopicQuestions);
  const updateTopic = useAppStore((s) => s.updateTopic);
  const updateTopicByDbId = useAppStore((s) => s.updateTopicByDbId);
  const patchSession = useAppStore((s) => s.patchSession);
  const reward = useAppStore((s) => (s.lastTopicReward?.topicId === topic.id ? s.lastTopicReward : null));

  const questions = topic.questions ?? [];

  // The phrases the AI marked as this section's point, one click from a sticky note.
  const keyIdeas = useMemo(() => keyIdeasOf(topic.notes), [topic.notes]);
  const addSticky = useStickyStore((s) => s.add);
  const [keeping, setKeeping] = useState(false);
  const keepKeyIdeas = async () => {
    if (!keyIdeas.length) return;
    setKeeping(true);
    try {
      for (const text of keyIdeas) {
        await addSticky({
          text,
          source: "key-idea",
          study_session_id: session.id,
          topic_id: topic.db_id ?? null,
          section_title: topic.title,
        });
      }
      toast({
        title: `Kept ${keyIdeas.length} key idea${keyIdeas.length === 1 ? "" : "s"}`,
        description: "They're on your dashboard with the rest of your sticky notes.",
      });
    } catch (e) {
      toast({ title: "Couldn't keep those", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setKeeping(false);
    }
  };

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
  const [editing, setEditing] = useState<null | "head" | "notes">(null);
  const [draftTitle, setDraftTitle] = useState(topic.title);
  const [draftDesc, setDraftDesc] = useState(topic.description ?? "");
  const [draftNotes, setDraftNotes] = useState(topic.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [writing, setWriting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [revising, setRevising] = useState(false);

  // Quiz runner (one question at a time)
  const [revealed, setRevealed] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [review, setReview] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.reduce((n, q, i) => (answers[i] !== undefined && answers[i] === q.correctAnswer ? n + 1 : n), 0);

  const wrongKey = (q: Question, i: number) => `${topic.id}::${q.id ?? i}`;

  const save = async () => {
    if (!topic.db_id) return;
    setSaving(true);
    try {
      const patch = editing === "head" ? { title: draftTitle.trim() || topic.title, description: draftDesc.trim() } : { notes: draftNotes };
      const res = await updateTopicDetails(session.id, topic.db_id, patch);
      // Adopt the server's copy so any normalisation it does is visible now
      // rather than appearing to change the notes on their own at the next fetch.
      updateTopic(session.id, topic.id, editing === "head" ? patch : { notes: typeof res?.notes === "string" ? res.notes : draftNotes });
      setEditing(null);
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
      setDraftNotes(adopted);
      return adopted;
    },
    [session.id, topic.db_id, topic.id, updateTopic, updateTopicByDbId, patchSession],
  );

  const openChecks = (topic.noteChecks ?? []).filter((c) => c.answer == null).length;
  const words = useMemo(() => wordsIn(topic.notes), [topic.notes]);
  // A note too short to quiz on doesn't offer it.
  const studyTools = !noteMode || words >= NOTE_MIN_WORDS;

  const writeNotes = async (force = false) => {
    if (!topic.db_id) return;
    setWriting(true);
    try {
      const notes = await generateTopicNotes(session.id, topic.db_id, force);
      updateTopic(session.id, topic.id, { notes });
      setDraftNotes(notes);
    } catch (e) {
      toast({ title: "Couldn't write notes", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setWriting(false);
    }
  };

  // The server wants at least 2 characters; below that, Apply stays disabled
  // rather than sending something it will refuse.
  const canRevise = instruction.trim().length >= 2;

  const revise = async () => {
    if (!topic.db_id || !canRevise || revising || frozen) return;
    setRevising(true);
    try {
      const notes = await reviseTopicNotes(session.id, topic.db_id, instruction.trim());
      updateTopic(session.id, topic.id, { notes });
      setDraftNotes(notes);
      setAsking(false);
      setInstruction("");
    } catch (e) {
      toast({ title: "Couldn't change the notes", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setRevising(false);
    }
  };

  const openQuiz = async (fresh: boolean) => {
    if (!topic.db_id) return;
    // Always ask the backend: it reuses this section's grounded questions when
    // they exist, and regenerates a fresh, correct set when they don't (or when
    // the section still holds older, less reliable bulk-pipeline questions).
    setQuizLoading(true);
    try {
      const qs = await generateSectionQuiz(session.id, topic.db_id, { count: 8, force: fresh });
      setTopicQuestions(session.id, topic.id, qs);
    } catch (e) {
      toast({ title: "Couldn't build the quiz", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
      setQuizLoading(false);
      return;
    }
    setQuizLoading(false);
    setAnswers({});
    setIdx(0);
    setShowSummary(false);
    setReview(false);
    setRevealed(true);
  };

  const choose = (ai: number) => {
    const q = questions[idx];
    if (!q || answers[idx] !== undefined) return;
    const { correct } = answerQuestion(session.id, topic.id, ai, idx);
    setAnswers((a) => ({ ...a, [idx]: ai }));
    const key = wrongKey(q, idx);
    if (correct) onRight(key);
    else onWrong({ key, topicId: topic.id, sectionTitle: topic.title, sectionIndex: index, question: q });
  };

  const finish = () => {
    completeTopic(session.id, topic.id);
    setShowSummary(true);
    setRevealed(false);
  };

  const retry = async () => {
    await openQuiz(false);
  };

  const isCurrentAnswered = answers[idx] !== undefined;
  const onLast = idx === questions.length - 1;
  // The quiz card stays one compact row until the learner starts it.
  const quizIdle = !quizLoading && !(showSummary && reward) && !review && !(revealed && questions.length > 0) && !topic.completed;

  return (
    <section id={`section-${topic.id}`} className="scroll-mt-4">
      {/* Heading — a note's is the page title above it */}
      {!noteMode && (
      <div className="group">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Section {index} of {total}
          {category ? <span className="normal-case tracking-normal"> · {category}</span> : null}
        </p>
        {editing === "head" ? (
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
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
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
                  setEditing("head");
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
          toolbar rail AND NO FILL OF ITS OWN: this block used to paint
          `bg-[hsl(var(--paper))]`, which punched an opaque rectangle through the
          page's grain and read as a third material. The text now sits directly
          on the chosen sheet, with a real page margin, and the 78ch measure is
          centred so the slack falls on both sides. */}
      <div className={cn("group/notes relative px-6 sm:px-12 lg:px-16", noteMode ? "pb-8 pt-3" : "mt-5 py-5 sm:py-8")}>
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
        {topic.db_id && (topic.notes || noteMode) && (
          /* Always there. It used to be invisible on anything 640px or wider until
             the pointer was over this exact section, which read as "editing is
             gone". Muted at rest so it doesn't compete with the notes; full while
             in use, and always full on touch, where nothing hovers. */
          <div
            data-an-chrome=""
            className={cn(
              "mx-auto mb-3 flex max-w-[78ch] flex-wrap items-center justify-end gap-1 transition-opacity",
              asking
                ? "opacity-100"
                : "opacity-70 hover:opacity-100 focus-within:opacity-100 group-hover/notes:opacity-100 [@media(pointer:coarse)]:opacity-100",
            )}
          >
            {keyIdeas.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto h-7 text-xs text-muted-foreground"
                onClick={keepKeyIdeas}
                disabled={keeping}
                title="Put this section's highlighted ideas on sticky notes"
              >
                {keeping ? <Loader2 className="size-3.5 animate-spin" /> : <StickyNote className="size-3.5" />}
                Keep {keyIdeas.length} key idea{keyIdeas.length === 1 ? "" : "s"}
              </Button>
            )}
            {/* In a note these two live in the page's top bar; one of each is enough. */}
            {!noteMode && (
              <>
                <DictateButton
                  compact
                  dictation={dictating ? dictation : { ...dictation, state: "off", interim: "" }}
                  disabled={frozen || (dictation.state !== "off" && !dictating)}
                  onToggle={() => onDictate(topic.db_id!)}
                  className="text-muted-foreground"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => onCheck(topic.db_id!)}
                  disabled={frozen || checking || !topic.notes?.trim()}
                  title={frozen ? "Paused while AnotherNotes is going through these notes" : "Your tutor reads these notes and asks about anything that looks wrong"}
                >
                  {checking ? <Loader2 className="size-3.5 animate-spin" /> : <SearchCheck className="size-3.5" />}
                  {checking ? "Checking…" : "Check these notes"}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 text-xs", asking ? "text-foreground" : "text-muted-foreground")}
              onClick={() => { setAsking((a) => !a); setInstruction(""); }}
              disabled={revising || frozen || !topic.notes?.trim()}
              // It replaces the whole section, so it waits while anything is
              // going through these notes.
              title={frozen ? "Paused while AnotherNotes is going through these notes" : "Tell the AI what to change in this section"}
            >
              <Wand2 className="size-3.5" />
              Ask AI to change
            </Button>
            {/* There is no edit MODE any more, so this is not a toggle: writing
                starts wherever you click or tap, on a mouse and on touch alike.
                The button stays as the keyboard route in — it just puts the
                caret at the top of the section. */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              disabled={frozen}
              title={frozen ? "Writing pauses while AnotherNotes is going through these notes" : "Put the caret in these notes (or just click where you want to write)"}
              onClick={() => notesRef.current?.startEditing()}
            >
              <Pencil className="size-3.5" />
              Write
            </Button>
          </div>
        )}
        {asking && topic.notes && (
          <div className="mx-auto mb-4 max-w-[78ch]" data-an-chrome="">
            <div className="flex items-center gap-2">
              <Wand2 className="size-4 shrink-0 text-chart-1" />
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void revise(); if (e.key === "Escape") setAsking(false); }}
                placeholder="Tell the AI what to change — e.g. “make the example about basketball”, “simplify the second part”"
                className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-foreground"
                autoFocus
                maxLength={600}
                disabled={revising || frozen}
              />
              <Button size="sm" className="h-9" onClick={revise} disabled={revising || frozen || !canRevise}>
                {revising ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                Apply
              </Button>
            </div>
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
            interim={dictating ? dictation.interim : undefined}
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

      {studyTools && (
      <>
      <SectionFlashcards session={session} topic={topic} />

      {/* Quiz */}
      <div data-guide-quiz={topic.db_id} className="mt-3 overflow-hidden rounded-2xl border border-border/50 bg-foreground/[0.03]">
        {!quizIdle && (
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Quiz</p>
            {(revealed || (topic.completed && !showSummary)) && questions.length > 0 && !review && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {revealed ? `${Math.min(idx + 1, questions.length)} / ${questions.length}` : `Score ${Math.round(topic.score ?? 0)}%`}
              </span>
            )}
          </div>
        )}

        {quizLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Writing challenging questions for this section…
          </div>
        ) : showSummary && reward ? (
          <div className="p-5">
            <TopicSummary
              topicTitle={topic.title}
              score={topic.score ?? 0}
              totalQuestions={questions.length}
              onContinue={() => {
                setShowSummary(false);
                onNext();
              }}
              onRetry={retry}
              isLastTopic={index === total}
              xp={reward.breakdown}
              sessionCompleted={reward.sessionCompleted}
            />
          </div>
        ) : review ? (
          <div className="divide-y divide-border">
            {questions.map((q, qi) => (
              <div key={q.id ?? qi} className="px-5 py-4">
                <p className="text-sm font-medium">
                  <span className="mr-2 tabular-nums text-muted-foreground">{qi + 1}.</span>
                  {q.question}
                </p>
                <p className="mt-2 text-xs text-success">
                  <Check className="mr-1 inline size-3.5 align-[-2px]" />
                  {String.fromCharCode(65 + q.correctAnswer)}. {q.options[q.correctAnswer]}
                </p>
                {q.explanation && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{q.explanation}</p>}
              </div>
            ))}
            <div className="flex justify-end px-5 py-3">
              <Button size="sm" variant="ghost" onClick={() => setReview(false)}>
                Done reviewing
              </Button>
            </div>
          </div>
        ) : revealed && questions.length > 0 ? (
          <div className="p-5">
            {/* progress dots */}
            <div className="mb-4 flex items-center gap-1.5">
              {questions.map((_, qi) => (
                <span
                  key={qi}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    qi === idx ? "w-5 bg-chart-1" : answers[qi] !== undefined ? "w-1.5 bg-chart-1/50" : "w-1.5 bg-muted",
                  )}
                />
              ))}
            </div>

            <QuizQuestion q={questions[idx]} chosen={answers[idx]} onChoose={choose} />

            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs tabular-nums text-muted-foreground">
                {answeredCount} answered · {correctCount} right
              </span>
              {isCurrentAnswered &&
                (onLast ? (
                  <Button size="sm" onClick={finish}>
                    Finish section
                    <ArrowRight className="size-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setIdx((i) => i + 1)}>
                    Next question
                    <ChevronRight className="size-3.5" />
                  </Button>
                ))}
            </div>
          </div>
        ) : topic.completed ? (
          // Completed, collapsed
          <div className="flex flex-col items-start gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-success" />
              <span className="font-medium">Completed</span>
              <span className="text-muted-foreground">
                · {Math.round(topic.score ?? 0)}% · {questions.length} question{questions.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setReview(true)}>
                Review answers
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={retry}>
                <RotateCcw className="size-3.5" />
                Retry
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openQuiz(true)}>
                <Sparkles className="size-3.5" />
                Fresh questions
              </Button>
            </div>
          </div>
        ) : (
          // Idle: one compact row — it only expands once the learner starts the quiz.
          <div className="flex items-center gap-2.5 px-3.5 py-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
              <ListChecks className="size-3.5 text-chart-1" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Quiz this section</p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">A few challenging questions from these notes, one at a time.</p>
            </div>
            <Button size="sm" className="h-8 shrink-0" onClick={() => openQuiz(false)} disabled={!topic.db_id} data-guide-quiz-button>
              <ListChecks className="size-3.5" />
              Start
            </Button>
          </div>
        )}
      </div>
      </>
      )}

    </section>
  );
}

/* --------------------------------------------------------------------------
   Flashcards — a quick memory check for a section. Tap a card to flip; step
   through the deck. Cards are written from the section's notes on demand.
-------------------------------------------------------------------------- */
function SectionFlashcards({ session, topic }: { session: StudySession; topic: Topic }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const load = async (force = false) => {
    if (!topic.db_id) return;
    setLoading(true);
    try {
      const cs = await generateSectionFlashcards(session.id, topic.db_id, { count: 8, force });
      if (!cs.length) throw new Error("No flashcards came back.");
      setCards(cs);
      setIdx(0);
      setFlipped(false);
      setOpen(true);
    } catch (e) {
      toast({ title: "Couldn't make flashcards", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const go = (delta: number) => {
    setFlipped(false);
    setIdx((i) => Math.min(cards.length - 1, Math.max(0, i + delta)));
  };

  if (!open) {
    return (
      <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-dashed border-border/50 bg-foreground/[0.02] px-3.5 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
          <Layers className="size-3.5 text-chart-1" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Flashcards</p>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">Check your memory — flip cards drawn from this section.</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => load(false)} disabled={loading || !topic.db_id}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Layers className="size-3.5" />}
          {loading ? "Making cards…" : "Flashcards"}
        </Button>
      </div>
    );
  }

  const card = cards[idx];
  return (
    <div className="mt-4 rounded-2xl border border-border/50 bg-foreground/[0.03] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Flashcards <span className="ml-1 normal-case tracking-normal">· {idx + 1} / {cards.length}</span>
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>

      {/* A real 3D flip: two faces on one rotating card (see .fc-* in index.css). */}
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show question" : "Reveal answer"}
        aria-pressed={flipped}
        className="fc-scene block h-52 w-full text-center"
      >
        <div className={cn("fc-card", flipped && "fc-flipped")}>
          <div className="fc-face rounded-2xl border border-border bg-muted/40 px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Recall</p>
            <p className="mt-3 text-lg font-medium leading-snug">{card.front}</p>
            <p className="mt-4 text-xs text-muted-foreground">Tap to flip</p>
          </div>
          <div className="fc-face fc-back rounded-2xl border border-chart-1/30 bg-chart-1/5 px-6">
            <p className="text-[15px] leading-relaxed">{card.back}</p>
            {card.hint && <p className="mt-3 text-xs text-muted-foreground">Hint: {card.hint}</p>}
            <p className="mt-4 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Tap to flip back</p>
          </div>
        </div>
      </button>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => go(-1)}>
          <ChevronLeft className="size-3.5" />
          Back
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => load(true)} disabled={loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          New cards
        </Button>
        {idx < cards.length - 1 ? (
          <Button size="sm" onClick={() => go(1)}>
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Finish
          </Button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   A single question with its options — shared by section quizzes and the
   wrong-questions retry. Read-only once answered.
-------------------------------------------------------------------------- */
function QuizQuestion({ q, chosen, onChoose }: { q: Question; chosen: number | undefined; onChoose: (ai: number) => void }) {
  const answered = chosen !== undefined;
  return (
    <div>
      <p className="text-base font-medium leading-relaxed md:text-[17px]">{q.question}</p>
      <div className="mt-4 grid gap-2.5">
        {q.options.map((opt, ai) => {
          const isCorrect = ai === q.correctAnswer;
          const isChosen = chosen === ai;
          return (
            <button
              key={ai}
              type="button"
              disabled={answered}
              onClick={() => onChoose(ai)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                !answered && "border-border hover:border-chart-1/50 hover:bg-muted",
                answered && isCorrect && "border-success bg-success/10",
                answered && isChosen && !isCorrect && "border-destructive bg-destructive/10",
                answered && !isChosen && !isCorrect && "border-border opacity-60",
              )}
            >
              <span
                className={cn(
                  "mt-px flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  answered && isCorrect && "border-success bg-success text-success-foreground",
                  answered && isChosen && !isCorrect && "border-destructive bg-destructive text-destructive-foreground",
                  (!answered || (!isCorrect && !isChosen)) && "border-border",
                )}
              >
                {String.fromCharCode(65 + ai)}
              </span>
              <span className="pt-0.5">{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div
          className={cn(
            "mt-4 rounded-xl border p-3 text-sm leading-relaxed",
            chosen === q.correctAnswer ? "border-success/40 bg-success/10" : "border-amber-500/40 bg-amber-500/10",
          )}
        >
          <p className="font-semibold">
            {chosen === q.correctAnswer ? "Correct" : `Answer: ${String.fromCharCode(65 + q.correctAnswer)} — ${q.options[q.correctAnswer]}`}
          </p>
          {q.explanation && <p className="mt-1 text-muted-foreground">{q.explanation}</p>}
        </div>
      )}
    </div>
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
      <DialogContent className="sm:max-w-xl">
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
      <p className="mt-1 text-sm text-muted-foreground">Each session is one scrolling note with a quiz under every section.</p>

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
