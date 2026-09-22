import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Mic, Pause, Play, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SttMode } from "@/lib/guide/speech";
import { GuideBot, type BotKind, type BotMood } from "./GuideBot";

/*
  Teach mode's controls: the tutor standing in the bottom-right corner with one
  small pill under them — status, play/pause, mic, speed, which tutor is speaking,
  close. What is being said shows in the speech bubble next to the pointer, not
  here. The typed-question box opens by itself where there's no microphone.
*/

export type GuidePhase = "loading" | "speaking" | "paused" | "listening" | "thinking" | "answering" | "done" | "error";

/** One of the two voices on offer, and the character that goes with it. */
export interface VoiceOption {
  /** "server:<id>" for a natural voice, "browser:<name>" for the browser's own. */
  id: string;
  name: string;
  gender: "female" | "male" | null;
  /** A few words about how it sounds ("bright", "warm"). */
  desc?: string;
}

export const botKind = (voice: { gender?: "female" | "male" | null } | null | undefined): BotKind =>
  voice?.gender === "female" ? "female" : voice?.gender === "male" ? "male" : "neutral";

/** Below this the whiteboard lies across the bottom of the screen, so the tutor stands smaller
 *  (and index.css lifts the board) to leave the board's own buttons clear. */
function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 900px)");
    const onChange = () => setNarrow(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

export interface GuideDockProps {
  phase: GuidePhase;
  question: string | null;
  interim: string | null;
  error: string | null;
  progress: { step: number; count: number; title: string };
  rate: number;
  onCycleRate: () => void;
  /** The two voices to choose from: a woman's and a man's. */
  voices: VoiceOption[];
  voiceId: string | null;
  onVoice: (id: string) => void;
  /** True while a newly picked voice introduces itself, so the tutor's mouth moves. */
  greeting?: boolean;
  askOpen: boolean;
  onToggleAsk: () => void;
  onAsk: (text: string) => void;
  /** What the lesson is about, for the question box: "section" (notes) or "page" (a PDF). */
  unit?: "section" | "page";
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

export function GuideDock(props: GuideDockProps) {
  const { phase, question, interim, error, progress, rate, voices, voiceId, askOpen, sttMode, greeting } = props;
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const narrow = useNarrow();

  useEffect(() => {
    if (askOpen) inputRef.current?.focus();
  }, [askOpen]);

  // Close the tutor picker on a click anywhere else.
  useEffect(() => {
    if (!picking) return;
    const onDown = (e: PointerEvent) => {
      if (!dockRef.current?.contains(e.target as Node)) setPicking(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [picking]);

  const busy = phase === "loading" || phase === "thinking";
  const playing = phase === "speaking" || phase === "answering" || phase === "listening" || busy;
  const listening = phase === "listening";
  const talking = phase === "speaking" || phase === "answering";
  const speaker = voices.find((v) => v.id === voiceId) ?? null;
  const mood: BotMood = talking || greeting ? "talking" : listening ? "listening" : busy ? "thinking" : "idle";

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
    <div
      ref={dockRef}
      className="pointer-events-none fixed bottom-4 right-4 z-[130] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape" && picking) {
          e.stopPropagation();
          setPicking(false);
        }
      }}
    >
      {speaker && (
        <button
          key={speaker.id}
          type="button"
          className="guide-bot-stage"
          onClick={() => setPicking((p) => !p)}
          aria-label={`${speaker.name} is reading. Change voice`}
        >
          <GuideBot kind={botKind(speaker)} mood={mood} size={narrow ? 50 : 74} title={`${speaker.name} — tap to change voice`} />
        </button>
      )}
      {picking && voices.length > 1 && (
        <div className="guide-voicemenu pointer-events-auto" role="menu" aria-label="Voice">
          {voices.map((v) => (
            <button
              key={v.id}
              type="button"
              role="menuitemradio"
              aria-checked={v.id === voiceId}
              className={cn("guide-voicemenu-item", v.id === voiceId && "is-on")}
              onClick={() => {
                props.onVoice(v.id);
                setPicking(false);
              }}
            >
              <GuideBot kind={botKind(v)} mood={v.id === voiceId ? "talking" : "idle"} size={38} />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="guide-voicemenu-name">{v.name}</span>
                {v.desc && <span className="guide-voicemenu-desc">{v.desc}</span>}
              </span>
              {v.id === voiceId && <Check className="size-4 text-pink-500" />}
            </button>
          ))}
        </div>
      )}
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
            placeholder={`Ask about this ${props.unit ?? "section"}…`}
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
          title={
            sttMode === "none"
              ? "Voice input isn't available in this browser — type instead"
              : listening
                ? "Done talking — send it (M)"
                : "Talk to your tutor (press M)"
          }
          aria-label={listening ? "Stop listening and send" : "Ask by voice"}
          aria-keyshortcuts="M"
          className={cn(
            "relative flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
            listening ? "guide-mic-live border-pink-500 bg-pink-500 text-white" : "border-border text-foreground hover:bg-muted",
            sttMode === "none" && "opacity-50",
          )}
        >
          <Mic className="size-4" />
          {sttMode !== "none" && (
            // The shortcut is worth seeing, not just hovering for: M starts listening, M again sends.
            <kbd
              aria-hidden
              className={cn(
                "absolute -right-1.5 -top-1.5 rounded-md border px-1 font-mono text-[9px] font-bold leading-4 shadow-sm",
                listening ? "border-pink-500 bg-white text-pink-600" : "border-border bg-background text-muted-foreground",
              )}
            >
              M
            </kbd>
          )}
        </button>
        <button
          type="button"
          onClick={props.onCycleRate}
          title="Speaking speed"
          className="h-8 shrink-0 rounded-full border border-border px-2 text-xs tabular-nums text-muted-foreground hover:bg-muted"
        >
          {rate}×
        </button>
        {voices.length > 1 && speaker && (
          <button
            type="button"
            className="guide-voicebtn"
            onClick={() => setPicking((p) => !p)}
            title={`${speaker.name} is reading — change voice`}
            aria-label="Voice"
            aria-haspopup="menu"
            aria-expanded={picking}
          >
            <GuideBot kind={botKind(speaker)} variant="head" size={20} mood={mood === "talking" ? "talking" : "idle"} />
            <span className="hidden sm:inline">{speaker.name}</span>
          </button>
        )}
        <IconButton title="Close Teach mode (Esc)" onClick={props.onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
    </div>,
    document.body,
  );
}
