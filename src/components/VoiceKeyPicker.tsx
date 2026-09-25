import { useEffect, useRef, useState } from "react";
import { Check, Keyboard, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  VOICE_KEY_PRESETS,
  isMac,
  matchesVoiceKey,
  sameVoiceKey,
  voiceKeyFromEvent,
  voiceKeyLabel,
  voiceKeyWarning,
  type VoiceKey,
} from "@/lib/voiceKey";

/*
  Choosing the key that opens the tutor's microphone: three ready-made choices, or
  "press your own" which records the next keypress (modifiers included).

  Used on the last onboarding screen and again in Profile → Settings, which live in
  two different worlds — the editorial cream pages and the app's own theme — so the
  colours come from `tone` rather than being baked in.
*/

const TONES = {
  editorial: {
    card: "border-[var(--hair)] bg-[var(--cream-alt)] hover:border-[var(--ink)]",
    on: "border-[var(--ink)] bg-[var(--ink)] text-[var(--on-ink)]",
    kbd: "border-[var(--hair)] bg-white",
    muted: "text-[var(--muted-2)]",
    warn: "text-[#a13a31]",
  },
  app: {
    card: "border-border bg-muted/40 hover:border-foreground/40",
    on: "border-foreground bg-foreground text-background",
    kbd: "border-border bg-background",
    muted: "text-muted-foreground",
    warn: "text-destructive",
  },
} as const;

export function VoiceKeyPicker({
  value,
  onChange,
  tone = "app",
  className,
}: {
  value: VoiceKey;
  onChange: (key: VoiceKey) => void;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const t = TONES[tone];
  const [recording, setRecording] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const recordRef = useRef<HTMLButtonElement>(null);

  // While recording, every key belongs to us: no typing into the page, no browser
  // shortcut. Escape is the way out (so it can never become the talk key itself).
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        setRecording(false);
        setProblem(null);
        return;
      }
      const result = voiceKeyFromEvent(e);
      if ("key" in result) {
        setRecording(false);
        setProblem(null);
        onChange(result.key);
      } else if (result.error) {
        setProblem(result.error);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, onChange]);

  const warning = problem ?? voiceKeyWarning(value);
  const custom = !VOICE_KEY_PRESETS.some((p) => sameVoiceKey(p.key, value));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid gap-2 sm:grid-cols-3">
        {VOICE_KEY_PRESETS.map((preset) => {
          const on = sameVoiceKey(preset.key, value);
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setProblem(null);
                setRecording(false);
                onChange(preset.key);
              }}
              className={cn(
                "flex flex-col gap-2 rounded-xl border px-3.5 py-3 text-left transition-colors",
                on ? t.on : t.card,
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <kbd
                  className={cn(
                    "rounded-md border px-2 py-1 font-mono text-[13px] font-semibold",
                    on ? "border-white/30 bg-white/15 text-inherit" : t.kbd,
                  )}
                >
                  {preset.label}
                </kbd>
                {on && <Check className="size-4 shrink-0" />}
              </span>
              <span className="text-[12px] leading-snug opacity-80">{preset.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          ref={recordRef}
          type="button"
          onClick={() => {
            setProblem(null);
            setRecording((r) => !r);
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors",
            recording ? t.on : t.card,
          )}
          aria-pressed={recording}
        >
          <Keyboard className="size-4" />
          {recording ? "Press any key…" : custom ? "Press a different key" : "Press your own key"}
        </button>
        <p className={cn("text-[13px]", t.muted)}>
          {recording ? (
            <>Hold any modifiers you want, then the key. Escape cancels.</>
          ) : (
            <>
              Yours is{" "}
              <kbd className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[12px] font-semibold", t.kbd)}>
                {voiceKeyLabel(value)}
              </kbd>
            </>
          )}
        </p>
      </div>

      {warning && <p className={cn("text-[12px]", t.warn)}>{warning}</p>}
      {isMac() && (
        // Asked for often, and it genuinely cannot work: macOS keeps fn for itself.
        <p className={cn("text-[12px]", t.muted)}>The fn key never reaches a web page, so it can't be used here.</p>
      )}
    </div>
  );
}

/*
  "Try it": press the chosen key and see it work, before ever opening a lesson.
  It lights up the way the mic does in Teach mode, so the student learns what the
  key does, not just which key it is. Paused while the picker above is recording a
  new key (that keypress belongs to the recorder).
*/
export function VoiceKeyTester({
  value,
  tone = "app",
  className,
}: {
  value: VoiceKey;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const t = TONES[tone];
  const [heard, setHeard] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !matchesVoiceKey(e, value)) return;
      // Typing into a field (Settings has some) is typing, never a test: an "m" there
      // must stay an "m".
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      // A recorder that is listening takes the key first (it stops propagation), so
      // reaching here means this press was a test. Keep it from typing anywhere.
      e.preventDefault();
      setHeard(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setHeard(false), 2600);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer.current);
    };
  }, [value]);

  return (
    <div
      className={cn("flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors", t.card, className)}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border transition-all",
          heard ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_0_6px_rgba(16,185,129,0.18)]" : t.kbd,
        )}
        aria-hidden
      >
        {heard ? <Check className="size-4" /> : <Mic className="size-4" />}
      </span>
      <p className="text-[13px] leading-snug">
        {heard ? (
          <>That's it — in a lesson, your tutor stops and listens when you press it.</>
        ) : (
          <>
            <span className="font-semibold">Try it:</span> press{" "}
            <kbd className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[12px] font-semibold", t.kbd)}>
              {voiceKeyLabel(value)}
            </kbd>{" "}
            now.
          </>
        )}
      </p>
    </div>
  );
}

/** The other keys Teach mode already knows, for reference (they aren't changeable). */
export function TeachKeysReference({ tone = "app", className }: { tone?: keyof typeof TONES; className?: string }) {
  const t = TONES[tone];
  const mod = isMac() ? "⌘" : "Ctrl";
  const keys: [string[], string][] = [
    [["Space"], "Play or pause the lesson"],
    [["←", "→"], "Previous or next step"],
    [["Esc"], "Stop the lesson"],
    [[`${mod} K`], "Search"],
    [[`${mod} B`], "Show or hide the sidebar"],
  ];
  return (
    <div className={cn("text-[13px]", className)}>
      <p className={cn("mb-2 text-[12px] font-semibold uppercase tracking-[0.08em]", t.muted)}>Other keys</p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {keys.map(([caps, what]) => (
          <li key={what} className="flex items-center gap-2">
            <span className="flex shrink-0 gap-1">
              {caps.map((c) => (
                <kbd key={c} className={cn("min-w-7 rounded-md border px-1.5 py-0.5 text-center font-mono text-[12px] font-semibold", t.kbd)}>
                  {c}
                </kbd>
              ))}
            </span>
            <span className={t.muted}>{what}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
