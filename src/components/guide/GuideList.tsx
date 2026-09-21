import { useEffect, useState } from "react";
import type { GuideList as GuideListData } from "@/services/guide";

/*
  A list on the Teach mode whiteboard: the principles, laws, stages or types a
  passage sets out, written down so the student sees all of them at once.

  It works like a teacher going down a list on the board: the list stays up for
  as many steps as it takes, the item being explained is highlighted, and the
  ones already covered get a tick. The board keeps this component mounted while
  only `focus` changes, so the ticks carry over from step to step.
*/

export function GuideList({ list }: { list: GuideListData }) {
  const { title, items, focus } = list;
  // The furthest item the lesson has reached; everything up to it counts as covered.
  const [reached, setReached] = useState(focus ?? -1);
  const upTo = Math.max(reached, focus ?? -1);
  useEffect(() => {
    if (upTo !== reached) setReached(upTo);
  }, [upTo, reached]);

  return (
    <div className="guide-list">
      {title && <div className="guide-chart-title">{title}</div>}
      <ol className="guide-list-items">
        {items.map((item, i) => {
          const state = i === focus ? "focus" : i <= upTo ? "done" : "todo";
          return (
            <li
              key={i}
              className="guide-list-item"
              data-state={state}
              data-board-focus={state === "focus" ? "" : undefined}
              style={{ animationDelay: `${i * 170}ms` }}
            >
              <span className="guide-list-num" aria-hidden>
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className="guide-list-text">
                <span className="guide-list-label">{item.label}</span>
                {item.detail && <span className="guide-list-detail">{item.detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
