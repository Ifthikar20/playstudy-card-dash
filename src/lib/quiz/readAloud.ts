/*
  Whether the tutor reads a quiz on Teach mode's board aloud: each question, a word on
  each answer, the answer when it's shown. On unless the student turns it off (the
  speaker button on the quiz); kept in this browser, like the other small preferences.

  The quiz only offers the switch. Teach mode is what speaks, and it asks readAloudOn()
  before saying a quiz's line. Hints still go up in the tutor's bubble either way.
*/

const KEY = "an-quiz-read-aloud";

const listeners = new Set<() => void>();
/** The switch as last set on this page, for a browser that won't store it (a private window). */
let here = true;

/** Whether quiz lines are spoken (on unless turned off). */
export function readAloudOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return here;
  }
}

/** Turn reading aloud on or off, and tell every switch showing it. */
export function setReadAloud(on: boolean): void {
  here = on;
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "off");
  } catch {
    // storage blocked: `here` keeps it for this page
  }
  listeners.forEach((fn) => fn());
}

/**
 * Hear about changes, here and from another tab (for useSyncExternalStore). Returns
 * the unsubscribe.
 */
export function subscribeReadAloud(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) fn();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
