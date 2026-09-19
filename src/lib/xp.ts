/**
 * Experience (XP) — the single source of truth for how XP is earned and how
 * levels are derived. Mirrored on the backend in app/core/xp.py; keep both in
 * sync.
 *
 * Earning
 *   correct answer ........ +10
 *   topic completed ....... +25
 *   perfect topic ......... +25 extra (every question right)
 *   session completed ..... +100 (every topic in a session done)
 *
 * Levels
 *   The XP needed to *reach* level n is 50 · (n−1) · n, so each level costs
 *   100 XP more than the one before: L2 = 100, L3 = 300, L4 = 600, L5 = 1 000…
 */

export const XP_RULES = {
  correctAnswer: 10,
  topicCompleted: 25,
  perfectTopic: 25,
  sessionCompleted: 100,
} as const;

export const XP_RULE_LABELS: { key: keyof typeof XP_RULES; label: string; hint: string }[] = [
  { key: "correctAnswer", label: "Correct answer", hint: "in any mode: full study, speed run or a game" },
  { key: "topicCompleted", label: "Topic completed", hint: "finish every question in a topic" },
  { key: "perfectTopic", label: "Perfect topic", hint: "bonus when you get every question right" },
  { key: "sessionCompleted", label: "Session completed", hint: "bonus when every topic in a session is done" },
];

/** Cumulative XP required to reach `level` (level 1 = 0). */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return 50 * (n - 1) * n;
}

/** Level for a cumulative XP total. */
export function levelFromXp(xp: number): number {
  const x = Math.max(0, Math.floor(xp || 0));
  // invert 50·(n−1)·n ≤ x  →  n = floor((1 + sqrt(1 + 8x/100)) / 2)
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * x) / 100)) / 2));
}

export interface LevelProgress {
  level: number;
  /** XP since the current level began */
  into: number;
  /** XP needed from the start of this level to the next */
  span: number;
  /** XP still needed to reach the next level */
  remaining: number;
  /** 0–1 */
  ratio: number;
  nextLevel: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - start;
  const into = Math.max(0, Math.floor(xp || 0) - start);
  return { level, into, span, remaining: Math.max(0, span - into), ratio: span ? Math.min(1, into / span) : 1, nextLevel: level + 1 };
}

export interface XpLine {
  label: string;
  amount: number;
  detail?: string;
}

export interface XpBreakdown {
  lines: XpLine[];
  total: number;
}

/**
 * XP for finishing a topic. `correct` answers were already credited one by
 * one while playing (+10 each); this returns the whole picture for the summary
 * card plus the completion bonuses that still need to be awarded.
 */
export function topicCompletionXp(correct: number, total: number, opts: { sessionCompleted?: boolean } = {}): XpBreakdown & { bonus: number } {
  const lines: XpLine[] = [];
  const answers = correct * XP_RULES.correctAnswer;
  lines.push({ label: "Correct answers", amount: answers, detail: `${correct} × ${XP_RULES.correctAnswer}` });
  let bonus = XP_RULES.topicCompleted;
  lines.push({ label: "Topic completed", amount: XP_RULES.topicCompleted });
  if (total > 0 && correct === total) {
    bonus += XP_RULES.perfectTopic;
    lines.push({ label: "Perfect topic", amount: XP_RULES.perfectTopic, detail: "every question right" });
  }
  if (opts.sessionCompleted) {
    bonus += XP_RULES.sessionCompleted;
    lines.push({ label: "Session completed", amount: XP_RULES.sessionCompleted, detail: "all topics done" });
  }
  const total_ = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total: total_, bonus };
}

export const formatXp = (n: number) => `${Math.round(n).toLocaleString()} XP`;
