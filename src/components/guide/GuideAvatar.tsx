import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { avatarDef, type AvatarId } from "@/lib/guide/avatars";
import { ARROW_PATH, AVATAR_ART, BADGE_PATHS, paint } from "@/lib/guide/avatarArt";
import { GuideBot, type BotKind, type BotMood } from "./GuideBot";

/*
  The tutor's avatar: a character on a coloured badge (a hexagon, circle,
  rounded square, octagon or shield), drawn flat with line art in a darker shade
  of the badge colour. It rides on the pointer, sits in the speech bubble, stands
  above the controls and fills the picker.

  `mood` drives the life in it from CSS (.guide-avatar in index.css): it blinks,
  bobs and works its mouth while talking, tilts in and glows while listening, and
  looks up while thinking. The art marks its eyes and mouth with the av-eyes and
  av-mouth classes for that. The "pixel" avatar is the original pixel-art tutor.

  The badge shapes, the arrow and the colour painter live in lib/guide/avatarArt.ts,
  plain data with no React in it, so anything else can draw the same thing.
*/

export function GuideAvatar({
  avatar,
  kind = "neutral",
  mood = "idle",
  size = 40,
  full = false,
  className,
  title,
}: {
  avatar: AvatarId;
  /** The voice's gender: picks the fallback avatar and the pixel tutor's colours. */
  kind?: BotKind;
  mood?: BotMood;
  size?: number;
  /** For the pixel tutor only: the whole standing figure instead of its head. */
  full?: boolean;
  className?: string;
  title?: string;
}) {
  const def = avatarDef(avatar, kind);
  const art = useMemo(() => (def.id === "pixel" ? "" : paint(AVATAR_ART[def.id] ?? "", def)), [def]);

  if (def.id === "pixel") {
    // Standing above the controls, the pixel tutor is its whole figure. Everywhere
    // else it's its head on a rounded badge like the others (the head crop would
    // otherwise spill its body out of the box).
    if (full) {
      return (
        <span className={cn("guide-avatar guide-avatar-pixel", className)} title={title}>
          <GuideBot kind={kind} variant="full" size={size} mood={mood} />
        </span>
      );
    }
    return (
      <span
        className={cn("guide-avatar guide-avatar-pixel guide-avatar-pixel-badge", className)}
        title={title}
        style={{ width: size, height: size, background: def.palette.light, borderColor: def.palette.dark }}
      >
        <GuideBot kind={kind} variant="head" size={Math.round(size * 0.78)} mood={mood} />
      </span>
    );
  }
  return (
    <span className={cn("guide-avatar", className)} data-mood={mood} title={title} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden focusable="false">
        <path className="av-ring" d={BADGE_PATHS[def.shape]} fill="none" stroke={def.palette.base} strokeWidth="3" />
        <g className="av-body">
          <path d={BADGE_PATHS[def.shape]} fill={def.palette.base} stroke={def.palette.dark} strokeWidth="3" strokeLinejoin="round" />
          <g dangerouslySetInnerHTML={{ __html: art }} />
        </g>
      </svg>
    </span>
  );
}

/** The pointer's arrow, in the avatar's colour. Its tip, at (3, 3), is the point it points with. */
export function AvatarArrow({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className="guide-cursor-svg" aria-hidden focusable="false">
      <path d={ARROW_PATH} fill={color} stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}
