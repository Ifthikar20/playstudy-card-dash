import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { avatarDef, type AvatarDef, type AvatarId, type AvatarShape } from "@/lib/guide/avatars";
import { AVATAR_ART } from "@/lib/guide/avatarArt";
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
*/

const SHAPES: Record<AvatarShape, string> = {
  // Everything sits in a 64×64 box, with room for the 3px outline.
  hexagon: "M32 3.5 L56.7 17.75 L56.7 46.25 L32 60.5 L7.3 46.25 L7.3 17.75 Z",
  circle: "M32 3.5 A28.5 28.5 0 1 1 31.99 3.5 Z",
  squircle: "M20 4 H44 C54 4 60 10 60 20 V44 C60 54 54 60 44 60 H20 C10 60 4 54 4 44 V20 C4 10 10 4 20 4 Z",
  octagon: "M21.6 4 H42.4 L60 21.6 V42.4 L42.4 60 H21.6 L4 42.4 V21.6 Z",
  shield: "M32 3.5 L57 11 V31 C57 46 46 55.5 32 60.5 C18 55.5 7 46 7 31 V11 Z",
};

/** The art uses colour tokens; swap in this avatar's palette. */
function paint(markup: string, def: AvatarDef) {
  return markup
    .replace(/\bDARK\b/g, def.palette.dark)
    .replace(/\bBASE\b/g, def.palette.base)
    .replace(/\bLIGHT\b/g, def.palette.light)
    .replace(/\bWHITE\b/g, "#ffffff");
}

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
        <path className="av-ring" d={SHAPES[def.shape]} fill="none" stroke={def.palette.base} strokeWidth="3" />
        <g className="av-body">
          <path d={SHAPES[def.shape]} fill={def.palette.base} stroke={def.palette.dark} strokeWidth="3" strokeLinejoin="round" />
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
      <path d="M3 3 L25 11.4 L14.6 14.6 L11.4 25 Z" fill={color} stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}
