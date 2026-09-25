import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { fetchChildAnswers, parentalKeys, ScopeNotGrantedError } from "@/services/parental";
import { cn } from "@/lib/utils";

/**
 * Answers & notes — deliberately not "Transcripts".
 *
 * What the data supports is which questions were answered and, for the ones
 * that went wrong, the question, the right answer, the explanation and (for
 * answers logged since it was kept) what the child picked or typed. What it
 * does not support is anything they asked the AI (those conversations are
 * never persisted). Naming the tab honestly beats promising a transcript that
 * does not exist.
 */

/** "Pages 3–5" / "Page 3", for a question asked on a PDF. */
const pagesLabel = (r: { first: number; last: number }) => (r.first === r.last ? `Page ${r.first}` : `Pages ${r.first}–${r.last}`);
export function AnswerTimeline({ childId }: { childId: string }) {
  const [onlyWrong, setOnlyWrong] = useState(true);
  const { data, isLoading, error } = useQuery({
    queryKey: parentalKeys.childAnswers(childId, onlyWrong ? false : undefined),
    queryFn: () => fetchChildAnswers(childId, { limit: 50, correct: onlyWrong ? false : undefined }),
    retry: false,
  });

  if (error instanceof ScopeNotGrantedError) {
    return (
      <EmptyState
        title="Not shared with you"
        body="This learner has their own account, so you can see their progress but not their written work."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const answers = data?.answers ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {onlyWrong ? "Questions they found hard." : "Everything they've answered."}
        </p>
        <Button variant="outline" size="sm" onClick={() => setOnlyWrong((v) => !v)}>
          {onlyWrong ? "Show all" : "Only mistakes"}
        </Button>
      </div>

      {answers.length === 0 ? (
        <EmptyState
          title={onlyWrong ? "No mistakes yet" : "Nothing answered yet"}
          body={
            onlyWrong
              ? "When they get a question wrong, it'll show up here with the right answer and why."
              : "Answers appear here once they start a study session."
          }
        />
      ) : (
        <ul className="space-y-3">
          {answers.map((a) => {
            // In words for every kind; single choice from older servers only has the index.
            const answer = a.answerText ?? (a.options && a.correctAnswer !== null ? a.options[a.correctAnswer] : null);
            return (
              <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                      a.correct ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {a.correct ? <Check className="size-3" /> : <X className="size-3" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">
                      {a.questionText ?? <span className="text-muted-foreground">Question no longer available</span>}
                    </p>

                    {!a.correct && a.pickedText && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        They answered: <span className="text-foreground">{a.pickedText}</span>
                      </p>
                    )}
                    {!a.correct && answer && (
                      <p className={cn("text-xs text-muted-foreground", a.pickedText ? "mt-0.5" : "mt-1.5")}>
                        Answer: <span className="font-medium text-foreground">{answer}</span>
                      </p>
                    )}
                    {!a.correct && a.explanation && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{a.explanation}</p>
                    )}

                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-muted-foreground">
                      {a.topicTitle && <span>{a.topicTitle}</span>}
                      {a.pageRange && <span>{a.topicTitle ? "· " : ""}{pagesLabel(a.pageRange)}</span>}
                      {a.sessionTitle && <span>· {a.sessionTitle}</span>}
                      <span>· {format(new Date(a.at), "d MMM, HH:mm")}</span>
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data?.nextCursor && (
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Showing the most recent {answers.length}.
        </p>
      )}
    </div>
  );
}
