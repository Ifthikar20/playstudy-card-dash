/**
 * Experience (XP) — the single source of truth for how XP is earned.
 * Mirrored on the backend in app/core/xp.py; keep both in sync.
 *
 * Earning
 *   minute studied ........ +2   (measured reading time, not time with the tab open)
 *   correct answer ........ +10  (the first try only, whatever kind of question: one got after a hint earns nothing)
 *   topic completed ....... +25  (once per topic: finishing it again after a retry doesn't pay twice)
 *   perfect topic ......... +25 extra (every question right, paid with the first finish)
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
  { key: "correctAnswer", label: "Correct answer", hint: "right on the first try, in any mode" },
  { key: "topicCompleted", label: "Topic completed", hint: "the first time you finish a topic's quiz" },
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
 *
 * `firstFinish: false` is a topic finished before (a Retry, or fresh questions):
 * its answers still earned their XP, but the completion bonuses were paid the
 * first time and aren't listed or paid again. Without this a student could
 * farm the +25 (and the +100 for the session) by retrying one short quiz.
 *
 * `unit` names what was finished in the lines ("part" for a stretch of a PDF, which
 * earns the same as a topic); the amounts don't change.
 */
export function topicCompletionXp(
  correct: number,
  total: number,
  opts: { sessionCompleted?: boolean; firstFinish?: boolean; unit?: string } = {},
): XpBreakdown & { bonus: number } {
  const unit = opts.unit ?? "topic";
  const lines: XpLine[] = [];
  const answers = correct * XP_RULES.correctAnswer;
  lines.push({ label: "Correct answers", amount: answers, detail: `${correct} × ${XP_RULES.correctAnswer}` });
  if (opts.firstFinish === false) return { lines, total: answers, bonus: 0 };
  let bonus = XP_RULES.topicCompleted;
  lines.push({ label: `${unit.charAt(0).toUpperCase()}${unit.slice(1)} completed`, amount: XP_RULES.topicCompleted });
  if (total > 0 && correct === total) {
    bonus += XP_RULES.perfectTopic;
    lines.push({ label: `Perfect ${unit}`, amount: XP_RULES.perfectTopic, detail: "every question right" });
  }
  if (opts.sessionCompleted) {
    bonus += XP_RULES.sessionCompleted;
    lines.push({ label: "Session completed", amount: XP_RULES.sessionCompleted, detail: "all topics done" });
  }
  const total_ = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total: total_, bonus };
}

export const formatXp = (n: number) => `${Math.round(n).toLocaleString()} XP`;
