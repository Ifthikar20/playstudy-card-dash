import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Keyboard, Loader2, Mic, Pause, Play, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SttMode } from "@/lib/guide/speech";

/*
  Teach mode's controls: one small pill in the bottom-right corner — status,
  play/pause, mic, typed question, speed, voice, close. What is being said shows
  in the speech bubble next to the pointer, not here.
*/

export type GuidePhase = "loading" | "speaking" | "paused" | "listening" | "thinking" | "answering" | "done" | "error";

export interface GuideDockProps {
  phase: GuidePhase;
  question: string | null;
  interim: string | null;
  error: string | null;
  progress: { step: number; count: number; title: string };
  rate: number;
  onCycleRate: () => void;
  /** Voice choices: natural server voices first ("server:<id>"), then browser voices ("browser:<name>"). */
  voices: { id: string; label: string }[];
  voiceId: string | null;
  onVoice: (id: string) => void;
  askOpen: boolean;
  onToggleAsk: () => void;
  onAsk: (text: string) => void;
  sttMode: SttMode;
  onPlayPause: () => void;
  onMic: () => void;
  onClose: () => void;
}

function IconButton({ title, onClick, children, active }: { title: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const shortName = (label: string) => label.split(/ — | \(/)[0];

export function GuideDock(props: GuideDockProps) {
  const { phase, question, interim, error, progress, rate, voices, voiceId, askOpen, sttMode } = props;
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (askOpen) inputRef.current?.focus();
  }, [askOpen]);

  const busy = phase === "loading" || phase === "thinking";
  const playing = phase === "speaking" || phase === "answering" || phase === "listening" || busy;
  const listening = phase === "listening";
  const talking = phase === "speaking" || phase === "answering";

  let status: string;
  if (phase === "speaking") status = progress.step ? `Teaching · ${progress.step}${progress.count ? `/${progress.count}` : ""}` : "Teaching";
  else if (phase === "answering") status = "Answering";
  else if (phase === "thinking") status = question ? `Thinking about “${question.length > 38 ? `${question.slice(0, 38)}…` : question}”` : "Thinking…";
  else if (phase === "listening") status = interim || "Listening…";
  else if (phase === "loading") status = "Getting ready…";
  else if (phase === "paused") status = "Paused";
  else if (phase === "done") status = "Finished";
  else status = "Something went wrong";

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    props.onAsk(t);
    setDraft("");
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[130] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {error && (
        <div className="pointer-events-auto max-w-sm rounded-xl border border-destructive/40 bg-background/95 px-3 py-2 text-xs text-destructive shadow-lg backdrop-blur">
          {error}
        </div>
      )}
      {askOpen && (
        <form
          onSubmit={onSubmit}
          className="guide-pop pointer-events-auto flex w-[min(440px,calc(100vw-2rem))] items-center gap-2 rounded-2xl border border-pink-500/30 bg-background/95 p-2 shadow-xl backdrop-blur"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") props.onToggleAsk();
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              e.stopPropagation();
            }}
            placeholder="Ask about this section…"
            className="h-9 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-pink-500"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Send className="size-3.5" />
            Ask
          </button>
        </form>
      )}

      <div
        className={cn(
          "guide-pop pointer-events-auto flex items-center gap-1 rounded-full border border-pink-500/25 bg-background/95 py-1.5 pl-3 pr-1.5 shadow-2xl shadow-pink-500/10 backdrop-blur-md",
          listening && "border-pink-500/60",
        )}
      >
        <span
          className={cn(
            "mr-1.5 size-2 shrink-0 rounded-full",
            talking ? "guide-glow bg-pink-500" : listening ? "guide-mic-live bg-pink-500" : busy ? "bg-amber-400" : "bg-muted-foreground/40",
          )}
        />
        <span className={cn("mr-1 truncate text-xs font-medium text-foreground", listening ? "max-w-[280px]" : "max-w-[200px]")} title={progress.title}>
          {status}
        </span>
        {busy && <Loader2 className="mr-1 size-3.5 shrink-0 animate-spin text-muted-foreground" />}

        <button
          type="button"
          onClick={props.onPlayPause}
          title={playing ? "Pause (space)" : "Play (space)"}
          aria-label={playing ? "Pause" : "Play"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-500 text-white shadow-md shadow-pink-500/30 transition-transform hover:scale-105 active:scale-95"
        >
          {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
        </button>
        <button
          type="button"
          onClick={props.onMic}
          title={sttMode === "none" ? "Voice input isn't available in this browser — type instead" : listening ? "Stop listening" : "Ask by voice (M)"}
          aria-label={listening ? "Stop listening" : "Ask by voice"}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
            listening ? "guide-mic-live border-pink-500 bg-pink-500 text-white" : "border-border text-foreground hover:bg-muted",
            sttMode === "none" && "opacity-50",
          )}
        >
          <Mic className="size-4" />
        </button>
        <IconButton title="Type a question" onClick={props.onToggleAsk} active={askOpen}>
          <Keyboard className="size-4" />
        </IconButton>
        <button
          type="button"
          onClick={props.onCycleRate}
          title="Speaking speed"
          className="h-8 shrink-0 rounded-full border border-border px-2 text-xs tabular-nums text-muted-foreground hover:bg-muted"
        >
          {rate}×
        </button>
        {voices.length > 1 && (
          <select
            value={voiceId ?? ""}
            onChange={(e) => props.onVoice(e.target.value)}
            title="Voice"
            aria-label="Voice"
            className="hidden h-8 max-w-[120px] rounded-full border border-border bg-background px-2 text-xs text-muted-foreground sm:block"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {shortName(v.label)}
              </option>
            ))}
          </select>
        )}
        <IconButton title="Close Teach mode (Esc)" onClick={props.onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
    </div>,
    document.body,
  );
}
