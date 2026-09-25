import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { kindOf } from "@/lib/quiz/grade";
import { optionLabel, useQuizKeys } from "@/components/study/quizKeys";
import type { KindProps } from "./QuestionView";

/*
  The kinds answered by picking from a list: single choice (one of 3-5), true or false,
  and select all that apply.

  - single: a pick answers. On the retry the first pick is crossed out (still
    focusable, so focus isn't dropped from under the student) and one more pick is
    made. Keys: 1-9.
  - true_false: two big buttons; a pick answers and there's no retry (a second pick
    would be the only one left). Keys: T or 1 for True, F or 2 for False.
  - multi: rows that tick on and off (role=checkbox, so Space works on the focused
    one as it does on any checkbox), sent with Check. The ticks stay for the retry.
    Keys: 1-9 tick.

  Once settled every option is marked with an icon and words as well as colour: the
  right ones, the picks that weren't, and (multi) the right ones left out.
*/
export function ChoiceQuestion({ q, value, onChange, onSubmit, stage, first, locked, marked, compact, numbered }: KindProps) {
  const kind = kindOf(q);
  const multi = kind === "multi";
  const tf = kind === "true_false";

  const correctSet = new Set<number>(
    q.answer?.kind === "multi" ? q.answer.correct : q.answer?.kind === "true_false" ? [q.answer.correct ? 0 : 1] : [q.correctAnswer],
  );
  /** What's picked now: the ticks, or the one pick (true/false as 0 True, 1 False). */
  const pickedNow = (r: typeof value | undefined): number[] => {
    if (!r) return [];
    if (r.kind === "multi") return r.choices;
    if (r.kind === "true_false") return [r.value ? 0 : 1];
    if (r.kind === "single") return r.choice >= 0 ? [r.choice] : [];
    return [];
  };
  const chosen = new Set(pickedNow(value));
  // A wrong first pick, crossed out on single choice's retry (and marked wrong after it).
  const crossedPick =
    kind === "single" && stage !== "answer" && first?.kind === "single" && first.choice !== q.correctAnswer ? first.choice : -1;

  const pick = (i: number): boolean => {
    if (locked || i < 0 || i >= q.options.length) return false;
    if (multi) {
      const next = chosen.has(i) ? [...chosen].filter((c) => c !== i) : [...chosen, i];
      onChange({ kind: "multi", choices: next.sort((a, b) => a - b) });
      return true;
    }
    if (i === crossedPick) return false;
    onSubmit(tf ? { kind: "true_false", value: i === 0 } : { kind: "single", choice: i });
    return true;
  };

  const keys = useQuizKeys({
    digit: (n) => pick(n - 1),
    letter: (ch) => (tf && (ch === "t" || ch === "f") ? pick(ch === "t" ? 0 : 1) : false),
  });
  const named = numbered || keys.live;
  const labelOf = (i: number) => (tf ? (i === 0 ? "T" : "F") : optionLabel(i, named));

  return (
    <div ref={keys.ref} tabIndex={-1} className={cn("outline-none", tf ? "grid grid-cols-2 gap-2" : cn("grid", compact ? "gap-2" : "gap-2.5"))}>
      {q.options.map((opt, i) => {
        const isRight = correctSet.has(i);
        const isPicked = chosen.has(i) || (marked && i === crossedPick);
        const crossed = i === crossedPick;
        // Marks once settled: a right pick, a wrong pick, a right one left out (multi).
        const good = marked && isRight && (isPicked || !multi);
        const bad = marked && isPicked && !isRight;
        const missed = marked && multi && isRight && !isPicked;
        const inert = locked || crossed;
        return (
          <button
            key={i}
            type="button"
            role={multi ? "checkbox" : undefined}
            aria-checked={multi ? chosen.has(i) : undefined}
            aria-pressed={multi ? undefined : isPicked && !crossed}
            // The crossed-out pick stays focusable (aria-disabled, not disabled) so focus
            // isn't dropped from under the student mid-question; settled, all are disabled.
            disabled={locked}
            aria-disabled={inert || undefined}
            onClick={() => pick(i)}
            data-board-part={`opt-${i}`}
            data-board-label={opt}
            className={cn(
              "quiz-option",
              tf && "quiz-option-tf",
              compact ? "min-h-[44px] items-center px-3 py-2" : "items-start px-4 py-3",
              !inert && "quiz-option-live",
              multi && chosen.has(i) && !marked && "quiz-option-on",
              crossed && !marked && "quiz-option-crossed",
              good && "quiz-option-right",
              (bad || (crossed && marked)) && "quiz-option-wrong",
              missed && "quiz-option-missed",
              marked && !good && !bad && !missed && !crossed && "opacity-60",
            )}
          >
            <span
              className={cn(
                "quiz-key",
                multi && "quiz-key-box",
                !compact && !tf && "mt-px",
                multi && chosen.has(i) && !marked && "quiz-key-on",
                good && "quiz-key-right",
                (bad || crossed) && "quiz-key-wrong",
              )}
              aria-hidden
            >
              {marked && good ? <Check className="size-3.5" /> : marked && (bad || crossed) ? <X className="size-3.5" /> : labelOf(i)}
            </span>
            <span className={cn("min-w-0 flex-1", !compact && !tf && "pt-0.5", crossed && "line-through decoration-destructive/60")}>{opt}</span>
            {missed && <span className="quiz-tag">Also right</span>}
            {crossed && !marked && <span className="sr-only"> (not this one)</span>}
            {good && <span className="sr-only"> (right answer{isPicked && multi ? ", picked" : ""})</span>}
            {(bad || (crossed && marked)) && <span className="sr-only"> (your pick, not right)</span>}
            {missed && <span className="sr-only"> (right, not picked)</span>}
          </button>
        );
      })}
    </div>
  );
}
