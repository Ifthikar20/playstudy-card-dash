import { create } from "zustand";
import {
  createStickyNote,
  deleteStickyNote,
  listStickyNotes,
  updateStickyNote,
  type NewStickyNote,
  type StickyColor,
  type StickyNote,
} from "@/services/stickies";

/*
  Sticky notes live in their own store because they are written in one place and
  read in another: a student saves a phrase while reading a section, then sees it
  on the dashboard. The app's main data is loaded once at sign-in, so notes saved
  mid-session would never reach it — here every save updates the one list that
  both pages render.
*/

interface StickyState {
  notes: StickyNote[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  /** Fetch the wall once; `force` refetches (after saving somewhere else, say). */
  load: (force?: boolean) => Promise<void>;
  /** Keep something new. Resolves to the saved note (or the one that already held those words). */
  add: (note: NewStickyNote) => Promise<StickyNote>;
  edit: (id: number, patch: { text?: string; color?: StickyColor }) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

const byNewest = (a: StickyNote, b: StickyNote) => b.created_at.localeCompare(a.created_at) || b.id - a.id;

/** Loads that found no server at all, in a row; retried every few seconds up to about five minutes. */
let unreachableTries = 0;
const RETRY_MS = 5000;
const MAX_RETRIES = 60;

export const useStickyStore = create<StickyState>((set, get) => ({
  notes: [],
  loaded: false,
  loading: false,
  error: null,

  load: async (force = false) => {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true, error: null });
    try {
      const notes = await listStickyNotes();
      unreachableTries = 0;
      set({ notes: notes.sort(byNewest), loaded: true, loading: false });
    } catch (e) {
      // fetch() rejects with a TypeError when nothing answers (the server restarting, or
      // not started locally). Try again shortly instead of leaving the wall on
      // "Failed to fetch" until the page is reloaded.
      if (e instanceof TypeError) {
        const retrying = ++unreachableTries <= MAX_RETRIES;
        set({ loading: false, error: retrying ? "Couldn't reach the server. Trying again…" : "Couldn't reach the server." });
        if (retrying) window.setTimeout(() => void get().load(), RETRY_MS);
        return;
      }
      set({ loading: false, error: e instanceof Error ? e.message : "Could not load your sticky notes" });
    }
  },

  add: async (note) => {
    const saved = await createStickyNote(note);
    // the server hands back the existing note when those words are already kept
    set((s) => ({ notes: [saved, ...s.notes.filter((n) => n.id !== saved.id)].sort(byNewest), loaded: true }));
    return saved;
  },

  edit: async (id, patch) => {
    const before = get().notes;
    set({ notes: before.map((n) => (n.id === id ? { ...n, ...patch } : n)) }); // show it straight away
    try {
      const saved = await updateStickyNote(id, patch);
      set((s) => ({ notes: s.notes.map((n) => (n.id === id ? saved : n)) }));
    } catch (e) {
      set({ notes: before });
      throw e;
    }
  },

  remove: async (id) => {
    const before = get().notes;
    set({ notes: before.filter((n) => n.id !== id) });
    try {
      await deleteStickyNote(id);
    } catch (e) {
      set({ notes: before });
      throw e;
    }
  },
}));

/** How many notes a given study session has produced. */
export const stickyCountFor = (notes: StickyNote[], sessionId?: string | null): number =>
  sessionId ? notes.filter((n) => n.study_session_id === sessionId).length : 0;
