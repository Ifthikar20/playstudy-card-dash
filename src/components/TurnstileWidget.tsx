/**
 * Cloudflare Turnstile widget.
 *
 * Loads the Turnstile script on demand — only the auth page needs it — renders
 * the widget explicitly, and reports the token up through `onChange`.
 *
 * Two behaviours here are easy to get wrong, and both look to a user like a
 * broken login rather than a broken CAPTCHA:
 *
 *   1. A token is single-use and expires after ~300s. After a failed sign-in
 *      the parent must call reset(), or the retry is rejected server-side with
 *      "timeout-or-duplicate" — and the user sees a correct password
 *      apparently being refused.
 *
 *   2. A configuration fault — wrong sitekey, or a hostname that isn't on the
 *      widget's allowlist — must not leave the form permanently disabled. One
 *      typo'd key would otherwise take the whole login page down. Those cases
 *      release the form and let the backend decide; it fails open on the same
 *      class of error. Genuine challenge failures still retry in the widget.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** True when a sitekey is configured at build time; the gate is inert without one. */
export const TURNSTILE_CONFIGURED = Boolean(SITE_KEY);

/**
 * Faults in the sitekey itself rather than anything the visitor did, so
 * retrying cannot help. Note these are not a single numeric family — an
 * invalid sitekey reports 400020 while an unlisted hostname reports 110200.
 * Deliberately excludes 200500 (iframe load) and the 600* family (challenge
 * failed / bot suspected), both of which Cloudflare documents as retryable.
 */
const CONFIG_ERROR_CODES = new Set(["110100", "110110", "110200", "400020", "400070"]);

/**
 * Backstop for INITIALISATION only - script load plus first render. It is
 * cancelled the moment the widget renders, because from then on the widget is
 * alive and an interactive challenge legitimately waits on the human. Letting
 * this timer run past render was a bug: it declared failure while the visitor
 * was still looking at an unsolved "Verify you are human" checkbox.
 */
const INIT_TIMEOUT_MS = 8000;

export interface TurnstileStatus {
  /** The token to send with the auth request, or null if we don't have one. */
  token: string | null;
  /** True while Turnstile is still working and the form should wait. */
  pending: boolean;
}

export interface TurnstileHandle {
  /** Discard the spent token and issue a fresh one. Call after a failed submit. */
  reset: () => void;
}

interface TurnstileWidgetProps {
  /** Action name recorded with the challenge, e.g. "login" or "register". */
  action: string;
  onChange: (status: TurnstileStatus) => void;
  className?: string;
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // let a later mount try again
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(
  ({ action, onChange, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    // Held in a ref so a new inline callback from the parent doesn't tear down
    // and re-render the widget on every keystroke.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const [fault, setFault] = useState<"config" | "incomplete" | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
            onChangeRef.current({ token: null, pending: true });
          }
        },
      }),
      []
    );

    useEffect(() => {
      if (!SITE_KEY) {
        console.warn("[Turnstile] VITE_TURNSTILE_SITE_KEY is not set — skipping the bot check");
        onChangeRef.current({ token: null, pending: false });
        return;
      }

      let cancelled = false;
      // A new action means a new challenge; drop any token from the old one.
      onChangeRef.current({ token: null, pending: true });

      /**
       * Stop blocking the form. Note this does NOT mean the sign-in will
       * succeed: the server rejects a request with no token outright, because
       * accepting one would let any bot skip the check by omitting the field.
       * Releasing only buys the user a clear error instead of a dead button.
       */
      const release = (kind: "config" | "incomplete", reason: string) => {
        if (cancelled) return;
        console.warn(`[Turnstile] ${reason} — releasing the form`);
        setFault(kind);
        onChangeRef.current({ token: null, pending: false });
      };

      const timer = window.setTimeout(
        () => release("incomplete", `no response within ${INIT_TIMEOUT_MS}ms`),
        INIT_TIMEOUT_MS
      );

      loadTurnstileScript()
        .then(() => {
          if (cancelled || !containerRef.current || !window.turnstile) return;

          const widgetId = window.turnstile.render(containerRef.current, {
            sitekey: SITE_KEY,
            action,
            // The auth page is the fixed cream/ink editorial design, not themed.
            theme: "light",
            callback: (token: string) => {
              if (cancelled) return;
              window.clearTimeout(timer);
              setFault(null);
              onChangeRef.current({ token, pending: false });
            },
            "error-callback": (code?: string) => {
              // Release on EVERY error, transient included. Cloudflare retries
              // internally and a later success re-enables the form via the
              // success callback - but if it never recovers, a disabled button
              // with no way forward is the worst possible outcome. Releasing
              // gets the visitor a clear server-side error and a Try again.
              window.clearTimeout(timer);
              release(
                CONFIG_ERROR_CODES.has(code ?? "") ? "config" : "incomplete",
                `error ${code ?? "(unknown)"}`
              );
            },
            "expired-callback": () => {
              if (cancelled) return;
              onChangeRef.current({ token: null, pending: true });
              if (widgetIdRef.current && window.turnstile) {
                window.turnstile.reset(widgetIdRef.current);
              }
            },
          });

          widgetIdRef.current = widgetId;
          // Rendered successfully: the widget owns the outcome from here, and a
          // visitor solving a checkbox may take far longer than the init budget.
          window.clearTimeout(timer);
        })
        .catch(() => {
          window.clearTimeout(timer);
          release("incomplete", "script could not be loaded");
        });

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, [action]);

    if (!SITE_KEY) return null;

    return (
      <div className={className}>
        <div ref={containerRef} />
        {fault === "config" && (
          <p className="mt-2 text-[12px] text-[var(--muted-2)]">
            Bot check is misconfigured — contact support if sign-in fails.
          </p>
        )}
        {fault === "incomplete" && (
          <p className="mt-2 text-center text-[12px] text-[var(--muted-2)]">
            Bot check didn't complete.{" "}
            <button
              type="button"
              onClick={() => {
                if (widgetIdRef.current && window.turnstile) {
                  setFault(null);
                  onChangeRef.current({ token: null, pending: true });
                  window.turnstile.reset(widgetIdRef.current);
                } else {
                  window.location.reload();
                }
              }}
              className="font-medium text-[var(--ink)] underline underline-offset-2"
            >
              Try again
            </button>
          </p>
        )}
      </div>
    );
  }
);

TurnstileWidget.displayName = "TurnstileWidget";

export default TurnstileWidget;

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "error-callback"?: (code?: string) => void;
          "expired-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}
