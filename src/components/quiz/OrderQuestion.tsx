import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KindProps } from "./QuestionView";
import { useDragList } from "./useDragList";

/*
  Put these in order: the items come shuffled (never already in order) and the
  student moves them into place, then presses Check.

  Three ways to move one, all the same move:
  - tap its ↑ or ↓ (big enough for a finger);
  - drag it by its grip (the grip alone, so the board still scrolls under a finger);
  - from the keyboard: Up/Down go from row to row, Space picks the row up, Up/Down then
    carry it, Space (or Enter) puts it down and Esc puts it back where it was. Esc is
    kept from the board while an item is held, or it would close the quiz.
  Every move is said to a screen reader ("Moved to position 3 of 5").

  The retry keeps the order as it was, with how many are in place; once settled each
  row says whether it's in the right place, and where it belongs if not.
*/

const identity = (n: number) => Array.from({ length: n }, (_, i) => i);

/** `list` with the entry at `from` moved to `to`. */
function moved(list: number[], from: number, to: number): number[] {
  const next = list.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export function OrderQuestion({ q, value, onChange, locked, marked, compact, announce }: KindProps) {
  const n = q.options.length;
  const order = value.kind === "order" && value.order.length === n ? value.order : identity(n);
  const want = q.answer?.kind === "order" ? q.answer.correct : identity(n);

  /** The item picked up from the keyboard, and the order before, for Esc. */
  const [held, setHeld] = useState<{ item: number; before: number[] } | null>(null);
  /** The row the keyboard is on (by item), so Tab comes back to it. */
  const [at, setAt] = useState(order[0] ?? 0);
  const grips = useRef(new Map<number, HTMLButtonElement>());
  // A row moved down is taken out of the page and put back, which drops its focus:
  // put it back on the grip it was on.
  const refocus = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (refocus.current == null) return;
    grips.current.get(refocus.current)?.focus({ preventScroll: false });
    refocus.current = null;
  });

  const text = (item: number) => q.options[item];
  const move = (from: number, to: number, keepFocus: boolean) => {
    if (locked || to < 0 || to >= n || from === to) return;
    const item = order[from];
    onChange({ kind: "order", order: moved(order, from, to) });
    if (keepFocus) refocus.current = item;
    announce(`${text(item)}: moved to position ${to + 1} of ${n}.`);
  };

  const drag = useDragList({ onMove: (from, to) => move(from, to, false), disabled: locked });

  const pickUp = (item: number) => {
    if (locked) return;
    if (held?.item === item) {
      setHeld(null);
      announce(`${text(item)}: dropped at position ${order.indexOf(item) + 1} of ${n}.`);
      return;
    }
    setHeld({ item, before: order });
    announce(`${text(item)}: picked up, at position ${order.indexOf(item) + 1} of ${n}. Up and down to move it, Space to drop it, Escape to cancel.`);
  };

  const onGripKey = (e: KeyboardEvent<HTMLButtonElement>, pos: number, item: number) => {
    if (locked) return;
    const up = e.key === "ArrowUp";
    const down = e.key === "ArrowDown";
    if (up || down) {
      e.preventDefault();
      const to = pos + (up ? -1 : 1);
      if (held?.item === item) move(pos, to, true);
      else if (to >= 0 && to < n) grips.current.get(order[to])?.focus();
      return;
    }
    if (!held || held.item !== item) return;
    if (e.key === "Escape") {
      // Kept from the board (it closes the quiz on Esc) and from Teach mode.
      e.preventDefault();
      e.stopPropagation();
      onChange({ kind: "order", order: held.before });
      refocus.current = item;
      setHeld(null);
      announce(`${text(item)}: back at position ${held.before.indexOf(item) + 1} of ${n}.`);
    } else if (e.key === "Enter") {
      // Put it down (not Check): taken here so the quiz's Enter doesn't see it.
      e.preventDefault();
      pickUp(item);
    }
  };

  return (
    <ol ref={drag.listRef} className={cn("quiz-order", drag.drag && "quiz-order-dragging")} aria-label="Items to put in order">
      {order.map((item, pos) => {
        const isHeld = held?.item === item;
        const inPlace = want[pos] === item;
        const belongs = want.indexOf(item) + 1;
        return (
          <li
            key={item}
            data-drag-row=""
            data-board-part={`opt-${item}`}
            data-board-label={text(item)}
            style={drag.rowStyle(pos)}
            className={cn(
              "quiz-order-row",
              compact && "quiz-order-row-compact",
              isHeld && "quiz-order-held",
              drag.drag?.from === pos && "quiz-order-lifted",
              marked && (inPlace ? "quiz-option-right" : "quiz-option-wrong"),
            )}
          >
            {!locked && (
              <button
                type="button"
                ref={(el) => {
                  if (el) grips.current.set(item, el);
                  else grips.current.delete(item);
                }}
                className="quiz-grip"
                tabIndex={at === item ? 0 : -1}
                aria-pressed={isHeld}
                aria-label={`Move ${text(item)}, position ${pos + 1} of ${n}; ${isHeld ? "Space to drop" : "Space to pick up"}`}
                onFocus={() => setAt(item)}
                onBlur={(e) => {
                  // Tabbing away puts it down where it is (a blur with nowhere to go, the
                  // row being moved in the page, isn't leaving).
                  if (isHeld && e.relatedTarget) setHeld(null);
                }}
                onClick={() => {
                  if (drag.consumeDrag()) return;
                  pickUp(item);
                }}
                onKeyDown={(e) => onGripKey(e, pos, item)}
                {...drag.grip(pos)}
              >
                <GripVertical className="size-4" aria-hidden />
              </button>
            )}
            <span className="quiz-key" aria-hidden>
              {marked ? inPlace ? <Check className="size-3.5" /> : <X className="size-3.5" /> : pos + 1}
            </span>
            <span className="min-w-0 flex-1 py-1">
              {text(item)}
              {marked && (
                <span className="sr-only">{inPlace ? " (in the right place)" : ` (belongs at position ${belongs})`}</span>
              )}
            </span>
            {marked && !inPlace && (
              <span className="quiz-tag" aria-hidden>
                Goes {belongs}
              </span>
            )}
            {!locked && (
              <span className="flex shrink-0 items-center">
                <button
                  type="button"
                  className="quiz-move"
                  tabIndex={-1}
                  disabled={pos === 0}
                  aria-label={`Move ${text(item)} up`}
                  onClick={() => move(pos, pos - 1, false)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="quiz-move"
                  tabIndex={-1}
                  disabled={pos === n - 1}
                  aria-label={`Move ${text(item)} down`}
                  onClick={() => move(pos, pos + 1, false)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
