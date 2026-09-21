import { create } from "zustand";
import { syncPresence } from "@/services/activity";

/**
 * Presence tracker — measures how long the user is actually interacting with
 * the platform (reading + writing), not merely how long the tab is open.
 *
 * Model
 *  - Any pointer / keyboard / scroll / touch event marks the user as active.
 *  - With no input for IDLE_AFTER_MS, or while the tab is hidden, the user is
 *    "away": the timer stops and the indicator turns red.
 *  - Each active second is attributed to *writing* when a key was pressed in
 *    the last WRITING_WINDOW_MS, otherwise to *reading*.
 *  - Totals are per user per calendar day, persisted to localStorage so a
 *    reload doesn't reset the counter.
 *
 * Start once per signed-in user with `startPresenceTracking(userId)`; the
 * returned function stops it. Components subscribe via `usePresenceStore`.
 */

export const IDLE_AFTER_MS = 60_000; // no input for a minute → away
const WRITING_WINDOW_MS = 5_000; // a keystroke keeps the next 5s "writing"
const TICK_MS = 1_000;
const PERSIST_EVERY_TICKS = 5;
const SYNC_EVERY_TICKS = 60; // push today's totals to the server once a minute while active

export type PresenceStatus = "active" | "away";

interface PresenceState {
  status: PresenceStatus;
  /** total seconds of interaction today */
  activeSeconds: number;
  readingSeconds: number;
  writingSeconds: number;
  /** epoch ms of the last input event */
  lastActivityAt: number;
  /** epoch ms when tracking started this page load */
  startedAt: number;
  /** epoch ms when the current active streak began (null while away) */
  streakStartedAt: number | null;
  tracking: boolean;
}

export const usePresenceStore = create<PresenceState>(() => ({
  status: "away",
  activeSeconds: 0,
  readingSeconds: 0,
  writingSeconds: 0,
  lastActivityAt: 0,
  startedAt: 0,
  streakStartedAt: null,
  tracking: false,
}));

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "pointermove",
  "pointerdown",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
];

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function storageKey(userId: string, day: string) {
  return `an-presence:${userId}:${day}`;
}

function load(userId: string, day: string) {
  try {
    const raw = localStorage.getItem(storageKey(userId, day));
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.active !== "number") return null;
    return { active: v.active, reading: v.reading ?? 0, writing: v.writing ?? 0 };
  } catch {
    return null; // private mode — the totals just won't persist
  }
}

function save(userId: string, day: string, s: PresenceState) {
  try {
    localStorage.setItem(
      storageKey(userId, day),
      JSON.stringify({ active: s.activeSeconds, reading: s.readingSeconds, writing: s.writingSeconds }),
    );
  } catch {
    /* private mode */
  }
}

/** Server copy of today's totals — the dashboard's "studied" time and streak come from this. */
function push(day: string, s: PresenceState) {
  syncPresence(day, { active: s.activeSeconds, reading: s.readingSeconds, writing: s.writingSeconds });
}

let stopCurrent: (() => void) | null = null;

export function startPresenceTracking(userId: string): () => void {
  stopCurrent?.();

  let day = dayKey();
  const persisted = load(userId, day);
  let lastKeyAt = 0;
  let ticks = 0;
  const now = Date.now();

  usePresenceStore.setState({
    tracking: true,
    startedAt: now,
    lastActivityAt: now,
    streakStartedAt: now,
    status: document.visibilityState === "visible" ? "active" : "away",
    activeSeconds: persisted?.active ?? 0,
    readingSeconds: persisted?.reading ?? 0,
    writingSeconds: persisted?.writing ?? 0,
  });
  if (persisted && persisted.active > 0) push(day, usePresenceStore.getState()); // catch up after an offline stretch

  // Input events only stamp the time; the interval below does the accounting.
  // Throttled so a busy pointermove stream doesn't thrash the store.
  let lastStamp = 0;
  const onActivity = (e: Event) => {
    const t = Date.now();
    if (e.type === "keydown") lastKeyAt = t;
    if (t - lastStamp < 250) return;
    lastStamp = t;
    const s = usePresenceStore.getState();
    usePresenceStore.setState({
      lastActivityAt: t,
      status: "active",
      streakStartedAt: s.status === "active" && s.streakStartedAt ? s.streakStartedAt : t,
    });
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      usePresenceStore.setState({ status: "away", streakStartedAt: null });
      const s = usePresenceStore.getState();
      save(userId, day, s);
      push(day, s);
    } else {
      onActivity(new Event("visibilitychange"));
    }
  };

  for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  const timer = window.setInterval(() => {
    const t = Date.now();
    const s = usePresenceStore.getState();

    // Day rollover: start a fresh daily total.
    const today = dayKey();
    if (today !== day) {
      save(userId, day, s);
      push(day, s);
      day = today;
      usePresenceStore.setState({ activeSeconds: 0, readingSeconds: 0, writingSeconds: 0 });
    }

    const visible = document.visibilityState === "visible";
    const recentlyActive = t - s.lastActivityAt < IDLE_AFTER_MS;

    if (!visible || !recentlyActive) {
      if (s.status !== "away") usePresenceStore.setState({ status: "away", streakStartedAt: null });
      return;
    }

    const writing = t - lastKeyAt < WRITING_WINDOW_MS;
    usePresenceStore.setState({
      status: "active",
      activeSeconds: s.activeSeconds + 1,
      readingSeconds: s.readingSeconds + (writing ? 0 : 1),
      writingSeconds: s.writingSeconds + (writing ? 1 : 0),
      streakStartedAt: s.streakStartedAt ?? t,
    });

    ticks++;
    if (ticks % PERSIST_EVERY_TICKS === 0) save(userId, day, usePresenceStore.getState());
    if (ticks % SYNC_EVERY_TICKS === 0) push(day, usePresenceStore.getState());
  }, TICK_MS);

  const stop = () => {
    window.clearInterval(timer);
    for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity);
    document.removeEventListener("visibilitychange", onVisibility);
    save(userId, day, usePresenceStore.getState());
    push(day, usePresenceStore.getState());
    usePresenceStore.setState({ tracking: false, status: "away", streakStartedAt: null });
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  return stop;
}

/** "just started" · "15 min" · "1 h 12 min" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 1) return "just started";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
}
