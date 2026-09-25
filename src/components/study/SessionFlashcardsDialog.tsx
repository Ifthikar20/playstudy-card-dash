import { useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudySession } from "@/store/appStore";
import { generateSectionFlashcards, type Flashcard } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FlashcardCard, FlashcardNav, FlashcardStage, FlashcardsLoading, FlashcardsMissing } from "./FlashcardParts";
import { StudyDialogShell } from "./StudyDialogShell";
import type { Section } from "./sections";

/*
  The whole session's flashcards, from the Flashcards button at the top of the page:
  one deck, section after section, each card marked with the section it comes from.

  Cards are fetched a section at a time, never all at once: asking for a section's
  cards can mean the AI writing them, and most students won't get through every
  section in one go. The first section loads when the deck opens; the next one is
  fetched while the student is still three cards from the end of what's loaded, so
  it's usually there by the time they reach it. The row of section chips jumps
  anywhere (loading that section if it isn't yet). What's loaded stays loaded for
  the rest of the visit, closing and opening again included.

  Sections are numbered by their place in this deck (the sections with study tools),
  everywhere: the chips, the card's label and "Section k of n" all agree.
*/

type Deck =
  | { status: "loading" }
  | { status: "ready"; cards: Flashcard[]; renewing?: boolean }
  | { status: "failed"; message: string };

/** How close to the end of the loaded cards the next section is fetched. */
const PREFETCH_WITHIN = 3;
/** A card position meaning "the section's last card", whenever its cards come. */
const LAST = -1;

export interface SessionFlashcardsDialogProps {
  session: StudySession;
  /** The sections that have study tools, in reading order (the page's own rule). */
  sections: Section[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionFlashcardsDialog({ session, sections, open, onOpenChange }: SessionFlashcardsDialogProps) {
  const { toast } = useToast();
  const n = sections.length;
  // Decks by section (database id), for this session only.
  const [decks, setDecks] = useState<Record<string, Deck>>({});
  // Where the student is: which section, which of its cards.
  const [at, setAt] = useState({ s: 0, c: 0 });
  const atRef = useRef(at);
  atRef.current = at;
  const [flipped, setFlipped] = useState(false);

  // Another session on the same page starts a new deck.
  const [forSession, setForSession] = useState(session.id);
  if (forSession !== session.id) {
    setForSession(session.id);
    setDecks({});
    setAt({ s: 0, c: 0 });
    setFlipped(false);
  }

  const deckKey = (si: number) => `${session.id}:${sections[si]?.topic.db_id ?? ""}`;
  const deckAt = (si: number): Deck | undefined => decks[deckKey(si)];
  const cardsAt = (si: number): Flashcard[] => {
    const d = deckAt(si);
    return d?.status === "ready" ? d.cards : [];
  };

  // One request per section at a time, even through StrictMode's double effects.
  const inFlight = useRef(new Set<string>());
  const load = (si: number, force = false) => {
    const dbId = sections[si]?.topic.db_id;
    if (!dbId) return;
    const key = deckKey(si);
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setDecks((d) => {
      const had = d[key];
      return { ...d, [key]: force && had?.status === "ready" ? { ...had, renewing: true } : { status: "loading" } };
    });
    generateSectionFlashcards(session.id, dbId, { count: 8, force })
      .then((cards) => {
        if (!cards.length) throw new Error("No flashcards came back.");
        setDecks((d) => ({ ...d, [key]: { status: "ready", cards } }));
        // New cards for the section being looked at start it from its first card. The
        // student may have moved on while they were written: leave that card as it is.
        if (force && atRef.current.s === si) {
          setAt({ s: si, c: 0 });
          setFlipped(false);
        }
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "The flashcards didn't come through.";
        setDecks((d) => {
          const had = d[key];
          // New cards that didn't come keep the deck already out.
          if (force && had?.status === "ready") return { ...d, [key]: { ...had, renewing: false } };
          return { ...d, [key]: { status: "failed", message } };
        });
        if (force) toast({ title: "Couldn't make flashcards", description: message, variant: "destructive" });
      })
      .finally(() => inFlight.current.delete(key));
  };

  const s = Math.min(at.s, Math.max(0, n - 1));
  const deck = deckAt(s);
  const cards = cardsAt(s);
  const c = at.c === LAST ? Math.max(0, cards.length - 1) : Math.min(at.c, Math.max(0, cards.length - 1));
  const card = cards[c];
  const section = sections[s];

  // Opening: the section being looked at (the first, on the first opening) loads if it hasn't.
  useEffect(() => {
    if (open && n > 0 && !deckAt(s)) load(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, n]);

  // A few cards from the end of what's loaded, fetch the next section not asked for yet.
  useEffect(() => {
    if (!open || deck?.status !== "ready") return;
    let ahead = cards.length - 1 - c;
    let next = s + 1;
    while (next < n && deckAt(next)?.status === "ready") {
      ahead += cardsAt(next).length;
      next += 1;
    }
    // Never on its own after a failure (deckAt is "failed", not empty): Try again asks.
    if (ahead <= PREFETCH_WITHIN && next < n && !deckAt(next)) load(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, s, c, decks, n]);

  const goTo = (si: number, ci: number) => {
    setFlipped(false);
    setAt({ s: si, c: ci });
    if (!deckAt(si)) load(si);
  };
  const forward = () => {
    if (c < cards.length - 1) goTo(s, c + 1);
    else if (s < n - 1) goTo(s + 1, 0);
  };
  const back = () => {
    if (c > 0) goTo(s, c - 1);
    // Back into the section before: its last card, once its cards are there if they aren't yet.
    else if (s > 0) goTo(s - 1, LAST);
  };

  // Keep the section being looked at in view in the chip row (sideways only: the dialog
  // itself mustn't jump while the student is reading a card).
  const chipsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.children[s];
    if (!row || !(chip instanceof HTMLElement)) return;
    const r = row.getBoundingClientRect();
    const k = chip.getBoundingClientRect();
    if (k.left < r.left) row.scrollLeft -= r.left - k.left + 8;
    else if (k.right > r.right) row.scrollLeft += k.right - r.right + 8;
  }, [s, open]);

  const lastCard = !!card && s === n - 1 && c === cards.length - 1;
  const canForward = (!!card && c < cards.length - 1) || s < n - 1;
  const title = section?.topic.title ?? "this section";

  return (
    <StudyDialogShell
      open={open}
      onClose={() => onOpenChange(false)}
      kind="flashcards"
      // Room for the row of section chips over the stage (see .fc-dialog in index.css).
      className={n > 1 ? "fc-dialog-chips" : undefined}
      title={`Flashcards · ${session.title}`}
      description="One deck from every section. Tap a card to flip it."
    >
      <div className="min-w-0">
        {/* Jump to any section; its cards load if they haven't. One row that scrolls sideways, never wraps. */}
        {n > 1 && (
          <div ref={chipsRef} className="fc-chips -mx-1 mb-3 px-1" role="group" aria-label="Sections">
            {sections.map((sec, i) => {
              const d = deckAt(i);
              return (
                <button
                  key={sec.topic.id}
                  type="button"
                  onClick={() => goTo(i, 0)}
                  aria-current={i === s ? "true" : undefined}
                  title={`${i + 1}. ${sec.topic.title}`}
                  className={cn(
                    "flex h-8 max-w-[11rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors",
                    i === s
                      ? "border-chart-1/50 bg-chart-1/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {d?.status === "loading" && <Loader2 className="size-3 shrink-0 animate-spin" />}
                  <span className="tabular-nums">{i + 1}.</span>
                  <span className="min-w-0 truncate">{sec.topic.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Every state on the one stage (see FlashcardParts), so the dialog keeps its size card to card. */}
        <FlashcardStage
          meta={
            n > 0 && (
              <>
                <span>{card ? `Card ${c + 1} of ${cards.length}` : ""}</span>
                <span>
                  Section {s + 1} of {n}
                </span>
              </>
            )
          }
          nav={
            <FlashcardNav
              canBack={s > 0 || (!!card && c > 0)}
              onBack={back}
              onRenew={() => load(s, true)}
              renewing={deck?.status === "ready" && deck.renewing === true}
              canRenew={!!card}
              renewLabel="New cards for this section"
              forward={
                lastCard ? (
                  <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                    Finish
                  </Button>
                ) : (
                  // With no cards here (on their way, or they didn't come) it still moves on to the next section.
                  <Button size="sm" disabled={!canForward} onClick={forward}>
                    Next
                    <ChevronRight className="size-3.5" />
                  </Button>
                )
              }
            />
          }
        >
          {n === 0 ? (
            <FlashcardsMissing message="Flashcards are written from a section's notes, so they come once there are notes to draw from." />
          ) : !deck || deck.status === "loading" ? (
            <FlashcardsLoading>{`Making flashcards from ${title}…`}</FlashcardsLoading>
          ) : deck.status === "failed" || !card ? (
            <FlashcardsMissing message={`The flashcards for ${title} didn't come through.`} onRetry={() => load(s)} />
          ) : (
            <FlashcardCard key={`${s}:${card.id}`} card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} label={`${s + 1}. ${title}`} />
          )}
        </FlashcardStage>
      </div>
    </StudyDialogShell>
  );
}
