/**
 * Quizzes on a PDF's pages, one per checkpoint (a run of pages, lib/pdf/checkpoints.ts).
 * Mirrors anothernotes-backend/app/api/pdf_quizzes.py.
 *
 * The server writes a checkpoint's questions the first time it is asked for them, from
 * the page text the browser sends (the same blocks Teach mode reads, so every question
 * can say which paragraph holds its answer), and keeps them: asking again for the same
 * pages hands back the stored set without writing anything.
 */
import { API_URL, getAuthToken, type HttpError, type Question } from "@/services/api";
import { authFetch } from "@/services/authFetch";
import { parseQuestions } from "@/lib/quiz/parse";
import type { PdfPageBlocks } from "@/lib/pdf/checkpoints";

export type { PdfPageBlocks } from "@/lib/pdf/checkpoints";

/** One checkpoint's quiz as the list knows it: no questions, just how it went. */
export interface PdfQuizSummary {
  id: number;
  firstPage: number;
  lastPage: number;
  questionCount: number;
  /** Finished at least once, at any score. */
  completed: boolean;
  /** The most questions right on the first try in one go, of questionCount. */
  bestScore: number | null;
  attempts: number;
}

export interface PdfQuizList {
  pageCount: number;
  quizzes: PdfQuizSummary[];
}

/** A checkpoint's quiz with its questions. Their ids are "pdf:{id}.{generation}:{n}". */
export interface PdfQuiz {
  id: number;
  firstPage: number;
  lastPage: number;
  /** Goes up each time the questions are written again ("New questions"). */
  generation: number;
  questions: Question[];
  completed: boolean;
  bestScore: number | null;
  attempts: number;
}

export interface PdfQuizResult {
  quiz: PdfQuiz;
  /** Written just now (the model was asked), rather than the stored set. */
  generated: boolean;
}

export interface PdfQuizCompletion {
  completed: true;
  /** This was the first time the quiz was finished: the completion bonus is due. */
  firstFinish: boolean;
  bestScore: number;
  attempts: number;
}

function headers(): Record<string, string> {
  const token = getAuthToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** Throw what the server said (FastAPI's `detail`), with the status, so a caller can tell a refusal from a failure. */
async function fail(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  const detail = body?.detail;
  const message =
    typeof detail === "string" ? detail : Array.isArray(detail) && typeof detail[0]?.msg === "string" ? detail[0].msg : fallback;
  throw Object.assign(new Error(message), { status: res.status }) as HttpError;
}

const base = (sessionId: string) => `${API_URL}/study-sessions/${encodeURIComponent(sessionId)}/pdf-quizzes`;

/** Every checkpoint quiz this session has, and how many pages the server counts in its PDF. */
export async function listPdfQuizzes(sessionId: string): Promise<PdfQuizList> {
  const res = await authFetch(base(sessionId), { headers: headers() });
  if (!res.ok) await fail(res, "Couldn't load the PDF's quizzes");
  const data = await res.json();
  return { pageCount: Number(data?.pageCount) || 0, quizzes: Array.isArray(data?.quizzes) ? data.quizzes : [] };
}

/**
 * The quiz on pages first..last: the stored one, or one written now from `pages` (the
 * pages' blocks, pdfPageBlocks). With a stored quiz the pages can be left out. `force`
 * writes new questions over the stored ones (the next generation).
 * Throws an HttpError: 422 for a range the server won't quiz (or too little text on
 * it), 502 when no usable questions came back, 429 when asked too often.
 */
export async function getPdfQuiz(
  sessionId: string,
  range: { first: number; last: number },
  pages: PdfPageBlocks[] = [],
  opts: { force?: boolean } = {},
): Promise<PdfQuizResult> {
  const res = await authFetch(base(sessionId), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ firstPage: range.first, lastPage: range.last, pages, force: opts.force ?? false }),
  });
  if (!res.ok) await fail(res, "Couldn't write the questions");
  const data = await res.json();
  const quiz = data?.quiz ?? {};
  // Checked per kind: a question this app can't draw or mark is left out.
  const questions: Question[] = parseQuestions(quiz.questions);
  return {
    quiz: {
      id: quiz.id,
      firstPage: quiz.firstPage ?? range.first,
      lastPage: quiz.lastPage ?? range.last,
      generation: quiz.generation ?? 1,
      questions,
      completed: !!quiz.completed,
      bestScore: quiz.bestScore ?? null,
      attempts: quiz.attempts ?? 0,
    },
    generated: !!data?.generated,
  };
}

/** A checkpoint's quiz was finished: `right` of `total` on the first try. The first finish is what counts it as done. */
export async function completePdfQuiz(
  sessionId: string,
  quizId: number,
  result: { right: number; total: number },
): Promise<PdfQuizCompletion> {
  const res = await authFetch(`${base(sessionId)}/${encodeURIComponent(String(quizId))}/complete`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(result),
  });
  if (!res.ok) await fail(res, "Couldn't save the result");
  return await res.json();
}
