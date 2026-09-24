import { useEffect, useState, type CSSProperties } from "react";
import type { GuideList as GuideListData } from "@/services/guide";

/*
  A list on the Teach mode whiteboard: the principles, laws, stages or types a
  passage sets out, written down so the student sees all of them at once.

  It works like a teacher going down a list on the board: the list stays up for
  as many steps as it takes, the item being explained is highlighted, and the
  ones already covered get a tick. The board keeps this component mounted while
  only `focus` changes, so the ticks carry over from step to step.

  So the board doesn't show the same thing every time, a list comes in one of five
  looks - numbered, cards, steps (a stepper), sticky (notes stuck on the board) and
  chips (pills) - drawn in one of a few colour themes. The list itself decides what
  fits: a title about stages or a cycle gets the stepper (running across the board
  when the steps are few and short), short names with nothing under them can be
  chips, long sentences stay in one column. A hash of the title and first label
  then picks among the looks that fit, and the theme, so one list keeps its look
  from step to step while the next list most likely gets another.
*/

export type ListLayout = "numbered" | "cards" | "steps" | "sticky" | "chips";
type Hue = "amber" | "violet" | "green" | "pink" | "blue" | "orange" | "teal";
type Density = "short" | "medium" | "long";

interface Look {
  layout: ListLayout;
  /** Item i is drawn in hues[i % hues.length]; the first also colours the title. */
  hues: Hue[];
  density: Density;
  /** Columns for cards and sticky notes (the CSS drops to fewer on a narrow board). */
  cols: number;
  /** A short sequence of steps can run across the board instead of down it (wide boards only). */
  flow: "row" | "column";
  /** Varies the sticky notes' tilt from one list to the next. */
  seed: number;
}

const HUES: Hue[] = ["amber", "violet", "green", "pink", "blue", "orange", "teal"];
/** The whole spectrum, a few families that sit well together, or a single colour. */
const THEMES: Hue[][] = [
  HUES,
  ["blue", "teal", "violet"],
  ["amber", "pink", "orange", "violet"],
  ["green", "pink", "teal", "amber"],
  ["violet", "pink", "blue"],
  [],
];

/** A title that says the items happen in order. */
const SEQUENCE = /\b(steps?|stages?|phases?|process(es)?|cycles?|sequence|procedures?|pathways?|method|life ?cycle|how to)\b/i;
/** Items that say so themselves: "Step 1 ...", "First ...", "Then ...", "Finally ...". */
const ORDINAL = /^(step|stage|phase)\s*\d|^(first(ly)?|second(ly)?|third(ly)?|then|next|after that|finally|lastly)\b/i;
/** Ideas to hold on to - these suit notes stuck on the board. */
const IDEAS =
  /\b(ideas?|points?|principles?|rules?|tips?|features?|takeaways?|lessons?|laws?|habits?|advice|guidelines?|traits?|characteristics?|qualities|benefits|advantages|disadvantages|pros|cons|reasons?|causes?|effects?|factors?|facts?|concepts?)\b/i;
/** Kinds or parts of a thing - these suit cards and chips. */
const KINDS =
  /\b(types?|kinds?|forms?|sorts?|categories|classes|groups?|families|examples?|parts?|components?|elements?|properties|materials?|sources?|uses?|organs?|structures?)\b/i;

/** ms between one item being written on and the next. */
const STAGGER: Record<ListLayout, number> = { numbered: 170, steps: 170, cards: 110, sticky: 120, chips: 80 };
/** Sticky-note tilts in degrees; stepping through them by 3 alternates left and right. */
const TILTS = [-2.2, 1.6, -1.1, 2.4, -1.7, 0.9, -2.6, 1.3];

/** FNV-1a with a murmur3 finish, so every bit depends on every character. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function columns(layout: ListLayout, density: Density, n: number): number {
  if (layout === "cards") return density === "long" ? 1 : 2;
  if (layout === "sticky") return n === 2 || n === 4 || density !== "short" ? 2 : 3;
  return 1;
}

function pickLook(list: GuideListData): Look {
  const title = list.title ?? "";
  const items = list.items;
  const n = items.length;
  const h = hash(`${title}|${items[0]?.label ?? ""}`);

  const maxLabel = Math.max(0, ...items.map((it) => it.label.length));
  const maxDetail = Math.max(0, ...items.map((it) => it.detail?.length ?? 0));
  const density: Density =
    maxLabel > 44 || maxLabel + maxDetail > 130 ? "long" : maxLabel <= 24 && maxDetail <= 56 ? "short" : "medium";

  let layout: ListLayout = "numbered";
  if (SEQUENCE.test(title) || items.filter((it) => ORDINAL.test(it.label.trim())).length >= 2) {
    layout = "steps";
  } else {
    // Every look that fits, weighted by how well it suits what the title says the items are.
    const ideas = IDEAS.test(title);
    const kinds = !ideas && KINDS.test(title);
    const names = items.every((it) => !it.detail && it.label.length <= 24 && it.label.trim().split(/\s+/).length <= 3);
    const pool: [ListLayout, number][] = [];
    if (names && n >= 3) pool.push(["chips", kinds ? 4 : ideas ? 2 : 3]);
    if (n <= (density === "short" ? 8 : density === "medium" ? 6 : 4)) pool.push(["sticky", ideas ? 4 : kinds ? 2 : 3]);
    pool.push(["cards", density === "long" && n > 5 ? 1 : 3]);
    pool.push(["numbered", density === "long" && n > 4 ? 3 : 1]);
    let r = h % pool.reduce((sum, [, w]) => sum + w, 0);
    for (const [candidate, weight] of pool) {
      if (r < weight) {
        layout = candidate;
        break;
      }
      r -= weight;
    }
  }

  const theme = THEMES[(h >>> 8) % THEMES.length];
  const turn = h >>> 16;
  const hues = theme.length
    ? [...theme.slice(turn % theme.length), ...theme.slice(0, turn % theme.length)]
    : [HUES[turn % HUES.length]];
  const across = n <= 4 && maxLabel <= (n === 4 ? 14 : 20) && maxDetail <= 50 && (h >>> 4) % 5 < 3;
  return {
    layout,
    hues,
    density,
    cols: columns(layout, density, n),
    flow: across ? "row" : "column",
    seed: (h >>> 24) % TILTS.length,
  };
}

/** What "Quiz me" puts in place of every label (see blankVisual). */
const BLANK = "?";
const looks = new Map<string, Look>();

/** The look for a list. "Quiz me" swaps every label for "?", so looks are also kept by
 *  what that leaves alone - hiding the labels doesn't rearrange the board under the
 *  student, and each item stays where they last saw it. */
function lookOf(list: GuideListData): Look {
  const key = JSON.stringify([list.title ?? "", list.items.map((it) => it.detail ?? "")]);
  const blanked = list.items.length > 0 && list.items.every((it) => it.label === BLANK);
  if (blanked) return looks.get(key) ?? pickLook(list);
  const look = pickLook(list);
  looks.delete(key);
  looks.set(key, look);
  if (looks.size > 64) {
    const oldest = looks.keys().next();
    if (!oldest.done) looks.delete(oldest.value);
  }
  return look;
}

function Tick() {
  return (
    <svg className="guide-list-tick" viewBox="0 0 20 20" aria-hidden>
      <path d="M4.6 10.8 8.4 14.4 15.6 5.8" pathLength={1} />
    </svg>
  );
}

/** `layout` forces one look (the dev gallery uses it); the board leaves it to the list. */
export function GuideList({ list, layout: forced }: { list: GuideListData; layout?: ListLayout }) {
  const { title, items, focus } = list;
  // The furthest item the lesson has reached; everything up to it counts as covered.
  const [reached, setReached] = useState(focus ?? -1);
  const upTo = Math.max(reached, focus ?? -1);
  useEffect(() => {
    if (upTo !== reached) setReached(upTo);
  }, [upTo, reached]);

  const look = lookOf(list);
  const layout = forced ?? look.layout;
  const hueAt = (i: number) => look.hues[i % look.hues.length];

  return (
    <div className="guide-list" data-layout={layout} data-density={look.density} data-hue={look.hues[0]}>
      {title && (
        <div className="guide-chart-title guide-list-title">
          {title}
          <svg className="guide-list-squiggle" viewBox="0 0 64 8" aria-hidden>
            <path d="M2 5c5-3.6 9-3.6 14 0s9 3.6 14 0 9-3.6 14 0 9 3.6 14 0" />
          </svg>
        </div>
      )}
      <ol
        className="guide-list-items"
        data-cols={forced ? columns(forced, look.density, items.length) : look.cols}
        data-flow={layout === "steps" ? look.flow : undefined}
      >
        {items.map((item, i) => {
          const state = i === focus ? "focus" : i <= upTo ? "done" : "todo";
          const style: Record<string, string> = { animationDelay: `${i * STAGGER[layout]}ms` };
          if (layout === "sticky") style["--gl-tilt"] = `${TILTS[(look.seed + i * 3) % TILTS.length]}deg`;
          if (layout === "steps") style["--gl-next"] = `var(--gl-${hueAt(i + 1)})`;
          return (
            <li
              key={i}
              className="guide-list-item"
              data-state={state}
              data-hue={hueAt(i)}
              data-board-focus={state === "focus" ? "" : undefined}
              // so the tutor's pointer can land on any item by name, not only the focused one
              data-board-part={`items.${i}`}
              data-board-label={item.label}
              style={style as CSSProperties}
            >
              <span className="guide-list-num" aria-hidden>
                {state === "done" ? <Tick /> : i + 1}
              </span>
              <span className="guide-list-text">
                {item.label === BLANK ? (
                  <span className="guide-list-label guide-list-blank">{BLANK}</span>
                ) : (
                  <span className="guide-list-label">{item.label}</span>
                )}
                {item.detail && <span className="guide-list-detail">{item.detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
