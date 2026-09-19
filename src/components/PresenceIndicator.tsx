import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { formatDuration, usePresenceStore, IDLE_AFTER_MS } from "@/store/presenceStore";
import { cn } from "@/lib/utils";

/*
  Presence indicator — sits in the sidebar footer, just above the user menu.

  A single status dot (green while interacting, red once idle or when the
  tab is hidden) beside a quiet, minute-granular timer: "Active · 15 min".
  Hovering reveals the reading / writing split and when the streak began.
  In the icon-collapsed rail only the dot remains.
*/

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function PresenceIndicator() {
  const { status, activeSeconds, readingSeconds, writingSeconds, streakStartedAt, lastActivityAt, tracking } =
    usePresenceStore();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  // Re-render every 30s so the "away since" copy stays fresh without a per-second render.
  const [, bump] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => bump((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!tracking) return null;

  const active = status === "active";
  const label = active ? "Active" : "Away";
  const duration = formatDuration(activeSeconds);

  const dot = (
    <span className="relative flex size-2 shrink-0" aria-hidden>
      {active && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-[presence-ping_2.4s_ease-out_infinite]" />
      )}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full transition-colors duration-500",
          active ? "bg-success" : "bg-destructive",
        )}
      />
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="status"
          aria-label={`${label}: ${duration} of interaction today`}
          className={cn(
            "flex h-8 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent",
            collapsed && "w-8 justify-center px-0",
          )}
        >
          {dot}
          {!collapsed && (
            <span className="truncate tabular-nums">
              <span className={cn("font-medium", active ? "text-sidebar-foreground" : "text-destructive")}>{label}</span>
              <span className="mx-1 opacity-60">·</span>
              {duration}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" align="end" className="max-w-56 text-xs leading-relaxed">
        <p className="font-semibold">{active ? "You're active" : "You've stepped away"}</p>
        <p className="mt-1 tabular-nums">
          Reading {formatDuration(readingSeconds)}
          <span className="mx-1 opacity-60">·</span>
          Writing {formatDuration(writingSeconds)}
        </p>
        <p className="mt-1 opacity-80">
          {active && streakStartedAt
            ? `Interacting since ${clock(streakStartedAt)}`
            : lastActivityAt
              ? `Last input ${clock(lastActivityAt)} · pauses after ${IDLE_AFTER_MS / 1000}s of silence`
              : "Move the mouse or type to start the timer"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
