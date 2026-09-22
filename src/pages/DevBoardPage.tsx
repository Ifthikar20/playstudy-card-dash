/**
 * Dev-only route: /dev-board
 *
 * The Teach mode whiteboard's list looks (components/guide/GuideList.tsx) drawn
 * inside the board's own classes, light and dark side by side, so a change to them
 * can be checked without sitting through a lesson: step the focus along to watch
 * the ticks carry over, try "Quiz me", narrow the board. Only registered when
 * import.meta.env.DEV is true - see App.tsx.
 *
 * Query string, for screenshots: ?focus=2&width=420&blank=1&only=looks|auto|facts
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { GuideFacts as GuideFactsData, GuideList as GuideListData } from "@/services/guide";
import { GuideList, type ListLayout } from "@/components/guide/GuideList";
import { GuideFacts } from "@/components/guide/GuideFacts";

/** "Did you know?" cards: two facts (side by side on a wide board), three, four. */
const FACTS: GuideFactsData[] = [
  {
    title: "The Moon in numbers",
    items: [
      { value: "384,400 km", text: "its average distance from Earth" },
      { value: "1969", text: "Apollo 11 lands the first people on it" },
    ],
  },
  {
    title: "Your heart",
    items: [
      { value: "~100,000", text: "beats a day, without you thinking about it once" },
      { value: "5 litres", text: "of blood pumped around the body every minute at rest" },
      { value: "4", text: "chambers: two atria on top, two ventricles below" },
    ],
  },
  {
    items: [
      { value: "299,792 km/s", text: "the speed of light in a vacuum" },
      { value: "8 min 20 s", text: "for sunlight to reach Earth" },
      { value: "1.3 s", text: "for light from the Moon to reach us" },
      { value: "1676", text: "Ole Rømer first shows light's speed is finite" },
    ],
  },
];

const NEWTON: GuideListData = {
  title: "Newton's three laws",
  items: [
    { label: "Inertia", detail: "a body keeps its motion unless a force acts on it" },
    { label: "F = ma", detail: "force equals mass times acceleration" },
    { label: "Action and reaction", detail: "every action has an equal and opposite reaction" },
  ],
};
const CONFORMITY: GuideListData = {
  title: "Key ideas",
  auto: true,
  items: [
    { label: "Conform", detail: "go along with what the group does" },
    { label: "Normative influence", detail: "wanting to fit in and be liked" },
    { label: "Informational influence", detail: "looking to others when unsure what is right" },
    { label: "Obedience", detail: "following a direct order from authority" },
  ],
};
const MITOSIS: GuideListData = {
  title: "Stages of mitosis",
  items: [
    { label: "Prophase", detail: "chromosomes condense and become visible" },
    { label: "Metaphase", detail: "chromosomes line up across the middle" },
    { label: "Anaphase", detail: "sister chromatids are pulled apart" },
    { label: "Telophase", detail: "two new nuclei form" },
  ],
};
const WATER: GuideListData = {
  title: "The water cycle",
  items: [
    { label: "Evaporation", detail: "the sun heats water and it rises as vapour" },
    { label: "Condensation", detail: "the vapour cools into clouds" },
    { label: "Precipitation", detail: "water falls as rain, snow or hail" },
    { label: "Collection", detail: "it gathers in rivers, lakes and seas" },
  ],
};
const BUTTERFLY: GuideListData = {
  title: "The life cycle of a butterfly",
  items: [
    { label: "Egg", detail: "laid on a leaf the caterpillar will eat" },
    { label: "Caterpillar", detail: "eats and grows, shedding its skin" },
    { label: "Chrysalis", detail: "its body is rebuilt inside a case" },
    { label: "Butterfly", detail: "the adult comes out and lays eggs" },
  ],
};
const ROCKS: GuideListData = {
  title: "Types of rock",
  items: [{ label: "Igneous" }, { label: "Sedimentary" }, { label: "Metamorphic" }],
};
const CELL: GuideListData = {
  title: "Parts of a plant cell",
  items: [
    { label: "Nucleus" },
    { label: "Cell wall" },
    { label: "Chloroplast" },
    { label: "Vacuole" },
    { label: "Mitochondria" },
    { label: "Cell membrane" },
    { label: "Cytoplasm" },
  ],
};
const ROME: GuideListData = {
  title: "Why the Western Roman Empire fell",
  auto: true,
  items: [
    { label: "The empire had grown too large to govern well from a single capital" },
    { label: "Constant wars drained the treasury and stretched the army thin" },
    { label: "Political instability meant emperors were replaced every few years" },
    { label: "Germanic tribes pushed across the borders and sacked Rome in 410" },
    { label: "Heavy taxes and inflation weakened trade and the middle class" },
  ],
};
const HYPOTHESIS: GuideListData = {
  title: "Features of a good hypothesis",
  items: [
    { label: "Testable", detail: "an experiment can check it" },
    { label: "Specific", detail: "it names the variables" },
    { label: "Falsifiable", detail: "a result could show it is wrong" },
    { label: "Grounded", detail: "it builds on what is already known" },
  ],
};
const ENERGY: GuideListData = {
  items: [
    { label: "Photosynthesis", detail: "makes glucose from light, water and carbon dioxide" },
    { label: "Respiration", detail: "releases the energy stored in glucose" },
  ],
};
const RENEWABLE: GuideListData = {
  title: "Advantages of renewable energy",
  items: [
    { label: "Never runs out", detail: "sunlight, wind and tides are replaced naturally" },
    { label: "Low emissions", detail: "almost no carbon dioxide once it is built" },
    { label: "Cheap to run", detail: "no fuel to buy after the plant is built" },
    { label: "Energy security", detail: "less reliance on imported oil and gas" },
    { label: "Creates jobs", detail: "in building, fitting and maintenance" },
    { label: "Cleaner air", detail: "less smoke and smog in towns and cities" },
  ],
};
const METHOD: GuideListData = {
  title: "The scientific method",
  items: [
    { label: "Ask a question" },
    { label: "Do background research" },
    { label: "Form a hypothesis" },
    { label: "Test it with an experiment" },
    { label: "Analyse the results" },
    { label: "Share the conclusion" },
  ],
};
const MARKETS: GuideListData = {
  title: "Key ideas",
  items: [
    { label: "Demand", detail: "how much buyers want at each price" },
    { label: "Supply", detail: "how much sellers offer at each price" },
    { label: "Equilibrium", detail: "the price where supply meets demand" },
    { label: "Shortage", detail: "demand is higher than supply" },
    { label: "Surplus", detail: "supply is higher than demand" },
  ],
};
const LUNGS: GuideListData = {
  title: "Words to know",
  items: [
    { label: "Pneumonoultramicroscopicsilicovolcanoconiosis", detail: "a lung disease from fine dust" },
    { label: "Alveoli" },
    { label: "Bronchi" },
    { label: "Trachea" },
    { label: "Diaphragm" },
    { label: "Larynx" },
    { label: "Pleura" },
    { label: "Cilia" },
  ],
};

/** Each look forced onto a list that suits it. */
const LOOKS: [ListLayout, GuideListData][] = [
  ["cards", NEWTON],
  ["steps", BUTTERFLY],
  ["sticky", CONFORMITY],
  ["chips", CELL],
  ["numbered", ROME],
];
/** Left to the list, as on the board. */
const SAMPLES = [NEWTON, CONFORMITY, MARKETS, MITOSIS, WATER, BUTTERFLY, METHOD, ROCKS, CELL, HYPOTHESIS, RENEWABLE, ENERGY, ROME, LUNGS];

const WIDTHS = [560, 460, 380, 320];
const MAX_FOCUS = 7;

/** A still copy of the board: its classes, without the fixed position. */
const boardStyle = (width: number): CSSProperties => ({
  position: "relative",
  inset: "auto",
  transform: "none",
  animation: "none",
  width,
  maxWidth: "100%",
  maxHeight: "none",
  zIndex: 0,
});

function Board({ list, layout, width }: { list: GuideListData; layout?: ListLayout; width: number }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState({ look: "", overflow: false });
  useEffect(() => {
    const read = () => {
      const body = bodyRef.current;
      if (!body) return;
      const look = body.querySelector<HTMLElement>(".guide-list")?.dataset.layout ?? "";
      const overflow = body.scrollWidth > body.clientWidth + 1;
      setInfo((prev) => (prev.look === look && prev.overflow === overflow ? prev : { look, overflow }));
    };
    read();
    const t = window.setTimeout(read, 2500); // once everything has been written on
    return () => window.clearTimeout(t);
  }, [list, layout, width]);

  return (
    <div className="guide-board" style={boardStyle(width)}>
      <div className="guide-board-head" style={{ cursor: "default" }}>
        <span className="guide-board-traffic" aria-hidden>
          <span className="guide-board-dot guide-board-dot-close inline-block" />
          <span className="guide-board-dot guide-board-dot-min inline-block" />
          <span className="guide-board-dot guide-board-dot-full inline-block" />
        </span>
        <span className="guide-board-minlabel">{info.look}</span>
        {info.overflow && <span className="ml-auto text-[11px] font-semibold normal-case text-red-500">overflows sideways</span>}
      </div>
      <div className="guide-board-body" ref={bodyRef}>
        <div className="guide-board-line" data-mode="writing" data-kind="list">
          <GuideList list={list} layout={layout} />
        </div>
      </div>
    </div>
  );
}

/** The same board on the notes' light paper and on dark. */
function Pair({ list, layout, width }: { list: GuideListData; layout?: ListLayout; width: number }) {
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="rounded-2xl bg-[hsl(var(--paper))] p-3">
        <Board list={list} layout={layout} width={width} />
      </div>
      <div className="dark rounded-2xl bg-[hsl(var(--paper))] p-3">
        <Board list={list} layout={layout} width={width} />
      </div>
    </div>
  );
}

/** A facts card on the board, light and dark. */
function FactsPair({ facts, width }: { facts: GuideFactsData; width: number }) {
  const board = (
    <div className="guide-board" style={boardStyle(width)}>
      <div className="guide-board-head" style={{ cursor: "default" }}>
        <span className="guide-board-traffic" aria-hidden>
          <span className="guide-board-dot guide-board-dot-close inline-block" />
          <span className="guide-board-dot guide-board-dot-min inline-block" />
          <span className="guide-board-dot guide-board-dot-full inline-block" />
        </span>
      </div>
      <div className="guide-board-body">
        <div className="guide-board-line" data-mode="writing" data-kind="facts">
          <GuideFacts facts={facts} />
        </div>
      </div>
    </div>
  );
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="rounded-2xl bg-[hsl(var(--paper))] p-3">{board}</div>
      <div className="dark rounded-2xl bg-[hsl(var(--paper))] p-3">{board}</div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
      {children}
    </section>
  );
}

const button = "rounded-full border border-border px-3 py-1 hover:bg-muted";

export default function DevBoardPage() {
  const params = new URLSearchParams(window.location.search);
  const only = params.get("only");
  const [focus, setFocus] = useState(() => Math.min(MAX_FOCUS, Number(params.get("focus") ?? -1)));
  const [width, setWidth] = useState(() => Number(params.get("width")) || WIDTHS[0]);
  const [blank, setBlank] = useState(() => params.get("blank") === "1");
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);

  // A light page whatever the app's theme is; the dark boards bring their own .dark.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const scheme = root.style.colorScheme;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    return () => {
      if (wasDark) root.classList.add("dark");
      root.style.colorScheme = scheme;
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setFocus((f) => (f >= MAX_FOCUS ? -1 : f + 1)), 1600);
    return () => window.clearInterval(t);
  }, [playing]);

  // What the board would pass: the same list with the focus moved (and, for "Quiz me", "?" labels).
  const show = useMemo(
    () => (list: GuideListData): GuideListData => ({
      ...list,
      items: blank ? list.items.map((it) => ({ ...it, label: "?" })) : list.items,
      focus: focus < 0 ? undefined : Math.min(focus, list.items.length - 1),
    }),
    [focus, blank],
  );
  const looks = useMemo(() => LOOKS.map(([layout, list]) => [layout, show(list)] as const), [show]);
  const samples = useMemo(() => SAMPLES.map(show), [show]);
  // The board redraws a list for "Quiz me" (and on replay); stepping the focus doesn't.
  const key = `${run}-${blank ? "b" : ""}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-6 py-3 text-sm backdrop-blur">
        <strong className="mr-2">Board lists</strong>
        <button type="button" className={button} onClick={() => setFocus(-1)}>
          No focus
        </button>
        <button type="button" className={button} onClick={() => setFocus((f) => Math.max(-1, f - 1))}>
          Prev
        </button>
        <span className="w-16 text-center tabular-nums text-muted-foreground">{focus < 0 ? "none" : `item ${focus + 1}`}</span>
        <button type="button" className={button} onClick={() => setFocus((f) => Math.min(MAX_FOCUS, f + 1))}>
          Next
        </button>
        <button type="button" className={button} onClick={() => setPlaying((p) => !p)}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className={button} onClick={() => setBlank((b) => !b)}>
          {blank ? "Reveal" : "Quiz me"}
        </button>
        <button type="button" className={button} onClick={() => setRun((r) => r + 1)}>
          Replay
        </button>
        <label className="ml-2 flex items-center gap-2 text-muted-foreground">
          Board width
          <select className="rounded-md border border-border bg-background px-2 py-1 text-foreground" value={width} onChange={(e) => setWidth(Number(e.target.value))}>
            {WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w}px
              </option>
            ))}
          </select>
        </label>
      </header>
      <main className="space-y-10 px-6 py-6">
        {only === "facts" && (
          <Section title="Fast facts" note="The board's &quot;Did you know?&quot; card: a few striking facts about the subject.">
            {FACTS.map((f, i) => (
              <FactsPair key={`${i}-${key}`} facts={blank ? { ...f, items: f.items.map((it) => ({ ...it, value: "?" })) } : f} width={width} />
            ))}
          </Section>
        )}
        {(!only || only === "looks") && (
          <Section title="Every look" note="The five looks a list can take, each forced onto a list that suits it.">
            {looks.map(([layout, list]) => (
              <Pair key={`${layout}-${key}`} list={list} layout={layout} width={width} />
            ))}
          </Section>
        )}
        {(!only || only === "auto") && (
          <Section title="Picked by the list" note="What the board picks on its own: from the title, the item count, details and label lengths, then a hash of the title and first label.">
            {samples.map((list, i) => (
              <Pair key={`${i}-${key}`} list={list} width={width} />
            ))}
          </Section>
        )}
      </main>
    </div>
  );
}
