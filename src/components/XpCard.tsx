import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { XP_RULES, XP_RULE_LABELS, levelProgress, xpForLevel } from "@/lib/xp";
import { cn } from "@/lib/utils";

/*
  XP card — level, progress to the next level, and a "how it works" dialog
  that shows the exact rules. There are no tokens or credits: XP is the only
  currency, and it is always explained.
*/
export function XpCard({ xp, className }: { xp: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const p = levelProgress(xp);

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-3xl leading-none">
          Level {p.level}
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">{Math.round(xp).toLocaleString()} XP</p>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-chart-1 transition-[width] duration-700" style={{ width: `${Math.max(2, p.ratio * 100)}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{p.remaining.toLocaleString()} XP to level {p.nextLevel}</span>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline">
          <HelpCircle className="size-3.5" />
          How XP works
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How experience works</DialogTitle>
            <DialogDescription>XP is the only score in PlayStudy. Every point comes from one of these.</DialogDescription>
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
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Levels</p>
            <p className="mt-1">
              Each level costs 100 XP more than the one before. Reaching level {p.level + 1} takes{" "}
              {xpForLevel(p.level + 1).toLocaleString()} XP in total; you have {Math.round(xp).toLocaleString()}.
            </p>
            <p className="mt-2 tabular-nums">
              {[2, 3, 5, 10, 20].map((l) => `L${l} · ${xpForLevel(l).toLocaleString()}`).join("   ")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
