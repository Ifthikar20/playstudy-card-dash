import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudySession, Topic } from "@/store/appStore";
import { generateSectionFlashcards, type Flashcard } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { FlashcardCard, FlashcardNav, FlashcardStage, FlashcardsLoading, FlashcardsMissing } from "./FlashcardParts";

/* --------------------------------------------------------------------------
   Flashcards — a quick memory check for a section. Tap a card to flip; step
   through the deck. Cards are written from the section's notes on demand.

   It opens straight to the cards: whatever opened it (the exam plan, the
   board) was the click that asked for them. The whole session's deck is
   SessionFlashcardsDialog, drawn with the same pieces (FlashcardParts).
-------------------------------------------------------------------------- */
export function SectionFlashcards({
  session,
  topic,
  compact = false,
  onClose,
}: {
  session: StudySession;
  topic: Topic;
  /** The shorter stage and smaller words, for the Teach mode board. */
  compact?: boolean;
  /** "Finish" on the last card. Without it, the last card offers to start over. */
  onClose?: () => void;
}) {
  const { toast } = useToast();
  // Already loading on the first frame, so it never flashes an empty deck.
  const [loading, setLoading] = useState(!!topic.db_id);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const load = async (force = false) => {
    if (!topic.db_id) return;
    setLoading(true);
    try {
      const cs = await generateSectionFlashcards(session.id, topic.db_id, { count: 8, force });
      if (!cs.length) throw new Error("No flashcards came back.");
      setCards(cs);
      setIdx(0);
      setFlipped(false);
    } catch (e) {
      // New cards that didn't come keep the deck already out.
      toast({ title: "Couldn't make flashcards", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Once only, even through StrictMode's double mount, so it never asks the backend twice.
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (delta: number) => {
    setFlipped(false);
    setIdx((i) => Math.min(cards.length - 1, Math.max(0, i + delta)));
  };

  const card = cards[idx];
  const last = idx === cards.length - 1;

  // One stage for every state (see FlashcardParts): the card, or what stands in for it
  // while the first cards come or when they didn't, with the row of buttons under it.
  return (
    <FlashcardStage
      compact={compact}
      meta={card && `Card ${idx + 1} of ${cards.length}`}
      nav={
        <FlashcardNav
          compact={compact}
          canBack={!!card && idx > 0}
          onBack={() => go(-1)}
          onRenew={() => load(true)}
          renewing={loading}
          canRenew={!!card}
          forward={
            !card || !last ? (
              <Button size="sm" disabled={!card} onClick={() => go(1)}>
                Next
                <ChevronRight className="size-3.5" />
              </Button>
            ) : onClose ? (
              <Button size="sm" variant="outline" onClick={onClose}>
                Finish
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => go(-idx)}>
                Start over
              </Button>
            )
          }
        />
      }
    >
      {card ? (
        <FlashcardCard key={card.id} card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} compact={compact} />
      ) : loading ? (
        <FlashcardsLoading>Making flashcards from this section…</FlashcardsLoading>
      ) : (
        // No deck: the first one didn't come (say so, and offer it again), or there are no notes to draw from.
        <FlashcardsMissing
          message={topic.db_id ? "The flashcards didn't come through." : "Flashcards need this section's notes first."}
          onRetry={topic.db_id ? () => load(false) : undefined}
        />
      )}
    </FlashcardStage>
  );
}
