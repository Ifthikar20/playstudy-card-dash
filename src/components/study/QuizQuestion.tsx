import type { Question } from "@/store/appStore";
import { QuestionView, type QuizStage } from "@/components/quiz/QuestionView";

/** A second go after a wrong first pick, with a hint (the section quiz). */
export interface QuizHint {
  /** The pick made after the hint; undefined while the student is still choosing. */
  retry: number | undefined;
  onRetry: (option: number) => void;
  /** The hint's words, or null while one is being found. */
  text: string | null;
}

/* --------------------------------------------------------------------------
   A single-choice question in the shape the section quiz and the wrong-questions
   retry have always used: the pick as an option index, and the hint's second go
   passed in. It is now only a way into QuestionView (the one question of any kind,
   drawn by ChoiceQuestion for single choice), kept until those callers move on to
   QuestionView and QuizRunner themselves.

   With `hint` (the section quiz), a wrong first pick doesn't end the question:
   that option is crossed out, a hint appears under the options, and the student
   picks again. Right then is "Got it with a hint"; wrong again shows the answer.
   Only the first pick counts (the caller scores it); the second is practice.
   Without `hint` (the wrong-questions retry), a wrong pick shows the answer at once.
-------------------------------------------------------------------------- */
export function QuizQuestion({
  q,
  chosen,
  onChoose,
  compact = false,
  hint,
  numbered = false,
}: {
  q: Question;
  /** The first pick: the answer that counts. */
  chosen: number | undefined;
  onChoose: (ai: number) => void;
  /** Tighter type and spacing, large tap targets, for the Teach mode board. */
  compact?: boolean;
  /** Multiple choice with a hint: see above. */
  hint?: QuizHint;
  /** Name the options 1-4 (the keys that pick them) instead of A-D. */
  numbered?: boolean;
}) {
  const firstWrong = chosen !== undefined && chosen !== q.correctAnswer;
  // Waiting for the second pick: the question is still open, one option down.
  const retrying = !!hint && firstWrong && hint.retry === undefined;
  const stage: QuizStage = chosen === undefined ? "answer" : retrying ? "retry" : "settled";

  return (
    <QuestionView
      // Always read as single choice, whatever else the question carries: the pick is an index.
      q={{ ...q, kind: "single", answer: null }}
      stage={stage}
      first={chosen === undefined ? undefined : { kind: "single", choice: chosen }}
      second={hint?.retry === undefined ? undefined : { kind: "single", choice: hint.retry }}
      onSubmit={(r) => {
        if (r.kind !== "single") return;
        if (stage === "retry") hint?.onRetry(r.choice);
        else if (stage === "answer") onChoose(r.choice);
      }}
      compact={compact}
      numbered={numbered}
      // The hint from the first wrong pick on (kept once found); "being found" only while it can help.
      hint={hint && firstWrong ? (hint.text ?? (retrying ? null : undefined)) : undefined}
    />
  );
}
