import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Lightbulb, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Something worth reading while AnotherNotes writes notes.

  Shows a live stage + progress bar (time-based: the API is one long call) and a
  card of facts that changes every few seconds — facts about the student's own
  material when the backend has them, general learning-science facts otherwise.
  Tap the card for the next one.
*/

export const STUDY_FACTS = [
  "Testing yourself beats rereading: pulling an answer from memory strengthens it far more than looking at it again.",
  "Spreading the same study time over several days produces much better recall a week later than one long session.",
  "Sleep is part of studying. Memories are consolidated overnight, so learning before sleep sticks better.",
  "Explaining an idea in your own words exposes the gaps in your understanding faster than highlighting ever will.",
  "Mixing topics in one sitting feels harder, but it trains you to pick the right method when it matters.",
  "Getting an answer wrong and then seeing the correction often leaves a stronger memory than getting it right first time.",
  "Curiosity primes memory: wondering about a question first makes the answer easier to remember.",
  "Short breaks every 25 to 50 minutes keep attention from fading; the breaks matter more than the timer.",
  "Teaching someone else is one of the strongest ways to learn, and even pretending to teach helps.",
  "Writing notes by hand tends to push you to summarise, which is where the learning actually happens.",
];

const DEFAULT_STAGES = [
  "Reading your material",
  "Finding the key sections",
  "Writing readable notes",
  "Writing the first quiz questions",
  "Almost there",
];

export function LoadingFacts({
  facts = [],
  subject,
  stages = DEFAULT_STAGES,
  expectedMs = 45_000,
  startedAt,
  compact = false,
  className,
}: {
  /** Facts about this specific material (shown first when present). */
  facts?: string[];
  subject?: string | null;
  stages?: string[];
  /** Typical duration; the bar eases towards ~95% by then and completes when the caller unmounts it. */
  expectedMs?: number;
  startedAt?: number;
  /** One rotating line instead of the full card. */
  compact?: boolean;
  className?: string;
}) {
  const started = useRef(startedAt ?? Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0); // bumping this restarts the rotation timer after a manual "next"

  const all = useMemo(() => {
    const own = facts.map((f) => f.trim()).filter(Boolean);
    const general = STUDY_FACTS.filter((f) => !own.includes(f));
    return own.length ? [...own, ...general] : general;
  }, [facts]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => i + 1), compact ? 6000 : 7500);
    return () => window.clearInterval(id);
  }, [cycle, compact]);

  const elapsed = Math.max(0, now - started.current);
  const progress = Math.min(0.95, 1 - Math.exp(-elapsed / (expectedMs / 2.6)));
  const stage = stages[Math.min(stages.length - 1, Math.floor(progress * stages.length))];
  const fact = all[index % all.length] ?? "";
  const aboutMaterial = facts.includes(fact);
  const next = () => {
    setIndex((i) => i + 1);
    setCycle((c) => c + 1);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={next}
        title="Next fact"
        className={cn("flex w-full items-start gap-2 rounded-lg text-left text-xs text-muted-foreground transition-colors hover:text-foreground", className)}
      >
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-lime-600" />
        <span key={index} className="guide-pop leading-relaxed">
          <span className="font-semibold text-foreground/80">While you wait: </span>
          {fact}
        </span>
      </button>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <div className="flex items-center gap-3">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime-200 text-lime-900">
          <span className="absolute inset-0 animate-ping rounded-xl bg-lime-300/40" />
          <Sparkles className="relative size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{stage}…</p>
          <p className="truncate text-xs text-muted-foreground">
            {subject ? `Building your study session on “${subject}”` : "Building your study session"} · {Math.round(elapsed / 1000)}s
          </p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-400 transition-[width] duration-300"
          style={{ width: `${Math.max(3, progress * 100)}%` }}
        />
      </div>

      <button
        type="button"
        onClick={next}
        className="group mt-4 w-full rounded-xl bg-muted/50 p-3.5 text-left transition-colors hover:bg-muted"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="rounded bg-lime-200 px-1.5 py-0.5 font-display text-[15px] italic leading-none text-lime-950">
            {aboutMaterial ? "About your material" : "While you wait"}
          </span>
          <span className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100">
            Next <ChevronRight className="size-3" />
          </span>
        </div>
        <p key={index} className="guide-pop mt-2 text-[15px] leading-relaxed text-foreground">
          {fact}
        </p>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: Math.min(all.length, 8) }).map((_, d) => (
            <span key={d} className={cn("h-1 flex-1 rounded-full transition-colors", d === index % Math.min(all.length, 8) ? "bg-lime-500" : "bg-border")} />
          ))}
        </div>
      </button>
    </div>
  );
}
