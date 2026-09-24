import { cn } from "@/lib/utils";
import { AVATARS, DEFAULT_AVATAR, accentVars, avatarDef, type AvatarChoice, type AvatarId } from "@/lib/guide/avatars";
import type { BotKind } from "@/components/guide/GuideBot";
import { AvatarArrow, GuideAvatar } from "@/components/guide/GuideAvatar";

/*
  How each Teach mode tutor looks: the avatar that rides on their pointer, in
  their colour. One card per voice, because each voice keeps its own look (Alec
  starts as the owl, Emily as the fox). Used at the end of onboarding and in
  Settings; the look is saved on the account (lib/guide/avatars).

  Like VoiceKeyPicker, it lives in two worlds — the editorial cream pages and the
  app's own theme — so its colours come from `tone`.
*/

/** The two voices on offer (see playstudy-voices): the man's voice and the woman's. */
const TUTORS: { kind: BotKind; name: string; voice: string }[] = [
  { kind: "male", name: "Alec", voice: "Relaxed British voice" },
  { kind: "female", name: "Emily", voice: "Relaxed American voice" },
];

const TONES = {
  editorial: {
    card: "border-[var(--hair)] bg-[var(--cream-alt)]",
    name: "lp-serif text-[1.5rem] leading-none text-[var(--ink)]",
    muted: "text-[var(--muted)]",
    stage: "bg-[var(--cream)] border-[var(--hair)]",
  },
  app: {
    card: "border-border bg-card",
    name: "text-base font-semibold text-foreground",
    muted: "text-muted-foreground",
    stage: "bg-muted/50 border-border",
  },
};

export function TutorLookPicker({
  value,
  onChange,
  tone = "app",
  className,
}: {
  value: AvatarChoice;
  onChange: (kind: BotKind, id: AvatarId) => void;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      {TUTORS.map(({ kind, name, voice }) => {
        const current = avatarDef(value[kind] ?? DEFAULT_AVATAR[kind], kind);
        return (
          <div key={kind} className={cn("rounded-2xl border p-4", t.card)} style={accentVars(current.palette)}>
            <div className="flex items-center gap-4">
              {/* A little stage showing the pointer as it will look on the notes. */}
              <div className={cn("relative h-[72px] w-[84px] shrink-0 rounded-xl border", t.stage)} aria-hidden>
                <div className="absolute left-3 top-3">
                  <AvatarArrow color={current.palette.base} />
                  <GuideAvatar className="absolute left-[13px] top-[13px]" avatar={current.id} kind={kind} size={40} mood="talking" />
                </div>
              </div>
              <div className="min-w-0">
                <p className={t.name}>{name}</p>
                <p className={cn("mt-1 text-[13px]", t.muted)}>
                  {voice} · {current.name}
                </p>
              </div>
            </div>
            <div className="guide-avatar-grid mt-4" role="radiogroup" aria-label={`How ${name} looks`}>
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={a.id === current.id}
                  aria-label={a.name}
                  title={a.name}
                  className={cn("guide-avatar-pick", a.id === current.id && "is-on")}
                  onClick={() => onChange(kind, a.id)}
                >
                  <GuideAvatar avatar={a.id} kind={kind} size={38} mood={a.id === current.id ? "talking" : "idle"} />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
