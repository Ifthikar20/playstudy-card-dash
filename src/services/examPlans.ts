/**
 * Exam study plans — "my exam is on the 2nd, what do I study today?"
 * Mirrors playstudy-backend/app/api/study_plans.py. The server owns the split;
 * every call here returns the whole plan back, so callers just replace theirs.
 */
import { authService } from "./authService";
import { todayIso, type ExamPlan } from "@/lib/examPlan";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function headers(): Record<string, string> {
  const token = authService.getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function fail(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error(typeof body?.detail === "string" ? body.detail : fallback);
}

export interface PlanRequest {
  /** YYYY-MM-DD. */
  examDate: string;
  /** How many times a day this student sits down to study (1-6). */
  sittingsPerDay: number;
  label?: string | null;
}

/** Make the plan, or lay it out again from today. Ticked days keep their tick. */
export async function saveExamPlan(sessionId: string, plan: PlanRequest): Promise<ExamPlan> {
  const res = await fetch(`${API_URL}/study-sessions/${sessionId}/plan`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      exam_date: plan.examDate,
      sittings_per_day: plan.sittingsPerDay,
      label: plan.label ?? null,
      // Their date, not the server's, so the plan starts on the day they're having.
      today: todayIso(),
    }),
  });
  if (!res.ok) await fail(res, "Could not save your study plan");
  return await res.json();
}

/** Tick a day off (or put it back). */
export async function setPlanDayDone(sessionId: string, day: string, done: boolean): Promise<ExamPlan> {
  const res = await fetch(`${API_URL}/study-sessions/${sessionId}/plan/days/${day}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ done }),
  });
  if (!res.ok) await fail(res, "Could not save that day");
  return await res.json();
}

export async function deleteExamPlan(sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/study-sessions/${sessionId}/plan`, { method: "DELETE", headers: headers() });
  if (!res.ok) await fail(res, "Could not remove the plan");
}

/** One session's plan. Null when it hasn't got one. */
export async function fetchExamPlan(sessionId: string): Promise<ExamPlan | null> {
  const res = await fetch(`${API_URL}/study-sessions/${sessionId}/plan`, { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) await fail(res, "Could not load your study plan");
  return await res.json();
}
