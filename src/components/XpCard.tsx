import { useState } from "react";
import { Clock, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { XP_RULES, XP_RULE_LABELS, formatStudyTime, studyXp } from "@/lib/xp";
import { cn } from "@/lib/utils";

/*
  XP card — the total, the read time behind it, and a "how it works" dialog with
  the exact rules. There are no levels and no tokens: XP is time studied plus
  progress made, and the split bar shows which half of it came from where.
*/
export function XpCard({ xp, studySeconds = 0, className }: { xp: number; studySeconds?: number; className?: string }) {
  const [open, setOpen] = useState(false);

  const total = Math.max(0, Math.round(xp || 0));
  const fromTime = Math.min(total, studyXp(studySeconds));
  const fromProgress = Math.max(0, total - fromTime);
  const timeShare = total ? (fromTime / total) * 100 : 0;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-3xl leading-none tabular-nums">{total.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">XP earned</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="inline-flex items-baseline gap-1.5 text-lg font-semibold leading-none tabular-nums">
            <Clock className="size-3.5 translate-y-px text-muted-foreground" />
            {formatStudyTime(studySeconds)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">read time</p>
        </div>
      </div>

      {/* How the total splits: reading on the left, progress on the right. An
          empty track when there's nothing yet — a full bar at 0 XP would read
          as "done". */}
      {total > 0 ? (
        <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-muted" title={`${fromTime.toLocaleString()} XP from reading · ${fromProgress.toLocaleString()} XP from progress`}>
          <div className="h-full bg-chart-1 transition-[width] duration-700" style={{ width: `${timeShare}%` }} />
          <div className="h-full flex-1 bg-chart-2/70 transition-[width] duration-700" />
        </div>
      ) : (
        <div className="mt-4 h-1.5 rounded-full bg-muted" />
      )}
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate tabular-nums">
          <span className="text-chart-1">{fromTime.toLocaleString()}</span> reading ·{" "}
          <span className="text-foreground">{fromProgress.toLocaleString()}</span> progress
        </span>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center gap-1 underline-offset-4 hover:text-foreground hover:underline">
          <HelpCircle className="size-3.5" />
          How XP works
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How experience works</DialogTitle>
            <DialogDescription>XP is the only score in AnotherNotes. Every point comes from one of these.</DialogDescription>
          </DialogHeader>
          <dl className="divide-y divide-border rounded-lg border border-border">
            {XP_RULE_LABELS.map((r) => (
              <div key={r.key} className="flex items-baseline justify-between gap-4 px-3 py-2.5 text-sm">
                <dt>
                  <span className="font-medium">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">{r.hint}</span>
                </dt>
                <dd className="shrink-0 font-semibold tabular-nums text-chart-1">+{XP_RULES[r.key]}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            Read time is measured, not guessed: the clock only runs while you're on a study page and actually reading or
            answering, and it stops when you switch away. So far that's {formatStudyTime(studySeconds)}, worth{" "}
            {fromTime.toLocaleString()} XP of your {total.toLocaleString()}.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
