import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, ListChecks, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopicSummary } from "@/components/TopicSummary";
import { QuizRunner, type QuizResult } from "@/components/quiz/QuizRunner";
import { usePdfPart, usePdfQuizStore, type PdfPartResult } from "@/store/pdfQuizStore";
import { pdfPageBlocks } from "@/lib/pdf/checkpoints";
import { trackAction } from "@/lib/analytics";
import { finishLine } from "@/lib/quiz/speech";
import type { PdfCheckpoint, QuizEvent, QuizItem } from "@/lib/quiz/types";
import type { Question } from "@/store/appStore";
import { cn } from "@/lib/utils";
import type { WrongEntry } from "./sections";

/*
  The quiz on one part of a PDF (a checkpoint: a run of pages, lib/pdf/checkpoints.ts).

  The same questions and runner as a section's quiz (QuizRunner), written from the
  pages themselves: the page text the browser has laid out goes to the server, which
  writes the questions the first time and keeps them. Each question knows the page,
  paragraph and words its answer is in, so on Teach mode's board the tutor can point
  at them.

  Two ways in:
  - the part's quiz ("quiz"), at the end of its pages on the board (an invitation), or
    from the top Quiz button and the Pages outline (PdfQuizDialog, started at once);
  - a quick check ("check", `only`): one key question in the middle of the lesson,
    right after the tutor explains the paragraph it comes from.
  A part's quiz asks only what the quick checks haven't, and its result counts every
  first try across both (pdfQuizStore keeps them). A quick check skipped goes back
  into the part's quiz.

  Finishing a part once, at any score, is what ticks it off. It doesn't count towards
  the session's progress: that's the sections'.
*/

export interface PdfQuizProps {
  sessionId: string;
  checkpoint: PdfCheckpoint;
  /** Open on an invitation (Start quiz · Skip for now): the board's hand-off at the end of the part. */
  invite?: boolean;
  /** Start at once (opened from a Quiz button, which was the "Start"). A part already done opens on its result. */
  autoStart?: boolean;
  /** Tighter spacing, for the Teach mode board. */
  compact?: boolean;
  /** A quick check: only these questions (by id). Implies mode "check". */
  only?: string[];
  /** "check": a quick check mid-lesson (starts at once, no summary). "quiz" (the default): the part's quiz. */
  mode?: "check" | "quiz";
  /** The summary's Continue button, where it does something other than carry on ("Next part", "Close"). */
  continueLabel?: string;
  /** The questions are on their way: the quiz has begun (from the invitation, a retry). */
  onStart?: () => void;
  /** Close and carry on: Continue, Skip for now, Carry on. */
  onDone: () => void;
  /** A hint that arrived after its question's 'answered' event, for the tutor to say. */
  onHint?: (text: string) => void;
  /** Everything the running quiz does, for the tutor to say and point at. */
  onEvent?: (e: QuizEvent) => void;
  /** The quiz reached its end: the result is up (or a quick check was answered). */
  onFinished?: () => void;
  /** "See it on page N": underline the words the answer is in. */
  onShowSource?: (q: QuizItem) => void;
  /** "Ask about this": the tutor listens for a question about the one on the board. */
  onAsk?: () => void;
  onWrong?: (e: WrongEntry) => void;
  onRight?: (key: string) => void;
}

type Phase = "idle" | "loading" | "error" | "running" | "summary";

/** "pages 3–5", "page 3", "slides 3–5": the part's title inside a sentence. */
const inSentence = (cp: PdfCheckpoint) => cp.title.charAt(0).toLowerCase() + cp.title.slice(1);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function PdfQuiz({
  sessionId,
  checkpoint: cp,
  invite = false,
  autoStart = false,
  compact = false,
  only,
  mode: givenMode,
  continueLabel,
  onStart,
  onDone,
  onHint,
  onEvent,
  onFinished,
  onShowSource,
  onAsk,
  onWrong,
  onRight,
}: PdfQuizProps) {
  const mode = givenMode ?? (only ? "check" : "quiz");
  const check = mode === "check";
  const part = usePdfPart(sessionId, cp.topicId);
  const done = !!part?.completed;

  // Decided once, on opening: a quick check always starts at once; a part's quiz does
  // when opened from a Quiz button, unless it's done (then its result, with Retry).
  const [startNow] = useState(() => check || (autoStart && !invite && !usePdfQuizStore.getState().isDone(sessionId, cp.topicId)));
  const [phase, setPhase] = useState<Phase>(startNow ? "loading" : "idle");
  const [error, setError] = useState<string | null>(null);
  /** The questions this run asks, fixed when it starts: the answers going into the store mustn't reshuffle them. */
  const [run, setRun] = useState<{ id: number; questions: Question[] }>({ id: 0, questions: [] });
  const [result, setResult] = useState<PdfPartResult | null>(null);
  /** Got on the second try, after a hint: shown with the result, never scored. */
  const [hinted, setHinted] = useState(0);
  /** A quick check's question has had its first try: skipping it now wouldn't give it back. */
  const [tried, setTried] = useState(false);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** The part's end: every first try this visit, across the quick checks and this quiz. */
  const finishPart = () => {
    const store = usePdfQuizStore.getState();
    const { right, total } = store.totals(sessionId, cp.topicId);
    return store.complete(sessionId, cp, right, total);
  };

  /**
   * Fetch (or reuse) the questions and start. `fresh` writes new ones; `again` asks the
   * part's every question again (Retry) instead of only those not answered yet.
   */
  const start = async (opts: { fresh?: boolean; again?: boolean } = {}) => {
    const store = usePdfQuizStore.getState();
    onStart?.();
    setPhase("loading");
    setError(null);
    let quiz;
    try {
      quiz = await store.ensure(sessionId, cp, () => pdfPageBlocks(cp.first, cp.last), { force: opts.fresh });
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : "Couldn't write the questions");
      setPhase("error");
      return;
    }
    if (!alive.current) return;
    if (opts.again) store.restart(sessionId, cp.topicId);
    const left = store.remaining(sessionId, cp.topicId);
    const questions = check ? left.filter((q) => only?.includes(q.id)) : left;

    if (!questions.length) {
      // A quick check on a question already answered: nothing to stop for.
      if (check) {
        onFinished?.();
        onDone();
        return;
      }
      // Every question was asked as a quick check (or answered before the dialog
      // closed): the part's quiz is just its result.
      if (!quiz.questions.length) {
        setError("There were no questions I could ask on these pages.");
        setPhase("error");
        return;
      }
      setResult(finishPart());
      setPhase("summary");
      onFinished?.();
      return;
    }
    trackAction("pdf_quiz_start", { mode, questions: questions.length, first: cp.first, last: cp.last });
    setRun((r) => ({ id: r.id + 1, questions }));
    setHinted(0);
    setTried(false);
    setResult(null);
    setPhase("running");
  };

  // Once only, even through StrictMode's double mount, so it never asks the server twice.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !startNow) return;
    started.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onComplete = (ran: QuizResult) => {
    const store = usePdfQuizStore.getState();
    if (check) {
      // A quick check closes as soon as it's answered, and the lesson carries on. If it
      // was the part's last question still open, that was the part's end too.
      if (store.remaining(sessionId, cp.topicId).length === 0) finishPart();
      onFinished?.();
      onDone();
      return;
    }
    setHinted(ran.hinted);
    setResult(finishPart());
    setPhase("summary");
    onFinished?.();
  };

  /** The runner's events, with the result said for the whole part: the questions asked
   *  as quick checks count too, so "two of three" would contradict the card's 3 / 4. */
  const forward = (e: QuizEvent) => {
    if (e.type === "finished" && !check) {
      const { right, total } = usePdfQuizStore.getState().totals(sessionId, cp.topicId);
      if (total !== e.total) {
        onEvent?.({ ...e, right, total, say: finishLine(right, total) });
        return;
      }
    }
    onEvent?.(e);
  };

  // What the invitation promises: what the part's quiz will ask, less any quick checks already answered.
  const count = part?.quiz ? part.quiz.questions.filter((q) => part.answered[q.id] === undefined).length : (part?.questionCount ?? 0);
  const questionCount = part?.quiz?.questions.length ?? part?.questionCount ?? 0;
  const tries = part ? Object.values(part.answered) : [];
  // The best to show for a part done: this visit's result when there is one, else its best.
  const scoreLine =
    tries.length && tries.length === questionCount
      ? `${tries.filter(Boolean).length} of ${questionCount} right`
      : part?.bestScore != null && questionCount
        ? `Best ${part.bestScore} of ${questionCount}`
        : questionCount
          ? plural(questionCount, "question")
          : null;

  return (
    <div className="outline-none" data-pdf-quiz={cp.topicId}>
      {phase === "loading" ? (
        <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", compact ? "py-6" : "py-8")}>
          <Loader2 className="size-4 animate-spin" /> Writing questions from {inSentence(cp)}…
        </div>
      ) : phase === "error" ? (
        <div className={cn("flex flex-col items-center text-center", compact ? "py-3" : "py-5")}>
          <AlertCircle className="size-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">Couldn't write the questions</p>
          {error && <p className="mt-0.5 max-w-sm text-sm text-muted-foreground">{error}</p>}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => void start()}>
              <RotateCcw className="size-3.5" />
              Try again
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onDone}>
              {check || invite ? "Skip for now" : (continueLabel ?? "Close")}
            </Button>
          </div>
        </div>
      ) : phase === "running" && run.questions.length > 0 ? (
        <div>
          <QuizRunner
            quizKey={`${cp.topicId}:${run.id}`}
            questions={run.questions}
            mode={mode}
            compact={compact}
            // A PDF's hints are written with its questions (QuizRunner shows a question's
            // own); with none, the nudge sends them back to the page, where the tutor points.
            nudge={(q) => `Look back at ${q.source?.page ? `page ${q.source.page}` : inSentence(cp)}.`}
            onFirstTry={(q, i, r, g) => {
              setTried(true);
              usePdfQuizStore.getState().answer(sessionId, cp, q, i, r, g);
              const key = `${cp.topicId}::${q.id}`;
              if (g.correct) onRight?.(key);
              else onWrong?.({ key, topicId: cp.topicId, sectionTitle: cp.title, sectionIndex: cp.first, question: q, origin: "pdf" });
            }}
            // Only with a host listening: the runner offers "read aloud" when there is one.
            onEvent={onEvent ? forward : undefined}
            onHint={onHint}
            onShowSource={onShowSource}
            onAsk={onAsk}
            onComplete={onComplete}
          />
          {check && !tried && (
            // Not now: the question goes back into the part's quiz at the end of its pages.
            <div className="mt-2 flex justify-center">
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onDone}>
                Skip for now
              </Button>
            </div>
          )}
        </div>
      ) : phase === "summary" && result ? (
        <div>
          <TopicSummary
            topicTitle={cp.title}
            score={result.total ? (result.right / result.total) * 100 : 0}
            totalQuestions={result.total}
            unitLabel="part"
            continueLabel={continueLabel ?? "Continue"}
            onContinue={onDone}
            onRetry={() => void start({ again: true })}
            onNewQuestions={() => void start({ fresh: true })}
            xp={result.xp}
          />
          {hinted > 0 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Plus {hinted} more with a hint. The score counts first tries only.
            </p>
          )}
        </div>
      ) : done && invite ? (
        // The board's hand-off for a part already checked: no need to stop the lesson for it.
        <div className={cn("flex flex-col items-center text-center", compact ? "py-3" : "py-5")}>
          <CheckCircle2 className="size-7 text-success" />
          <p className="mt-2 text-base font-semibold">You've checked {inSentence(cp)}</p>
          {scoreLine && <p className="mt-0.5 text-sm text-muted-foreground">{scoreLine}</p>}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={onDone} data-guide-quiz-start="">
              Carry on
              <ArrowRight className="size-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => void start({ again: true })}>
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
          </div>
        </div>
      ) : done ? (
        // Checked, collapsed: the dialog opened on a part already done.
        <div className={cn("flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between", compact ? "py-2" : "py-3")}>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-success" />
            <span className="font-medium">Checked</span>
            {scoreLine && <span className="text-muted-foreground">· {scoreLine}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void start({ again: true })}>
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void start({ fresh: true })}>
              <Sparkles className="size-3.5" />
              New questions
            </Button>
          </div>
        </div>
      ) : invite ? (
        // The board's hand-off at the end of the part: an invitation, not a demand.
        <div className={cn("flex flex-col items-center text-center", compact ? "py-3" : "py-5")}>
          <span className="flex size-10 items-center justify-center rounded-2xl bg-chart-1/10">
            <ListChecks className="size-5 text-chart-1" />
          </span>
          <p className="mt-3 text-base font-semibold">Quiz time</p>
          <p className="mt-0.5 max-w-sm text-sm text-muted-foreground">
            {count > 0 ? `${plural(count, "question")} on ${inSentence(cp)}` : `A few questions on ${inSentence(cp)}`}, one at a time.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => void start()} data-guide-quiz-start="">
              <ListChecks className="size-3.5" />
              Start quiz
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onDone}>
              Skip for now
            </Button>
          </div>
        </div>
      ) : (
        // Not started: opened without starting, so it can be started here.
        <div className="flex items-center gap-2.5 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
            <ListChecks className="size-3.5 text-chart-1" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Quiz {inSentence(cp)}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">A few questions from these pages, one at a time.</p>
          </div>
          <Button size="sm" className="h-8 shrink-0" onClick={() => void start()}>
            <ListChecks className="size-3.5" />
            Start
          </Button>
        </div>
      )}
    </div>
  );
}

