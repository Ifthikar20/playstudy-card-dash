import { useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, differenceInCalendarDays, format, startOfWeek, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchActivityDays, type ActivityDayRow } from "@/services/activity";
import { cn } from "@/lib/utils";

/*
  Streak — a contribution-style heatmap of measured interaction time.
  One square per day, seven rows (Sun–Sat), a window of weeks you can page
  through, and "N day streak" / longest streak from the server. A day lights
  up only when the presence tracker recorded real reading or writing time.
*/

const WEEKS = 18; // columns visible at once
const CELL = 10; // px
const GAP = 3; // px
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 0 = nothing, 1–4 = under 15 min · under 45 · under 90 · 90+ */
function level(activeSeconds: number): 0 | 1 | 2 | 3 | 4 {
  const m = activeSeconds / 60;
  if (m <= 0) return 0;
  if (m < 15) return 1;
  if (m < 45) return 2;
  if (m < 90) return 3;
  return 4;
}

const LEVEL_CLASS: Record<number, string> = {
  0: "bg-muted",
  1: "bg-chart-1/25",
  2: "bg-chart-1/50",
  3: "bg-chart-1/75",
  4: "bg-chart-1",
};

function fmtMinutes(seconds: number) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function StreakCard({ className }: { className?: string }) {
  const [data, setData] = useState<{ days: ActivityDayRow[]; currentStreak: number; longestStreak: number } | null>(null);
  const [offsetWeeks, setOffsetWeeks] = useState(0); // 0 = window ends this week

  useEffect(() => {
    fetchActivityDays(400).then((d) => setData(d ?? { days: [], currentStreak: 0, longestStreak: 0 }));
  }, []);

  const byDay = useMemo(() => new Map((data?.days ?? []).map((d) => [d.day, d])), [data]);

  // window: WEEKS columns ending at the current week (shifted by offset)
  const end = startOfWeek(subWeeks(new Date(), offsetWeeks)); // Sunday of the last visible week
  const start = subWeeks(end, WEEKS - 1);
  const columns = Array.from({ length: WEEKS }, (_, i) => addWeeks(start, i));
  const today = new Date();

  // month labels: first column whose Sunday falls in a new month
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  columns.forEach((c, i) => {
    if (c.getMonth() !== lastMonth) {
      monthLabels.push({ col: i, label: format(c, "MMM") });
      lastMonth = c.getMonth();
    }
  });

  const canGoForward = offsetWeeks > 0;
  const gridWidth = WEEKS * CELL + (WEEKS - 1) * GAP;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      {data === null ? (
        <div className="space-y-3">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xl font-semibold tracking-tight">
              {data.currentStreak} day{data.currentStreak === 1 ? "" : "s"} streak
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Longest <span className="mx-1 opacity-50">|</span> {data.longestStreak} day{data.longestStreak === 1 ? "" : "s"}
            </p>
          </div>

          {/* months + paging */}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffsetWeeks((o) => o + 8)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Earlier"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <div className="relative h-4 flex-1 text-[10px] text-muted-foreground" style={{ marginLeft: 28 }}>
              {monthLabels.map((m) => (
                <span key={`${m.label}-${m.col}`} className="absolute" style={{ left: m.col * (CELL + GAP) }}>
                  {m.label}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOffsetWeeks((o) => Math.max(0, o - 8))}
              disabled={!canGoForward}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              aria-label="Later"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          {/* grid */}
          <div className="mt-1 flex gap-2 overflow-x-auto">
            <div className="flex shrink-0 flex-col" style={{ gap: GAP }}>
              {DAY_LABELS.map((d) => (
                <span key={d} className="text-[10px] leading-none text-muted-foreground" style={{ height: CELL, lineHeight: `${CELL}px`, width: 20 }}>
                  {d}
                </span>
              ))}
            </div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${WEEKS}, ${CELL}px)`, gridAutoRows: `${CELL}px`, gap: GAP, width: gridWidth }}>
              {DAY_LABELS.map((_, row) =>
                columns.map((weekStart, col) => {
                  const day = addDays(weekStart, row);
                  const key = format(day, "yyyy-MM-dd");
                  const rec = byDay.get(key);
                  const future = differenceInCalendarDays(day, today) > 0;
                  const lv = future ? 0 : level(rec?.active ?? 0);
                  const isToday = differenceInCalendarDays(day, today) === 0;
                  const cell = (
                    <span
                      className={cn(
                        "block rounded-[2px]",
                        future ? "bg-muted/40" : LEVEL_CLASS[lv],
                        isToday && "ring-1 ring-foreground/40",
                      )}
                      style={{ width: CELL, height: CELL, gridColumn: col + 1, gridRow: row + 1 }}
                    />
                  );
                  return future ? (
                    <span key={key} style={{ gridColumn: col + 1, gridRow: row + 1 }}>{cell}</span>
                  ) : (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <span style={{ gridColumn: col + 1, gridRow: row + 1 }}>{cell}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p className="font-semibold">{format(day, "EEE, MMM d")}</p>
                        <p>
                          {rec ? `${fmtMinutes(rec.active)} studying` : "No activity"}
                          {rec?.answers ? ` · ${rec.answers} answered` : ""}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }),
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>Less</span>
            {[1, 2, 3, 4].map((l) => (
              <span key={l} className={cn("inline-block rounded-[2px]", LEVEL_CLASS[l])} style={{ width: CELL, height: CELL }} />
            ))}
            <span>More</span>
            <span className="ml-auto">15 · 45 · 90 min</span>
          </div>
        </>
      )}
    </div>
  );
}
