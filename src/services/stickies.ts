/**
 * Sticky notes — the important bits a student keeps from their studying.
 * Mirrors anothernotes-backend/app/api/sticky_notes.py.
 */
import { authFetch } from "./authFetch";
import { authService } from "./authService";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export type StickyColor = "amber" | "pink" | "green" | "blue" | "violet";
/** How the note came to be kept: typed by hand, highlighted in the notes, a key idea, or from Teach mode. */
export type StickySource = "manual" | "highlight" | "key-idea" | "teach";

export interface StickyNote {
  id: number;
  text: string;
  color: StickyColor;
  source: StickySource;
  study_session_id: string | null;
  topic_id: number | null;
  section_title: string | null;
  /** The name of the session it came from, resolved by the server. */
  session_title: string | null;
  created_at: string;
}

export interface NewStickyNote {
  text: string;
  color?: StickyColor;
  source?: StickySource;
  study_session_id?: string | null;
  topic_id?: number | null;
  section_title?: string | null;
}

function headers(): Record<string, string> {
  const token = authService.getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function fail(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error(typeof body?.detail === "string" ? body.detail : fallback);
}

/** Every sticky note, newest first; `sessionId` narrows them to one study session. */
export async function listStickyNotes(sessionId?: string): Promise<StickyNote[]> {
  const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  const res = await authFetch(`${API_URL}/sticky-notes${query}`, { headers: headers() });
  if (!res.ok) await fail(res, "Could not load your sticky notes");
  return await res.json();
}

/** Keep something. Saving the same words twice gives back the note that is already there. */
export async function createStickyNote(note: NewStickyNote): Promise<StickyNote> {
  const res = await authFetch(`${API_URL}/sticky-notes`, { method: "POST", headers: headers(), body: JSON.stringify(note) });
  if (!res.ok) await fail(res, "Could not save that to a sticky note");
  return await res.json();
}

export async function updateStickyNote(id: number, patch: { text?: string; color?: StickyColor }): Promise<StickyNote> {
  const res = await authFetch(`${API_URL}/sticky-notes/${id}`, { method: "PUT", headers: headers(), body: JSON.stringify(patch) });
  if (!res.ok) await fail(res, "Could not update that sticky note");
  return await res.json();
}

export async function deleteStickyNote(id: number): Promise<void> {
  const res = await authFetch(`${API_URL}/sticky-notes/${id}`, { method: "DELETE", headers: headers() });
  if (!res.ok && res.status !== 404) await fail(res, "Could not throw that sticky note away");
}
