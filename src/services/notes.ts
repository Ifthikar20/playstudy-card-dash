/**
 * Notes and section checks.
 *
 * A note is a study session with source_kind "note" (see lib/notes/isNote.ts), so its
 * text is saved through the same topic endpoints as any Full Study section. What is
 * here is the rest:
 *  - creating, renaming and deleting a note  (/api/notes, playstudy-backend/app/api/notes.py)
 *  - checking ANY section's notes for mistakes, and answering or fixing what the tutor
 *    asked about  (/api/study-sessions/{sid}/topics/{tid}/notes/..., app/api/section_checks.py)
 */
import { authFetch } from "./authFetch";
import { authService } from "./authService";
import { forgetCachedSession } from "./api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

/** What the student said back about a flagged phrase. */
export type CheckAnswer = "kept" | "fixed" | "skipped";

/** One thing the tutor thinks may be wrong in a section's notes. */
export interface NoteCheck {
  id: string;
  /** The words as the student READS them (rendered text, no Markdown), so the page
   *  can find them on screen with findQuoteRange. */
  quote: string;
  /** Where those words sit in the section's MARKDOWN source; -1 once they are gone. */
  start: number;
  end: number;
  /** "wrong" is a plain error; "check" is something that may just be their shorthand. */
  kind: "wrong" | "check";
  /** What the tutor asks, spoken and shown in the bubble. */
  question: string;
  /** The words that should replace the quote — empty when the tutor isn't sure. */
  fix: string;
  answer: CheckAnswer | null;
}

export interface CheckResult {
  checks: NoteCheck[];
  /** Said when there is nothing to ask ("Nothing looks wrong in there.") or too little to check. */
  message: string;
  /** When they were checked; null when there was too little to check. */
  checkedAt?: string | null;
}

function headers(): Record<string, string> {
  const token = authService.getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function fail(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  const detail = body?.detail;
  const message =
    typeof detail === "string" ? detail : Array.isArray(detail) && typeof detail[0]?.msg === "string" ? detail[0].msg : fallback;
  const error = new Error(message) as Error & { status?: number };
  error.status = res.status;
  throw error;
}

/* ------------------------------------------------------------------ notes */

/** A new, empty note: a one-section study session. Returns the same shape as
 *  GET /api/study-sessions/{id}, so it can go straight into the store. */
export async function createNote(title = ""): Promise<{ id: string; title: string } & Record<string, unknown>> {
  const res = await authFetch(`${API_URL}/notes`, { method: "POST", headers: headers(), body: JSON.stringify({ title }) });
  if (!res.ok) await fail(res, "Could not start a new note");
  return await res.json();
}

/** Rename a note — the session, its chapter and its one section keep the same title. */
export async function renameNote(id: string, title: string): Promise<{ id: string; title: string; updatedAt: number | null }> {
  const res = await authFetch(`${API_URL}/notes/${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ title }) });
  if (!res.ok) await fail(res, "Could not rename that note");
  forgetCachedSession(id);
  return await res.json();
}

export async function deleteNote(id: string): Promise<void> {
  const res = await authFetch(`${API_URL}/notes/${id}`, { method: "DELETE", headers: headers() });
  if (!res.ok && res.status !== 404) await fail(res, "Could not delete that note");
}

/* --------------------------------------------------------- section checks */

const checksUrl = (sessionId: string, topicDbId: number) =>
  `${API_URL}/study-sessions/${sessionId}/topics/${topicDbId}/notes`;

/** Read a section back and ask about anything that looks wrong. */
export async function checkSection(sessionId: string, topicDbId: number): Promise<CheckResult> {
  const res = await authFetch(`${checksUrl(sessionId, topicDbId)}/check`, { method: "POST", headers: headers() });
  if (!res.ok) await fail(res, "Couldn't check these notes just now");
  forgetCachedSession(sessionId);
  return await res.json();
}

export async function getChecks(sessionId: string, topicDbId: number): Promise<NoteCheck[]> {
  const res = await authFetch(`${checksUrl(sessionId, topicDbId)}/checks`, { headers: headers() });
  if (!res.ok) await fail(res, "Couldn't load the questions about these notes");
  const body = await res.json();
  return body.checks ?? [];
}

/** Record what they said back: kept it, fixed it themselves, or moved on. */
export async function answerCheck(sessionId: string, topicDbId: number, checkId: string, answer: CheckAnswer): Promise<NoteCheck[]> {
  const res = await authFetch(`${checksUrl(sessionId, topicDbId)}/checks/${checkId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ answer }),
  });
  if (!res.ok) await fail(res, "Could not save your answer");
  forgetCachedSession(sessionId);
  const body = await res.json();
  return body.checks ?? [];
}

/** Apply the tutor's fix. The server splices it into the Markdown, keeping bold, marks
 *  and links around it; a 409 means the words have moved and it must be fixed by hand. */
export async function fixCheck(
  sessionId: string,
  topicDbId: number,
  checkId: string,
  replacement?: string,
): Promise<{ notes: string; checks: NoteCheck[] }> {
  const res = await authFetch(`${checksUrl(sessionId, topicDbId)}/checks/${checkId}/fix`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(replacement == null ? {} : { replacement }),
  });
  if (!res.ok) await fail(res, "Couldn't apply that fix");
  forgetCachedSession(sessionId);
  return await res.json();
}

/** Forget every question about a section. */
export async function clearChecks(sessionId: string, topicDbId: number): Promise<void> {
  const res = await authFetch(`${checksUrl(sessionId, topicDbId)}/checks`, { method: "DELETE", headers: headers() });
  if (!res.ok && res.status !== 404) await fail(res, "Couldn't clear those questions");
}
