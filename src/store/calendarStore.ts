import { create } from "zustand";
import { parseIcs } from "@/lib/ics";

/**
 * Calendar events — exams, study blocks, deadlines and classes.
 *
 * Local-first: events live in localStorage per user (`ps-calendar:<userId>`)
 * until a backend endpoint exists. Two ways in: the add/edit dialog, or an
 * .ics import (Google Calendar, Outlook, school portals).
 */

export type EventKind = "exam" | "study" | "deadline" | "class" | "other";

export interface CalendarEvent {
  id: string;
  title: string;
  kind: EventKind;
  /** ISO 8601 */
  start: string;
  /** ISO 8601; omitted for all-day / instant events */
  end?: string;
  allDay: boolean;
  sessionId?: string;
  notes?: string;
  location?: string;
  source: "manual" | "import";
  /** iCalendar UID, used to dedupe repeat imports */
  uid?: string;
}

export const KIND_LABELS: Record<EventKind, string> = {
  exam: "Exam",
  study: "Study block",
  deadline: "Deadline",
  class: "Class",
  other: "Other",
};

interface CalendarState {
  userId: string | null;
  events: CalendarEvent[];
  load: (userId: string) => void;
  add: (e: Omit<CalendarEvent, "id" | "source">) => CalendarEvent;
  update: (id: string, patch: Partial<CalendarEvent>) => void;
  remove: (id: string) => void;
  importIcs: (text: string) => { added: number; skipped: number; warnings: string[] };
}

const key = (userId: string) => `ps-calendar:${userId}`;

function persist(userId: string | null, events: CalendarEvent[]) {
  if (!userId) return;
  try {
    localStorage.setItem(key(userId), JSON.stringify(events));
  } catch {
    /* private mode — the calendar just won't persist */
  }
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Guess a kind from an imported title: "Midterm exam" → exam, "Essay due" → deadline… */
function guessKind(title: string): EventKind {
  const t = title.toLowerCase();
  if (/\b(exam|test|quiz|midterm|final)\b/.test(t)) return "exam";
  if (/\b(due|deadline|submit|submission|assignment)\b/.test(t)) return "deadline";
  if (/\b(lecture|class|seminar|lab|tutorial)\b/.test(t)) return "class";
  if (/\b(study|revise|revision|review)\b/.test(t)) return "study";
  return "other";
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  userId: null,
  events: [],

  load: (userId) => {
    let events: CalendarEvent[] = [];
    try {
      const raw = localStorage.getItem(key(userId));
      if (raw) events = JSON.parse(raw);
    } catch {
      events = [];
    }
    set({ userId, events });
  },

  add: (e) => {
    const ev: CalendarEvent = { ...e, id: newId(), source: "manual" };
    const events = [...get().events, ev];
    set({ events });
    persist(get().userId, events);
    return ev;
  },

  update: (id, patch) => {
    const events = get().events.map((e) => (e.id === id ? { ...e, ...patch } : e));
    set({ events });
    persist(get().userId, events);
  },

  remove: (id) => {
    const events = get().events.filter((e) => e.id !== id);
    set({ events });
    persist(get().userId, events);
  },

  importIcs: (text) => {
    const { events: parsed, warnings } = parseIcs(text);
    const existing = new Set(get().events.map((e) => e.uid).filter(Boolean));
    let added = 0;
    let skipped = 0;
    const next = [...get().events];
    for (const p of parsed) {
      if (existing.has(p.uid)) {
        skipped++;
        continue;
      }
      next.push({
        id: newId(),
        uid: p.uid,
        title: p.title,
        kind: guessKind(p.title),
        start: p.start.toISOString(),
        end: p.end?.toISOString(),
        allDay: p.allDay,
        notes: p.description,
        location: p.location,
        source: "import",
      });
      added++;
    }
    set({ events: next });
    persist(get().userId, next);
    return { added, skipped, warnings };
  },
}));
