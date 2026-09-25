/*
  A quiz question as it arrives from the server (or from a copy the browser kept),
  checked before anything draws it.

  The server only sends questions it has already checked (app/core/quiz_kinds.py), so
  this is the last line, not the first: it makes sure a question can be drawn and
  marked at all. Anything that can't (an unknown kind, an answer of the wrong shape,
  an index off the end) is dropped here rather than breaking the quiz halfway through.
  A question with no kind but with options and a correct index is the original single
  choice, so every question stored before the other kinds existed still comes through.

  Self-contained on purpose (type imports only), so plain Node can check it.
*/
import type { QuestionAnswer, QuestionKind, QuestionSource, QuizItem } from "./types.ts";

const KINDS: readonly QuestionKind[] = ["single", "multi", "true_false", "order", "categorize", "fill", "match"];

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A whole number from a number or a string of digits (older copies kept "2"), else null. */
function index(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) ? v : null;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

/** A list of non-empty strings, trimmed; null if it isn't one (or has a blank). */
function strings(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const s of v) {
    const t = str(s);
    if (t === null) return null;
    out.push(t);
  }
  return out;
}

/** A list of whole numbers, each in 0..n-1; null if it isn't one. */
function indices(v: unknown, n: number): number[] | null {
  if (!Array.isArray(v)) return null;
  const out: number[] = [];
  for (const x of v) {
    const i = index(x);
    if (i === null || i < 0 || i >= n) return null;
    out.push(i);
  }
  return out;
}

/** Whether `list` holds each of 0..n-1 exactly once. */
const isPermutation = (list: number[], n: number): boolean => list.length === n && new Set(list).size === n;

/** The answer for a kind other than single, checked against the options; null if it doesn't fit. */
function answerFor(kind: QuestionKind, raw: unknown, options: string[]): QuestionAnswer | null {
  if (!isObj(raw) || raw.kind !== kind) return null;
  const n = options.length;
  switch (kind) {
    case "multi": {
      const correct = indices(raw.correct, n);
      if (!correct || !correct.length || new Set(correct).size !== correct.length) return null;
      return { kind, correct: [...correct].sort((a, b) => a - b) };
    }
    case "true_false":
      return typeof raw.correct === "boolean" ? { kind, correct: raw.correct } : null;
    case "order": {
      const correct = indices(raw.correct, n);
      return correct && n >= 2 && isPermutation(correct, n) ? { kind, correct } : null;
    }
    case "categorize": {
      const categories = strings(raw.categories);
      if (!categories || categories.length < 2) return null;
      const correct = indices(raw.correct, categories.length);
      return correct && correct.length === n && n >= 2 ? { kind, categories, correct } : null;
    }
    case "fill": {
      const accept = strings(raw.accept);
      return accept && accept.length ? { kind, accept } : null;
    }
    case "match": {
      const rights = strings(raw.rights);
      if (!rights || rights.length !== n || n < 2) return null;
      const correct = indices(raw.correct, n);
      return correct && isPermutation(correct, n) ? { kind, rights, correct } : null;
    }
    default:
      return null;
  }
}

/** Where on a PDF page the answer is, or null if there's no usable page. */
function sourceOf(raw: unknown): QuestionSource | null {
  if (!isObj(raw)) return null;
  const page = index(raw.page);
  if (page === null || page < 1) return null;
  return { page, block: str(raw.block), quote: str(raw.quote) };
}

/**
 * A question from the wire ({id, kind, question, options, correctAnswer, answer,
 * explanation, hint, source, key}), checked; null when it can't be drawn and marked.
 */
export function parseQuestion(raw: unknown): QuizItem | null {
  if (!isObj(raw)) return null;
  const id = typeof raw.id === "number" ? String(raw.id) : str(raw.id);
  const question = str(raw.question);
  if (id === null || question === null) return null;

  const kind = raw.kind == null ? "single" : (raw.kind as QuestionKind);
  if (!KINDS.includes(kind)) return null;

  let options = raw.options == null && kind === "fill" ? [] : strings(raw.options);
  if (!options) return null;
  // A true/false statement is always the two choices, whatever came with it.
  if (kind === "true_false") options = ["True", "False"];

  let correctAnswer = index(raw.correctAnswer);
  let answer: QuestionAnswer | null = null;
  if (kind === "single") {
    if (options.length < 2 || correctAnswer === null || correctAnswer < 0 || correctAnswer >= options.length) return null;
  } else {
    answer = answerFor(kind, raw.answer, options);
    if (!answer) return null;
    if (kind !== "fill" && options.length < 2) return null;
    // Only a stand-in for these kinds (older readers of single choice); keep it in range.
    if (correctAnswer === null || correctAnswer < 0 || correctAnswer >= Math.max(options.length, 1)) correctAnswer = 0;
  }

  const hint = str(raw.hint);
  const item: QuizItem = {
    id,
    kind,
    question,
    options,
    correctAnswer,
    answer,
    explanation: typeof raw.explanation === "string" ? raw.explanation.trim() : "",
    hint,
    source: sourceOf(raw.source),
  };
  if (raw.key === true) item.key = true;
  return item;
}

/** Every question in a list that can be drawn, in order (the rest are dropped). */
export function parseQuestions(raw: unknown): QuizItem[] {
  if (!Array.isArray(raw)) return [];
  const out: QuizItem[] = [];
  for (const r of raw) {
    const q = parseQuestion(r);
    if (q) out.push(q);
  }
  return out;
}
