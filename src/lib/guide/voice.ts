/*
  Which voice the tutor speaks in, and how fast.

  Lived inside TeachMode until the blank-note page needed the same tutor to read a
  question out loud: the student picked that voice once and must hear it wherever the
  tutor speaks. TeachMode still owns the picker UI; this is only the choosing.
*/
import {
  browserVoiceName,
  browserVoicePair,
  pickVoice,
  voiceGender,
  type Narrator,
  type VoiceGender,
} from "@/lib/guide/speech";
import type { GuideVoice } from "@/services/guide";

/** One of the two voices on offer, and the character that goes with it. */
export interface VoiceOption {
  /** "server:<id>" for a natural voice, "browser:<name>" for the browser's own. */
  id: string;
  name: string;
  gender: VoiceGender | null;
  /** A few words about how it sounds ("bright", "warm"). */
  desc?: string;
}

export const RATE_KEY = "an-guide-rate";
// { id: "server:<voice id>" | "browser:<voice name>", gender }. v3 (2026-09-22): Alec became the
// default voice, and a new key makes everyone start on him once instead of their old pick.
export const VOICE_KEY = "an-guide-voice3";
export const RATES = [0.85, 1, 1.15, 1.3];

export function readStored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

/** The voice the student picked last time, and whose voice it was. The gender matters
 *  on its own: when the voices on offer change - a natural voice provider falls over,
 *  or they open the lesson on another machine - a student who chose the man's voice
 *  gets the man's voice again, and the character on screen still matches. */
export interface StoredVoice {
  id: string;
  gender: VoiceGender | null;
}

export function readVoicePref(): StoredVoice | null {
  const raw = readStored<string | { id?: string; gender?: string } | null>(VOICE_KEY, null);
  if (typeof raw === "string") return { id: raw, gender: raw.startsWith("browser:") ? voiceGender(raw.slice(8)) : null };
  if (raw && typeof raw.id === "string") {
    return { id: raw.id, gender: raw.gender === "female" || raw.gender === "male" ? raw.gender : null };
  }
  return null;
}

/** The two voices on offer: the natural ones when the server has them, else the browser's own. */
export function voiceChoices(server: GuideVoice[], browser: SpeechSynthesisVoice[]): VoiceOption[] {
  if (server.length) {
    return server.map((v) => ({ id: `server:${v.id}`, name: v.name, gender: v.gender ?? null, desc: v.desc }));
  }
  return browserVoicePair(browser).map((v) => ({
    id: `browser:${v.name}`,
    name: browserVoiceName(v.name),
    gender: voiceGender(v.name),
    desc: "your device's own voice",
  }));
}

/** The browser voice behind a choice. For a natural voice it's the stand-in if that voice
 *  fails mid-lesson, so it's the same gender and the face on screen still matches. */
export function browserVoiceFor(choice: VoiceOption, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (choice.id.startsWith("browser:")) return voices.find((v) => v.name === choice.id.slice(8)) ?? null;
  return browserVoicePair(voices).find((v) => voiceGender(v.name) === choice.gender) ?? pickVoice(voices);
}

export function applyVoice(n: Narrator, choice: VoiceOption, voices: SpeechSynthesisVoice[]) {
  n.serverVoice = choice.id.startsWith("server:") ? choice.id.slice(7) : null;
  n.voice = browserVoiceFor(choice, voices) ?? n.voice;
}

/** The voice to speak in: what they chose, else the same gender, else the server's default. */
export function chosenVoice(choices: VoiceOption[], serverDefault?: string | null): VoiceOption | null {
  if (!choices.length) return null;
  const stored = readVoicePref();
  return (
    choices.find((c) => c.id === stored?.id) ??
    (stored?.gender ? choices.find((c) => c.gender === stored.gender) : undefined) ??
    (serverDefault ? choices.find((c) => c.id === `server:${serverDefault}`) : undefined) ??
    choices[0]
  );
}
