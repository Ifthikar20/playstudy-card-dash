import { useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, ListChecks, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudySession } from "@/store/appStore";
import { cn } from "@/lib/utils";
import { SectionQuiz } from "./SectionQuiz";
import { StudyDialogShell } from "./StudyDialogShell";
import type { Section, WrongEntry } from "./sections";

/*
  The whole session's quiz, from the Quiz button at the top of the page.

  It runs each section's quiz (SectionQuiz) in reading order, so nothing about a
  section's quiz changes: finishing one completes that section (ticks, "N sections
  to go", XP) exactly as it does anywhere else. It opens on the first section not
  done yet, Continue moves on to the next one, and it can be closed at any point:
  what was finished stays finished. With every section done it says so and offers
  "Review all", which goes through them again from the first (each opens on its
  result: review the answers, retry, or fresh questions).
*/
export interface SessionQuizDialogProps {
  session: StudySession;
  /** The sections that have study tools, in reading order. The page's own rule decides
   *  (a PDF page, or a note too short to quiz, has none); this never works it out again. */
  sections: Section[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWrong: (e: WrongEntry) => void;
  onRight: (key: string) => void;
  /** A hint went up in a section's quiz (see SectionQuiz). */
  onHint?: (text: string) => void;
}

export function SessionQuizDialog({ session, sections, open, onOpenChange, onWrong, onRight, onHint }: SessionQuizDialogProps) {
  const n = sections.length;
  const [pos, setPos] = useState(0);
  const [finished, setFinished] = useState(false);
  // Going through finished sections again, one after another, rather than only the open ones.
  const [reviewing, setReviewing] = useState(false);
  // A fresh quiz for each opening and each "Review all", never one left over from before.
  const [round, setRound] = useState(0);

  // Opening: start at the first section not done, or on "All sections done" when there's none.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const first = sections.findIndex((s) => !s.topic.completed);
      setPos(Math.max(0, first));
      setFinished(first < 0 && n > 0);
      setReviewing(false);
      setRound((r) => r + 1);
    }
  }

  const at = Math.min(pos, Math.max(0, n - 1));
  const current = sections[at];
  const doneCount = sections.filter((s) => s.topic.completed).length;
  const left = n - doneCount;

  // The next section to go to: the next one along when reviewing, else the next one not done.
  const moveOn = () => {
    const nextOpen = sections.findIndex((s, i) => i > at && (reviewing || !s.topic.completed));
    if (nextOpen >= 0) setPos(nextOpen);
    else setFinished(true);
  };
  const reviewAll = () => {
    setReviewing(true);
    setPos(0);
    setFinished(false);
    setRound((r) => r + 1);
  };
  const takeRemaining = () => {
    const first = sections.findIndex((s) => !s.topic.completed);
    setReviewing(false);
    setPos(Math.max(0, first));
    setFinished(false);
  };

  const onFinishPanel = finished || !current;

  return (
    <StudyDialogShell
      open={open}
      onClose={() => onOpenChange(false)}
      kind="quiz"
      title={onFinishPanel ? `Quiz · ${session.title}` : `Section ${at + 1} of ${n} · ${current.topic.title}`}
      description={
        onFinishPanel
          ? "Every section's quiz, one after another."
          : "Every section's quiz in turn. Close any time: what you finish stays done."
      }
    >
      {/* Where they are in the session: one mark per section, ticked once it's done. */}
      {n > 1 && (
        <div className="flex gap-1" aria-hidden="true">
          {sections.map((s, i) => (
            <span
              key={s.topic.id}
              className={cn(
                "h-1 min-w-0 flex-1 rounded-full",
                !onFinishPanel && i === at ? "bg-chart-1" : s.topic.completed ? "bg-success/60" : "bg-muted",
              )}
            />
          ))}
        </div>
      )}

      {n === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <ListChecks className="size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Nothing to quiz yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">A quiz is written from a section's notes, so it comes once there are notes to ask about.</p>
        </div>
      ) : onFinishPanel ? (
        <div className="flex flex-col items-center py-6 text-center">
          {left === 0 ? <CheckCircle2 className="size-8 text-success" /> : <ListChecks className="size-8 text-chart-1" />}
          <p className="mt-3 text-base font-semibold">
            {left === 0 ? "All sections done" : `${left} section${left === 1 ? "" : "s"} still to quiz`}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {left === 0
              ? `Every quiz in ${session.title} is finished.`
              : "You skipped past these. Take them now, or come back to them later."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {left > 0 && (
              <Button size="sm" onClick={takeRemaining}>
                Take them now
                <ArrowRight className="size-3.5" />
              </Button>
            )}
            {doneCount > 0 && (
              <Button size="sm" variant={left === 0 ? "default" : "outline"} onClick={reviewAll}>
                <RotateCcw className="size-3.5" />
                Review all
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          <SectionQuiz
            key={`${round}:${current.topic.id}`}
            session={session}
            topic={current.topic}
            onWrong={onWrong}
            onRight={onRight}
            onHint={onHint}
            onDone={moveOn}
          />
          {/* Moving about without finishing: a section skipped stays to do. */}
          <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-3">
            <Button size="sm" variant="ghost" disabled={at === 0} onClick={() => setPos(at - 1)}>
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>
            <Button size="sm" variant="ghost" onClick={moveOn}>
              {current.topic.completed ? (at === n - 1 ? "Finish" : "Next section") : "Skip section"}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </StudyDialogShell>
  );
}
