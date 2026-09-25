import { useSyncExternalStore, type CSSProperties } from "react";
import type { BotKind } from "@/components/guide/GuideBot";

/*
  Who the tutor looks like: the avatar on Teach mode's pointer, in the speech
  bubble, standing above the controls and in the voice menu.

  Each avatar is a character on a coloured badge, and the pointer's arrow takes
  the same colour, so each voice has its own look. The choice is kept per voice
  GENDER, not per voice id: a voice that isn't available falls back to one of the
  same gender (see playstudy-voices notes), and the tutor must not change face
  when that happens. "pixel" is the original pixel-art tutor, kept as an option.

  The pick belongs to the ACCOUNT (users.guide_avatar, "male:owl,female:fox"), so
  it follows the student to a school computer, like the talk key. It is chosen on
  onboarding's "how your tutors look" screen and in Settings or Teach mode's menu.
  localStorage is only a cache, read synchronously so the pointer never shows the
  wrong face for a frame; the session refresh keeps it honest (AuthContext).
*/

export type AvatarId = "owl" | "fox" | "cat" | "robot" | "octopus" | "frog" | "panda" | "dino" | "pixel";
export type AvatarShape = "hexagon" | "circle" | "squircle" | "octagon" | "shield";

export interface AvatarPalette {
  /** The badge, and the pointer's arrow. */
  base: string;
  /** Line art and dark fills. */
  dark: string;
  /** Faces and highlights. */
  light: string;
}

export interface AvatarDef {
  id: AvatarId;
  name: string;
  shape: AvatarShape;
  palette: AvatarPalette;
}

export const AVATARS: AvatarDef[] = [
  { id: "owl", name: "Owl", shape: "hexagon", palette: { base: "#2fb67c", dark: "#11573a", light: "#c8f2dc" } },
  { id: "fox", name: "Fox", shape: "circle", palette: { base: "#f47b2a", dark: "#7c2d0c", light: "#ffe0c7" } },
  { id: "cat", name: "Cat", shape: "squircle", palette: { base: "#e8629f", dark: "#7a1c4a", light: "#ffd6e8" } },
  { id: "robot", name: "Robot", shape: "octagon", palette: { base: "#4c8df6", dark: "#173a8a", light: "#d6e5ff" } },
  { id: "octopus", name: "Octopus", shape: "circle", palette: { base: "#8b5cf6", dark: "#3b1a8c", light: "#e6dcff" } },
  { id: "frog", name: "Frog", shape: "squircle", palette: { base: "#7cc243", dark: "#35601a", light: "#e3f5cd" } },
  { id: "panda", name: "Panda", shape: "hexagon", palette: { base: "#17b3a3", dark: "#0c4f49", light: "#d2f5f0" } },
  { id: "dino", name: "Dino", shape: "shield", palette: { base: "#ef5a4f", dark: "#7a1b16", light: "#ffd9d5" } },
  // The original pixel tutor: its colours follow the voice (pink, blue or violet).
  { id: "pixel", name: "Pixel", shape: "squircle", palette: { base: "#8b5cf6", dark: "#1f1235", light: "#ddd6fe" } },
];

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

/** The pixel tutor's colours per voice, taken from GuideBot's palette. */
const PIXEL_PALETTE: Record<BotKind, AvatarPalette> = {
  female: { base: "#ec4899", dark: "#1f1235", light: "#fbcfe8" },
  male: { base: "#3b82f6", dark: "#1f1235", light: "#bfdbfe" },
  neutral: { base: "#8b5cf6", dark: "#1f1235", light: "#ddd6fe" },
};

/** Each voice starts with its own look: Alec (the man's voice) is the owl, Emily the fox. */
export const DEFAULT_AVATAR: Record<BotKind, AvatarId> = { male: "owl", female: "fox", neutral: "octopus" };

export function avatarDef(id: AvatarId, kind: BotKind = "neutral"): AvatarDef {
  const def = BY_ID.get(id) ?? BY_ID.get(DEFAULT_AVATAR[kind])!;
  return def.id === "pixel" ? { ...def, palette: PIXEL_PALETTE[kind] } : def;
}

/** "236, 72, 153" from "#ec4899", for rgba() in CSS. */
export function rgbTriple(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** The CSS variables index.css colours the pointer, bubble and dock with (--guide-accent). */
export function accentVars(palette: AvatarPalette): CSSProperties {
  return { "--guide-accent": rgbTriple(palette.base), "--guide-accent-ink": palette.dark } as CSSProperties;
}

/* ---------- the saved choice ---------- */

const KEY = "an-guide-avatar";
export type AvatarChoice = Partial<Record<BotKind, AvatarId>>;
type Choice = AvatarChoice;
const KINDS: BotKind[] = ["male", "female", "neutral"];

/** How it travels to the server: "male:owl,female:fox". */
export function avatarsToString(c: AvatarChoice): string {
  return KINDS.filter((k) => c[k]).map((k) => `${k}:${c[k]}`).join(",");
}

export function avatarsFromString(value: string | null | undefined): AvatarChoice {
  const out: AvatarChoice = {};
  for (const part of (value || "").split(",")) {
    const [k, id] = part.trim().split(":");
    if (KINDS.includes(k as BotKind) && BY_ID.has(id as AvatarId)) out[k as BotKind] = id as AvatarId;
  }
  return out;
}

function read(): Choice {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    const out: Choice = {};
    for (const k of ["female", "male", "neutral"] as BotKind[]) {
      const id = raw?.[k];
      if (typeof id === "string" && BY_ID.has(id as AvatarId)) out[k] = id as AvatarId;
    }
    return out;
  } catch {
    return {};
  }
}

let choice: Choice = typeof window === "undefined" ? {} : read();
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  // Another tab changed it.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      choice = read();
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function avatarFor(kind: BotKind): AvatarId {
  return choice[kind] ?? DEFAULT_AVATAR[kind];
}

function store(next: Choice) {
  choice = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Storage blocked (private mode): the pick still holds until the page reloads.
  }
  listeners.forEach((fn) => fn());
}

/* Saving to the account is handed in by AuthContext while someone is signed in, so
   this module needs no API client and a signed-out page saves nothing. */
let saver: ((value: string) => Promise<unknown>) | null = null;
export function setAvatarSaver(fn: ((value: string) => Promise<unknown>) | null) {
  saver = fn;
}

/** Pick a look for one voice, here and (when signed in) on the account. Saving can fail offline; the pick still holds. */
export function setAvatar(kind: BotKind, id: AvatarId, opts?: { save?: boolean }) {
  if (choice[kind] === id) return;
  store({ ...choice, [kind]: id });
  if (opts?.save !== false) void saver?.(avatarsToString(choice))?.catch?.(() => undefined);
}

/** Several at once (onboarding sends them with its own request, so nothing is saved here). */
export function setAvatars(picks: AvatarChoice) {
  store({ ...choice, ...picks });
}

/** What the session says this account chose, applied without saving it back. An account that
 *  never chose goes back to the defaults, so the last student on this computer doesn't leave
 *  their looks behind for the next one. */
export function syncAvatarsFromServer(value: string | null | undefined) {
  const next = avatarsFromString(value);
  if (avatarsToString(next) !== avatarsToString(choice)) store(next);
}

/** The avatar the voice of this gender uses, updating when the student picks another. */
export function useAvatar(kind: BotKind): AvatarDef {
  const id = useSyncExternalStore(subscribe, () => avatarFor(kind), () => DEFAULT_AVATAR[kind]);
  return avatarDef(id, kind);
}
