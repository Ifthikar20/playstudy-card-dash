import { useMemo, useState } from "react";
import { CalendarClock, CalendarDays, Check, Loader2, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { saveExamPlan, setPlanDayDone } from "@/services/examPlans";
import {
  SITTING_LABEL,
  dayFor,
  dayNumber,
  daysBehind,
  examCountdown,
  relativeDay,
  shortDate,
  studyDays,
  todayIso,
  type PlanSitting,
} from "@/lib/examPlan";
import { ExamPlanDialog } from "./ExamPlanDialog";

/*
  The exam plan on the study page: what today is for, and whether they're keeping up.

  Without a plan it's one quiet line offering one — a student who isn't sitting an
  exam should barely notice it.
*/

export function ExamPlanStrip({
  sessionId,
  sessionTitle,
  sections,
  onOpenSection,
}: {
  sessionId: string;
  sessionTitle?: string;
  /** Every section of this session, so a plan's topic ids can be named. */
  sections: { dbId?: number; title: string }[];
  onOpenSection?: (dbId: number) => void;
}) {
  const plan = useAppStore((s) => s.examPlans[sessionId]) ?? null;
  const setExamPlan = useAppStore((s) => s.setExamPlan);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const titles = useMemo(() => {
    const map = new Map<number, string>();
    sections.forEach((s) => s.dbId != null && map.set(s.dbId, s.title));
    return map;
  }, [sections]);

  const today = todayIso();
  const day = plan ? dayFor(plan, today) : null;
  const behind = plan ? daysBehind(plan, today) : [];
  const number = plan ? dayNumber(plan, today) : null;
  const total = plan ? studyDays(plan).length : 0;

  const name = (id: number) => titles.get(id) ?? "a section";
  const sittingText = (s: PlanSitting) => {
    if (s.mode === "wrong") return plan?.wrongCount ? `${SITTING_LABEL.wrong} (${plan.wrongCount})` : SITTING_LABEL.wrong;
    if (!s.topics.length) return SITTING_LABEL[s.mode];
    const shown = s.topics.slice(0, 2).map(name).join(", ");
    const rest = s.topics.length > 2 ? ` +${s.topics.length - 2}` : "";
    return `${SITTING_LABEL[s.mode]}: ${shown}${rest}`;
  };

  const tick = async () => {
    if (!plan || !day || busy) return;
    setBusy(true);
    try {
      setExamPlan(await setPlanDayDone(sessionId, day.date, !day.done));
    } catch (e) {
      toast({ title: "Couldn't save that", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  /** Fallen behind: lay the days that are left out again, from today. */
  const reshuffle = async () => {
    if (!plan || busy) return;
    setBusy(true);
    try {
      setExamPlan(await saveExamPlan(sessionId, { examDate: plan.examDate, sittingsPerDay: plan.sittingsPerDay, label: plan.label }));
      toast({ title: "Plan redone from today", description: "Everything you haven't studied yet fits in the days you have left." });
    } catch (e) {
      toast({ title: "Couldn't redo the plan", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // One dialog for both states: swapping between two instances as the plan arrives
  // remounts it, and the new one opens itself on the `editing` flag.
  const dialog = (
    <ExamPlanDialog
      open={editing}
      onOpenChange={setEditing}
      sessionId={sessionId}
      sessionTitle={sessionTitle}
      existing={plan}
    />
  );

  if (!plan) {
    return (
      <>
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-2.5">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Studying this for an exam? Have it split day by day so you're through it in time.
          </p>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEditing(true)}>
            Plan it
          </Button>
        </div>
        {dialog}
      </>
    );
  }

  const examDay = day?.kind === "exam" || plan.examDate === today;

  return (
    <>
      <section
        className={cn(
          "mt-6 rounded-2xl border bg-card p-4",
          examDay ? "border-primary/60 bg-primary/[0.04]" : behind.length ? "border-amber-500/50" : "border-border",
        )}
        aria-label="Exam study plan"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CalendarClock className="size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {number ? `Day ${number} of ${total}` : examDay ? "Exam day" : "Off-plan day"}
              <span className="font-normal text-muted-foreground">
                {" · "}
                {examCountdown(plan, today)}
                {plan.label ? ` · ${plan.label}` : ""}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Exam {shortDate(plan.examDate)} · {plan.sittingsPerDay} {plan.sittingsPerDay === 1 ? "sitting" : "sittings"} a day
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} title="Change the date or how often you study">
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Button>
            {day && (
              <Button size="sm" variant={day.done ? "secondary" : "default"} onClick={tick} disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Check className="mr-1.5 size-3.5" />}
                {day.done ? "Done today" : "Mark today done"}
              </Button>
            )}
          </div>
        </div>

        {day && day.sittings.length > 0 && (
          <ol className="mt-3 flex flex-wrap gap-2">
            {day.sittings.map((sitting, i) => (
              <li key={`${sitting.mode}-${i}`}>
                <button
                  type="button"
                  disabled={!onOpenSection || !sitting.topics.length}
                  onClick={() => sitting.topics[0] != null && onOpenSection?.(sitting.topics[0])}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    day.done ? "border-border text-muted-foreground line-through" : "border-border hover:border-primary hover:text-primary",
                    (!onOpenSection || !sitting.topics.length) && "cursor-default hover:border-border hover:text-inherit",
                  )}
                >
                  <span className="mr-1 font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                  {sittingText(sitting)}
                </button>
              </li>
            ))}
          </ol>
        )}

        {!day && !examDay && (
          <p className="mt-3 text-xs text-muted-foreground">
            Nothing scheduled for today — your plan runs {relativeDay(studyDays(plan)[0]?.date ?? plan.examDate)} to{" "}
            {shortDate(plan.examDate)}.
          </p>
        )}

        {behind.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-amber-500/10 px-3 py-2">
            <p className="text-xs text-amber-900 dark:text-amber-200">
              {behind.length === 1 ? "One day went by" : `${behind.length} days went by`} without being ticked off. Redo the
              plan and the rest still fits.
            </p>
            <Button size="sm" variant="outline" className="ml-auto h-7" onClick={reshuffle} disabled={busy}>
              <RefreshCw className={cn("mr-1.5 size-3.5", busy && "animate-spin")} />
              Redo from today
            </Button>
          </div>
        )}
      </section>

      {dialog}
    </>
  );
}
