import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuizKeys } from "@/components/study/quizKeys";
import type { KindProps } from "./QuestionView";
import { useDropDrag } from "./useDragList";

/*
  Sort into groups: 4-8 items, 2-3 groups, every item placed before Check.

  One item is always the one in hand (the first not yet placed, to start with):
  - tap an item to take it, then tap a group to put it there (or the "To sort" pool to
    take it back out);
  - with a mouse, drag an item onto a group;
  - from the keyboard, 1..k puts the item in hand into group k and hands over the next
    one not placed yet; Backspace on a placed item takes it back out.
  Groups sit side by side where there's room and stack on a phone's sheet.

  The retry keeps every item where it was, with how many are in the right group; once
  settled each placed item says whether it's right, and where it belongs if not.
*/

export function CategorizeQuestion({ q, value, onChange, locked, marked, compact, announce }: KindProps) {
  const n = q.options.length;
  const cats = q.answer?.kind === "categorize" ? q.answer.categories : [];
  const want = q.answer?.kind === "categorize" ? q.answer.correct : [];
  const placed = value.kind === "categorize" && value.placed.length === n ? value.placed : Array.from({ length: n }, () => -1);

  /** The item in hand: what a group tapped or a number key places. */
  const [sel, setSel] = useState<number | null>(() => {
    const i = placed.findIndex((c) => c < 0);
    return i < 0 ? null : i;
  });
  const chips = useRef(new Map<number, HTMLButtonElement>());
  // Hand focus to the next item after one is placed from the keyboard.
  const refocus = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (refocus.current == null) return;
    chips.current.get(refocus.current)?.focus();
    refocus.current = null;
  });

  const keyList = cats.map((c, ci) => `${ci + 1} for ${c}`).join(", ");
  const text = (i: number) => q.options[i];

  const place = (i: number, c: number) => {
    if (locked || c < 0 || c >= cats.length) return;
    const next = placed.slice();
    next[i] = c;
    onChange({ kind: "categorize", placed: next });
    // The next one to place: the first free one after this.
    let after: number | null = null;
    for (let k = 1; k < n; k++) {
      const j = (i + k) % n;
      if (next[j] < 0) {
        after = j;
        break;
      }
    }
    const focusWasOnChip = document.activeElement instanceof HTMLElement && !!document.activeElement.closest(".quiz-chip");
    setSel(after);
    if (focusWasOnChip) refocus.current = after ?? i;
    announce(`${text(i)}: in ${cats[c]}.${after == null ? " All sorted." : ""}`);
  };

  const unplace = (i: number) => {
    if (locked || placed[i] < 0) return;
    const next = placed.slice();
    next[i] = -1;
    onChange({ kind: "categorize", placed: next });
    setSel(i);
    refocus.current = i;
    announce(`${text(i)}: taken out, not placed.`);
  };

  const keys = useQuizKeys({
    digit: (d) => {
      if (locked || sel == null || d > cats.length) return false;
      place(sel, d - 1);
      return true;
    },
  });

  const drag = useDropDrag({
    onDrop: (i, target) => (target === "pool" ? unplace(i) : place(i, Number(target))),
    disabled: locked,
  });

  const onChipKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (locked || (e.key !== "Backspace" && e.key !== "Delete")) return;
    e.preventDefault();
    unplace(i);
  };

  const chip = (i: number) => {
    const where = placed[i];
    const right = marked && where === want[i];
    const wrong = marked && where >= 0 && where !== want[i];
    const label =
      where < 0
        ? `${text(i)}, not placed; press ${keyList}`
        : `${text(i)}, in ${cats[where]}${locked ? "" : `; press a number to move it, Backspace to take it out`}`;
    return (
      <button
        key={i}
        type="button"
        ref={(el) => {
          if (el) chips.current.set(i, el);
          else chips.current.delete(i);
        }}
        disabled={locked}
        aria-pressed={locked ? undefined : sel === i}
        aria-label={marked ? `${text(i)}${right ? ", right" : `, belongs in ${cats[want[i]]}`}` : label}
        data-board-part={`opt-${i}`}
        data-board-label={text(i)}
        onClick={(e) => {
          // Inside a group, a tap takes the item rather than putting another there.
          e.stopPropagation();
          if (drag.consumeDrag() || locked) return;
          setSel(i);
        }}
        onFocus={() => {
          if (!locked) setSel(i);
        }}
        onKeyDown={(e) => onChipKey(e, i)}
        style={drag.itemStyle(i)}
        className={cn(
          "quiz-chip",
          !locked && sel === i && "quiz-chip-on",
          drag.drag?.item === i && "quiz-chip-dragging",
          right && "quiz-option-right",
          wrong && "quiz-option-wrong",
        )}
        {...drag.handle(i)}
      >
        {marked && (right ? <Check className="size-3.5 shrink-0 text-success" aria-hidden /> : wrong ? <X className="size-3.5 shrink-0 text-destructive" aria-hidden /> : null)}
        <span className="min-w-0">{text(i)}</span>
        {wrong && (
          <span className="quiz-tag" aria-hidden>
            {cats[want[i]]}
          </span>
        )}
      </button>
    );
  };

  const pool = q.options.map((_, i) => i).filter((i) => placed[i] < 0);
  const over = drag.drag?.over ?? null;

  return (
    <div ref={keys.ref} tabIndex={-1} className={cn("quiz-sort outline-none", compact && "quiz-sort-compact")}>
      {!locked && (
        <div
          role="group"
          aria-label={`To sort: ${pool.length} item${pool.length === 1 ? "" : "s"}`}
          data-drop="pool"
          className={cn("quiz-sort-pool", over === "pool" && "quiz-drop-over")}
          onClick={() => sel != null && placed[sel] >= 0 && unplace(sel)}
        >
          <p className="quiz-sort-title">{pool.length ? "To sort" : "All sorted"}</p>
          {pool.length > 0 && <div className="quiz-chips">{pool.map(chip)}</div>}
        </div>
      )}
      <div className="quiz-sort-groups">
        {cats.map((c, ci) => {
          const items = q.options.map((_, i) => i).filter((i) => placed[i] === ci);
          return (
            <div
              key={ci}
              role="group"
              aria-label={`${c}: ${items.length} item${items.length === 1 ? "" : "s"}`}
              data-drop={String(ci)}
              className={cn("quiz-sort-group", over === String(ci) && "quiz-drop-over", !locked && sel != null && "quiz-sort-group-ready")}
              onClick={() => sel != null && place(sel, ci)}
            >
              <button
                type="button"
                className="quiz-sort-head"
                disabled={locked}
                aria-label={sel != null && !locked ? `Put ${text(sel)} in ${c}` : c}
                onClick={(e) => {
                  e.stopPropagation();
                  if (sel != null) place(sel, ci);
                }}
              >
                <span className="quiz-key" aria-hidden>
                  {ci + 1}
                </span>
                <span className="min-w-0 truncate">{c}</span>
              </button>
              <div className="quiz-chips">{items.map(chip)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
