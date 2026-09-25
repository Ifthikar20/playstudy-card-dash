import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pdfPartKey, usePdfQuizStore } from "@/store/pdfQuizStore";
import type { PdfCheckpoint } from "@/lib/quiz/types";
import { PdfQuiz } from "./PdfQuiz";
import { StudyDialogShell } from "./StudyDialogShell";
import type { WrongEntry } from "./sections";

/*
  A PDF's quizzes, from the top Quiz button in PDF view and the Pages outline.

  A PDF has no sections, so its quiz goes by part: a run of pages with about 400 words
  of text (lib/pdf/checkpoints.ts), the same parts Teach mode stops at. The dialog
  opens on the part being read and starts its quiz; the head moves between parts and
  says how many are checked. "Next part" on a result goes on to the next one.

  Opening a part whose questions aren't written yet costs a call to the model, so
  only the part it opened on and "Next part" start at once. Paging through with the
  arrows or the picker starts a part the server already has questions for, and offers
  a Start button on the others.
*/
export interface PdfQuizDialogProps {
  sessionId: string;
  /** Every part of the PDF, in page order (pdfCheckpoints). */
  checkpoints: PdfCheckpoint[];
  /** The part to open on (the one being read); null closes the dialog. */
  target: PdfCheckpoint | null;
  onClose: () => void;
  onWrong?: (e: WrongEntry) => void;
  onRight?: (key: string) => void;
  /** A hint went up in the quiz (see PdfQuiz). */
  onHint?: (text: string) => void;
}

/** How the dialog came to a part: whether to start its quiz straight away. */
type Arrival = "opened" | "next" | "browsed";

export function PdfQuizDialog({ sessionId, checkpoints, target, onClose, onWrong, onRight, onHint }: PdfQuizDialogProps) {
  const n = checkpoints.length;
  const open = !!target;
  const [topicId, setTopicId] = useState<string | null>(null);
  const [arrival, setArrival] = useState<Arrival>("opened");
  // A fresh quiz for each opening, never one left over from before.
  const [round, setRound] = useState(0);

  // Opening (or asked for another part while open): start on the part asked for. What
  // was open stays on screen while the dialog fades out, rather than emptying first.
  const [seen, setSeen] = useState<{ open: boolean; target: PdfCheckpoint | null }>({ open: false, target: null });
  if (open !== seen.open || (target && target !== seen.target)) {
    setSeen({ open, target: target ?? seen.target });
    if (target) {
      setTopicId(target.topicId);
      setArrival("opened");
      setRound((r) => r + 1);
    }
  }

  const load = usePdfQuizStore((s) => s.load);
  useEffect(() => {
    if (open) void load(sessionId);
  }, [open, sessionId, load]);

  const parts = usePdfQuizStore((s) => s.parts);
  const partOf = (cp: PdfCheckpoint) => parts[pdfPartKey(sessionId, cp.topicId)];
  const checked = checkpoints.filter((cp) => partOf(cp)?.completed).length;

  const found = checkpoints.findIndex((cp) => cp.topicId === topicId);
  const at = found >= 0 ? found : 0;
  const cp = checkpoints[at] ?? null;
  const isLast = at >= n - 1;

  const go = (i: number, how: Arrival) => {
    const next = checkpoints[Math.max(0, Math.min(n - 1, i))];
    if (!next) return;
    setTopicId(next.topicId);
    setArrival(how);
  };

  /** "✓ 4/4" beside a part that's checked. */
  const tick = (c: PdfCheckpoint): string | null => {
    const p = partOf(c);
    if (!p?.completed) return null;
    const of = p.quiz?.questions.length ?? p.questionCount;
    return p.bestScore != null && of ? `✓ ${p.bestScore}/${of}` : "✓";
  };

  const autoStart = arrival !== "browsed" || (!!cp && partOf(cp)?.quizId != null);

  return (
    <StudyDialogShell
      open={open}
      onClose={onClose}
      kind="quiz"
      title={cp ? `Quiz · ${cp.title}` : "Quiz"}
      description={n > 0 ? `${checked} of ${n} part${n === 1 ? "" : "s"} checked` : "Questions on the pages you're reading."}
    >
      {n === 0 || !cp ? (
        <div className="flex flex-col items-center py-8 text-center">
          <FileQuestion className="size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Nothing to quiz yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            The questions are written from the PDF's text, and there's none I can read in it yet.
          </p>
        </div>
      ) : (
        <div className="min-w-0">
          {n > 1 && (
            <div className="mb-4 flex items-center gap-1.5">
              <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label="Previous part" disabled={at === 0} onClick={() => go(at - 1, "browsed")}>
                <ChevronLeft className="size-4" />
              </Button>
              <Select value={cp.topicId} onValueChange={(v) => go(checkpoints.findIndex((c) => c.topicId === v), "browsed")}>
                <SelectTrigger className="h-8 min-w-0 flex-1 text-sm" aria-label="Part of the PDF">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {checkpoints.map((c) => (
                    <SelectItem key={c.topicId} value={c.topicId}>
                      {c.title}
                      {tick(c) && <span className="ml-2 text-xs tabular-nums text-success">{tick(c)}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label="Next part" disabled={isLast} onClick={() => go(at + 1, "browsed")}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
          <PdfQuiz
            key={`${round}:${cp.topicId}`}
            sessionId={sessionId}
            checkpoint={cp}
            autoStart={autoStart}
            continueLabel={isLast ? "Close" : "Next part"}
            onDone={isLast ? onClose : () => go(at + 1, "next")}
            onWrong={onWrong}
            onRight={onRight}
            onHint={onHint}
          />
        </div>
      )}
    </StudyDialogShell>
  );
}
