/*
  The student's talk key, wherever the page listens for it.

  One key does one thing at a time: in Teach mode it opens the microphone for a
  question, on a notes page it starts and stops dictation. Every screen used to carry
  its own copy of the listener and each one guarded typing differently (Teach mode
  ignored the key in any input, the blank note only in its own textarea), so this is
  the one listener, with one rule:

  - A key with no modifier (the default is plain M) is a letter the student may be
    TYPING. While focus is in an input, a textarea, a select, anything contentEditable
    or one of our own editors ([data-an-input]), it types; it doesn't toggle anything.
  - A key with a modifier (Alt + Space, Ctrl + Shift + V) can't be typing, so it works
    everywhere, including inside the note editor: that is how a student dictates into
    the very line they're writing.

  Shift doesn't count as a modifier here: Shift + M types a capital M.

  Menus own their keys (type-ahead, arrows), so nothing fires inside one, the same
  as Teach mode's voice picker always did. A held key repeats; only the first press
  counts, or the microphone would flicker on and off.
*/
import { useEffect, useRef } from "react";
import { matchesVoiceKey, useVoiceKey, type VoiceKey } from "@/lib/voiceKey";

const NOT_TYPING_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"]);

/** Whether keys pressed with focus on `el` are text being typed. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName === "INPUT") return !NOT_TYPING_INPUTS.has((el as HTMLInputElement).type);
  return !!el.closest("[data-an-input]");
}

/** A plain key: no Alt, Ctrl or Cmd/Win (Shift alone still types a letter). */
export const isBareKey = (k: VoiceKey): boolean => !k.alt && !k.ctrl && !k.meta;

/**
 * Call `onToggle` when the student presses their talk key. Returns the key, live, for
 * labels ("press M to dictate"). `enabled: false` removes the listener altogether, so
 * two owners (dictation and Teach mode) never both answer one keypress.
 */
export function useTalkKey(onToggle: (e: KeyboardEvent) => void, opts: { enabled?: boolean } = {}): VoiceKey {
  const enabled = opts.enabled ?? true;
  const voiceKey = useVoiceKey();
  // Refs, so a new callback each render (or the student changing the key in Settings
  // while the page is open) never re-binds the listener mid-keypress.
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;
  const keyRef = useRef(voiceKey);
  keyRef.current = voiceKey;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // something closer to the key already handled it
      const key = keyRef.current;
      if (!matchesVoiceKey(e, key)) return;
      const target = (e.target as Element | null) ?? document.activeElement;
      if (target instanceof Element && target.closest('[role="menu"],[role="listbox"]')) return;
      if (isBareKey(key) && (isTypingTarget(target) || isTypingTarget(document.activeElement))) return;
      e.preventDefault();
      if (e.repeat) return;
      toggleRef.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  return voiceKey;
}
