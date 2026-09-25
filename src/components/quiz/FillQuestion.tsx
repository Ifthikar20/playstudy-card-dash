import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FILL_MAX, grade } from "@/lib/quiz/grade";
import type { KindProps } from "./QuestionView";

/*
  Fill in the blank: one word or a short phrase, typed. Enter in the box (or Check)
  sends it; the quiz's own keys leave a box being typed in alone, so letters and
  numbers type as they should.

  Small slips don't count against it (see normalizeFill: case, a leading "the",
  punctuation, a hyphen, one letter out on a longer word). The retry keeps what was
  typed, selected, so a fresh word just replaces it. The box scrolls itself into view
  as it's focused: on a phone the keyboard comes up over the board's sheet.
*/
export function FillQuestion({ q, value, onChange, onSubmit, stage, locked, marked, compact, labelledBy }: KindProps & { labelledBy?: string }) {
  const text = value.kind === "fill" ? value.text : "";
  const input = useRef<HTMLInputElement | null>(null);
  const right = marked && grade(q, value).correct;

  // On the retry: what was typed, selected, ready to be typed over.
  useEffect(() => {
    if (stage !== "retry") return;
    const el = input.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.select();
  }, [stage]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked) onSubmit({ kind: "fill", text });
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={input}
        type="text"
        value={text}
        onChange={(e) => onChange({ kind: "fill", text: e.target.value })}
        disabled={locked}
        maxLength={FILL_MAX}
        aria-label="Your answer for the blank"
        aria-describedby={labelledBy}
        aria-invalid={marked && !right ? true : undefined}
        inputMode="text"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-quiz-autofocus=""
        onFocus={(e) => e.currentTarget.scrollIntoView?.({ block: "nearest" })}
        placeholder={locked ? undefined : "Type your answer"}
        className={cn(
          "quiz-fill min-w-0 flex-1",
          compact ? "h-11 text-[15px]" : "h-11 text-base",
          marked && (right ? "quiz-option-right" : "quiz-option-wrong"),
        )}
      />
      {marked &&
        (right ? (
          <Check className="size-5 shrink-0 text-success" aria-hidden />
        ) : (
          <X className="size-5 shrink-0 text-destructive" aria-hidden />
        ))}
    </form>
  );
}
