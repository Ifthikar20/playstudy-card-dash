import { useState } from "react";
import { AVATARS, DEFAULT_AVATAR, accentVars, avatarDef } from "@/lib/guide/avatars";
import type { VoiceOption } from "@/lib/guide/voice";
import type { BotKind, BotMood } from "./GuideBot";
import { AvatarArrow, GuideAvatar } from "./GuideAvatar";
import { GuideDock, type GuidePhase } from "./GuideDock";
import { TutorLookPicker } from "@/components/TutorLookPicker";
import type { AvatarChoice } from "@/lib/guide/avatars";

/*
  Dev-only (/dev-board?only=avatars): every Teach mode avatar at the sizes the app
  uses, in each mood, the pointer as each voice shows it over a line of notes, and
  the real controls with the voice-and-look menu (tap the tutor, bottom right).
*/

const MOODS: BotMood[] = ["idle", "talking", "listening", "thinking"];
const PHASE: Record<BotMood, GuidePhase> = { idle: "paused", talking: "speaking", listening: "listening", thinking: "thinking" };
const VOICES: VoiceOption[] = [
  { id: "server:alec", name: "Alec", gender: "male", desc: "relaxed" },
  { id: "server:emily", name: "Emily", gender: "female", desc: "relaxed" },
];

function PointerSample({ kind, label }: { kind: BotKind; label: string }) {
  const def = avatarDef(DEFAULT_AVATAR[kind], kind);
  return (
    <div className="relative h-40 rounded-2xl border border-border bg-card p-5" style={accentVars(def.palette)}>
      <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
        Photosynthesis turns light into chemical energy.{" "}
        <span className="guide-underline relative inline" style={{ position: "relative" }}>
          Chlorophyll absorbs red and blue light
        </span>{" "}
        and reflects green, which is why leaves look green.
      </p>
      <div className="guide-cursor absolute" style={{ left: 190, top: 44 }}>
        <AvatarArrow color={def.palette.base} />
        <GuideAvatar className="guide-cursor-avatar" avatar={def.id} kind={kind} size={34} mood="talking" />
        <div className="guide-chip">{label}</div>
      </div>
    </div>
  );
}

export function DevAvatarGallery() {
  const [mood, setMood] = useState<BotMood>("idle");
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [looks, setLooks] = useState<AvatarChoice>({ male: "owl", female: "fox" });
  return (
    <div className="space-y-8">
      {/* Onboarding's "how your tutors look" screen, in its editorial (.lp) world. */}
      <div className="lp rounded-2xl p-6">
        <TutorLookPicker value={looks} onChange={(kind, id) => setLooks((l) => ({ ...l, [kind]: id }))} tone="editorial" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        Mood:
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMood(m)}
            className={`rounded-full border px-3 py-1 ${m === mood ? "border-foreground bg-muted" : "border-border"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <PointerSample kind="male" label="Alec" />
        <PointerSample kind="female" label="Emily" />
      </div>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-9">
        {AVATARS.map((a) => (
          <div key={a.id} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3">
            <GuideAvatar avatar={a.id} kind="male" size={96} mood={mood} />
            <div className="flex items-end gap-2">
              <GuideAvatar avatar={a.id} kind="male" size={48} mood={mood} />
              <GuideAvatar avatar={a.id} kind="male" size={34} mood={mood} />
              <GuideAvatar avatar={a.id} kind="male" size={20} mood={mood} />
            </div>
            <span className="text-xs font-medium">{a.name}</span>
          </div>
        ))}
      </div>
      <GuideDock
        phase={PHASE[mood]}
        question={null}
        interim={null}
        error={null}
        progress={{ step: 3, count: 12, title: "Photosynthesis" }}
        rate={1}
        onCycleRate={() => {}}
        voices={VOICES}
        voiceId={voiceId}
        onVoice={setVoiceId}
        askOpen={false}
        onToggleAsk={() => {}}
        onAsk={() => {}}
        sttMode="none"
        onPlayPause={() => {}}
        onMic={() => {}}
        onClose={() => {}}
      />
    </div>
  );
}
