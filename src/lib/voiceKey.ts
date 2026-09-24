/*
  The key a student presses to talk to their tutor.

  They choose it at the end of onboarding (VoiceKeyStep) and can change it later in
  Settings; Teach mode listens for it and opens the microphone. It is stored by
  `code` — the physical key — so it keeps working on a French or German keyboard
  where the letters sit elsewhere.

  Mac keyboards have an fn key and people ask for it, but browsers never see it:
  macOS swallows fn (and the media keys) before the page gets a keydown, so it
  cannot be a shortcut on the web. The chooser says so and suggests ⌥ Space.
*/

import { useSyncExternalStore } from "react";

export interface VoiceKey {
  /** KeyboardEvent.code: "KeyM", "Space", "F4", "Backquote". */
  code: string;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

export const VOICE_KEY_STORAGE = "an-voice-key";

export const isMac = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/** M on its own: no modifier to hold, and nothing else in Teach mode uses it. */
export const DEFAULT_VOICE_KEY: VoiceKey = { code: "KeyM", alt: false, ctrl: false, meta: false, shift: false };

/** The handful we offer as one-tap choices, the first being the default. */
export const VOICE_KEY_PRESETS: { label: string; hint: string; key: VoiceKey }[] = [
  { label: "M", hint: "one tap, nothing to hold", key: DEFAULT_VOICE_KEY },
  {
    label: isMac() ? "⌥ Space" : "Alt + Space",
    hint: "hold the option key",
    key: { code: "Space", alt: true, ctrl: false, meta: false, shift: false },
  },
  {
    label: isMac() ? "⌘ ⇧ V" : "Ctrl + Shift + V",
    hint: "harder to hit by accident",
    key: isMac()
      ? { code: "KeyV", alt: false, ctrl: false, meta: true, shift: true }
      : { code: "KeyV", alt: false, ctrl: true, meta: false, shift: true },
  },
];

/** "KeyM" -> "M", "Digit1" -> "1", "BracketLeft" -> "[", so a label reads like the key cap. */
function keyName(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return `Num ${code.slice(6) || "pad"}`;
  const named: Record<string, string> = {
    Space: "Space",
    Enter: "Enter",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Insert: "Insert",
    Home: "Home",
    End: "End",
    PageUp: "Page Up",
    PageDown: "Page Down",
  };
  return named[code] ?? code;
}

/** The full label for a button or a sentence: "⌥ Space", "Ctrl + Shift + V". */
export function voiceKeyLabel(k: VoiceKey): string {
  const mac = isMac();
  const parts: string[] = [];
  if (k.ctrl) parts.push(mac ? "⌃" : "Ctrl");
  if (k.alt) parts.push(mac ? "⌥" : "Alt");
  if (k.shift) parts.push(mac ? "⇧" : "Shift");
  if (k.meta) parts.push(mac ? "⌘" : "Win");
  parts.push(keyName(k.code));
  return parts.join(mac ? " " : " + ");
}

/** The short form for the badge on the mic button: "M", "⌥Space", "^⇧V". */
export function voiceKeyBadge(k: VoiceKey): string {
  const mac = isMac();
  const mods = `${k.ctrl ? (mac ? "⌃" : "^") : ""}${k.alt ? (mac ? "⌥" : "⎇") : ""}${k.shift ? "⇧" : ""}${k.meta ? (mac ? "⌘" : "⊞") : ""}`;
  const name = keyName(k.code);
  return `${mods}${name.length > 5 ? name.slice(0, 5) : name}`;
}

export function sameVoiceKey(a: VoiceKey | null, b: VoiceKey | null): boolean {
  if (!a || !b) return a === b;
  return a.code === b.code && a.alt === b.alt && a.ctrl === b.ctrl && a.meta === b.meta && a.shift === b.shift;
}

/** Whether this keypress is the student's talk key. */
export function matchesVoiceKey(e: KeyboardEvent, k: VoiceKey): boolean {
  return e.code === k.code && e.altKey === k.alt && e.ctrlKey === k.ctrl && e.metaKey === k.meta && e.shiftKey === k.shift;
}

const MODIFIER_CODES = /^(Shift|Control|Alt|Meta|OS)(Left|Right)?$/;

/** A keypress turned into a shortcut, or why it can't be one (for the recorder). */
export function voiceKeyFromEvent(e: KeyboardEvent): { key: VoiceKey } | { error: string } {
  if (MODIFIER_CODES.test(e.code)) return { error: "" }; // still holding a modifier: keep waiting
  if (e.code === "Escape") return { error: "Escape closes Teach mode, so it can't be the talk key." };
  if (e.code === "Tab") return { error: "Tab moves between buttons for keyboard users — pick another key." };
  if (e.code === "Enter" || e.code === "NumpadEnter") return { error: "Enter sends a typed question. Pick another key." };
  if (e.code === "Space" && !e.altKey && !e.ctrlKey && !e.metaKey) {
    return { error: "Space alone plays and pauses the lesson. Try holding alt or ctrl with it." };
  }
  if (!e.code) return { error: "That key didn't reach the browser. Try another one." };
  return { key: { code: e.code, alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey } };
}

/** A warning to show under a chosen key, when the browser or the system may take it first. */
export function voiceKeyWarning(k: VoiceKey): string | null {
  const mac = isMac();
  // AnotherNotes' own two shortcuts. Both are plain ⌘/Ctrl, so a modifier on top is free.
  if ((k.meta || k.ctrl) && !k.shift && !k.alt && k.code === "KeyK") return "This one opens search in AnotherNotes.";
  if ((k.meta || k.ctrl) && !k.shift && !k.alt && k.code === "KeyB") return "This one opens and closes the sidebar.";
  if (!mac && k.alt && !k.ctrl && !k.shift && k.code === "Space") return "Windows opens the window menu on Alt + Space in some apps.";
  if (mac && k.meta && ["KeyW", "KeyQ", "KeyT", "KeyN", "KeyR"].includes(k.code)) return "The browser uses this one — it may close or reload the tab.";
  if (!mac && k.ctrl && ["KeyW", "KeyT", "KeyN", "KeyR", "KeyP"].includes(k.code)) return "The browser uses this one — it may close or reload the tab.";
  if (/^F\d+$/.test(k.code) && !k.alt && !k.ctrl && !k.meta && !k.shift) {
    return mac ? "On a Mac this row needs the fn key unless function keys are set as standard." : "Some function keys belong to the browser (F5, F11, F12).";
  }
  return null;
}

/* --- how it travels to the server: "KeyM", "Alt+Space", "Ctrl+Shift+KeyV" --- */

export function voiceKeyToString(k: VoiceKey): string {
  return `${k.ctrl ? "Ctrl+" : ""}${k.alt ? "Alt+" : ""}${k.shift ? "Shift+" : ""}${k.meta ? "Meta+" : ""}${k.code}`;
}

export function voiceKeyFromString(value: string | null | undefined): VoiceKey | null {
  const parts = (value || "").split("+").filter(Boolean);
  const code = parts.pop();
  if (!code || !/^[A-Za-z][A-Za-z0-9]{0,23}$/.test(code)) return null;
  const has = (m: string) => parts.includes(m);
  if (parts.some((p) => !["Ctrl", "Alt", "Shift", "Meta"].includes(p))) return null;
  return { code, alt: has("Alt"), ctrl: has("Ctrl"), meta: has("Meta"), shift: has("Shift") };
}

/* --- where it lives on this device ----------------------------------------
   The account owns the key (users.voice_key), so it follows the student to a
   school computer. This copy is only a cache, read synchronously so Teach mode
   never shows the wrong key for a frame; the session refresh keeps it honest.
   It sits outside the `an-pref:` prefix on purpose - localData.ts wipes those
   on sign-out, and onboarding only runs once. */

let current: VoiceKey | null = null;
const listeners = new Set<() => void>();

export function readVoiceKey(): VoiceKey {
  if (current) return current;
  try {
    const raw = localStorage.getItem(VOICE_KEY_STORAGE);
    current = (raw && voiceKeyFromString(raw)) || DEFAULT_VOICE_KEY;
  } catch {
    current = DEFAULT_VOICE_KEY;
  }
  return current;
}

function store(k: VoiceKey): void {
  current = k;
  try {
    localStorage.setItem(VOICE_KEY_STORAGE, voiceKeyToString(k));
  } catch {
    /* a private window without storage still gets the key for this session */
  }
  listeners.forEach((fn) => fn());
}

/** Set it here and on the account. Saving can fail (offline) - the key still works. */
export function writeVoiceKey(k: VoiceKey, save?: (value: string) => Promise<unknown>): void {
  if (sameVoiceKey(current, k)) return;
  store(k);
  void save?.(voiceKeyToString(k))?.catch?.(() => undefined);
}

/** What the session says this account chose, applied without saving it back. An account
 *  that never picked one goes back to the default, so the last person to use this
 *  computer doesn't leave their key behind for the next student. */
export function syncVoiceKeyFromServer(value: string | null | undefined): void {
  const fromServer = voiceKeyFromString(value ?? null) ?? DEFAULT_VOICE_KEY;
  if (!sameVoiceKey(readVoiceKey(), fromServer)) store(fromServer);
}

export function subscribeVoiceKey(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The student's talk key, live: changing it in Settings updates an open lesson. */
export const useVoiceKey = (): VoiceKey => useSyncExternalStore(subscribeVoiceKey, readVoiceKey, readVoiceKey);
