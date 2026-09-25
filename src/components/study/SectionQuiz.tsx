import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, ListChecks, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopicSummary } from "@/components/TopicSummary";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { useAppStore, type Question, type StudySession, type Topic } from "@/store/appStore";
import { generateSectionQuiz, getQuestionHint } from "@/services/api";
import { answerText, kindOf } from "@/lib/quiz/grade";
import type { QuizEvent, QuizItem } from "@/lib/quiz/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { optionLabel } from "./quizKeys";
import { useLiveSection, type WrongEntry } from "./sections";

/*
  A section's quiz: a few challenging questions from its notes, one at a time.

  It used to sit under every section of Full Study. It now opens from the page's Quiz
  buttons (SectionStudyDialog, SessionQuizDialog), from the exam plan, and on Teach
  mode's board at the end of a section, so it is its own component. The backend writes
  (or reuses) the questions, every answer goes through the store, and finishing is what
  marks the section complete: the sidebar ticks, "N sections to go" and the XP all
  come from that.

  The questions themselves (every kind: single choice, select all, true/false, order,
  sort, fill in the blank, match) run in QuizRunner, which a PDF's quiz shares; this
  keeps what belongs to a section: fetching its questions, the invitation on the board,
  the finished states, and the store. A wrong first try gets a hint (the question's
  own, else one the server writes once and keeps) and another go. Only the FIRST try
  is the answer: it alone goes to the store (score, XP, the answer log a guardian sees)
  and to the wrong-questions list. A second try that's right is "Got it with a hint",
  practice that earns nothing.
*/

/** When no hint could be found (offline, or the server couldn't write a safe one). */
const HINT_NUDGE = "Look back at what this section says about the key idea here, then try again.";

export interface SectionQuizProps {
  session: StudySession;
  topic: Topic;
  onWrong: (e: WrongEntry) => void;
  onRight: (key: string) => void;
  /** What "Continue" does after the result: the next section on the page, or on with the lesson. */
  onDone?: () => void;
  /** Tighter spacing, for the Teach mode board. */
  compact?: boolean;
  /** Open on an invitation (Start quiz · Skip for now) instead of starting at once: the
   *  board's hand-off at the end of a section. "Skip for now" is `onDone`. */
  invite?: boolean;
  /** The questions are being fetched: the quiz has begun (from the invitation or a retry). */
  onStart?: () => void;
  /** A hint that arrived after its question's 'answered' event, with its words: Teach
   *  mode says it in the tutor's speech bubble too. */
  onHint?: (text: string) => void;
  /** Everything the running quiz does, for Teach mode to say (see QuizEvent). */
  onEvent?: (e: QuizEvent) => void;
  /** The quiz reached its end and the result is up. */
  onFinished?: () => void;
  /** "Ask about this" on the board: the tutor listens for a question about this one. */
  onAsk?: () => void;
  /** "See it on the page", for a question that says where its answer is. */
  onShowSource?: (q: QuizItem) => void;
}

export function SectionQuiz({
  session,
  topic: given,
  onWrong,
  onRight,
  onDone,
  compact = false,
  invite = false,
  onStart,
  onHint,
  onEvent,
  onFinished,
  onAsk,
  onShowSource,
}: SectionQuizProps) {
  const { toast } = useToast();
  const { section, total } = useLiveSection(session, given);
  const { topic, index } = section;

  const answerQuestion = useAppStore((s) => s.answerQuestion);
  const completeTopic = useAppStore((s) => s.completeTopic);
  const setTopicQuestions = useAppStore((s) => s.setTopicQuestions);
  const setQuestionHint = useAppStore((s) => s.setQuestionHint);
  const reward = useAppStore((s) => (s.lastTopicReward?.topicId === topic.id ? s.lastTopicReward : null));

  const questions = topic.questions ?? [];

  // Opened from a Quiz button, it starts at once: that click was the "Start". A section
  // already done opens on its result instead (review, retry or fresh questions), and
  // the board's invitation waits to be taken up. Decided once, on opening.
  const [autoStart] = useState(() => !invite && !topic.completed && !!topic.db_id);

  const [running, setRunning] = useState(false);
  /** Each start is a new run: the runner starts over for it, and a late hint is dropped. */
  const [runId, setRunId] = useState(0);
  /** Questions got on the second try, after a hint: shown with the result, never scored. */
  const [hinted, setHinted] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [review, setReview] = useState(false);
  // Already loading when it starts at once, so the first frame isn't a Start button.
  const [quizLoading, setQuizLoading] = useState(autoStart);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const wrongKey = (q: Question, i: number) => `${topic.id}::${q.id ?? i}`;

  const openQuiz = async (fresh: boolean) => {
    if (!topic.db_id) return;
    onStart?.();
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
    if (!alive.current) return;
    setQuizLoading(false);
    setRunId((n) => n + 1);
    setHinted(0);
    setShowSummary(false);
    setReview(false);
    setRunning(true);
  };

  // Once only, even through StrictMode's double mount, so it never asks the backend twice.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !autoStart) return;
    autoStarted.current = true;
    void openQuiz(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The hint for a wrong first try: the question's own, else one the server writes (and
   * keeps, so a retry of this quiz has it at once), else null for the runner's nudge.
   * Only a question the server numbered can be asked about (older copies carry made-up
   * ids), and a true/false one never: a second pick there would be forced.
   */
  const getHint = async (q: Question): Promise<string | null> => {
    const own = q.hint?.trim();
    if (own) return own;
    if (!topic.db_id || !/^\d+$/.test(q.id) || kindOf(q) === "true_false") return null;
    try {
      const text = await getQuestionHint(session.id, topic.db_id, q.id);
      setQuestionHint(session.id, topic.id, q.id, text);
      return text;
    } catch {
      return null;
    }
  };

  const finish = () => {
    completeTopic(session.id, topic.id);
    setShowSummary(true);
    setRunning(false);
    onFinished?.();
  };

  const retry = async () => {
    await openQuiz(false);
  };

  // The right option's name in the review: its number key on the board, else a letter.
  const numbered = compact;
  const score = Math.round(topic.score ?? 0);
  const count = `${questions.length} question${questions.length === 1 ? "" : "s"}`;

  return (
    <div className="outline-none" data-section-quiz={topic.db_id ?? undefined}>
      {quizLoading ? (
        <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", compact ? "py-6" : "py-8")}>
          <Loader2 className="size-4 animate-spin" /> Writing challenging questions for this section…
        </div>
      ) : showSummary && reward ? (
        <div>
          <TopicSummary
            topicTitle={topic.title}
            score={topic.score ?? 0}
            totalQuestions={questions.length}
            onContinue={() => {
              setShowSummary(false);
              onDone?.();
            }}
            onRetry={retry}
            isLastTopic={index === total}
            xp={reward.breakdown}
            sessionCompleted={reward.sessionCompleted}
          />
          {hinted > 0 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Plus {hinted} more with a hint. The score counts first tries only.
            </p>
          )}
        </div>
      ) : review ? (
        <div className="divide-y divide-border">
          {questions.map((q, qi) => (
            <div key={q.id ?? qi} className={compact ? "py-3" : "py-4"}>
              <p className="text-sm font-medium">
                <span className="mr-2 tabular-nums text-muted-foreground">{qi + 1}.</span>
                {q.question}
              </p>
              <p className="mt-2 text-xs text-success">
                <Check className="mr-1 inline size-3.5 align-[-2px]" />
                {kindOf(q) === "single" ? `${optionLabel(q.correctAnswer, numbered)}. ${answerText(q)}` : answerText(q)}
              </p>
              {q.explanation && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{q.explanation}</p>}
            </div>
          ))}
          <div className="flex justify-end pt-3">
            <Button size="sm" variant="ghost" onClick={() => setReview(false)}>
              Done reviewing
            </Button>
          </div>
        </div>
      ) : running && questions.length > 0 ? (
        <QuizRunner
          quizKey={`${topic.id}:${runId}`}
          questions={questions}
          compact={compact}
          getHint={getHint}
          nudge={() => HINT_NUDGE}
          onFirstTry={(q, i, r) => {
            // The answer that counts: score, XP, the answer log and the wrong-questions list.
            // `i` is the question's place in the section's list, which is the store's.
            const { correct } = answerQuestion(session.id, topic.id, r, i);
            const key = wrongKey(q, i);
            if (correct) onRight(key);
            else onWrong({ key, topicId: topic.id, sectionTitle: topic.title, sectionIndex: index, question: q, origin: "notes" });
          }}
          onEvent={onEvent}
          onHint={onHint}
          onShowSource={onShowSource}
          onAsk={onAsk}
          onComplete={(result) => {
            setHinted(result.hinted);
            finish();
          }}
        />
      ) : topic.completed && invite ? (
        // The board's hand-off for a section already done: no need to stop the lesson for it.
        <div className={cn("flex flex-col items-center text-center", compact ? "py-3" : "py-5")}>
          <CheckCircle2 className="size-7 text-success" />
          <p className="mt-2 text-base font-semibold">You've done this quiz</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {score}% · {count}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => onDone?.()} data-guide-quiz-start="">
              Carry on
              <ArrowRight className="size-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={retry}>
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
          </div>
        </div>
      ) : topic.completed ? (
        // Completed, collapsed
        <div className={cn("flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between", compact ? "py-2" : "py-3")}>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-success" />
            <span className="font-medium">Completed</span>
            <span className="text-muted-foreground">
              · {score}% · {count}
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
      ) : invite ? (
        // The board's hand-off at the end of a section: an invitation, not a demand.
        <div className={cn("flex flex-col items-center text-center", compact ? "py-3" : "py-5")}>
          <span className="flex size-10 items-center justify-center rounded-2xl bg-chart-1/10">
            <ListChecks className="size-5 text-chart-1" />
          </span>
          <p className="mt-3 text-base font-semibold">Quiz time</p>
          <p className="mt-0.5 max-w-sm text-sm text-muted-foreground">
            {questions.length > 0 ? `${count} on ${topic.title}` : `A few challenging questions on ${topic.title}`}, one at a time.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => openQuiz(false)} disabled={!topic.db_id} data-guide-quiz-start="">
              <ListChecks className="size-3.5" />
              Start quiz
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onDone?.()}>
              Skip for now
            </Button>
          </div>
        </div>
      ) : (
        // Not started: only when starting didn't work (it starts on opening), so it can be tried again.
        <div className="flex items-center gap-2.5 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
            <ListChecks className="size-3.5 text-chart-1" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Quiz this section</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">A few challenging questions from these notes, one at a time.</p>
          </div>
          <Button size="sm" className="h-8 shrink-0" onClick={() => openQuiz(false)} disabled={!topic.db_id}>
            <ListChecks className="size-3.5" />
            Start
          </Button>
        </div>
      )}
    </div>
  );
}
