/*
  The exam study plan, as the pages read it.

  The server owns the split (app/core/study_plan.py) — it decides which sections
  fall on which day and what each sitting is for. Everything here is presentation:
  the student's own date (so a plan doesn't jump a day for someone in Auckland),
  the words for a day, and the small sums the cards show.
*/

export type PlanDayKind = "learn" | "revise" | "exam";
export type SittingMode = "learn" | "quiz" | "flashcards" | "revise" | "wrong";

export interface PlanSitting {
  mode: SittingMode;
  /** Topic ids for this sitting; empty on an exam day. */
  topics: number[];
}

export interface PlanDay {
  /** YYYY-MM-DD in the student's own timezone. */
  date: string;
  kind: PlanDayKind;
  topics: number[];
  sittings: PlanSitting[];
  done: boolean;
}

export interface ExamPlan {
  sessionId: string;
  sessionTitle: string;
  examDate: string;
  sittingsPerDay: number;
  label: string | null;
  days: PlanDay[];
  /** Distinct questions this student has got wrong here — what a revision sitting works through. */
  wrongCount: number;
}

/** Today where the student is, not where the server is. */
export function todayIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const [a, b] = [new Date(`${fromIso}T00:00:00`), new Date(`${toIso}T00:00:00`)];
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export const studyDays = (plan: ExamPlan): PlanDay[] => plan.days.filter((d) => d.kind !== "exam");

export const dayFor = (plan: ExamPlan, iso: string): PlanDay | null =>
  plan.days.find((d) => d.kind !== "exam" && d.date === iso) ?? null;

/** 1-based position of a date in the run-up, for "Day 3 of 8". */
export function dayNumber(plan: ExamPlan, iso: string): number | null {
  const i = studyDays(plan).findIndex((d) => d.date === iso);
  return i < 0 ? null : i + 1;
}

/** Days that have gone by without being ticked off. */
export const daysBehind = (plan: ExamPlan, iso: string): PlanDay[] =>
  studyDays(plan).filter((d) => d.date < iso && !d.done);

export function examCountdown(plan: ExamPlan, iso: string): string {
  const left = daysBetween(iso, plan.examDate);
  if (left < 0) return "Exam has passed";
  if (left === 0) return "Exam today";
  if (left === 1) return "Exam tomorrow";
  return `Exam in ${left} days`;
}

/** What a sitting asks the student to do, in their own words. */
export const SITTING_LABEL: Record<SittingMode, string> = {
  learn: "Learn",
  revise: "Go back over",
  quiz: "Quiz yourself",
  flashcards: "Flashcards",
  wrong: "Questions you got wrong",
};

/**
 * The sittings that are a section's study tool, and which one. Their chip opens it
 * on that section (its quiz, its flashcards) rather than only scrolling there: the
 * tools live behind the section's header buttons now, not at the foot of its notes,
 * so scrolling alone would land on a section with nothing to do.
 */
export const SITTING_TOOL: Partial<Record<SittingMode, "quiz" | "flashcards">> = {
  quiz: "quiz",
  flashcards: "flashcards",
};

export const DAY_LABEL: Record<PlanDayKind, string> = {
  learn: "New sections",
  revise: "Revision",
  exam: "Exam day",
};

/** "Mon 6 Oct" — short, and never the year, because a plan is always weeks away at most. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** "today" / "tomorrow" / "Mon 6 Oct", for a line that reads like speech. */
export function relativeDay(iso: string, from: string = todayIso()): string {
  const diff = daysBetween(from, iso);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return shortDate(iso);
}

/*
  Plan days on the calendar page.

  These are generated on the fly rather than written into the calendar store: the
  plan can be redone at any moment, and a generated day must never outlive it.
  They borrow the calendar's own "study" and "exam" kinds, so every view renders
  them without knowing anything about plans.
*/
export interface PlanCalendarEvent {
  id: string;
  title: string;
  kind: "study" | "exam";
  start: string;
  /** Always a whole day, so there is never an end time — kept for the calendar's shape. */
  end?: string;
  allDay: true;
  sessionId: string;
  notes?: string;
  source: "plan";
}

export function planCalendarEvents(plans: ExamPlan[]): PlanCalendarEvent[] {
  const out: PlanCalendarEvent[] = [];
  for (const plan of plans) {
    const name = plan.label || plan.sessionTitle;
    const total = studyDays(plan).length;
    plan.days.forEach((day, i) => {
      if (day.kind === "exam") {
        out.push({
          id: `plan-${plan.sessionId}-exam`,
          title: `${name} exam`,
          kind: "exam",
          start: `${day.date}T09:00:00`,
          allDay: true,
          sessionId: plan.sessionId,
          source: "plan",
        });
        return;
      }
      const jobs = day.sittings.map((s) => SITTING_LABEL[s.mode]).join(" · ");
      out.push({
        id: `plan-${plan.sessionId}-${day.date}`,
        title: `${day.done ? "✓ " : ""}${name} · day ${i + 1} of ${total}`,
        kind: "study",
        start: `${day.date}T09:00:00`,
        allDay: true,
        sessionId: plan.sessionId,
        notes: `${DAY_LABEL[day.kind]}${jobs ? ` — ${jobs}` : ""}`,
        source: "plan",
      });
    });
  }
  return out;
}
