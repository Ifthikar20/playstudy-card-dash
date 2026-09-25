import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, ChevronRight, FileText, Mic, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Grade, QuizEvent, QuizItem, QuizResponse } from "@/lib/quiz/types";
import { grade, kindOf } from "@/lib/quiz/grade";
import { finishLine, partialLine, questionLine, revealLine, rightLine, wrongLine } from "@/lib/quiz/speech";
import { readAloudOn, setReadAloud, subscribeReadAloud } from "@/lib/quiz/readAloud";
import { useQuizKeys } from "@/components/study/quizKeys";
import { QuestionView, type QuizStage } from "./QuestionView";

/*
  The one quiz engine: a section's quiz from the notes, the whole session's, a PDF
  part's, and the board's one-question quick check all run through this. Questions go
  in; the first try at each comes out (onFirstTry: the only answer that scores), and
  the result at the end (onComplete). It keeps nothing itself: no store, no network.

  Each question, one at a time:
  - Right first time: that's it.
  - Wrong first time: one more go, with a hint - the question's own, else one asked for
    (getHint), else a nudge. True/false has no second go (the other answer would be the
    only one left), so its answer shows at once.
  - Wrong again: the answer shows, with why.
  The kinds marked in parts (multi, order, categorize, match) say how close it came
  ("2 of 5 are in the right place"); that's feedback, never score.

  Whoever hosts it hears about each step (onEvent), each with a line to say (`say`,
  empty when there's nothing to add): Teach mode reads the question out, reacts to the
  answer, gives the hint in its bubble and points at the page. A hint that turns up
  after the answer's event comes separately (onHint). Exactly one line per thing the
  student does, so no line talks over another: a wrong true/false or a wrong second
  go says the answer in that same line, and the reveal that follows says nothing.

  Keys (where they work, see quizKeys): each kind's own, Enter to Check, and Enter
  again for the next question.
*/

export interface QuizResult {
  /** Right on the first try. */
  right: number;
  total: number;
  /** Right on the second go, after the hint (practice: not scored). */
  hinted: number;
}

export interface QuizRunnerProps {
  /** A new key starts the quiz again from the first question (a retry, fresh questions). */
  quizKey: string;
  questions: QuizItem[];
  /** Run just these questions (by id), in the order `questions` has them. */
  only?: string[];
  /** "check": a quick check mid-lesson (one question, usually): no progress dots, no
   *  running score, "Continue" at the end, and nothing said as it finishes (the lesson
   *  carries on talking). */
  mode?: "quiz" | "check";
  /** Tighter spacing, big tap targets, for the Teach mode board. */
  compact?: boolean;
  /** Name options by their number keys even where the keys aren't live. */
  numbered?: boolean;
  /** A hint for question `i` (its index in `questions`) after a wrong first answer; null for none. */
  getHint?: (q: QuizItem, i: number) => Promise<string | null>;
  /** The words when there's no hint to be had ("Look back at page 4."). */
  nudge?: (q: QuizItem) => string;
  /** The first try at question `i` (its index in `questions`): the answer that counts. */
  onFirstTry: (q: QuizItem, i: number, r: QuizResponse, g: Grade) => void;
  onEvent?: (e: QuizEvent) => void;
  /** A hint that arrived after its question's "answered" event, while it can still help. */
  onHint?: (text: string) => void;
  /** "See it on page N", once a PDF question with a source is settled. */
  onShowSource?: (q: QuizItem) => void;
  /** "Ask about this": the tutor takes a question about this question. */
  onAsk?: () => void;
  /** Finished: the last question's Finish. The host shows its summary. */
  onComplete: (result: QuizResult) => void;
  /** The last button's words (default "Finish", or "Continue" for a quick check). */
  finishLabel?: string;
}

/** The words when nothing better is to hand. */
const DEFAULT_NUDGE = "Look back at what this part says about the key idea here, then try again.";

interface Entry {
  first?: QuizResponse;
  firstRight?: boolean;
  second?: QuizResponse;
  secondRight?: boolean;
  /** The hint: its words, null while being found, undefined for none. */
  hint?: string | null;
}

interface RunState {
  key: string;
  pos: number;
  entries: Entry[];
  done: boolean;
}

const fresh = (key: string): RunState => ({ key, pos: 0, entries: [], done: false });

/** Where a question stands, from what's been answered. */
function stageOf(q: QuizItem, e: Entry | undefined): QuizStage {
  if (!e?.first) return "answer";
  if (e.firstRight || e.second || kindOf(q) === "true_false") return "settled";
  return "retry";
}

export function QuizRunner({
  quizKey,
  questions,
  only,
  mode = "quiz",
  compact = false,
  numbered = false,
  getHint,
  nudge,
  onFirstTry,
  onEvent,
  onHint,
  onShowSource,
  onAsk,
  onComplete,
  finishLabel,
}: QuizRunnerProps) {
  const check = mode === "check";
  const run = only ? questions.filter((q) => only.includes(q.id)) : questions;
  const total = run.length;

  const [state, setState] = useState<RunState>(() => fresh(quizKey));
  // A new key is a new quiz: back to the first question, nothing answered.
  let s = state;
  if (s.key !== quizKey) {
    s = fresh(quizKey);
    setState(s);
  }
  const pos = Math.min(s.pos, Math.max(0, total - 1));
  const current = run[pos];
  const entry = s.entries[pos];
  const stage = current ? stageOf(current, entry) : "answer";

  // The latest of everything, for the hint that arrives later and the events.
  const live = useRef({ s, onEvent, onHint });
  live.current = { s, onEvent, onHint };
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const emit = (e: QuizEvent) => live.current.onEvent?.(e);
  const indexOf = (q: QuizItem) => questions.findIndex((x) => x.id === q.id);
  const nudgeFor = (q: QuizItem) => nudge?.(q)?.trim() || DEFAULT_NUDGE;

  const setEntry = (at: number, patch: Partial<Entry>, key = s.key) =>
    setState((st) => {
      if (st.key !== key) return st;
      const entries = st.entries.slice();
      entries[at] = { ...entries[at], ...patch };
      return { ...st, entries };
    });

  // Each question read out as it comes up, once (StrictMode's second run finds it said).
  const said = useRef("");
  useEffect(() => {
    if (!current || s.done) return;
    const k = `${s.key}\n${pos}\n${current.id}`;
    if (said.current === k) return;
    said.current = k;
    emit({ type: "question", index: pos, total, q: current, say: questionLine(current, pos, total, { check }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.key, pos, current?.id, s.done]);

  /** Ask for question `at`'s hint; it goes up (and to onHint) when it comes, if still wanted. */
  const fetchHint = (q: QuizItem, at: number) => {
    const key = s.key;
    const ask = getHint ? getHint(q, indexOf(q)) : Promise.resolve(null);
    void ask
      .then((text) => text?.trim() || nudgeFor(q))
      .catch(() => nudgeFor(q))
      .then((text) => {
        if (!alive.current || live.current.s.key !== key) return;
        const e = live.current.s.entries[at];
        setEntry(at, { hint: text }, key);
        // Said only while it can still help: not once the second go is in.
        if (e && !e.second) live.current.onHint?.(text);
      });
  };

  const submit = (r: QuizResponse) => {
    const q = current;
    if (!q || s.done) return;
    const kind = kindOf(q);
    if (stage === "answer") {
      const g = grade(q, r);
      onFirstTry(q, indexOf(q), r, g);
      if (g.correct) {
        setEntry(pos, { first: r, firstRight: true });
        emit({ type: "answered", index: pos, q, correct: true, grade: g, hint: null, say: rightLine(pos) });
        return;
      }
      if (kind === "true_false") {
        setEntry(pos, { first: r, firstRight: false });
        emit({ type: "answered", index: pos, q, correct: false, grade: g, hint: null, say: `${wrongLine(pos)} ${revealLine(q)}` });
        emit({ type: "revealed", index: pos, q, say: "" });
        return;
      }
      // The hint: the question's own, else one asked for (null until it comes), else a nudge.
      const own = q.hint?.trim() || null;
      const hint = own ?? (getHint ? null : nudgeFor(q));
      setEntry(pos, { first: r, firstRight: false, hint });
      emit({
        type: "answered",
        index: pos,
        q,
        correct: false,
        grade: g,
        hint,
        say: [wrongLine(pos), partialLine(q, g), hint && `Here's a hint: ${hint}`].filter(Boolean).join(" "),
      });
      if (hint === null) fetchHint(q, pos);
      // Nobody is listening for the events, so nobody would say this hint: hand it over
      // the way a late one comes (the notes quiz on the board did, before events).
      else if (!onEvent) onHint?.(hint);
      return;
    }
    if (stage === "retry") {
      const g = grade(q, r);
      setEntry(pos, { second: r, secondRight: g.correct });
      emit({
        type: "retried",
        index: pos,
        q,
        correct: g.correct,
        say: g.correct ? `${rightLine(pos + 1)} Got it with the hint.` : `${wrongLine(pos + 1)} ${revealLine(q)}`,
      });
      if (!g.correct) emit({ type: "revealed", index: pos, q, say: "" });
    }
  };

  const counts = () => {
    let right = 0;
    let hinted = 0;
    let answered = 0;
    run.forEach((q, i) => {
      const e = s.entries[i];
      if (e?.firstRight) right++;
      else if (e?.secondRight) hinted++;
      if (e && stageOf(q, e) === "settled") answered++;
    });
    return { right, hinted, answered };
  };

  const finish = () => {
    const { right, hinted } = counts();
    setState((st) => (st.key === s.key ? { ...st, done: true } : st));
    emit({ type: "finished", right, total, say: check ? "" : finishLine(right, total) });
    onComplete({ right, total, hinted });
  };

  const settled = !!current && stage === "settled";
  const last = pos >= total - 1;
  const next = (): boolean => {
    if (!settled || s.done) return false;
    if (last) finish();
    else setState((st) => (st.key === s.key ? { ...st, pos: st.pos + 1 } : st));
    return true;
  };

  const keys = useQuizKeys({ enter: next });

  // Settled: the keyboard goes to Next (its Enter), unless it's somewhere else on purpose.
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!settled || s.done) return;
    const active = document.activeElement;
    const home = rootRef.current?.closest(".guide-board-panel, [data-study-dialog]") ?? rootRef.current;
    if (active && active !== document.body && !home?.contains(active)) return;
    nextRef.current?.focus({ preventScroll: true });
  }, [settled, pos, s.done]);

  const readAloud = useSyncExternalStore(subscribeReadAloud, readAloudOn, () => true);

  if (!current) return null;
  const { right, hinted, answered } = counts();
  const page = current.source?.page;

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
        keys.ref(el);
      }}
      tabIndex={-1}
      className={cn("quiz-runner outline-none", compact && "quiz-runner-compact")}
      data-quiz-runner={mode}
    >
      {(total > 1 && !check) || onEvent || onAsk ? (
        <div className={cn("flex items-center justify-between gap-3", compact ? "mb-3" : "mb-4")}>
          {total > 1 && !check ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-hidden>
              {run.map((q, i) => (
                <span
                  key={q.id ?? i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === pos ? "w-5 bg-chart-1" : stageOf(q, s.entries[i]) === "settled" ? "w-1.5 bg-chart-1/50" : "w-1.5 bg-muted",
                  )}
                />
              ))}
            </div>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 items-center gap-1">
            {total > 1 && !check && (
              <span className="mr-1 text-xs tabular-nums text-muted-foreground">
                <span className="sr-only">Question </span>
                {pos + 1}
                <span aria-hidden> / </span>
                <span className="sr-only"> of </span>
                {total}
              </span>
            )}
            {onEvent && (
              <button
                type="button"
                className="quiz-tool"
                data-quiz-own-keys=""
                aria-pressed={readAloud}
                aria-label="Read the questions aloud"
                title={readAloud ? "Reading aloud: on" : "Reading aloud: off"}
                onClick={() => setReadAloud(!readAloud)}
              >
                {readAloud ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
              </button>
            )}
            {onAsk && (
              <button type="button" className="quiz-tool quiz-tool-ask" data-quiz-own-keys="" onClick={onAsk} title="Ask the tutor about this question">
                <Mic className="size-4" aria-hidden />
                <span className="quiz-tool-label">Ask about this</span>
              </button>
            )}
          </div>
        </div>
      ) : null}

      <QuestionView
        key={`${s.key}:${pos}:${current.id}`}
        q={current}
        stage={stage}
        first={entry?.first}
        second={entry?.second}
        onSubmit={submit}
        compact={compact}
        numbered={numbered}
        hint={entry?.hint}
        autoFocus
        status={
          check ? undefined : (
            <>
              {answered} answered · {right} right
              {hinted > 0 && ` · ${hinted} with a hint`}
            </>
          )
        }
        actions={
          s.done ? undefined : (
            <>
              {page && onShowSource && (
                <Button size="sm" variant="ghost" onClick={() => onShowSource(current)} data-quiz-own-keys="">
                  <FileText className="size-3.5" />
                  See it on page {page}
                </Button>
              )}
              <Button size="sm" ref={nextRef} onClick={next}>
                {last ? (finishLabel ?? (check ? "Continue" : "Finish")) : "Next question"}
                {last ? <ArrowRight className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              </Button>
            </>
          )
        }
      />
    </div>
  );
}
