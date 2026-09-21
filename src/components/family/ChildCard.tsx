import { Link } from "react-router-dom";
import { ChevronRight, Flame } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChildSummary } from "@/services/parental";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ChildCard({ child }: { child: ChildSummary }) {
  const { stats, guardianship } = child;
  // A claimed account is someone who already had their own; saying so keeps
  // the difference in what a guardian can do from being a surprise later.
  const claimed = guardianship.origin === "claimed";

  return (
    <Link
      to={`/dashboard/family/${child.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <Avatar className="size-11 shrink-0">
        <AvatarFallback className="text-sm font-semibold">{initials(child.name)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{child.name}</p>
          {stats.streakDays > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
              <Flame className="size-3" />
              {stats.streakDays}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {claimed ? "Has their own account" : `Signs in as ${child.username}`}
        </p>
      </div>

      <dl className="hidden shrink-0 gap-6 sm:flex">
        <div className="text-right">
          <dd className="font-display text-lg leading-none tabular-nums">{stats.totalStudyTime}</dd>
          <dt className="mt-1 text-[0.7rem] text-muted-foreground">studied</dt>
        </div>
        <div className="text-right">
          <dd className="font-display text-lg leading-none tabular-nums">{stats.questionsAnswered}</dd>
          <dt className="mt-1 text-[0.7rem] text-muted-foreground">answered</dt>
        </div>
        <div className="text-right">
          <dd className="font-display text-lg leading-none tabular-nums">{stats.averageAccuracy}%</dd>
          <dt className="mt-1 text-[0.7rem] text-muted-foreground">accuracy</dt>
        </div>
      </dl>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
