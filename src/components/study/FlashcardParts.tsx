import { useLayoutEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { ChevronLeft, Layers, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Flashcard } from "@/services/api";
import { cn } from "@/lib/utils";

/*
  The pieces a deck of flashcards is drawn with, shared by one section's deck
  (SectionFlashcards) and the whole session's (SessionFlashcardsDialog): the stage a
  deck stands on, the card itself with its flip, the row under it, and what shows
  while cards are on their way or when they didn't come.

  Every state of a deck is drawn on the same stage, one fixed size (.fc-stage in
  index.css): the line over the card, the card's box and the row of buttons, always
  all three. A card of three letters, one of three hundred words, cards on their way,
  a deck that didn't come and the last card's Finish all take exactly the same room,
  so the dialog or the Teach mode board holding the deck never changes size, and never
  jumps, from one card to the next.
*/

/** The smallest a card's words get before its face scrolls instead (px; the app's root is 14px). */
const FIT_MIN = 12;

/**
 * Fit a face's words to its box: a pixel smaller at a time, from the face's own size
 * down to FIT_MIN, and past that the face scrolls (see .fc-face-body). Measured before
 * the card is painted, again when its width changes (the dialog or the board resized),
 * and once the web fonts are in, since those decide where the words wrap.
 */
function useFitText(ref: RefObject<HTMLElement>, max: number, text: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = 0; // a new card starts at its top, not where the last one was scrolled to
    const fit = () => {
      if (!el.isConnected) return;
      let size = max;
      el.style.fontSize = `${size}px`;
      while (size > FIT_MIN && el.scrollHeight > el.clientHeight) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    // Its outer width only: its own scrollbar coming and going must not set it off again.
    let width = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth === width) return;
      width = el.offsetWidth;
      fit();
    });
    ro.observe(el);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) fit();
    });
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [ref, max, text]);
}

/**
 * The box every state of a deck is drawn in: a line over the card (which card of how
 * many), the card's own box, and the row of buttons under it. Its height is fixed in
 * index.css, and the dialogs and the board are sized from it.
 */
export function FlashcardStage({
  compact = false,
  meta,
  nav,
  children,
}: {
  /** The shorter stage, for the Teach mode board. */
  compact?: boolean;
  /** Over the card: "Card 2 of 8", and the section on the session's deck. Empty is fine. */
  meta?: ReactNode;
  /** Under it: always a FlashcardNav, so the row is there in every state. */
  nav: ReactNode;
  /** The card, or what stands in for it (FlashcardsLoading, FlashcardsMissing). */
  children: ReactNode;
}) {
  return (
    <div className={cn("fc-stage", compact && "fc-stage-compact")}>
      <div
        className={cn(
          "flex h-4 shrink-0 items-center justify-between gap-3 whitespace-nowrap text-xs tabular-nums text-muted-foreground",
          compact ? "mb-2" : "mb-3",
        )}
      >
        {meta}
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
      {nav}
    </div>
  );
}

/** One card. Tap to flip: a real 3D flip, two faces on one rotating card (see .fc-* in index.css). */
export function FlashcardCard({
  card,
  flipped,
  onFlip,
  compact = false,
  label = "Recall",
}: {
  card: Flashcard;
  flipped: boolean;
  onFlip: () => void;
  /** Smaller words, for the Teach mode board. */
  compact?: boolean;
  /** The small line over the question: "Recall", or the section a card comes from. */
  label?: string;
}) {
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  // Each face on its own: a short question can keep its size while a long answer shrinks.
  // Their full sizes are the card's usual ones (text-lg and 15px, on the board text-base
  // and text-sm, at the app's 14px root).
  useFitText(front, compact ? 14 : 16, card.front);
  useFitText(back, compact ? 13 : 15,`${card.back}\n${card.hint ?? ""}`);

  // A long face is scrolled with the same pointer that flips the card. A press that
  // scrolled it, dragged, or landed on its scrollbar wasn't a tap, so it doesn't flip.
  const press = useRef<{ x: number; y: number; body: HTMLElement | null; top: number; bar: boolean } | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    const body = e.target instanceof Element ? e.target.closest<HTMLElement>(".fc-face-body") : null;
    const r = body?.getBoundingClientRect();
    press.current = {
      x: e.clientX,
      y: e.clientY,
      body,
      top: body?.scrollTop ?? 0,
      bar: !!body && !!r && e.clientX > r.left + body.clientLeft + body.clientWidth,
    };
  };
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    const p = press.current;
    press.current = null;
    // Enter or Space (detail 0) always flips.
    const scrolled =
      e.detail !== 0 &&
      !!p &&
      (p.bar || Math.abs(e.clientX - p.x) > 6 || Math.abs(e.clientY - p.y) > 6 || (!!p.body && p.body.scrollTop !== p.top));
    if (!scrolled) onFlip();
  };

  // The label, the words and the "tap" line each carry the side padding, so a face that
  // scrolls has its scrollbar at the card's edge rather than in the middle of the margin.
  const pad = compact ? "px-4" : "px-6";
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={onClick}
      aria-label={flipped ? "Show question" : "Reveal answer"}
      aria-pressed={flipped}
      className="fc-scene block size-full text-center"
    >
      <div className={cn("fc-card", flipped && "fc-flipped")}>
        <div className={cn("fc-face rounded-2xl border border-border bg-muted/40", compact ? "py-3" : "py-4")}>
          <p className={cn("w-full shrink-0 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground", pad)} title={label}>
            {label}
          </p>
          <div ref={front} className={cn("fc-face-body my-2 font-medium leading-snug", pad)}>
            <p className="my-auto">{card.front}</p>
          </div>
          <p className={cn("shrink-0 text-xs text-muted-foreground", pad)}>Tap to flip</p>
        </div>
        <div className={cn("fc-face fc-back rounded-2xl border border-chart-1/30 bg-chart-1/5", compact ? "py-3" : "py-4")}>
          <div ref={back} className={cn("fc-face-body mb-2 leading-relaxed", pad)}>
            <div className="my-auto">
              <p>{card.back}</p>
              {card.hint && <p className="mt-3 text-xs text-muted-foreground">Hint: {card.hint}</p>}
            </div>
          </div>
          <p className={cn("shrink-0 text-[11px] uppercase tracking-[0.12em] text-muted-foreground", pad)}>Tap to flip back</p>
        </div>
      </div>
    </button>
  );
}

/**
 * Under the card: Back · New cards · whatever goes forward (Next, Finish, Start over).
 * There in every state, buttons that don't apply just disabled, so the row never goes.
 */
export function FlashcardNav({
  compact = false,
  canBack,
  onBack,
  onRenew,
  renewing,
  canRenew = true,
  renewLabel = "New cards",
  forward,
}: {
  compact?: boolean;
  canBack: boolean;
  onBack: () => void;
  /** Write this deck again (costs an AI call, so it's never automatic). */
  onRenew: () => void;
  renewing: boolean;
  /** False while there's no deck to replace (its own Try again asks for one). */
  canRenew?: boolean;
  renewLabel?: string;
  forward: ReactNode;
}) {
  return (
    <div className={cn("flex h-8 shrink-0 items-center justify-between gap-2", compact ? "mt-3" : "mt-4")}>
      <Button variant="ghost" size="sm" className="shrink-0" disabled={!canBack} onClick={onBack}>
        <ChevronLeft className="size-3.5" />
        Back
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 min-w-0 text-xs text-muted-foreground"
        onClick={onRenew}
        disabled={renewing || !canRenew}
        title={renewLabel}
      >
        {renewing ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
        <span className="truncate">{renewLabel}</span>
      </Button>
      <div className="flex shrink-0 items-center">{forward}</div>
    </div>
  );
}

/** Stands where the card goes, the card's size: while cards are on their way, or when they didn't come. */
function CardStandIn({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-border px-6 text-center [overflow-wrap:anywhere]">
      {children}
    </div>
  );
}

/** Cards on their way. */
export function FlashcardsLoading({ children }: { children: string }) {
  return (
    <CardStandIn>
      <Loader2 className="size-5 shrink-0 animate-spin text-chart-1" />
      <p className="line-clamp-3 max-w-sm text-sm text-muted-foreground" role="status" title={children}>
        {children}
      </p>
    </CardStandIn>
  );
}

/** No deck: say why, and offer it again when asking again could help. */
export function FlashcardsMissing({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <CardStandIn>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
        <Layers className="size-4 text-chart-1" />
      </span>
      <p className="line-clamp-3 max-w-sm text-sm text-muted-foreground" title={message}>
        {message}
      </p>
      {onRetry && (
        <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={onRetry}>
          <Layers className="size-3.5" />
          Try again
        </Button>
      )}
    </CardStandIn>
  );
}
