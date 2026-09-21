import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatItem {
  value: string | number;
  label: string;
}

/**
 * The serif-numeral stat rail. Lifted out of the dashboard so a guardian
 * looking at a child sees exactly the same treatment of the same numbers.
 */
export function StatRail({ items, loading, className }: { items: StatItem[]; loading?: boolean; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      {loading ? (
        <div className="space-y-4">
          {items.map((s) => (
            <Skeleton key={s.label} className="h-8 w-32" />
          ))}
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 xl:grid-cols-1">
          {items.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2.5">
              <dt className="font-display text-[30px] leading-none tabular-nums">{s.value}</dt>
              <dd className="text-sm text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
