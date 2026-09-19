import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Quiet inline loader: a thin ring and a short line of muted text.
 * Used inside the section that is loading — never as a full-page takeover.
 */
export function LoadingSpinner({ message = "Loading…", size = "md", className }: LoadingSpinnerProps) {
  const ring = size === "sm" ? "size-4 border" : size === "lg" ? "size-6 border-2" : "size-5 border-2";
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center justify-center gap-2.5 py-8 text-sm text-muted-foreground", className)}>
      <span className={cn("inline-block animate-spin rounded-full border-muted border-t-foreground", ring)} />
      {message && <span>{message}</span>}
    </div>
  );
}
