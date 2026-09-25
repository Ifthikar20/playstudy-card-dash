import type { ReactNode } from "react";
import { Layers, ListChecks } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/*
  The frame every study dialog shares: a section's quiz or flashcards
  (SectionStudyDialog) and the whole session's (SessionQuizDialog,
  SessionFlashcardsDialog). One place for what Teach mode relies on:
  data-study-dialog on the content, so it leaves the keys alone in here (and the
  quiz's number keys switch on) and lowers its board under the dialog.

  A flashcards dialog is one fixed height (.fc-dialog in index.css), worked out from
  the deck's fixed stage, and its title and description keep to one line each, so the
  dialog never changes size or moves from one card to the next. A quiz dialog is as
  tall as its question, up to the screen's height.
*/
export function StudyDialogShell({
  open,
  onClose,
  kind,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Sets the icon beside the title, and the flashcards' fixed height. */
  kind: "quiz" | "flashcards";
  /** One line; a long one ends in "…" with the whole of it on hover. */
  title: string;
  description: string;
  /** More classes on the dialog: the session's deck adds room for its section chips. */
  className?: string;
  children: ReactNode;
}) {
  const cards = kind === "flashcards";
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        data-study-dialog=""
        className={cn("max-h-[calc(100dvh-2rem)] overflow-y-auto focus:outline-none sm:max-w-xl", cards && "fc-dialog", className)}
        // Focus the dialog itself, not its first button: that's the close ×, since the
        // quiz is still loading when it opens, and Enter there (meant for "next
        // question") would shut the dialog. The title is read out all the same.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (e.currentTarget instanceof HTMLElement) e.currentTarget.focus({ preventScroll: true });
        }}
      >
        <DialogHeader className="min-w-0 text-left">
          <DialogTitle className="flex min-w-0 items-center gap-2 pr-6">
            {kind === "quiz" ? <ListChecks className="size-4 shrink-0 text-chart-1" /> : <Layers className="size-4 shrink-0 text-chart-1" />}
            {/* The title's line is only as tall as its letters (leading-none), so cutting
                it short would clip the tails of g, y and p: the padding gives them room
                and the negative margin keeps the line's height, which the flashcards'
                fixed height is worked out from. */}
            <span className="-my-1 min-w-0 truncate py-1" title={title}>
              {title}
            </span>
          </DialogTitle>
          <DialogDescription className={cards ? "truncate" : undefined} title={cards ? description : undefined}>
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
