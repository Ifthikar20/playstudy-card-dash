/**
 * Dev-only: /dev-board?only=pointing
 *
 * Checks that the tutor's pointer lands on the exact part being talked about, with
 * the real whiteboard (GuideBoard), the real pointer (GuidePointer) and the same
 * pointing helpers Teach mode uses (lib/guide/boardParts).
 *
 * The picture is a resistor drawn right here, so its four colour bands sit at known
 * places; the part locator is stubbed to answer with exactly those places. Step
 * through the bands and each gets a PASS/FAIL: the pointer's tip (where the cursor
 * is translated to) must be inside that band, and the speech bubble must not cover
 * it. The second section does the same for one small drawn visual per kind, via its
 * data-board-part anchors ("no anchor" until that visual has them).
 *
 * Query string: ?img=<url>&regions=<json {label: region}> for a real photo,
 * &band=N to point at band N on load, &auto=1 to run every check on load,
 * &locator=off to see the whole-picture fallback.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  fetchImageParts,
  overrideImageParts,
  type GuideImage as GuideImageData,
  type GuidePoint,
  type GuideRegion,
  type VisualSpec,
} from "@/services/guide";
import { BOARD_IMAGE, findAnchor, locatePart, matchAnchor, partGesture, pointAtPart, restBeside, type Box } from "@/lib/guide/boardParts";
import { GuideBoard, type BoardHandle } from "./GuideBoard";
import { GuidePointer, type PointerHandle } from "./GuidePointer";
import { GuideVisual } from "./GuideVisual";

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

// ---- the resistor ------------------------------------------------------------------
// 800 x 300 user units. Bands are 32 wide and run the body's full height, so their
// normalized boxes below are exact.
const RW = 800;
const RH = 300;
const BAND_Y = 90;
const BAND_W = 32;
const BAND_H = 120;
const BANDS = [
  { label: "the brown band", color: "#7c4a1e", x: 230, say: "The first band, on the far left, is brown, so the first digit is 1." },
  { label: "the black band", color: "#111827", x: 300, say: "Right next to it, the second band is black: the second digit is 0." },
  { label: "the red band", color: "#dc2626", x: 370, say: "The third band is red, which means multiply by one hundred." },
  { label: "the gold band", color: "#d4a017", x: 540, say: "And the gold band, on its own at the right end, is the tolerance: plus or minus five percent." },
];

const RESISTOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${RW}" height="${RH}" viewBox="0 0 ${RW} ${RH}">
<rect width="${RW}" height="${RH}" fill="#f8fafc"/>
<line x1="0" y1="150" x2="150" y2="150" stroke="#9ca3af" stroke-width="10" stroke-linecap="round"/>
<line x1="650" y1="150" x2="800" y2="150" stroke="#9ca3af" stroke-width="10" stroke-linecap="round"/>
<rect x="150" y="${BAND_Y}" width="500" height="${BAND_H}" rx="48" fill="#e7cfa0" stroke="#b08a50" stroke-width="3"/>
${BANDS.map((b) => `<rect x="${b.x}" y="${BAND_Y}" width="${BAND_W}" height="${BAND_H}" fill="${b.color}"/>`).join("\n")}
</svg>`;
const RESISTOR_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(RESISTOR_SVG)}`;

/** Each band's true place, 0-1 of the picture: what a perfect locator would answer. */
const RESISTOR_REGIONS: Record<string, GuideRegion> = Object.fromEntries(
  BANDS.map((b) => [
    b.label,
    {
      box: [b.x / RW, BAND_Y / RH, BAND_W / RW, BAND_H / RH],
      point: [(b.x + BAND_W / 2) / RW, (BAND_Y + BAND_H / 2) / RH],
      confidence: "high",
    } satisfies GuideRegion,
  ]),
);

// ---- one small drawn visual per kind -------------------------------------------------
const DRAWN: Array<{ name: string; spec: VisualSpec; point: GuidePoint; say: string }> = [
  {
    name: "List",
    spec: {
      kind: "list",
      data: {
        title: "Newton's three laws",
        items: [
          { label: "Inertia", detail: "a body keeps its motion unless a force acts on it" },
          { label: "F = ma", detail: "force equals mass times acceleration" },
          { label: "Action and reaction", detail: "every action has an equal and opposite reaction" },
        ],
      },
    },
    point: { label: "F = ma", part: "items.1" },
    say: "The second law, F = ma, is the one you'll use most.",
  },
  {
    name: "Table",
    spec: {
      kind: "table",
      data: {
        columns: ["", "Mitosis", "Meiosis"],
        rows: [
          ["Daughter cells", "2", "4"],
          ["Identical to the parent", "Yes", "No"],
        ],
      },
    },
    point: { label: "No", part: "cells.1.2" },
    say: "Meiosis cells are not identical to the parent: this cell says no.",
  },
  {
    name: "Chart",
    spec: {
      kind: "chart",
      data: {
        type: "bar",
        title: "Days in one orbit",
        data: [
          { label: "Mercury", value: 88 },
          { label: "Venus", value: 225 },
          { label: "Earth", value: 365 },
        ],
      },
    },
    point: { label: "Earth", part: "data.2" },
    say: "Earth's bar, the longest, is one year: 365 days.",
  },
  {
    name: "Circuit",
    spec: {
      kind: "circuit",
      data: {
        layout: "series",
        components: [
          { type: "battery", label: "6 V" },
          { type: "resistor", label: "R1" },
          { type: "bulb", label: "lamp" },
        ],
      },
    },
    point: { label: "the resistor", part: "components.1" },
    say: "The resistor, R1, limits the current round the loop.",
  },
  {
    name: "Geometry",
    spec: { kind: "geometry", data: { shape: "right_triangle", values: { a: 3, b: 4, c: 5 }, labels: {}, show: ["right_angle"] } },
    point: { label: "side c", part: "sides.c" },
    say: "Side c, the hypotenuse, is opposite the right angle.",
  },
  {
    name: "Code",
    spec: { kind: "code", data: { language: "python", lines: ["total = 0", "for n in range(1, 4):", "    total += n", "print(total)"], highlight: [3] } },
    point: { label: "total += n", part: "lines.3" },
    say: "Line three adds each n to the running total.",
  },
  {
    name: "Timeline",
    spec: {
      kind: "timeline",
      data: {
        title: "The space race",
        events: [
          { year: 1957, label: "Sputnik 1" },
          { year: 1961, label: "Gagarin orbits Earth" },
          { year: 1969, label: "Apollo 11 lands on the Moon" },
        ],
      },
    },
    point: { label: "1969", part: "events.2" },
    say: "In 1969 Apollo 11 lands on the Moon.",
  },
];

// ---- checks --------------------------------------------------------------------------
interface Verdict {
  pass: boolean | null; // null: couldn't be checked (no anchor, no board)
  note: string;
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
const inside = (p: { x: number; y: number }, b: Box, slack = 0.75) =>
  p.x >= b.left - slack && p.x <= b.left + b.width + slack && p.y >= b.top - slack && p.y <= b.top + b.height + slack;
const fmt = (n: number) => n.toFixed(1);

/**
 * A region's true on-screen box, worked out independently of regionTarget: from the
 * element's client box (inside its border) and the picture's shape, as object-fit:
 * contain lays it out. The two agreeing is part of what's being checked.
 */
function expectedBox(img: HTMLImageElement, region: GuideRegion): Box | null {
  const r = img.getBoundingClientRect();
  const cw = img.clientWidth;
  const ch = img.clientHeight;
  if (!cw || !ch || !img.naturalWidth || !img.naturalHeight) return null;
  const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const ox = r.left + img.clientLeft + (cw - dw) / 2;
  const oy = r.top + img.clientTop + (ch - dh) / 2;
  const [x, y, w, h] = region.box;
  return { left: ox + x * dw, top: oy + y * dh, width: w * dw, height: h * dh };
}

/** Wait until the pointer has stopped (its transform unchanged for a moment), then read where its tip is. */
async function settledTip(host: HTMLElement): Promise<{ x: number; y: number } | null> {
  const cursor = host.querySelector<HTMLElement>(".guide-cursor");
  if (!cursor) return null;
  const start = performance.now();
  let last = "";
  let still = performance.now();
  while (performance.now() - start < 6000) {
    await sleep(80);
    const now = cursor.style.transform;
    if (now !== last) {
      last = now;
      still = performance.now();
    } else if (performance.now() - still > 380) break;
  }
  const m = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(cursor.style.transform);
  if (!m) return null;
  // The translate is in the pointer layer's space; measuring from the layer itself (not
  // the host) catches a layer that sits anywhere but on the host's corner.
  const layer = (cursor.parentElement ?? host).getBoundingClientRect();
  return { x: layer.left + Number(m[1]), y: layer.top + Number(m[2]) };
}

/** PASS when the tip is on `part` and the bubble (or name chip) is clear of it. */
async function judge(host: HTMLElement, part: () => Box | null): Promise<Verdict> {
  const tip = await settledTip(host);
  const box = part();
  if (!tip || !box) return { pass: false, note: "couldn't measure" };
  const bubble = host.querySelector<HTMLElement>(".guide-bubble, .guide-chip")?.getBoundingClientRect() ?? null;
  const on = inside(tip, box);
  const covered = !!bubble && overlaps(bubble, box);
  const where = `tip ${fmt(tip.x)},${fmt(tip.y)} in ${fmt(box.left)}-${fmt(box.left + box.width)} × ${fmt(box.top)}-${fmt(box.top + box.height)}`;
  if (!on) return { pass: false, note: `tip off the part (${where})` };
  if (covered) return { pass: false, note: `bubble covers the part (${where})` };
  return { pass: true, note: where };
}

// ---- the page ------------------------------------------------------------------------
function Result({ v }: { v?: Verdict }) {
  if (!v) return <span className="text-muted-foreground">not run</span>;
  const tone = v.pass === true ? "text-emerald-600" : v.pass === false ? "text-red-600" : "text-amber-600";
  return (
    <span className={tone} data-result={v.pass === true ? "pass" : v.pass === false ? "fail" : "skip"}>
      <strong>{v.pass === true ? "PASS" : v.pass === false ? "FAIL" : "—"}</strong> <span className="text-xs opacity-80">{v.note}</span>
    </span>
  );
}

/** A still copy of the board for the drawn visuals: its classes, in the page flow. */
const staticBoard: CSSProperties = {
  position: "relative",
  inset: "auto",
  transform: "none",
  animation: "none",
  width: 460,
  maxWidth: "100%",
  maxHeight: "none",
  zIndex: 0,
};

function DrawnBoard({ name, spec, children }: { name: string; spec: VisualSpec; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="guide-board" style={staticBoard} data-kind={spec.kind} data-drawn={name}>
        <div className="guide-board-head" style={{ cursor: "default" }}>
          <span className="guide-board-traffic" aria-hidden>
            <span className="guide-board-dot guide-board-dot-close inline-block" />
            <span className="guide-board-dot guide-board-dot-min inline-block" />
            <span className="guide-board-dot guide-board-dot-full inline-block" />
          </span>
          <span className="guide-board-name">{name}</span>
        </div>
        <div className="guide-board-body">
          <div className="guide-board-line" data-mode="writing" data-kind={spec.kind}>
            <GuideVisual spec={spec} />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

const button = "rounded-full border border-border px-3 py-1 text-sm hover:bg-muted disabled:opacity-40";

export function DevPointingGallery() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  // A real photo and its regions can come in on the URL; otherwise the drawn resistor.
  const custom = useMemo(() => {
    const img = params.get("img");
    if (!img) return null;
    try {
      const regions = JSON.parse(params.get("regions") || "{}") as Record<string, GuideRegion>;
      return { url: img, regions };
    } catch {
      return { url: img, regions: {} as Record<string, GuideRegion> };
    }
  }, [params]);
  const regions = custom?.regions ?? RESISTOR_REGIONS;
  const labels = custom ? Object.keys(custom.regions) : BANDS.map((b) => b.label);
  const sayFor = (i: number) => (custom ? `Look at ${labels[i]}, just here.` : BANDS[i].say);
  const image: GuideImageData = useMemo(
    () =>
      custom
        ? { query: "dev photo", caption: "A photo from the URL", url: custom.url }
        : { query: "resistor colour bands", caption: "A 1 kΩ resistor: brown, black, red, gold", url: RESISTOR_URL },
    [custom],
  );

  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const pointer = useRef<PointerHandle | null>(null);
  const board = useRef<BoardHandle | null>(null);
  const [caption, setCaption] = useState<string | null>("Press a band and I'll point at it.");
  const [locatorOff, setLocatorOff] = useState(() => params.get("locator") === "off");
  const [results, setResults] = useState<Record<string, Verdict>>({});
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(() => window.innerWidth);
  const circled = useRef(false);
  const drawnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const record = (key: string, v: Verdict) => setResults((r) => ({ ...r, [key]: v }));

  // The locator, stubbed: the true regions, or "switched off" to see the fallback.
  useEffect(() => {
    overrideImageParts(async (_url, asked) => {
      await sleep(60);
      if (locatorOff) return { enabled: false, regions: {} };
      return { enabled: true, regions: Object.fromEntries(asked.filter((l) => regions[l]).map((l) => [l, regions[l]])) };
    });
    return () => overrideImageParts(null);
  }, [locatorOff, regions]);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Put the picture up once the board exists.
  useEffect(() => {
    const t = window.setTimeout(() => board.current?.draw({ kind: "image", data: image }), 50);
    return () => window.clearTimeout(t);
  }, [image]);

  /** The live picture on the board, once it has loaded. */
  const livePicture = async (): Promise<{ el: HTMLElement; img: HTMLImageElement } | null> => {
    for (let i = 0; i < 60; i++) {
      const el = board.current?.live();
      const img = el?.querySelector<HTMLImageElement>(BOARD_IMAGE);
      if (el && img?.complete && img.naturalWidth > 0) {
        await sleep(450); // past the board's own entry and the picture fading in
        return { el, img };
      }
      await sleep(100);
    }
    return null;
  };

  const pointBand = async (i: number): Promise<Verdict> => {
    const p = pointer.current;
    const key = `band-${i}`;
    if (!p || !host) return { pass: null, note: "no pointer" };
    const live = await livePicture();
    if (!live) {
      const v = { pass: null, note: "no picture on the board" };
      record(key, v);
      return v;
    }
    const { el, img } = live;
    const label = labels[i];
    setCaption(sayFor(i));
    const found = await fetchImageParts(img.currentSrc || img.src, [label], { context: sayFor(i) });
    const spot = locatePart(el, { label }, found);
    const boardBox = el.closest<HTMLElement>(".guide-board")?.getBoundingClientRect() ?? null;
    let v: Verdict;
    if (spot) {
      pointAtPart(p, host, spot, { gesture: partGesture(spot.box, !circled.current), board: boardBox });
      circled.current = true;
      v = await judge(host, () => (regions[label] ? expectedBox(img, regions[label]) : null));
    } else {
      // No region: the whole picture outlined and the pointer resting beside it, off the picture.
      restBeside(p, host, img.getBoundingClientRect(), { board: boardBox, duration: 900 });
      const tip = await settledTip(host);
      const pic = img.getBoundingClientRect();
      const bubble = host.querySelector<HTMLElement>(".guide-bubble, .guide-chip")?.getBoundingClientRect() ?? null;
      const off = !!tip && !inside(tip, pic, -0.5);
      const near = !!tip && Math.hypot(tip.x - pic.left, tip.y - pic.bottom) < 12;
      const clear = !bubble || !overlaps(bubble, pic);
      v = {
        pass: off && near && clear,
        note: !off ? "tip is on the picture" : !near ? "tip isn't by the bottom-left corner" : !clear ? "bubble covers the picture" : "rests beside the picture (no region)",
      };
    }
    record(key, v);
    return v;
  };

  const pointDrawn = async (d: (typeof DRAWN)[number]): Promise<Verdict> => {
    const p = pointer.current;
    const key = `drawn-${d.name}`;
    const root = drawnRefs.current[d.name]?.querySelector<HTMLElement>(".guide-board-line") ?? null;
    if (!p || !host || !root) return { pass: null, note: "not rendered" };
    root.scrollIntoView({ block: "center" });
    await sleep(250);
    const target = (d.point.part ? findAnchor(root, d.point.part) : null) ?? matchAnchor(root, d.point.label);
    const spot = target ? locatePart(root, d.point, {}) : null;
    if (!target || !spot) {
      p.focus(null);
      const v = { pass: null, note: `no anchor for ${d.point.part ?? d.point.label}` };
      record(key, v);
      return v;
    }
    setCaption(d.say);
    const boardBox = root.closest<HTMLElement>(".guide-board")?.getBoundingClientRect() ?? null;
    pointAtPart(p, host, spot, { gesture: "click", board: boardBox });
    const via = target.getAttribute("data-board-part") === d.point.part ? "" : " (matched by name)";
    const v = await judge(host, () => (target.isConnected ? target.getBoundingClientRect() : null));
    const out = { ...v, note: v.note + via };
    record(key, out);
    return out;
  };

  const runAll = async () => {
    setBusy(true);
    try {
      window.scrollTo({ top: 0 });
      for (let i = 0; i < labels.length; i++) await pointBand(i);
      for (const d of DRAWN) await pointDrawn(d);
      window.scrollTo({ top: 0 });
    } finally {
      setBusy(false);
    }
  };

  // ?band=N points at one band on load; ?auto=1 runs everything (for screenshots).
  useEffect(() => {
    if (!host) return;
    const band = Number(params.get("band"));
    const t = window.setTimeout(() => {
      if (params.get("auto") === "1") void runAll();
      else if (Number.isInteger(band) && band >= 1 && band <= labels.length) void pointBand(band - 1);
    }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the host is there
  }, [host]);

  // For driving the gallery from a script: every verdict so far.
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __pointing?: unknown }).__pointing = results;
  }, [results]);

  const passed = Object.values(results).filter((v) => v.pass === true).length;
  const failed = Object.values(results).filter((v) => v.pass === false).length;

  return (
    // The host the pointer lives in, as the notes page is for Teach mode. guide-shift
    // moves this column out from under the board, like the notes. (No spacing utility
    // on the host itself: it would push the pointer's portalled layer off its corner.)
    <div ref={setHost} className="guide-shift relative">
      {host && (
        <GuidePointer ref={pointer} host={host} speaking caption={caption} speaker={{ name: "Alec", kind: "male" }} />
      )}
      <GuideBoard ref={board} title={custom ? "Photo" : "Resistor colour code"} onClose={() => board.current?.hide()} />
      <div className="space-y-8">
        <section className="max-w-xl space-y-3">
          <p className="text-sm text-muted-foreground">
            The picture on the board ({width}px window). Press a band: the tip must land inside it and the bubble must stay off it.
            After full screen or dragging the board, press it again.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {labels.map((label, i) => (
              <button key={label} type="button" className={button} disabled={busy} onClick={() => void pointBand(i)}>
                {i + 1}. {label}
              </button>
            ))}
            <button type="button" className={button} disabled={busy} onClick={() => void runAll()}>
              Run all
            </button>
            <button type="button" className={button} onClick={() => board.current?.draw({ kind: "image", data: image })}>
              Show picture
            </button>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input type="checkbox" checked={locatorOff} onChange={(e) => setLocatorOff(e.target.checked)} />
              Locator off
            </label>
          </div>
          <ul className="space-y-1 text-sm">
            {labels.map((label, i) => (
              <li key={label} className="flex gap-2">
                <span className="w-40 shrink-0">
                  {i + 1}. {label}
                </span>
                <Result v={results[`band-${i}`]} />
              </li>
            ))}
          </ul>
          <p className="text-sm">
            <strong>{passed}</strong> passed · <strong>{failed}</strong> failed
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Drawn visuals</h3>
          <div className="flex flex-wrap items-start gap-6">
            {DRAWN.map((d) => (
              <div
                key={d.name}
                ref={(n) => {
                  drawnRefs.current[d.name] = n;
                }}
              >
                <DrawnBoard name={d.name} spec={d.spec}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <button type="button" className={button} disabled={busy} onClick={() => void pointDrawn(d)}>
                      Point at {d.point.part ?? d.point.label}
                    </button>
                    <Result v={results[`drawn-${d.name}`]} />
                  </div>
                </DrawnBoard>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
