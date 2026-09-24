import { useEffect, useRef, useState } from "react";
import { Check, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  VOICE_KEY_PRESETS,
  isMac,
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
