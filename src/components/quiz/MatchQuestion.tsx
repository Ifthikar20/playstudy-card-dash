import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuizKeys } from "@/components/study/quizKeys";
import type { KindProps } from "./QuestionView";

/*
  Match the pairs: 3-6 items on the left, their partners shuffled on the right,
  numbered. Check once every left item is joined to one.

  - Tap a left item then a right one (or the right one first) to join them. Each right
    item goes with one left item at a time: joining it again moves it.
  - Keys: Up/Down go from left item to left item, 1..n joins the one focused (or the
    next one waiting) with right item n, Backspace undoes its join.
  - A join shows as the right item's number on the left item, and the left item's
    letter on the right one, so it never rests on colour or a line alone.
  Side by side where there's room. On a phone's sheet the right items come first as a
  numbered list, and each left item has a row of numbers to tap.

  The retry keeps the joins, with how many pairs are right; once settled each left
  item says whether its pair is right, and which it should be if not.
*/

const letter = (i: number) => String.fromCharCode(65 + i);

export function MatchQuestion({ q, value, onChange, locked, marked, compact, announce }: KindProps) {
  const n = q.options.length;
  const rights = q.answer?.kind === "match" ? q.answer.rights : [];
  const want = q.answer?.kind === "match" ? q.answer.correct : [];
  const pairs = value.kind === "match" && value.pairs.length === n ? value.pairs : Array.from({ length: n }, () => -1);

  /** The left item the number keys join: the one focused, tapped, or next waiting. */
  const [left, setLeft] = useState<number>(() => Math.max(0, pairs.findIndex((p) => p < 0)));
  /** Whether that left item is waiting for a tap on a right one: once the student has
   *  picked one (tapped or focused it), and then the next one waiting after each join.
   *  Not merely because the first is where the keys start. */
  const [armed, setArmed] = useState(false);
  /** A right item tapped first, waiting for a left one. */
  const [right, setRight] = useState<number | null>(null);
  const rows = useRef(new Map<number, HTMLButtonElement>());
  const refocus = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (refocus.current == null) return;
    rows.current.get(refocus.current)?.focus();
    refocus.current = null;
  });

  const joinedTo = (r: number) => pairs.indexOf(r);

  const join = (l: number, r: number) => {
    if (locked || l < 0 || l >= n || r < 0 || r >= rights.length) return;
    // A right item goes with one left item: joining it here takes it from any other.
    const next = pairs.map((p) => (p === r ? -1 : p));
    next[l] = r;
    onChange({ kind: "match", pairs: next });
    setRight(null);
    setArmed(next.some((p) => p < 0));
    // On to the next left item still waiting, if there is one.
    let after = l;
    for (let k = 1; k < n; k++) {
      const j = (l + k) % n;
      if (next[j] < 0) {
        after = j;
        break;
      }
    }
    setLeft(after);
    const focusWasOnRow = document.activeElement instanceof HTMLElement && !!document.activeElement.closest(".quiz-match-left");
    if (focusWasOnRow) refocus.current = after;
    announce(`${q.options[l]}: joined to ${rights[r]}.${next.every((p) => p >= 0) ? " All joined." : ""}`);
  };

  const unjoin = (l: number) => {
    if (locked || pairs[l] < 0) return;
    const next = pairs.slice();
    next[l] = -1;
    onChange({ kind: "match", pairs: next });
    setLeft(l);
    announce(`${q.options[l]}: not joined.`);
  };

  const keys = useQuizKeys({
    digit: (d) => {
      if (locked || d > rights.length) return false;
      join(left, d - 1);
      return true;
    },
  });

  const onRowKey = (e: KeyboardEvent<HTMLButtonElement>, l: number) => {
    if (locked) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const to = l + (e.key === "ArrowUp" ? -1 : 1);
      if (to >= 0 && to < n) rows.current.get(to)?.focus();
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      unjoin(l);
    }
  };

  const tapLeft = (l: number) => {
    if (locked) return;
    if (right != null) return join(l, right);
    setLeft(l);
    setArmed(true);
  };
  const tapRight = (r: number) => {
    if (locked) return;
    // A left item waiting: join them. Otherwise hold this one (tapped again, let it go).
    if (armed) join(left, r);
    else setRight(right === r ? null : r);
  };

  return (
    <div ref={keys.ref} tabIndex={-1} className={cn("quiz-match outline-none", compact && "quiz-match-compact")}>
      <ul className="quiz-match-lefts" aria-label="Items to match">
        {q.options.map((text, l) => {
          const r = pairs[l];
          const ok = marked && r === want[l];
          const bad = marked && !ok;
          const current = !locked && left === l && armed;
          return (
            <li key={l} className="quiz-match-item">
              <button
                type="button"
                ref={(el) => {
                  if (el) rows.current.set(l, el);
                  else rows.current.delete(l);
                }}
                disabled={locked}
                tabIndex={locked ? undefined : left === l ? 0 : -1}
                aria-pressed={locked ? undefined : current}
                aria-label={
                  marked
                    ? `${text}: ${ok ? `joined to ${rights[r]}, right` : `should go with ${rights[want[l]]}`}`
                    : r >= 0
                      ? `${text}: joined to ${rights[r]}`
                      : `${text}: not joined, press 1 to ${rights.length}`
                }
                data-board-part={`opt-${l}`}
                data-board-label={text}
                onClick={() => tapLeft(l)}
                onFocus={() => {
                  if (locked) return;
                  setLeft(l);
                  setArmed(true);
                }}
                onKeyDown={(e) => onRowKey(e, l)}
                className={cn("quiz-match-left", current && "quiz-chip-on", ok && "quiz-option-right", bad && "quiz-option-wrong")}
              >
                <span className="quiz-key" aria-hidden>
                  {marked ? ok ? <Check className="size-3.5" /> : <X className="size-3.5" /> : letter(l)}
                </span>
                <span className="min-w-0 flex-1">{text}</span>
                <span className={cn("quiz-match-badge", r >= 0 && "quiz-match-badge-on")} aria-hidden>
                  {r >= 0 ? `→ ${r + 1}` : "→ ?"}
                </span>
              </button>
              {marked && bad && (
                <p className="quiz-match-fix" aria-hidden>
                  Goes with {want[l] + 1}. {rights[want[l]]}
                </p>
              )}
              {!locked && (
                // The phone sheet's way to join: this item's row of numbers.
                <div className="quiz-match-nums" role="group" aria-label={`Join ${text} with`}>
                  {rights.map((rt, ri) => (
                    <button
                      key={ri}
                      type="button"
                      tabIndex={-1}
                      aria-label={`${rt}`}
                      aria-pressed={r === ri}
                      className={cn("quiz-match-num", r === ri && "quiz-key-on")}
                      onClick={() => join(l, ri)}
                    >
                      {ri + 1}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ol className="quiz-match-rights" aria-label="Matches, numbered">
        {rights.map((text, r) => {
          const by = joinedTo(r);
          return (
            <li key={r}>
              <button
                type="button"
                disabled={locked}
                tabIndex={-1}
                aria-pressed={locked ? undefined : right === r}
                aria-label={by >= 0 ? `${r + 1}: ${text}, joined to ${q.options[by]}` : `${r + 1}: ${text}`}
                onClick={() => tapRight(r)}
                className={cn("quiz-match-right", right === r && "quiz-chip-on")}
              >
                <span className="quiz-key" aria-hidden>
                  {r + 1}
                </span>
                <span className="min-w-0 flex-1">{text}</span>
                {by >= 0 && (
                  <span className="quiz-match-badge quiz-match-badge-on" aria-hidden>
                    {letter(by)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
