import { Component, type ErrorInfo, type ReactNode } from "react";
import { trackError } from "@/lib/analytics";

/*
  The last line of defence: a page that throws while rendering used to leave a blank
  screen. Now the error is recorded (lib/analytics) and the person gets a way out.
*/
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    trackError(error, { componentStack: info.componentStack?.slice(0, 1500), boundary: true });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold">Something went wrong on this page</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            It has been reported so it can be fixed. Reloading usually gets you going again.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Reload
            </button>
            <a
              href="/dashboard"
              className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
            >
              Go to the dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
