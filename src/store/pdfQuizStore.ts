import { create } from "zustand";
import { syncProgressSoon, useAppStore, type Question } from "@/store/appStore";
import { completePdfQuiz, getPdfQuiz, listPdfQuizzes, type PdfPageBlocks, type PdfQuiz } from "@/services/pdfQuiz";
import { loggedResponse } from "@/services/activity";
import { XP_RULES, topicCompletionXp, type XpBreakdown } from "@/lib/xp";
import { trackAction } from "@/lib/analytics";
import type { Grade, PdfCheckpoint, QuizResponse } from "@/lib/quiz/types";

/*
  A PDF's quizzes, one per checkpoint ("part": a run of pages, lib/pdf/checkpoints.ts).

  Their own store, like sticky notes: they aren't sections of the session (a part is
  pages, not a topic with a row of its own), they don't count towards the session's
  progress, and several places read the same part at once: the board's quiz, the top
  Quiz button's dialog and the Pages outline's ticks.

  Only the first try at a question counts, as in a section's quiz: it alone is logged
  (mode "pdf_quiz"), scores and pays XP. Within one visit to the page the store
  remembers each part's first tries (`answered`), because the lesson can ask a part's
  key questions on their own as it goes ("quick checks"); the part's quiz at the end
  then asks only what's left, and its result counts every first try across both.
  Nothing of that survives a reload: a part not finished starts again from the top.
*/

/** One checkpoint's quiz, as far as this page knows it. */
export interface PdfPart {
  /** The server's quiz, once known (from the list, or once its questions are fetched). */
  quizId: number | null;
  questionCount: number;
  /** Finished at least once, at any score: the part is "checked". */
  completed: boolean;
  /** Most right on the first try in one go, of questionCount. */
  bestScore: number | null;
  attempts: number;
  /** The questions, once fetched (ensure). */
  quiz: PdfQuiz | null;
  /** This visit's first try per question id: right or not. */
  answered: Record<string, boolean>;
}

/** What a part's end came to: shown on its summary. */
export interface PdfPartResult {
  right: number;
  total: number;
  /** The part was finished for the first time: the completion bonus was paid. */
  firstFinish: boolean;
  xp: XpBreakdown;
}

export interface PdfPartSummary {
  questionCount: number;
  completed: boolean;
  bestScore: number | null;
  attempts: number;
  /** This visit's first tries so far. */
  right: number;
  answered: number;
}

interface PdfQuizState {
  /** Per study session: whether its list has come, and the page count the server sees. */
  sessions: Record<string, { loaded: boolean; loading: boolean; pageCount: number | null; error: string | null }>;
  /** Per part, keyed by pdfPartKey(sessionId, topicId). */
  parts: Record<string, PdfPart>;
  /** Fetch which parts have quizzes and how they went (once; `force` fetches again). */
  load: (sessionId: string, force?: boolean) => Promise<void>;
  /**
   * The part's questions: the ones already here, else the stored set, else written now
   * from `getPages()` (the pages' blocks). Asked twice at once, it asks the server once.
   * `force` writes new questions (a new generation) and forgets this visit's answers.
   */
  ensure: (
    sessionId: string,
    cp: PdfCheckpoint,
    getPages?: () => PdfPageBlocks[],
    opts?: { force?: boolean },
  ) => Promise<PdfQuiz>;
  /** The first try at question `q` (index `index` in the run that asked it). Later tries are ignored. */
  answer: (sessionId: string, cp: PdfCheckpoint, q: Question, index: number, r: QuizResponse, g: Grade) => void;
  /** The part's questions not answered yet this visit, in quiz order ([] until fetched). */
  remaining: (sessionId: string, topicId: string) => Question[];
  /** Of those, the key ones with a paragraph to follow (source.page and source.block):
   *  what Teach mode may ask as quick checks, right after narrating that paragraph. */
  keyChecks: (sessionId: string, topicId: string) => Question[];
  /** This visit's first tries at the part: how many right, of how many answered. */
  totals: (sessionId: string, topicId: string) => { right: number; total: number };
  /** Forget this visit's answers to the part (Retry asks every question again). */
  restart: (sessionId: string, topicId: string) => void;
  /**
   * The part's quiz came to its end with `right` of `total` on the first try. Marks it
   * checked, pays the completion bonus on its first finish (only the bonus: every
   * answer was paid as it came) and tells the server.
   */
  complete: (sessionId: string, cp: PdfCheckpoint, right: number, total: number) => PdfPartResult;
  isDone: (sessionId: string, topicId: string) => boolean;
  summary: (sessionId: string, topicId: string) => PdfPartSummary | null;
}

/** Where a part lives in the store. */
export const pdfPartKey = (sessionId: string, topicId: string) => `${sessionId}:${topicId}`;

const emptyPart = (): PdfPart => ({
  quizId: null,
  questionCount: 0,
  completed: false,
  bestScore: null,
  attempts: 0,
  quiz: null,
  answered: {},
});

/** Requests on their way, by part: a second ensure() waits for the first. */
const inFlight = new Map<string, Promise<PdfQuiz>>();
/** Parts whose completion bonus this page has paid: never twice, whatever arrives late. */
const bonusPaid = new Set<string>();

/** The larger of two best scores, either of which may not be known yet. */
const maxOf = (a: number | null | undefined, b: number | null | undefined): number | null =>
  a == null ? (b ?? null) : b == null ? a : Math.max(a, b);

const errorStatus = (e: unknown): number | undefined =>
  e && typeof e === "object" && "status" in e && typeof e.status === "number" ? e.status : undefined;

/** The id an answer is logged under: the server's "pdf:{quizId}.{generation}:{n}". */
function answerId(quiz: PdfQuiz | null, q: Question, index: number): string {
  if (q.id.startsWith("pdf:") || !quiz) return q.id;
  const n = quiz.questions.findIndex((x) => x.id === q.id);
  return `pdf:${quiz.id}.${quiz.generation}:${n >= 0 ? n : index}`;
}

export const usePdfQuizStore = create<PdfQuizState>((set, get) => {
  const patchPart = (key: string, patch: (p: PdfPart) => Partial<PdfPart>) =>
    set((s) => {
      const before = s.parts[key] ?? emptyPart();
      return { parts: { ...s.parts, [key]: { ...before, ...patch(before) } } };
    });

  /** Ask the server for a part's questions (stored, or written now). */
  const fetchQuiz = async (sessionId: string, cp: PdfCheckpoint, getPages?: () => PdfPageBlocks[], force = false): Promise<PdfQuiz> => {
    const key = pdfPartKey(sessionId, cp.topicId);
    const range = { first: cp.first, last: cp.last };
    // A quiz the server already has needs no page text: it's handed back as stored.
    const stored = !force && get().parts[key]?.quizId != null;
    const pages = () => getPages?.() ?? [];
    let result;
    try {
      result = await getPdfQuiz(sessionId, range, stored ? [] : pages(), { force });
    } catch (e) {
      // The list said there was one, but it has gone (the session's PDF was replaced):
      // write it from the pages after all.
      if (!stored || errorStatus(e) !== 422 || !getPages) throw e;
      result = await getPdfQuiz(sessionId, range, pages(), { force });
    }
    const quiz = result.quiz;
    patchPart(key, (p) => {
      const same = !!p.quiz && p.quiz.id === quiz.id && p.quiz.generation === quiz.generation;
      return {
        quizId: quiz.id,
        questionCount: quiz.questions.length,
        // New questions start the part again on the server (not checked, no best, no
        // attempts): take its word for it. Otherwise a finish saved here moments ago
        // (complete) may not have reached the server yet, so keep the better of the two.
        completed: force ? quiz.completed : quiz.completed || p.completed,
        bestScore: force ? quiz.bestScore : maxOf(quiz.bestScore, p.bestScore),
        attempts: force ? quiz.attempts : Math.max(quiz.attempts, p.attempts),
        quiz,
        // Another generation's answers are about questions that are gone.
        answered: same ? p.answered : {},
      };
    });
    return quiz;
  };

  return {
    sessions: {},
    parts: {},

    load: async (sessionId, force = false) => {
      const had = get().sessions[sessionId];
      if (had?.loading || (had?.loaded && !force)) return;
      set((s) => ({ sessions: { ...s.sessions, [sessionId]: { loaded: false, pageCount: null, ...had, loading: true, error: null } } }));
      try {
        const list = await listPdfQuizzes(sessionId);
        set((s) => {
          const parts = { ...s.parts };
          for (const q of list.quizzes) {
            const key = pdfPartKey(sessionId, `pdfq-${q.firstPage}-${q.lastPage}`);
            const before = parts[key] ?? emptyPart();
            parts[key] = {
              ...before,
              quizId: q.id,
              // A set fetched this visit knows its own count (and may be a newer generation).
              questionCount: before.quiz ? before.questionCount : q.questionCount,
              completed: q.completed || before.completed,
              bestScore: maxOf(q.bestScore, before.bestScore),
              attempts: Math.max(q.attempts, before.attempts),
            };
          }
          return {
            parts,
            sessions: { ...s.sessions, [sessionId]: { loaded: true, loading: false, pageCount: list.pageCount || null, error: null } },
          };
        });
      } catch (e) {
        set((s) => ({
          sessions: {
            ...s.sessions,
            [sessionId]: { loaded: false, loading: false, pageCount: null, error: e instanceof Error ? e.message : "Couldn't load the PDF's quizzes" },
          },
        }));
      }
    },

    ensure: (sessionId, cp, getPages, opts = {}) => {
      const key = pdfPartKey(sessionId, cp.topicId);
      const force = !!opts.force;
      const have = get().parts[key]?.quiz;
      if (have && !force) return Promise.resolve(have);
      const waiting = inFlight.get(key);
      if (waiting && !force) return waiting;
      // "New questions" pressed while the first set is still coming: after it, not beside it.
      const run = (waiting ? waiting.catch(() => null) : Promise.resolve(null)).then(() => fetchQuiz(sessionId, cp, getPages, force));
      const tracked = run.finally(() => {
        if (inFlight.get(key) === tracked) inFlight.delete(key);
      });
      inFlight.set(key, tracked);
      return tracked;
    },

    answer: (sessionId, cp, q, index, r, g) => {
      const key = pdfPartKey(sessionId, cp.topicId);
      const part = get().parts[key];
      if (part?.answered[q.id] !== undefined) return; // first try only
      patchPart(key, (p) => ({ answered: { ...p.answered, [q.id]: g.correct } }));
      const app = useAppStore.getState();
      // All or nothing, whatever the kind: "3 of 5 in the right place" is feedback, not a score.
      if (g.correct) app.addXp(XP_RULES.correctAnswer);
      app.logAnswer({
        session_id: sessionId,
        topic_id: null,
        question_id: answerId(part?.quiz ?? null, q, index),
        correct: g.correct,
        mode: "pdf_quiz",
        at: new Date().toISOString(),
        kind: q.kind ?? "single",
        response: loggedResponse(r),
      });
    },

    remaining: (sessionId, topicId) => {
      const part = get().parts[pdfPartKey(sessionId, topicId)];
      return part?.quiz ? part.quiz.questions.filter((q) => part.answered[q.id] === undefined) : [];
    },

    keyChecks: (sessionId, topicId) => get().remaining(sessionId, topicId).filter((q) => q.key && q.source?.page && q.source.block),

    totals: (sessionId, topicId) => {
      const tries = Object.values(get().parts[pdfPartKey(sessionId, topicId)]?.answered ?? {});
      return { right: tries.filter(Boolean).length, total: tries.length };
    },

    restart: (sessionId, topicId) => patchPart(pdfPartKey(sessionId, topicId), () => ({ answered: {} })),

    complete: (sessionId, cp, right, total) => {
      const key = pdfPartKey(sessionId, cp.topicId);
      const part = get().parts[key] ?? emptyPart();
      // Paid once per part: the server says whether this was its first finish too, but
      // the summary can't wait for it, and what this page knows is enough (the quiz's
      // own `completed` came with its questions).
      const firstFinish = !part.completed && !bonusPaid.has(key);
      const reward = topicCompletionXp(right, total, { sessionCompleted: false, firstFinish, unit: "part" });
      if (reward.bonus > 0) {
        bonusPaid.add(key);
        useAppStore.getState().addXp(reward.bonus);
        syncProgressSoon();
      }
      patchPart(key, (p) => ({
        completed: true,
        bestScore: Math.max(p.bestScore ?? 0, right),
        attempts: p.attempts + 1,
      }));
      const kinds = [...new Set((part.quiz?.questions ?? []).map((q) => q.kind ?? "single"))].sort();
      trackAction("pdf_quiz_complete", { kinds, right, total });

      const quizId = part.quizId ?? part.quiz?.id;
      if (quizId != null) {
        completePdfQuiz(sessionId, quizId, { right, total }).then(
          (saved) => patchPart(key, () => ({ completed: true, bestScore: saved.bestScore, attempts: saved.attempts })),
          (e) => console.warn("Couldn't save the PDF quiz result:", e),
        );
      }
      return { right, total, firstFinish, xp: { lines: reward.lines, total: reward.total } };
    },

    isDone: (sessionId, topicId) => !!get().parts[pdfPartKey(sessionId, topicId)]?.completed,

    summary: (sessionId, topicId) => {
      const part = get().parts[pdfPartKey(sessionId, topicId)];
      if (!part) return null;
      const tries = Object.values(part.answered);
      return {
        questionCount: part.questionCount,
        completed: part.completed,
        bestScore: part.bestScore,
        attempts: part.attempts,
        right: tries.filter(Boolean).length,
        answered: tries.length,
      };
    },
  };
});

/** One part, kept up to date (for a component that shows it). */
export const usePdfPart = (sessionId: string, topicId: string): PdfPart | undefined =>
  usePdfQuizStore((s) => s.parts[pdfPartKey(sessionId, topicId)]);
