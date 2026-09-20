/**
 * Experience (XP) — the single source of truth for how XP is earned.
 * Mirrored on the backend in app/core/xp.py; keep both in sync.
 *
 * Earning
 *   minute studied ........ +2   (measured reading time, not time with the tab open)
 *   correct answer ........ +10
 *   topic completed ....... +25
 *   perfect topic ......... +25 extra (every question right)
 *   session completed ..... +100 (every topic in a session done)
 *
 * There are no levels. XP is just time put in plus progress made, so every
 * point traces back to something the student actually did, and the number
 * never means anything other than "this much work".
 */

export const XP_RULES = {
  minuteStudied: 2,
  correctAnswer: 10,
  topicCompleted: 25,
  perfectTopic: 25,
  sessionCompleted: 100,
} as const;

export const XP_RULE_LABELS: { key: keyof typeof XP_RULES; label: string; hint: string }[] = [
  { key: "minuteStudied", label: "Minute of reading", hint: "measured while you're actually reading or answering" },
  { key: "correctAnswer", label: "Correct answer", hint: "in any mode: full study, speed run or a game" },
  { key: "topicCompleted", label: "Topic completed", hint: "finish every question in a topic" },
  { key: "perfectTopic", label: "Perfect topic", hint: "bonus when you get every question right" },
  { key: "sessionCompleted", label: "Session completed", hint: "bonus when every topic in a session is done" },
];

/** XP earned from measured study time. Part-minutes don't count. */
export function studyXp(seconds: number): number {
  return Math.max(0, Math.floor((seconds || 0) / 60)) * XP_RULES.minuteStudied;
}

/** Read time for the XP card: "0m" · "45m" · "2h 5m". */
export function formatStudyTime(seconds: number): string {
  const mins = Math.max(0, Math.floor((seconds || 0) / 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
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
