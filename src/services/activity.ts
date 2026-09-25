/**
 * Measured activity — mirrors anothernotes-backend/app/api/activity.py.
 * Everything the dashboard counts (answers, accuracy, study time, XP) starts
 * as one of these calls.
 */
import { authService } from "./authService";
import { FILL_MAX } from "@/lib/quiz/grade";
import type { QuestionKind, QuizResponse } from "@/lib/quiz/types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

/** "pdf_quiz" is a question on a PDF's pages (its question_id is "pdf:{quizId}.{generation}:{n}"). */
export type AnswerMode = "full_study" | "speed_run" | "quiz" | "game" | "mentor" | "pdf_quiz";

export interface AnswerEventIn {
  session_id?: string | null;
  topic_id?: number | null;
  question_id?: string | null;
  correct: boolean;
  mode: AnswerMode;
  /** ISO timestamp; defaults to now on the server */
  at?: string;
  /** The question's kind (missing means single choice, as before kinds existed). */
  kind?: QuestionKind;
  /** What was picked or typed, so a guardian can see it. The server drops one over 1 KB. */
  response?: QuizResponse;
}

export interface ActivitySummary {
  totalSessions: number;
  questionsAnswered: number;
  correctAnswers: number;
  averageAccuracy: number;
  activeSeconds: number;
  readingSeconds: number;
  writingSeconds: number;
  totalStudyTime: string;
  streakDays: number;
  measured: true;
}

/** A response as it goes into the answer log: a typed answer cut to what the server keeps. */
export function loggedResponse(r: QuizResponse): QuizResponse {
  return r.kind === "fill" && r.text.length > FILL_MAX ? { kind: "fill", text: r.text.slice(0, FILL_MAX) } : r;
}

function headers(): Record<string, string> {
  const token = authService.getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** Batch-record answered questions. Resolves to the number stored. */
export async function recordAnswers(answers: AnswerEventIn[]): Promise<number> {
  if (answers.length === 0 || !authService.getToken()) return 0;
  const res = await fetch(`${API_URL}/activity/answers`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ answers }),
    keepalive: true,
  });
  if (!res.ok) throw new Error(`activity/answers ${res.status}`);
  return (await res.json()).recorded ?? answers.length;
}

/** Send today's cumulative presence totals (seconds). Safe to repeat; the server keeps the max. */
export function syncPresence(day: string, totals: { active: number; reading: number; writing: number }): void {
  const token = authService.getToken();
  if (!token) return;
  const body = JSON.stringify({ day, ...totals });
  // keepalive lets the request finish even when the tab is being closed
  fetch(`${API_URL}/activity/presence`, { method: "POST", headers: headers(), body, keepalive: true }).catch(() => {
    /* offline — the next tick will retry with the larger total */
  });
}

export interface ActivityDayRow {
  /** yyyy-MM-dd */
  day: string;
  active: number;
  reading: number;
  writing: number;
  answers: number;
}

export interface ActivityDays {
  since: string;
  days: ActivityDayRow[];
  currentStreak: number;
  longestStreak: number;
}

/** GET that answers null whenever there's nothing to show - an error status or no server at all. */
async function getOrNull<T>(path: string): Promise<T | null> {
  if (!authService.getToken()) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, { headers: headers() });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null; // unreachable server: the card shows its empty state instead of an uncaught error
  }
}

/** Per-day interaction for the streak heatmap (up to 400 days). */
export async function fetchActivityDays(days = 400): Promise<ActivityDays | null> {
  return getOrNull<ActivityDays>(`/activity/days?days=${days}`);
}

export async function fetchActivitySummary(): Promise<ActivitySummary | null> {
  return getOrNull<ActivitySummary>("/activity/summary");
}
