import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Mic, Pause, Play, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceKey, voiceKeyBadge, voiceKeyLabel } from "@/lib/voiceKey";
import type { SttMode } from "@/lib/guide/speech";
import type { VoiceOption } from "@/lib/guide/voice";
import { AVATARS, accentVars, setAvatar, useAvatar } from "@/lib/guide/avatars";
import type { BotKind, BotMood } from "./GuideBot";
import { GuideAvatar } from "./GuideAvatar";

/*
  Teach mode's controls: the tutor standing in the bottom-right corner with one
  small pill under them — status, play/pause, mic, speed, which tutor is speaking,
  close. What is being said shows in the speech bubble next to the pointer, not
  here. The typed-question box opens by itself where there's no microphone.
*/

export type GuidePhase = "loading" | "speaking" | "paused" | "listening" | "thinking" | "answering" | "done" | "error";

/** One of the two voices on offer, and the character that goes with it. */
export type { VoiceOption } from "@/lib/guide/voice";

export const botKind = (voice: { gender?: "female" | "male" | null } | null | undefined): BotKind =>
  voice?.gender === "female" ? "female" : voice?.gender === "male" ? "male" : "neutral";

/** A voice's avatar, as the student has picked it for that voice (a hook per voice). */
function VoiceAvatar({ kind, mood, size, full, title }: { kind: BotKind; mood: BotMood; size: number; full?: boolean; title?: string }) {
  const avatar = useAvatar(kind);
  return <GuideAvatar avatar={avatar.id} kind={kind} mood={mood} size={size} full={full} title={title} />;
}

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

  const voiceKey = useVoiceKey();
  const keyLabel = voiceKeyLabel(voiceKey);
  const keyBadge = voiceKeyBadge(voiceKey);
  const busy = phase === "loading" || phase === "thinking";
  const playing = phase === "speaking" || phase === "answering" || phase === "listening" || busy;
  const listening = phase === "listening";
  const talking = phase === "speaking" || phase === "answering";
  const speaker = voices.find((v) => v.id === voiceId) ?? null;
  const speakerKind = botKind(speaker);
  const avatar = useAvatar(speakerKind);
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
      style={accentVars(avatar.palette)}
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
          aria-label={`${speaker.name} is reading. Change the voice or the look`}
        >
          <GuideAvatar
            avatar={avatar.id}
            kind={speakerKind}
            mood={mood}
            size={avatar.id === "pixel" ? (narrow ? 50 : 74) : narrow ? 48 : 64}
            full
            title={`${speaker.name} — tap to change the voice or the look`}
          />
        </button>
      )}
      {picking && speaker && (
        <div className="guide-voicemenu pointer-events-auto" role="menu" aria-label="Voice and look">
          {voices.length > 1 && <div className="guide-voicemenu-label">Voice</div>}
          {voices.length > 1 && voices.map((v) => (
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
              <VoiceAvatar kind={botKind(v)} mood={v.id === voiceId ? "talking" : "idle"} size={38} />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="guide-voicemenu-name">{v.name}</span>
                {v.desc && <span className="guide-voicemenu-desc">{v.desc}</span>}
              </span>
              {v.id === voiceId && <Check className="size-4" style={{ color: "var(--guide-accent-ink)" }} />}
            </button>
          ))}
          {/* How this voice's tutor looks: the pointer's avatar and colour. Kept per voice. */}
          <div className="guide-voicemenu-label">{speaker.name}'s look</div>
          <div className="guide-avatar-grid" role="radiogroup" aria-label={`${speaker.name}'s look`}>
            {AVATARS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={a.id === avatar.id}
                aria-label={a.name}
                title={a.name}
                className={cn("guide-avatar-pick", a.id === avatar.id && "is-on")}
                onClick={() => setAvatar(speakerKind, a.id)}
              >
                <GuideAvatar avatar={a.id} kind={speakerKind} size={36} mood={a.id === avatar.id ? "talking" : "idle"} />
              </button>
            ))}
          </div>
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
          className="guide-pop pointer-events-auto flex w-[min(440px,calc(100vw-2rem))] items-center gap-2 rounded-2xl guide-accent-edge border bg-background/95 p-2 shadow-xl backdrop-blur"
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
            className="h-9 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none guide-accent-focus"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex h-9 items-center gap-1.5 rounded-xl guide-accent-fill px-3 text-xs font-semibold disabled:opacity-50"
          >
            <Send className="size-3.5" />
            Ask
          </button>
        </form>
      )}

      <div
        className={cn(
          "guide-pop pointer-events-auto flex items-center gap-1 rounded-full guide-accent-edge border bg-background/95 py-1.5 pl-3 pr-1.5 shadow-2xl backdrop-blur-md",
          // The whole bar breathes while the tutor is hearing you, so it's obvious
          // the talk key worked without watching the little mic button.
          listening && "guide-dock-live guide-accent-edge-strong",
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
          className="flex size-9 shrink-0 items-center justify-center rounded-full guide-accent-fill shadow-md transition-transform hover:scale-105 active:scale-95"
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
                ? `Done talking — send it (${keyLabel})`
                : `Talk to ${speaker?.name ?? "your tutor"} (press ${keyLabel})`
          }
          aria-label={listening ? "Stop listening and send" : "Ask by voice"}
          aria-keyshortcuts={keyLabel}
          className={cn(
            "relative flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
            listening ? "guide-mic-live guide-accent-fill" : "border-border text-foreground hover:bg-muted",
            sttMode === "none" && "opacity-50",
          )}
        >
          <Mic className="size-4" />
          {sttMode !== "none" && (
            // The key is worth seeing, not just hovering for: press it to listen, again to send.
            <kbd
              aria-hidden
              className={cn(
                "absolute -right-1.5 -top-1.5 max-w-[56px] truncate rounded-md border px-1 font-mono text-[9px] font-bold leading-4 shadow-sm",
                listening ? "guide-accent-key bg-white" : "border-border bg-background text-muted-foreground",
              )}
            >
              {keyBadge}
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
        {/* Who is teaching, by name, next to the mic they're heard through. */}
        {speaker && (
          <button
            type="button"
            className="guide-voicebtn"
            onClick={() => setPicking((p) => !p)}
            title={`${speaker.name} is reading — change the voice or the look`}
            aria-label="Voice and look"
            aria-haspopup="menu"
            aria-expanded={picking}
          >
            <GuideAvatar avatar={avatar.id} kind={speakerKind} size={20} mood={mood === "talking" ? "talking" : "idle"} />
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
