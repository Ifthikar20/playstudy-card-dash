import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Gamepad2, GraduationCap, Mic, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Agent cursors — AnotherNotes's four study modes standing around the hero copy
  the way collaborators stand around a shared document, and drifting the way
  they do in Figma or Notion.

  Deliberately monochrome. A resting agent is an *outlined* arrow with a cream
  hairline chip; the one holding the floor is a *filled* ink arrow wearing the
  page's own ink pill, its lucide mark swapped for a three-bar voice meter.
  Fill versus outline, ink pill versus cream chip — the page's existing
  hairline-vs-ink grammar used as an on-air light, so "which agent is talking"
  is pre-attentive and needs no accent colour. The pastel tints from the
  Features mega-menu stay quarantined there; four of them in the first 200px
  would make the hero the most chromatic surface on a cream/ink page.

  The floor passes every 2.4s — the page's shared ambient beat. Motion is one
  step up from still: each cursor drifts at most 3px on a 9.6/12/14.4s loop
  (all multiples of 2.4s), and the speaker lifts 2px. Nothing scales, nothing
  slides, and no chip ever changes width, so display type is never crowded.

  Both layers are aria-hidden and pointer-events-none — the headline stays
  selectable and both CTAs stay clickable through the chips. The roster is
  handed to screen readers once, statically, at the end.

  Requires the `.lp-agent-drift-*` block in src/index.css (search
  "Hero agent cursors").
*/

/* Identity only. Geometry lives in STATIONS so retuning after a real browser
   pass is a one-line edit per station rather than a hunt through this array. */
type Agent = { name: string; icon: LucideIcon };

const AGENTS: Agent[] = [
  { name: "Full study", icon: GraduationCap },
  { name: "Speed run", icon: Zap },
  { name: "Mentor mode", icon: Mic },
  { name: "Game zone", icon: Gamepad2 },
];

/*
  Geometry only, indexed in step with AGENTS — clockwise: above-left,
  above-right, below-right, below-left.

  Every value is a complete literal Tailwind string (the scanner cannot see an
  interpolated class name). The stations are pinned to the two bands that are
  empty at EVERY width: the whitespace above the headline, and the 56px pocket
  the wrapper's own `md:pb-16` opens below the CTA row. Nothing is ever placed
  beside the headline, so clearance is vertical — a Georgia fallback can widen
  the headline but it cannot move it up, which is why this survives a
  font-loading failure where percentage-anchored geometry does not.

  These offsets are reasoned from the type ramp against this repo's 14px root,
  not measured in a browser. Expect to nudge them once on real hardware.
*/
type Station = { pos: string; side: "left" | "right"; drift: string };

const STATIONS: Station[] = [
  { pos: "left-[1%] top-0", side: "left", drift: "lp-agent-drift-a" },
  { pos: "right-[4%] top-2", side: "right", drift: "lp-agent-drift-b" },
  { pos: "right-[1%] bottom-0", side: "right", drift: "lp-agent-drift-c" },
  { pos: "left-[5%] bottom-2", side: "left", drift: "lp-agent-drift-a" },
];

/* The page's ambient loop (StepArt, the upload arrow). One agent holds the
   floor for exactly that long, so the hero breathes on the page's clock. */
const DWELL_MS = 2400;

/*
  Easing is written as one arbitrary `transition` shorthand per element rather
  than as a `duration` + `ease` utility pair. This is NOT a style preference:
  this project loads tailwindcss-animate, which registers a competing `ease`
  matchUtilities, so an arbitrary `ease` utility holding var(--ease) is reported
  ambiguous and compiles to NOTHING — the easing silently disappears. (An
  arbitrary `duration` utility is fine; both the core and the plugin rule emit.
  Only the `ease` family is poisoned.) Verified against this repo's installed
  plugin — please do not "clean these up" back into a utility pair.
*/
const SWELL = "[transition:color_500ms_var(--ease),transform_500ms_var(--ease)] motion-reduce:transition-none";
const FADE = "[transition:opacity_500ms_var(--ease)] motion-reduce:transition-none";
const TINT =
  "[transition:color_500ms_var(--ease),background-color_500ms_var(--ease),border-color_500ms_var(--ease)] motion-reduce:transition-none";

/* Lazily reads the real preference on the FIRST render, so a reduced-motion
   visitor never sees a frame of animation before an effect corrects it. The
   `change` listener picks up a live OS toggle without a reload. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return reduced;
}

/* Three bars on a 0.9s beat — the tempo the in-app guide's equaliser already
   speaks at. SVG <animate>, the same technique as the page's own illustrations,
   so this component adds no keyframes of its own. It is the one thing allowed
   to move faster than the page, because it depicts a voice rather than
   decorating a layout. SMIL ignores prefers-reduced-motion, so the children are
   gated in JS instead. */
function VoiceMeter({ animated }: { animated: boolean }) {
  const bars: [number, number][] = [
    [1, 4],
    [5.5, 7],
    [10, 5],
  ];
  return (
    <svg viewBox="0 0 14 12" className="size-3.5" fill="currentColor" aria-hidden="true">
      {bars.map(([x, h], i) => (
        <rect key={x} x={x} y={12 - h} width="3" height={h} rx="1.5">
          {animated && (
            <>
              <animate
                attributeName="height"
                values={`${h};${h + 4};${h}`}
                dur="0.9s"
                begin={`${i * 0.15}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                values={`${12 - h};${8 - h};${12 - h}`}
                dur="0.9s"
                begin={`${i * 0.15}s`}
                repeatCount="indefinite"
              />
            </>
          )}
        </rect>
      ))}
    </svg>
  );
}

/* The app's own guide-cursor silhouette (src/components/guide/GuidePointer.tsx)
   re-cut in ink — we keep its shape and drop its brand pink, which `.lp`
   forbids. Both states are drawn and cross-faded so a handover is a swell
   rather than a cut. The filled state carries a cream keyline so the glyph
   survives wherever it lands; that keyline replaces the drop-shadow this would
   otherwise want, because only three elements on this page carry a shadow and
   all three are overlay surfaces. Right-hand stations mirror about the glyph's
   own centre, so the box stays put and only the arrow flips. */
function Arrow({ speaking, mirrored }: { speaking: boolean; mirrored: boolean }) {
  const d = "M3 2 L3 27 L9.5 21.2 L14.2 32 L18.6 30.1 L14 19.6 L22.5 19.6 Z";
  return (
    <svg
      width="20"
      height="24"
      viewBox="0 0 30 36"
      className={cn("block shrink-0 overflow-visible", mirrored && "scale-x-[-1]")}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        className={cn(FADE, speaking ? "opacity-0" : "opacity-100")}
      />
      <path
        d={d}
        fill="currentColor"
        stroke="var(--cream)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        className={cn(FADE, speaking ? "opacity-100" : "opacity-0")}
      />
    </svg>
  );
}

function Cursor({
  agent,
  speaking,
  reduced,
  side = "left",
  inline = false,
}: {
  agent: Agent;
  speaking: boolean;
  reduced: boolean;
  side?: "left" | "right";
  inline?: boolean;
}) {
  const Icon = agent.icon;
  /* A cursor always opens away from the edge it is anchored to, so a chip can
     never grow towards the viewport edge and force a horizontal scroll. */
  const mirrored = !inline && side === "right";

  return (
    <span
      className={cn(
        "select-none",
        SWELL,
        inline ? "flex max-w-[calc(100vw-3rem)] items-center gap-2" : mirrored ? "flex flex-col items-end" : "flex flex-col items-start",
        speaking ? "text-[var(--ink)]" : "text-[var(--muted-2)]",
        !inline && speaking && !reduced ? "-translate-y-[2px]" : "translate-y-0",
      )}
    >
      <Arrow speaking={speaking} mirrored={mirrored} />
      <span
        className={cn(
          "flex min-w-[104px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-medium leading-none",
          TINT,
          !inline && (mirrored ? "-mt-1 mr-[13px]" : "-mt-1 ml-[13px]"),
          /* No opacity on resting text. Fading 11px type is how restrained
             designs become illegible ones: #5c5c5c on #f5f3ee is ~6:1, and
             dropping it to 70% would take it to ~3.1:1, under AA. */
          speaking
            ? "border-transparent bg-[var(--ink)] text-[var(--on-ink)]"
            : "border-[var(--hair)] bg-[var(--cream-alt)] text-[var(--muted-2)]",
        )}
      >
        {/* One 14px slot: the mode's mark at rest, its voice when it speaks.
            Same footprint either way, so the chip never changes width between
            states and `min-w-[104px]` keeps the longest and shortest names in
            the same box — a handover cannot reflow or jitter anything. */}
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <Icon className={cn("absolute size-3.5", FADE, speaking ? "opacity-0" : "opacity-100")} />
          <span className={cn("absolute inline-flex", FADE, speaking ? "opacity-100" : "opacity-0")}>
            <VoiceMeter animated={speaking && !reduced} />
          </span>
        </span>
        {agent.name}
      </span>
    </span>
  );
}

/*
  Wraps the hero copy (headline, subhead, CTA row) so the stations are measured
  against that box rather than against the viewport.
*/
export default function AgentCursors({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(true);
  const hostRef = useRef<HTMLDivElement>(null);

  /* Nobody is served by a timer ticking behind a scrolled-past hero or a
     backgrounded tab — on a marketing page people leave open, that is just
     battery. Off-screen and hidden-tab are tracked separately and ANDed. */
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let onScreen = true;
    let visible = typeof document === "undefined" || document.visibilityState === "visible";
    const sync = () => setRunning(onScreen && visible);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        ([entry]) => {
          onScreen = entry.isIntersecting;
          sync();
        },
        { rootMargin: "120px" },
      );
      io.observe(el);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (reduced || !running) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % AGENTS.length), DWELL_MS);
    return () => window.clearInterval(id);
  }, [reduced, running]);

  return (
    <div ref={hostRef} className={cn("relative md:pb-16", className)}>
      {/*
        Below md there is no room to scatter — a 360px phone has 318px of copy
        and zero lateral clearance beside a 45.5px serif headline. The scatter
        collapses to ONE cursor in normal flow, in the band the deleted badge
        pill left above the headline, handing off in place. Its height is
        reserved so a name change can never move the h1 by a pixel, and because
        it is in flow rather than absolutely positioned there is no negative
        offset that could collide with the fixed nav, and no absolutely
        positioned element below md at all — horizontal scroll is structurally
        impossible rather than merely unlikely.
      */}
      <div aria-hidden="true" className="pointer-events-none mb-5 flex h-9 items-center justify-center md:hidden">
        <span className="lp-agent-drift-a inline-flex">
          <span key={active} className="fade-in inline-flex">
            <Cursor agent={AGENTS[active]} speaking reduced={reduced} inline />
          </span>
        </span>
      </div>

      {children}

      {/* md and up: all four, in the two bands that stay empty at every width. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-16 bottom-0 hidden md:block">
        {AGENTS.map((agent, i) => (
          <span key={agent.name} className={cn("absolute", STATIONS[i].pos, STATIONS[i].drift)}>
            <Cursor agent={agent} speaking={i === active} reduced={reduced} side={STATIONS[i].side} />
          </span>
        ))}
      </div>

      {/* The roster, once, as capability rather than as fake live status — no
          aria-live, because announcing a name every 2.4s would be pure noise. */}
      <p className="sr-only">
        AnotherNotes studies your notes four ways: Full study teaches topic by topic and explains every answer, Speed run
        drills you with flashcards against the clock, Mentor mode reads your notes aloud and quizzes you on them, and
        Game zone turns them into games.
      </p>
    </div>
  );
}
