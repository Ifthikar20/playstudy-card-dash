import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
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
  Layers,
  ListChecks,
  Loader2,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Wand2,
  Youtube,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";
import { StudyContentUpload } from "@/components/StudyContentUpload";
import { TopicSummary } from "@/components/TopicSummary";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAppStore, type Question, type StudySession, type Topic } from "@/store/appStore";
import { usePresenceStore } from "@/store/presenceStore";
import { generateSectionFlashcards, generateSectionQuiz, generateTopicNotes, getStudySession, reviseTopicNotes, updateTopicDetails, type Flashcard } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

/* Keep only <mark> raw HTML in AI notes; drop every other tag so rehype-raw is
   safe to run. Text and Markdown are left untouched. */
function sanitizeNotes(md: string): string {
  return md.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g, (m, tag: string) =>
    /^mark$/i.test(tag) ? (m.startsWith("</") ? "</mark>" : "<mark>") : "",
  );
}

/* Soft, readable highlighter hues for section headings — cycled so consecutive
   headings differ. Mid-tone so they read on both light and dark backgrounds. */
const HEADING_COLORS = ["#7C3AED", "#2563EB", "#0D9488", "#D97706", "#DB2777", "#0EA5E9"];

const BASE_NOTE_COMPONENTS = {
  // Highlighter: a light amber chip with dark ink — reads on any background
  // (app light/dark and both Read-mode themes), like a real highlighter.
  mark: (props: any) => <mark className="rounded bg-amber-200/80 px-1 py-0.5 text-amber-950" {...props} />,
  a: (props: any) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

/* Shared Markdown renderer: pastel-highlighted headings (cycled in document
   order), <mark> highlights, and safe raw HTML (mark only). Used by both the
   notes card and Read mode so they render identically. */
function Markdown({ md }: { md: string }) {
  const counter = useRef(0);
  counter.current = 0;
  const heading = (Tag: "h2" | "h3") => (props: any) => {
    const c = HEADING_COLORS[counter.current++ % HEADING_COLORS.length];
    return (
      <Tag>
        <span className="box-decoration-clone rounded-md px-1.5 py-0.5" style={{ backgroundColor: `${c}22`, color: c }}>
          {props.children}
        </span>
      </Tag>
    );
  };
  const components = { ...BASE_NOTE_COMPONENTS, h2: heading("h2"), h3: heading("h3") };
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components as any}>
      {sanitizeNotes(md)}
    </ReactMarkdown>
  );
}

const NOTE_PROSE =
  "prose prose-base max-w-[74ch] text-[15.5px] leading-[1.75] text-foreground/90 dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mb-2.5 prose-h2:mt-7 prose-h2:text-lg prose-h3:mt-5 prose-h3:text-base prose-p:my-3 prose-p:leading-[1.75] prose-li:my-1 prose-li:leading-[1.7] prose-strong:font-semibold prose-strong:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-[''] prose-code:after:content-[''] prose-blockquote:my-4 prose-blockquote:rounded-r-lg prose-blockquote:border-l-[3px] prose-blockquote:border-chart-1 prose-blockquote:bg-chart-1/[0.07] prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-foreground";

// Book-like reading measure for Read mode; `prose`/`prose-invert` is added per theme.
const READ_PROSE =
  "prose prose-lg max-w-none text-[17px] leading-[1.85] prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-8 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-lg prose-p:my-4 prose-p:leading-[1.85] prose-li:my-1.5 prose-code:rounded prose-code:bg-black/10 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-[''] prose-code:after:content-[''] prose-blockquote:my-5 prose-blockquote:rounded-r-lg prose-blockquote:border-l-[3px] prose-blockquote:border-chart-1 prose-blockquote:bg-chart-1/[0.08] prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:font-normal prose-blockquote:not-italic";

function RichNotes({ md }: { md: string }) {
  return (
    <div className={NOTE_PROSE}>
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

/* A calm reading backdrop: a warm wash, a soft purple glow and a faint dot
   grid. Uses theme tokens so it works in light and dark. */
const BACKDROP_STYLE: React.CSSProperties = {
  backgroundColor: "hsl(var(--background))",
  backgroundImage: [
    "radial-gradient(1100px 560px at 84% -12%, hsl(var(--chart-1) / 0.10), transparent 60%)",
    "radial-gradient(820px 520px at -10% 2%, hsl(32 95% 60% / 0.08), transparent 55%)",
    "radial-gradient(circle at 1px 1px, hsl(var(--foreground) / 0.05) 1px, transparent 0)",
  ].join(", "),
  backgroundSize: "auto, auto, 22px 22px",
};

export default function FullStudyPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();

  const currentSession = useAppStore((s) => s.currentSession);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const studySessions = useAppStore((s) => s.studySessions);
  const processStudyContent = useAppStore((s) => s.processStudyContent);
  const updateTopic = useAppStore((s) => s.updateTopic);
  const syncPendingProgress = useAppStore((s) => s.syncPendingProgress);

  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [notesPending, setNotesPending] = useState<Set<string>>(new Set());
  const notesRunning = useRef(false);

  // Wrong questions collected across the whole session.
  const [wrong, setWrong] = useState<WrongEntry[]>([]);
  const [showWrong, setShowWrong] = useState(false);
  const [readMode, setReadMode] = useState(false);
  const [readTheme, setReadTheme] = useState<"paper" | "night">(() => {
    try {
      return (localStorage.getItem("ps-read-theme") as "paper" | "night") || "paper";
    } catch {
      return "paper";
    }
  });
  const toggleReadTheme = useCallback(() => {
    setReadTheme((t) => {
      const next = t === "paper" ? "night" : "paper";
      try {
        localStorage.setItem("ps-read-theme", next);
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

  // ---- auto-write notes for every section that doesn't have them yet --------
  // Sequential (one at a time) so we never overwhelm the single-worker dev API;
  // the backend call is idempotent, so re-opening a session costs nothing.
  useEffect(() => {
    if (!currentSession || notesRunning.current) return;
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

  // ------------------------------------------------------------------ states
  if (!sessionId || (!currentSession && !isLoadingSession)) {
    return (
      <SessionPicker
        sessions={studySessions}
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
          This session has no content yet. Paste your material and PlayStudy will build the sections and quizzes.
        </p>
        <div className="mt-6">
          <StudyContentUpload onContentSubmit={(c) => processStudyContent(currentSession.id, c)} isProcessing={false} />
        </div>
      </div>
    );
  }

  const session = currentSession!;

  return (
    <div className="relative -m-4 min-h-full md:-m-6">
      {/* full-bleed reading backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={BACKDROP_STYLE} />
      <div className="relative p-4 md:p-6">
        <div className="fade-in mx-auto w-full max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Full Study</p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight md:text-[28px]">{session.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setReadMode(true)}
            title="Distraction-free reading"
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <BookText className="size-3.5" />
            Read mode
          </button>
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
          <div className="w-44 sm:w-56">
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

      {/* Source — the video this session was built from */}
      {session.sourceKind === "youtube" && session.sourceUrl && (
        <a
          href={session.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 pr-4 transition-colors hover:bg-muted/50"
        >
          <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
            {session.sourceSnapshots?.[0] && (
              <img
                src={session.sourceSnapshots[0]}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className="absolute inset-0 flex items-center justify-center">
              <Youtube className="size-6 text-white drop-shadow" />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">From YouTube</span>
            <span className="mt-0.5 block truncate text-sm font-medium">Built from this video's transcript</span>
            <span className="block truncate text-xs text-muted-foreground">{session.sourceUrl}</span>
          </span>
        </a>
      )}

      <div className="mt-6 grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
        {/* Document */}
        <div className="order-2 min-w-0 space-y-12 lg:order-1">
          {sections.map((s) => (
            <StudySection
              key={s.topic.id}
              section={s}
              total={sections.length}
              session={session}
              notesLoading={notesPending.has(s.topic.id)}
              onWrong={addWrong}
              onRight={clearWrong}
              onNext={() => {
                const next = sections[s.index]; // index is 1-based → next section
                if (next) scrollTo(next.topic.id);
                else document.getElementById("session-end")?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          ))}

          <div id="session-end" className="rounded-2xl border border-border bg-card p-6 text-center">
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
        </div>

        {/* Outline */}
        <nav className="order-1 hidden lg:order-2 lg:block">
          <div className="sticky top-2 space-y-1">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">On this page</p>
            {sections.map((s) => (
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
  onWrong,
  onRight,
  onNext,
}: {
  section: Section;
  total: number;
  session: StudySession;
  notesLoading: boolean;
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
  const reward = useAppStore((s) => (s.lastTopicReward?.topicId === topic.id ? s.lastTopicReward : null));

  const questions = topic.questions ?? [];

  // Notes editing
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
      await updateTopicDetails(session.id, topic.db_id, patch);
      updateTopic(session.id, topic.id, patch);
      setEditing(null);
    } catch (e) {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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

  const revise = async () => {
    if (!topic.db_id || !instruction.trim()) return;
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

  return (
    <section id={`section-${topic.id}`} className="scroll-mt-4">
      {/* Heading */}
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
              <Button size="sm" onClick={save} disabled={saving}>
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
                onClick={() => {
                  setDraftTitle(topic.title);
                  setDraftDesc(topic.description ?? "");
                  setEditing("head");
                }}
                className="mt-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                aria-label="Edit section"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-[#FCFBF6] shadow-sm dark:bg-card">
        {editing !== "notes" && topic.db_id && topic.notes && (
          <div className="flex items-center justify-end gap-1 border-b border-border/70 px-3 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 text-xs", asking ? "text-foreground" : "text-muted-foreground")}
              onClick={() => { setAsking((a) => !a); setInstruction(""); }}
              disabled={revising}
            >
              <Wand2 className="size-3.5" />
              Ask AI to change
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                setDraftNotes(topic.notes ?? "");
                setEditing("notes");
              }}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </div>
        )}
        {asking && topic.notes && editing !== "notes" && (
          <div className="border-b border-border/70 bg-muted/40 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Wand2 className="size-4 shrink-0 text-chart-1" />
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") revise(); if (e.key === "Escape") setAsking(false); }}
                placeholder="Tell the AI what to change — e.g. “make the example about basketball”, “simplify the second part”"
                className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-foreground"
                autoFocus
                disabled={revising}
              />
              <Button size="sm" className="h-9" onClick={revise} disabled={revising || !instruction.trim()}>
                {revising ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                Apply
              </Button>
            </div>
          </div>
        )}
        <div className="px-6 py-5 sm:px-7">
          {editing === "notes" ? (
            <div className="space-y-2">
              <Textarea
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                rows={Math.min(26, Math.max(10, draftNotes.split("\n").length + 2))}
                placeholder="Write the notes for this section. Markdown works: **bold**, - lists, ## headings, <mark>highlight</mark>."
                className="font-mono text-[13px] leading-relaxed"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Save notes
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : topic.notes ? (
            <RichNotes md={topic.notes} />
          ) : notesLoading || writing ? (
            <div className="space-y-2.5 py-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Writing readable notes from your material…
              </div>
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3.5 w-10/12" />
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 py-2">
              <p className="text-sm text-muted-foreground">Notes couldn't be written automatically.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => writeNotes(false)} disabled={!topic.db_id}>
                  <Sparkles className="size-3.5" />
                  Write notes with AI
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraftNotes("");
                    setEditing("notes");
                  }}
                  disabled={!topic.db_id}
                >
                  <Pencil className="size-3.5" />
                  Write them myself
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quiz */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Quiz</p>
          {(revealed || (topic.completed && !showSummary)) && questions.length > 0 && !review && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {revealed ? `${Math.min(idx + 1, questions.length)} / ${questions.length}` : `Score ${Math.round(topic.score ?? 0)}%`}
            </span>
          )}
        </div>

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
          // Idle CTA
          <div className="px-5 py-7 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-chart-1/10">
              <ListChecks className="size-5 text-chart-1" />
            </div>
            <p className="mt-3 text-sm font-semibold">Quiz this section</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              A short set of thoughtful, challenging questions written from this section's notes — one at a time.
              Anything you miss goes to Wrong questions.
            </p>
            <Button size="sm" className="mt-4" onClick={() => openQuiz(false)} disabled={!topic.db_id}>
              <ListChecks className="size-3.5" />
              Quiz this section
            </Button>
          </div>
        )}
      </div>

      <SectionFlashcards session={session} topic={topic} />
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
      <div className="mt-4 flex flex-col items-start gap-2.5 rounded-2xl border border-dashed border-border/70 bg-card/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-chart-1/10">
            <Layers className="size-4 text-chart-1" />
          </span>
          <div>
            <p className="text-sm font-semibold">Flashcards</p>
            <p className="text-xs text-muted-foreground">Check your memory — flip cards drawn from this section.</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => load(false)} disabled={loading || !topic.db_id}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Layers className="size-3.5" />}
          {loading ? "Making cards…" : "Flashcards"}
        </Button>
      </div>
    );
  }

  const card = cards[idx];
  return (
    <div className="mt-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Flashcards <span className="ml-1 normal-case tracking-normal">· {idx + 1} / {cards.length}</span>
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show question" : "Reveal answer"}
        className={cn(
          "flex h-52 w-full flex-col items-center justify-center rounded-2xl border px-6 text-center transition-colors",
          flipped ? "border-chart-1/30 bg-chart-1/5" : "border-border bg-muted/40",
        )}
      >
        {flipped ? (
          <div key="back" className="fade-in">
            <p className="text-[15px] leading-relaxed">{card.back}</p>
            {card.hint && <p className="mt-3 text-xs text-muted-foreground">Hint: {card.hint}</p>}
            <p className="mt-4 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Tap to flip back</p>
          </div>
        ) : (
          <div key="front" className="fade-in">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Recall</p>
            <p className="mt-3 text-lg font-medium leading-snug">{card.front}</p>
            <p className="mt-4 text-xs text-muted-foreground">Tap to reveal</p>
          </div>
        )}
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
            Paste notes, drop a PDF, or add a YouTube link and PlayStudy writes the sections and quizzes.
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
