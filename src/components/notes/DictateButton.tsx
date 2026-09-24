import { Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Dictation } from "@/lib/guide/dictation";
import { micBlockedByInsecurePage, primeSpeechAudio } from "@/lib/guide/speech";
import { useVoiceKey, voiceKeyLabel } from "@/lib/voiceKey";

/*
  Start / stop dictating. The same button in the page header and in each section's
  toolbar (`compact`), driving the page's ONE dictation (there is one microphone).

  It never takes focus from the editor: pressing it would otherwise move focus off
  the open sheet, and with no caret the next phrase would have nowhere to land. So
  the mouse-down is swallowed, the same trick as the sheet's own lock-bar buttons. The keyboard route (Tab, Enter) still works; the talk
  key, shown in the tooltip, is the way to dictate without leaving the line.
*/

export function DictateButton({
  dictation,
  disabled,
  compact,
  onToggle,
  className,
}: {
  dictation: Dictation;
  /** Off while something else owns the page (Teach mode, the tutor's questions). */
  disabled?: boolean;
  /** The small ghost button of a section's toolbar, instead of the header pill. */
  compact?: boolean;
  /** Instead of `dictation.toggle()`, when the page must pick where the words go first. */
  onToggle?: () => void;
  className?: string;
}) {
  const { toast } = useToast();
  const voiceKey = useVoiceKey();
  const listening = dictation.state !== "off";
  const writing = dictation.state === "writing";
  const unsupported = dictation.mode === "none";

  const label = writing ? "Writing that down…" : listening ? "Stop dictating" : "Dictate";
  const title = unsupported
    ? micBlockedByInsecurePage()
      ? "The microphone only works on an https page — type instead"
      : "This browser can't do voice input — type instead"
    : `${listening ? "Stop" : "Start"} dictating (${voiceKeyLabel(voiceKey)})`;

  const press = () => {
    if (unsupported) {
      // Not disabled, so the reason is one click away rather than hidden in a tooltip
      // that a disabled button never shows.
      toast({ title: title.replace(/ — type instead$/, "."), description: "You can always type instead." });
      return;
    }
    primeSpeechAudio(); // a real click, so the tutor's voice is unlocked for later too
    if (onToggle) onToggle();
    else dictation.toggle();
  };

  const icon = writing ? (
    <Loader2 className="size-3.5 animate-spin" />
  ) : listening ? (
    <MicOff className="size-3.5" />
  ) : (
    <Mic className="size-3.5" />
  );

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={press}
        disabled={disabled}
        aria-pressed={listening}
        title={title}
        className={cn(
          "h-7 text-xs",
          listening ? "an-note-live text-pink-700 dark:text-pink-300" : "text-muted-foreground",
          unsupported && "opacity-60",
          className,
        )}
      >
        {icon}
        {writing ? "Writing…" : listening ? "Stop" : "Dictate"}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={press}
      disabled={disabled}
      aria-pressed={listening}
      title={title}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        listening
          ? "an-note-live border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300"
          : "border-border bg-foreground/[0.04] text-foreground hover:bg-foreground/[0.08]",
        unsupported && "opacity-60",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}
