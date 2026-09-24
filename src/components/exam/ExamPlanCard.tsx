import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { SITTING_LABEL, dayFor, dayNumber, daysBehind, daysBetween, examCountdown, shortDate, studyDays } from "@/lib/examPlan";

/*
  The exam plans on the dashboard: the nearest exam first, what today asks of
  them, and whether they've slipped. Nothing shows when no exam is coming.
*/

export function ExamPlanCard() {
  const plans = useAppStore((s) => s.examPlans);
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const upcoming = useMemo(
    () =>
      Object.values(plans)
        .filter((p) => daysBetween(today, p.examDate) >= 0)
        .sort((a, b) => a.examDate.localeCompare(b.examDate)),
    [plans, today],
  );

  if (!upcoming.length) return null;

  return (
    <section aria-label="Exam plans" className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Coming up</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {upcoming.slice(0, 4).map((plan) => {
          const day = dayFor(plan, today);
          const number = dayNumber(plan, today);
          const total = studyDays(plan).length;
          const behind = daysBehind(plan, today).length;
          const left = daysBetween(today, plan.examDate);
          return (
            <Link
              key={plan.sessionId}
              to={`/dashboard/${plan.sessionId}/full-study`}
              className={cn(
                "group flex flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/30",
                left <= 1 ? "border-primary/60" : behind ? "border-amber-500/50" : "border-border",
              )}
            >
              <div className="flex items-center gap-2">
                <CalendarClock className={cn("size-4 shrink-0", left <= 1 ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate text-sm font-semibold">{plan.label || plan.sessionTitle}</span>
                <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>

              <p className="text-xs text-muted-foreground">
                {examCountdown(plan, today)} · {shortDate(plan.examDate)}
                {number ? ` · day ${number} of ${total}` : ""}
              </p>

              {day ? (
                day.done ? (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                    <Check className="size-3.5" />
                    Today's study is done
                  </p>
                ) : (
                  <p className="line-clamp-2 text-xs text-foreground">
                    Today:{" "}
                    {day.sittings
                      .map((s) => (s.mode === "wrong" && plan.wrongCount ? `${SITTING_LABEL.wrong} (${plan.wrongCount})` : SITTING_LABEL[s.mode]))
                      .join(" · ")}
                    {day.topics.length ? ` — ${day.topics.length} ${day.topics.length === 1 ? "section" : "sections"}` : ""}
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">{left === 0 ? "Good luck today." : "Nothing scheduled today."}</p>
              )}

              {behind > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {behind === 1 ? "1 day missed" : `${behind} days missed`} — open it to redo the plan
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
