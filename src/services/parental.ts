/**
 * Parental access — mirrors plays-study-backend-auth/app/api/parental.py.
 *
 * Deliberately standalone, on the src/services/activity.ts pattern, and it
 * must stay that way: it never imports from src/services/api.ts and never
 * writes to the zustand app store.
 *
 * The reason is a trap rather than a preference. fetchAppData caches into
 * localStorage under global, non-user-scoped keys (playstudy_sessions), and
 * useAppData keys its react-query entry on ['appData'] with no user in it.
 * Rendering a child's data through either would overwrite the *guardian's*
 * own dashboard with their child's work. So child data has its own fetchers
 * and its own query keys, and every component that shows it renders from
 * props.
 */
import { authService } from "./authService";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export type GuardianshipOrigin = "created" | "claimed";
export type GuardianshipScope = "progress" | "settings" | "detail";

export interface GuardianshipInfo {
  id: string;
  origin: GuardianshipOrigin;
  status: string;
  scopes: GuardianshipScope[];
  since: string | null;
}

export interface ChildStats {
  streakDays: number;
  questionsAnswered: number;
  averageAccuracy: number;
  totalStudyTime: string;
  activeSeconds: number;
  totalSessions: number;
  /** Progress XP plus read-time XP — the number the learner sees themselves. */
  xp: number;
}

export interface ChildSummary {
  id: string;
  name: string;
  username: string | null;
  accountKind: "standard" | "managed_child";
  birthYear: number | null;
  createdAt: string | null;
  guardianship: GuardianshipInfo;
  stats: ChildStats;
}

export interface LearningSettings {
  dailyLimitMinutes?: number | null;
  gradeLevel?: string | null;
  weeklyGoalMinutes?: number | null;
}

export interface SessionSummary {
  id: string;
  title: string;
  topic: string;
  progress: number;
  accuracy: number | null;
  isCompleted: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ChildDetail extends ChildSummary {
  learningSettings: LearningSettings;
  recentSessions: SessionSummary[];
}

export interface ChildCreated {
  child: ChildSummary;
  username: string;
  /** Returned exactly once, at creation. It is only stored hashed. */
  pin: string;
}

export interface AnswerDetail {
  id: string;
  at: string;
  correct: boolean;
  mode: string;
  sessionId: string | null;
  sessionTitle: string | null;
  topicTitle: string | null;
  questionText: string | null;
  options: string[] | null;
  correctAnswer: number | null;
  explanation: string | null;
}

export interface AnswerPage {
  answers: AnswerDetail[];
  nextCursor: string | null;
}

export interface GuardianInfo {
  id: string;
  name: string;
  email: string | null;
  since: string | null;
  origin: GuardianshipOrigin;
  scopes: GuardianshipScope[];
  canSeeAnswerDetail: boolean;
  canChangeSettings: boolean;
}

export interface LinkCodeIssued {
  code: string;
  expiresAt: string;
  expiresInSeconds: number;
}

/** Thrown when the guardianship exists but does not cover what was asked for. */
export class ScopeNotGrantedError extends Error {
  scope: string;
  constructor(scope: string, message: string) {
    super(message);
    this.name = "ScopeNotGrantedError";
    this.scope = scope;
  }
}

function headers(): Record<string, string> {
  const token = authService.getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: headers() });
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (res.ok) return data as T;

  const detail = data?.detail;
  if (detail && typeof detail === "object") {
    if (detail.code === "scope_not_granted") {
      throw new ScopeNotGrantedError(detail.scope, detail.message ?? "Not available for this learner");
    }
    throw new Error(detail.message ?? "Something went wrong");
  }
  if (typeof detail === "string") throw new Error(detail);
  // Pydantic validation errors arrive as a list of issues.
  if (Array.isArray(detail) && detail[0]?.msg) throw new Error(String(detail[0].msg).replace(/^Value error, /, ""));
  throw new Error(`Request failed (${res.status})`);
}

// --- guardian side ---------------------------------------------------------

export async function fetchChildren(): Promise<ChildSummary[]> {
  const data = await request<{ children: ChildSummary[] }>("/parental/children");
  return data.children;
}

export function fetchChild(childId: string): Promise<ChildDetail> {
  return request<ChildDetail>(`/parental/children/${childId}`);
}

export function createChild(input: { name: string; pin: string; birthYear?: number | null }): Promise<ChildCreated> {
  return request<ChildCreated>("/parental/children", {
    method: "POST",
    body: JSON.stringify({ name: input.name, pin: input.pin, birthYear: input.birthYear ?? null }),
  });
}

export interface ChildActivity {
  since: string;
  days: { day: string; active: number; reading: number; writing: number; answers: number }[];
  currentStreak: number;
  longestStreak: number;
}

export function fetchChildActivity(childId: string, days = 182): Promise<ChildActivity> {
  return request<ChildActivity>(`/parental/children/${childId}/activity?days=${days}`);
}

export function fetchChildAnswers(
  childId: string,
  options: { limit?: number; cursor?: string | null; correct?: boolean } = {},
): Promise<AnswerPage> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 50));
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.correct !== undefined) params.set("correct", String(options.correct));
  return request<AnswerPage>(`/parental/children/${childId}/answers?${params}`);
}

export function updateChildSettings(childId: string, settings: LearningSettings): Promise<{ learningSettings: LearningSettings }> {
  return request(`/parental/children/${childId}/settings`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

export function resetChildPin(childId: string, pin: string): Promise<{ ok: boolean; tokensRevoked: boolean }> {
  return request(`/parental/children/${childId}/pin`, { method: "POST", body: JSON.stringify({ pin }) });
}

/** Permanent. Only offered for profiles this guardian created. */
export function deleteChild(childId: string, confirmUsername: string): Promise<void> {
  return request(`/parental/children/${childId}?confirm=${encodeURIComponent(confirmUsername)}`, { method: "DELETE" });
}

/** Give up access to a learner who owns their own account. */
export function releaseGuardianship(childId: string): Promise<void> {
  return request(`/parental/children/${childId}/guardianship`, { method: "DELETE" });
}

export function redeemLinkCode(code: string): Promise<{ child: ChildSummary }> {
  return request("/parental/link-codes/redeem", { method: "POST", body: JSON.stringify({ code }) });
}

// --- learner side ----------------------------------------------------------

/** Who can see my progress, and exactly what they see. Read-only by design. */
export async function fetchMyGuardians(): Promise<GuardianInfo[]> {
  const data = await request<{ guardians: GuardianInfo[] }>("/parental/guardians");
  return data.guardians;
}

/** Mint a code to hand to an adult, in person. */
export function requestLinkCode(birthYear?: number | null): Promise<LinkCodeIssued> {
  return request<LinkCodeIssued>("/parental/link-codes", {
    method: "POST",
    body: JSON.stringify({ birthYear: birthYear ?? null }),
  });
}

// --- query keys ------------------------------------------------------------
// Namespaced away from ['appData'] so a guardian looking at a child can never
// evict or overwrite their own dashboard's cache entry.
export const parentalKeys = {
  all: ["parental"] as const,
  children: () => [...parentalKeys.all, "children"] as const,
  child: (childId: string) => [...parentalKeys.all, "child", childId] as const,
  childActivity: (childId: string, days: number) => [...parentalKeys.child(childId), "activity", days] as const,
  childAnswers: (childId: string, correct?: boolean) => [...parentalKeys.child(childId), "answers", correct ?? "all"] as const,
  guardians: () => [...parentalKeys.all, "guardians"] as const,
};
