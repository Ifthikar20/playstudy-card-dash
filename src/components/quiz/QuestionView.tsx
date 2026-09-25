import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Lightbulb, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuestionKind, QuizItem, QuizResponse } from "@/lib/quiz/types";
import { answerText, emptyResponse, grade, isComplete, kindOf } from "@/lib/quiz/grade";
import { partialLine } from "@/lib/quiz/speech";
import { optionLabel, useQuizKeys } from "@/components/study/quizKeys";
import { ChoiceQuestion } from "./ChoiceQuestion";
import { OrderQuestion } from "./OrderQuestion";
import { CategorizeQuestion } from "./CategorizeQuestion";
import { FillQuestion } from "./FillQuestion";
import { MatchQuestion } from "./MatchQuestion";

/*
  One question of any kind, with its result: the section quiz, a PDF part's quiz and
  the board's quick check run it through QuizRunner, and the wrong-questions list shows
  it on its own.

  Where it is in its life is `stage`:
  - answer: being answered. Single choice and true/false answer with the pick; the
    others are built up (options ticked, items moved, placed or joined, a word typed)
    and sent with Check.
  - retry: the first answer was wrong and there's one more go. Single choice crosses
    the first pick out; the others keep what was there, with how close it came ("2 of
    5 are in the right place") and the hint.
  - settled: nothing more to do. What was right and wrong is marked, with the answer
    and why.
  `first` and `second` are the answers given; only the first ever scores (the caller
  does that). It never grades anything itself beyond showing the marks.

  The question is a fieldset whose legend is the question, focused as it appears
  (autoFocus) so a screen reader starts there; the hint and the result are read out
  from one live region that is always there. The row with Check (and whatever the
  caller puts beside it: Next) sticks to the bottom of whatever scrolls around it.
  Board anchors: the question is data-board-part="q", each option or item "opt-{i}"
  (its index in `options`), each with its words in data-board-label.
*/

export type QuizStage = "answer" | "retry" | "settled";

/** What each kind's body is given (ChoiceQuestion, OrderQuestion, …). */
export interface KindProps {
  q: QuizItem;
  /** The answer as it stands: being built, or once settled the one to mark. */
  value: QuizResponse;
  /** The answer being built changed (a tick, a move, a placement, a word). */
  onChange: (r: QuizResponse) => void;
  /** Answer now: a pick in single choice and true/false, Enter in the blank. */
  onSubmit: (r: QuizResponse) => void;
  stage: QuizStage;
  /** The first answer: single choice crosses its pick out on the retry. */
  first?: QuizResponse;
  /** Nothing can change any more (settled, or the whole question switched off). */
  locked: boolean;
  /** Show what's right and wrong: the question is settled. */
  marked: boolean;
  compact: boolean;
  /** Name the options by the keys that pick them (the caller's wish; each kind adds its own keys being live). */
  numbered: boolean;
  /** Say something to a screen reader: an item picked up, moved, placed. */
  announce: (text: string) => void;
}

export interface QuestionViewProps {
  q: QuizItem;
  stage: QuizStage;
  /** The first answer given (the one that counts). */
  first?: QuizResponse;
  /** The answer after the hint. */
  second?: QuizResponse;
  /** An answer was given: the first while answering, the second on the retry. */
  onSubmit: (r: QuizResponse) => void;
  /** Tighter type and spacing, big tap targets, for the Teach mode board. */
  compact?: boolean;
  /** Name the options 1-4 (the keys) rather than A-D. */
  numbered?: boolean;
  /** Shown only: nothing can be answered. */
  disabled?: boolean;
  /** The hint after a wrong first answer: its words, null while it's being found, undefined for none. */
  hint?: string | null;
  /** Beside the Check / Next buttons, on the left: how the quiz is going. */
  status?: ReactNode;
  /** Once settled, in place of Check: what comes next (the quiz's Next). */
  actions?: ReactNode;
  /** Move focus to the question as it appears (the quiz does; a list of them doesn't). */
  autoFocus?: boolean;
}

/** The kind of question, said above it (single choice needs no introduction). */
const KIND_LABEL: Record<QuestionKind, string> = {
  single: "",
  multi: "Select all that apply",
  true_false: "True or false?",
  order: "Put these in order",
  categorize: "Sort into groups",
  fill: "Fill in the blank",
  match: "Match the pairs",
};

/** Kinds answered with a pick; the rest are built up and sent with Check. */
const picked = (k: QuestionKind) => k === "single" || k === "true_false";

/** What the answer starts as: fresh, or on the retry what was there (single choice picks again). */
function startFor(q: QuizItem, stage: QuizStage, first: QuizResponse | undefined): QuizResponse {
  if (stage === "retry" && first && !picked(kindOf(q))) return first;
  return emptyResponse(q);
}

/** The question with its blank drawn as a gap, filled once the question is settled. */
function WithBlank({ text, filled, right }: { text: string; filled: string | null; right: boolean }) {
  const parts = text.split(/_{3,}/);
  if (parts.length < 2) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className={cn("quiz-blank", filled && (right ? "quiz-blank-right" : "quiz-blank-shown"))}>
              {filled ?? <span className="sr-only">blank</span>}
            </span>
          )}
        </span>
      ))}
    </>
  );
}

/** The right answer, laid out for its kind (for the result box). */
function AnswerShown({ q, numbered }: { q: QuizItem; numbered: boolean }) {
  const kind = kindOf(q);
  const a = q.answer;
  if (kind === "order" && a?.kind === "order") {
    return (
      <>
        <p className="font-semibold">The right order</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          {a.correct.map((i) => (
            <li key={i}>{q.options[i]}</li>
          ))}
        </ol>
      </>
    );
  }
  if (kind === "categorize" && a?.kind === "categorize") {
    return (
      <>
        <p className="font-semibold">Where they go</p>
        <ul className="mt-1 space-y-0.5">
          {a.categories.map((c, ci) => (
            <li key={ci}>
              <span className="font-medium">{c}:</span> {q.options.filter((_, i) => a.correct[i] === ci).join(", ")}
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (kind === "match" && a?.kind === "match") {
    return (
      <>
        <p className="font-semibold">The pairs</p>
        <ul className="mt-1 space-y-0.5">
          {q.options.map((left, i) => (
            <li key={i}>
              {left} → {a.rights[a.correct[i]]}
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (kind === "single") {
    return (
      <p className="font-semibold">
        Answer: {optionLabel(q.correctAnswer, numbered)} — {q.options[q.correctAnswer]}
      </p>
    );
  }
  return <p className="font-semibold">Answer: {answerText(q)}</p>;
}

export function QuestionView({
  q,
  stage,
  first,
  second,
  onSubmit,
  compact = false,
  numbered = false,
  disabled = false,
  hint,
  status,
  actions,
  autoFocus = false,
}: QuestionViewProps) {
  const kind = kindOf(q);
  const settled = stage === "settled";
  const locked = settled || disabled;
  const legendId = useId();

  // The answer being built. It starts again for a new question, and for the retry
  // (from the first answer, see startFor).
  const [draft, setDraft] = useState<QuizResponse>(() => startFor(q, stage, first));
  const [seen, setSeen] = useState({ id: q.id, stage });
  if (seen.id !== q.id || seen.stage !== stage) {
    setSeen({ id: q.id, stage });
    if (seen.id !== q.id || stage === "retry") setDraft(startFor(q, stage, first));
  }

  const final = second ?? first;
  const value = settled && final ? final : draft;
  const g1 = first ? grade(q, first) : null;
  const gFinal = final ? grade(q, final) : null;
  const right = settled && !!gFinal?.correct;
  const hinted = right && !!second && !g1?.correct;

  const needsCheck = !picked(kind);
  const canCheck = needsCheck && !locked && isComplete(q, draft);
  const check = () => {
    if (canCheck) onSubmit(draft);
  };
  const submit = (r: QuizResponse) => {
    if (!locked && isComplete(q, r)) onSubmit(r);
  };

  const keys = useQuizKeys({
    enter: () => {
      if (!canCheck) return false;
      check();
      return true;
    },
  });

  // What a screen reader hears about moves and placements, apart from the result.
  // Alternating a trailing space makes the same words ("Moved to position 2") heard twice.
  const [said, setSaid] = useState("");
  const announce = (text: string) => setSaid((s) => (s.replace(/ $/, "") === text ? (s.endsWith(" ") ? text : `${text} `) : text));

  // The question takes focus as it appears, so it's read out first (the blank's box
  // instead, ready for typing). Only from inside the quiz or from nowhere: never away
  // from something else on the page.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const legendRef = useRef<HTMLLegendElement | null>(null);
  useEffect(() => {
    if (!autoFocus) return;
    const root = rootRef.current;
    if (!root) return;
    const active = document.activeElement;
    const home = root.closest(".guide-board-panel, [data-study-dialog], [data-quiz-runner]") ?? root;
    if (active && active !== document.body && !home.contains(active)) return;
    const target = root.querySelector<HTMLElement>("[data-quiz-autofocus]:not(:disabled)") ?? legendRef.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: "nearest" });
    // Once per question: the retry keeps focus where the student is.
  }, [q.id, autoFocus]);

  const label = KIND_LABEL[kind];
  const body: KindProps = {
    q,
    value,
    onChange: setDraft,
    onSubmit: submit,
    stage,
    first,
    locked,
    marked: settled,
    compact,
    numbered: numbered || compact,
    announce,
  };
  const fillShown = kind === "fill" && settled ? (right ? (final?.kind === "fill" ? final.text.trim() : null) : answerText(q)) : null;
  const firstWrong = !!g1 && !g1.correct;
  const partial = stage === "retry" && g1 ? partialLine(q, g1) : "";
  const showCheck = needsCheck && !settled && !disabled;
  const hasRow = !!status || showCheck || (settled && !!actions);

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
        keys.ref(el);
      }}
      tabIndex={-1}
      className={cn("quiz-q outline-none", compact && "quiz-q-compact")}
      data-quiz-kind={kind}
      data-quiz-stage={stage}
    >
      <fieldset className="quiz-fieldset">
        <legend
          ref={legendRef}
          id={legendId}
          tabIndex={-1}
          className={cn("quiz-legend", compact ? "text-[15px]" : "text-base md:text-[17px]")}
          data-board-part="q"
          data-board-label={q.question}
        >
          {label && <span className="quiz-kind-label">{label}</span>}
          <span className="block font-medium leading-relaxed">
            {kind === "fill" ? <WithBlank text={q.question} filled={fillShown} right={right} /> : q.question}
          </span>
        </legend>
        <div className={compact ? "mt-3" : "mt-4"}>
          {kind === "single" || kind === "true_false" || kind === "multi" ? (
            <ChoiceQuestion {...body} />
          ) : kind === "order" ? (
            <OrderQuestion {...body} />
          ) : kind === "categorize" ? (
            <CategorizeQuestion {...body} />
          ) : kind === "match" ? (
            <MatchQuestion {...body} />
          ) : (
            <FillQuestion {...body} labelledBy={legendId} />
          )}
        </div>
      </fieldset>

      <p className="sr-only" aria-live="polite">
        {said}
      </p>

      {/* One live region, always there, so the hint and the result are read out as they
          appear: a region added with its words already in it (a question's own hint, the
          result) is often not announced at all. */}
      <div aria-live="polite">
        {firstWrong && (stage === "retry" || hint) && (
          <div className={cn("quiz-note quiz-note-hint", compact ? "mt-3 p-2.5" : "mt-4 p-3")}>
            {stage === "retry" && (
              <p className="flex items-start gap-2 font-semibold">
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <span>
                  Not quite.{partial && ` ${partial}`}
                  {hint !== undefined && " Here's a hint:"}
                </span>
              </p>
            )}
            {hint === null ? (
              <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin text-chart-1" aria-hidden />
                Finding a hint…
              </p>
            ) : hint ? (
              <p className={cn("flex items-start gap-2", stage === "retry" ? "mt-1" : "text-muted-foreground")}>
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-chart-1" aria-hidden />
                <span>{hint}</span>
              </p>
            ) : null}
          </div>
        )}

        {settled && final && (
          <div className={cn("quiz-note", right ? "quiz-note-right" : "quiz-note-wrong", compact ? "mt-3 p-2.5" : "mt-4 p-3")}>
            <div className="flex items-start gap-2">
              {right ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                {right ? (
                  <>
                    <p className="font-semibold">{hinted ? "Got it with a hint" : "Correct"}</p>
                    {hinted && <p className="text-xs text-muted-foreground">Only a first-try answer scores, so no XP for this one.</p>}
                  </>
                ) : (
                  <>
                    <span className="sr-only">Not right. </span>
                    <AnswerShown q={q} numbered={numbered || compact || keys.live} />
                  </>
                )}
                {q.explanation && <p className="mt-1 text-muted-foreground">{q.explanation}</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {hasRow && (
        <div className="quiz-actions">
          <div className="min-w-0 flex-1 text-xs tabular-nums text-muted-foreground">{status}</div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {showCheck && (
              <Button size="sm" onClick={check} disabled={!canCheck} data-quiz-check="">
                {stage === "retry" ? "Check again" : "Check"}
              </Button>
            )}
            {settled && actions}
          </div>
        </div>
      )}
    </div>
  );
}
