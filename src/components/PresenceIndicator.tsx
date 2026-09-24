import { useEffect, useState } from "react";
import { SidebarMenuButton, SidebarTooltip } from "@/components/ui/sidebar";
import { formatDuration, usePresenceStore, IDLE_AFTER_MS } from "@/store/presenceStore";
import { cn } from "@/lib/utils";

/*
  Presence indicator — the first row of the sidebar's utility shelf, just above
  the theme and help rows and the account menu.

  A single status dot (green while interacting, red once idle or when the
  tab is hidden) beside a quiet, minute-granular timer: "Active · 15 min".
  Hovering — or tabbing to it, it is a real button now — reveals the reading /
  writing split and when the streak began. In the icon-collapsed rail only the
  dot remains; that is the same row, with its label hidden by the rail's CSS.

  It is a 28px menu row like its neighbours, in both states, with the dot in the
  16px icon slot, so the dot sits on the same x as every icon above it and does
  not move when the sidebar folds. Before tracking starts it still holds its row,
  so the shelf does not grow by one icon a moment after the page loads.
*/

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function PresenceIndicator() {
  const { status, activeSeconds, readingSeconds, writingSeconds, streakStartedAt, lastActivityAt, tracking } =
    usePresenceStore();

  // Re-render every 30s so the "away since" copy stays fresh without a per-second render.
  const [, bump] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => bump((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!tracking) return <div aria-hidden className="h-8" />;

  const active = status === "active";
  const label = active ? "Active" : "Away";
  const duration = formatDuration(activeSeconds);

  return (
    <SidebarTooltip
      always
      tooltip={{
        side: "right",
        align: "end",
        className: "max-w-56 text-xs leading-relaxed",
        children: (
          <>
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
          </>
        ),
      }}
    >
      <SidebarMenuButton
        type="button"
        aria-label={`${label}: ${duration} of interaction today`}
        className="cursor-default text-xs text-muted-foreground"
      >
        <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden>
          {active && (
            <span className="absolute inline-flex size-2 rounded-full bg-success opacity-60 animate-[presence-ping_2.4s_ease-out_infinite]" />
          )}
          <span
            className={cn(
              "relative inline-flex size-2 rounded-full transition-colors duration-500",
              active ? "bg-success" : "bg-destructive",
            )}
          />
        </span>
        <span className="truncate tabular-nums">
          <span className={cn("font-medium", active ? "text-sidebar-foreground" : "text-destructive")}>{label}</span>
          <span className="mx-1 opacity-60">·</span>
          {duration}
        </span>
      </SidebarMenuButton>
    </SidebarTooltip>
  );
}
