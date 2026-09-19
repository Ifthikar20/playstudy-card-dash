import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Empty state that names the action which produces data.
 * Product rule (from the reference): never render sample figures — say there
 * is no data yet and point at the action.
 */
interface EmptyStateProps {
  title: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
  icon?: ReactNode;
  /** `panel` adds a dashed hairline frame; `plain` is for use inside a card */
  variant?: "panel" | "plain";
  className?: string;
}

export function EmptyState({ title, body, ctaLabel, onCta, icon, variant = "panel", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        variant === "panel" && "rounded-2xl border border-dashed border-border bg-card",
        className,
      )}
    >
      {icon && <div className="mb-1 text-muted-foreground [&>svg]:size-6">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {body && <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{body}</p>}
      {ctaLabel && onCta && (
        <Button size="sm" className="mt-2" onClick={onCta}>
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
