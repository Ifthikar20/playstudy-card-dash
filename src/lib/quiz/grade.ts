/*
  Marking a quiz answer, for every kind of question.

  Grading happens in the browser (the answers already come with the quiz), and the
  server keeps a copy of these rules in app/core/quiz_kinds.py for checking and for
  the guardian's view. The two must agree to the letter: grading_cases.json holds the
  cases both sides run (scripts/tests/quiz.test.ts here, the backend's parity test).

  Scoring is all or nothing: only `correct` counts for the score, the XP and the
  answer log. `right`/`total` are the parts ("3 of 5 in the right place"), shown and
  said as feedback, never scored.

  Self-contained on purpose: only erasable TypeScript and type imports, so plain Node
  runs the checks against this very file.
*/
import type { Grade, QuestionAnswer, QuestionKind, QuizItem, QuizResponse } from "./types.ts";

type AnswerOf<K extends QuestionAnswer["kind"]> = Extract<QuestionAnswer, { kind: K }>;

/**
 * The kind a question is read as. A question with no kind is the original single choice,
 * and so is one whose answer doesn't fit the kind it names (a copy cut short somewhere):
 * its options and correctAnswer always make a single-choice question it can fall back on.
 */
export function kindOf(q: QuizItem): QuestionKind {
  const k = q.kind ?? "single";
  if (k === "single") return "single";
  return q.answer && q.answer.kind === k ? k : "single";
}

/** The question's answer, typed for its kind (only call once kindOf has said which). */
const answerOf = <K extends QuestionAnswer["kind"]>(q: QuizItem, kind: K): AnswerOf<K> => q.answer as AnswerOf<K>;

// ---- fill in the blank --------------------------------------------------------------

/** Punctuation that doesn't change a typed answer when it's at either end (with spaces). */
const EDGES = /^[\s.,;:!?"'()]+|[\s.,;:!?"'()]+$/g;
/** Hyphens and dashes: "cell-wall" and "cell wall" are one answer. */
const DASHES = /[-‐-—]/g;
/** A plain number, with thousands commas allowed ("1,200") and a sign. */
const NUMBER = /^-?(\d+|\d{1,3}(,\d{3})+)(\.\d+)?$/;

/**
 * A typed answer reduced to what matters, so small differences don't mark it wrong:
 * NFKC and lower case; curly quotes made straight and a typeset minus a plain one;
 * punctuation and spaces trimmed off both ends; hyphens made spaces (a minus sign in
 * front of a number stays); runs of spaces made one; and a leading "a", "an" or "the"
 * dropped. The same steps, in the same order, as the server's normalize_fill.
 */
export function normalizeFill(text: string): string {
  let s = String(text ?? "").normalize("NFKC").toLowerCase().trim();
  s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/−/g, "-");
  s = s.replace(EDGES, "");
  const lead = s.startsWith("-") && /\d/.test(s.charAt(1)) ? "-" : "";
  s = lead + s.slice(lead.length).replace(DASHES, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.replace(/^(a|an|the) /, "");
}

const asNumber = (s: string): number | null => (NUMBER.test(s) ? Number(s.replace(/,/g, "")) : null);

/** Python's math.isclose(a, b, rel_tol=1e-6), so both sides round the same way. */
const close = (a: number, b: number): boolean => a === b || Math.abs(a - b) <= 1e-6 * Math.max(Math.abs(a), Math.abs(b));

/**
 * Whether two strings are at most one edit apart: one letter changed, added or dropped,
 * or two neighbours swapped (Damerau-Levenshtein, the restricted kind). Counted in code
 * points, as Python counts a string's letters.
 */
function withinOneEdit(a: string, b: string): boolean {
  const x = Array.from(a);
  const y = Array.from(b);
  if (Math.abs(x.length - y.length) > 1) return false;
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  if (i === x.length && i === y.length) return true;
  const rest = (p: number, q: number) => x.slice(p).join("") === y.slice(q).join("");
  if (x.length === y.length) {
    // one letter changed, or this one and the next swapped
    return rest(i + 1, i + 1) || (x[i] === y[i + 1] && x[i + 1] === y[i] && rest(i + 2, i + 2));
  }
  return x.length > y.length ? rest(i + 1, i) : rest(i, i + 1);
}

/**
 * Whether `typed` is one of the accepted answers. Both sides are normalised first.
 * Two numbers are compared as numbers ("1,000" is "1000", "2.50" is "2.5"). Otherwise
 * a slip of one letter is forgiven when the accepted answer is 5 letters or longer
 * ("mitocondria"), but never on a short one, where one letter makes another word.
 */
export function fillAccepts(accept: readonly string[], typed: string): boolean {
  const t = normalizeFill(typed);
  if (!t) return false;
  const tn = asNumber(t);
  return accept.some((raw) => {
    const a = normalizeFill(raw);
    if (!a) return false;
    const an = asNumber(a);
    if (tn !== null && an !== null) return close(tn, an);
    if (t === a) return true;
    return Array.from(a).length >= 5 && withinOneEdit(t, a);
  });
}

// ---- grading ---------------------------------------------------------------------------

/** How many parts a question is marked in. */
function partsOf(q: QuizItem): number {
  switch (kindOf(q)) {
    case "multi":
    case "categorize":
    case "match":
      return q.options.length;
    case "order":
      return answerOf(q, "order").correct.length;
    default:
      return 1;
  }
}

const whole = (correct: boolean): Grade => ({ correct, right: correct ? 1 : 0, total: 1 });

/** Count the places where `given[i]` is `want[i]`; a missing or extra entry is simply wrong. */
function samePlaces(given: readonly number[], want: readonly number[]): Grade {
  const total = want.length;
  let right = 0;
  for (let i = 0; i < total; i++) if (given[i] === want[i]) right++;
  return { correct: right === total && given.length === total, right, total };
}

/**
 * Mark an answer. An answer of the wrong shape for the question (a leftover from the
 * question before, say) is simply wrong, with no parts right.
 *
 * - single: the option picked is the right one.
 * - true_false: the value is the statement's truth. (A single-choice pick is read as
 *   0 = True, 1 = False, as a number key or an older caller would give it.)
 * - multi: exactly the right set, in any order. Parts: every option judged right,
 *   picked and right or left out and wrong.
 * - order, categorize, match: every item in its place, group or pair. Parts: the ones
 *   that are.
 * - fill: the text is one of the accepted answers (see fillAccepts).
 */
export function grade(q: QuizItem, r: QuizResponse): Grade {
  const kind = kindOf(q);
  const wrong: Grade = { correct: false, right: 0, total: partsOf(q) };
  if (!r) return wrong;
  switch (kind) {
    case "single":
      return r.kind === "single" ? whole(r.choice === q.correctAnswer) : wrong;
    case "true_false": {
      const want = answerOf(q, "true_false").correct;
      if (r.kind === "true_false") return whole(r.value === want);
      if (r.kind === "single" && (r.choice === 0 || r.choice === 1)) return whole((r.choice === 0) === want);
      return wrong;
    }
    case "multi": {
      if (r.kind !== "multi") return wrong;
      const n = q.options.length;
      const want = new Set(answerOf(q, "multi").correct);
      const picked = new Set(r.choices.filter((c) => Number.isInteger(c) && c >= 0 && c < n));
      let right = 0;
      for (let i = 0; i < n; i++) if (picked.has(i) === want.has(i)) right++;
      return { correct: right === n, right, total: n };
    }
    case "order":
      return r.kind === "order" ? samePlaces(r.order, answerOf(q, "order").correct) : wrong;
    case "categorize":
      return r.kind === "categorize" ? samePlaces(r.placed, answerOf(q, "categorize").correct) : wrong;
    case "match":
      return r.kind === "match" ? samePlaces(r.pairs, answerOf(q, "match").correct) : wrong;
    case "fill":
      return r.kind === "fill" ? whole(fillAccepts(answerOf(q, "fill").accept, r.text)) : wrong;
  }
}

// ---- answers in progress ----------------------------------------------------------------

/** A fresh answer to build on: nothing picked, the items as they came, nothing placed or joined. */
export function emptyResponse(q: QuizItem): QuizResponse {
  const n = q.options.length;
  switch (kindOf(q)) {
    case "true_false":
      // Nothing picked yet: a true_false answer is only ever made by a pick, so this
      // placeholder never reaches isComplete as an answer.
      return { kind: "single", choice: -1 };
    case "multi":
      return { kind: "multi", choices: [] };
    case "order":
      return { kind: "order", order: Array.from({ length: n }, (_, i) => i) };
    case "categorize":
      return { kind: "categorize", placed: Array.from({ length: n }, () => -1) };
    case "match":
      return { kind: "match", pairs: Array.from({ length: n }, () => -1) };
    case "fill":
      return { kind: "fill", text: "" };
    default:
      return { kind: "single", choice: -1 };
  }
}

/** The answer that's right, as a response (what a revealed question shows). */
export function correctResponse(q: QuizItem): QuizResponse {
  switch (kindOf(q)) {
    case "true_false":
      return { kind: "true_false", value: answerOf(q, "true_false").correct };
    case "multi":
      return { kind: "multi", choices: [...answerOf(q, "multi").correct] };
    case "order":
      return { kind: "order", order: [...answerOf(q, "order").correct] };
    case "categorize":
      return { kind: "categorize", placed: [...answerOf(q, "categorize").correct] };
    case "match":
      return { kind: "match", pairs: [...answerOf(q, "match").correct] };
    case "fill":
      return { kind: "fill", text: answerOf(q, "fill").accept[0] ?? "" };
    default:
      return { kind: "single", choice: q.correctAnswer };
  }
}

/**
 * Whether an answer is ready to be checked: something picked (multi: at least one),
 * every item placed or joined, some text typed. Order is always ready: the items are
 * in some order from the start, and leaving them as they are is an answer too.
 */
export function isComplete(q: QuizItem, r: QuizResponse | null | undefined): boolean {
  if (!r) return false;
  const n = q.options.length;
  switch (kindOf(q)) {
    case "single":
      return r.kind === "single" && Number.isInteger(r.choice) && r.choice >= 0 && r.choice < n;
    case "true_false":
      return r.kind === "true_false" || (r.kind === "single" && (r.choice === 0 || r.choice === 1));
    case "multi":
      return r.kind === "multi" && r.choices.some((c) => c >= 0 && c < n);
    case "order":
      return r.kind === "order" && r.order.length === n;
    case "categorize":
      return r.kind === "categorize" && r.placed.length === n && r.placed.every((c) => c >= 0);
    case "match":
      return r.kind === "match" && r.pairs.length === n && r.pairs.every((c) => c >= 0);
    case "fill":
      return r.kind === "fill" && r.text.trim().length > 0;
  }
}

// ---- in words ---------------------------------------------------------------------------

const TF = (v: boolean) => (v ? "True" : "False");

/** Items grouped under their categories: "Plants: fern, moss; Animals: frog". Empty groups are left out. */
function groups(q: QuizItem, placed: readonly number[]): string {
  const { categories } = answerOf(q, "categorize");
  return categories
    .map((name, c) => {
      const items = q.options.filter((_, i) => placed[i] === c);
      return items.length ? `${name}: ${items.join(", ")}` : "";
    })
    .filter(Boolean)
    .join("; ");
}

/** Pairs as "left → right; left → right", for the lefts that have one. */
function pairs(q: QuizItem, joined: readonly number[]): string {
  const { rights } = answerOf(q, "match");
  return q.options
    .map((left, i) => (joined[i] >= 0 && joined[i] < rights.length ? `${left} → ${rights[joined[i]]}` : ""))
    .filter(Boolean)
    .join("; ");
}

/**
 * The right answer in words, for "Answer: …", the wrong-questions list and the
 * guardian's view (the server's describe_answer says the same):
 * "Mitochondria" / "False" / "Mitosis, Meiosis" / "Sow → Water → Harvest" /
 * "Plants: fern, moss; Animals: frog" / "chlorophyll" / "Heart → pumps blood; Lungs → …".
 */
export function answerText(q: QuizItem): string {
  switch (kindOf(q)) {
    case "true_false":
      return TF(answerOf(q, "true_false").correct);
    case "multi":
      return answerOf(q, "multi").correct.map((i) => q.options[i]).join(", ");
    case "order":
      return answerOf(q, "order").correct.map((i) => q.options[i]).join(" → ");
    case "categorize":
      return groups(q, answerOf(q, "categorize").correct);
    case "match":
      return pairs(q, answerOf(q, "match").correct);
    case "fill":
      return answerOf(q, "fill").accept[0] ?? "";
    default:
      return q.options[q.correctAnswer] ?? "";
  }
}

/** The longest typed answer kept or shown (the server keeps no more either). */
export const FILL_MAX = 80;

/**
 * What the student answered, in the same words as answerText, or null when there's
 * nothing to say (nothing picked, placed, joined or typed, or an answer of the wrong shape).
 */
export function responseText(q: QuizItem, r: QuizResponse | null | undefined): string | null {
  if (!r) return null;
  const n = q.options.length;
  const text = (s: string) => s || null;
  switch (kindOf(q)) {
    case "single":
      return r.kind === "single" ? (q.options[r.choice] ?? null) : null;
    case "true_false":
      if (r.kind === "true_false") return TF(r.value);
      return r.kind === "single" && (r.choice === 0 || r.choice === 1) ? TF(r.choice === 0) : null;
    case "multi":
      if (r.kind !== "multi") return null;
      return text(
        [...new Set(r.choices)]
          .filter((i) => i >= 0 && i < n)
          .sort((a, b) => a - b)
          .map((i) => q.options[i])
          .join(", "),
      );
    case "order":
      if (r.kind !== "order") return null;
      return text(
        r.order
          .filter((i) => i >= 0 && i < n)
          .map((i) => q.options[i])
          .join(" → "),
      );
    case "categorize":
      return r.kind === "categorize" ? text(groups(q, r.placed)) : null;
    case "match":
      return r.kind === "match" ? text(pairs(q, r.pairs)) : null;
    case "fill":
      return r.kind === "fill" ? text(r.text.replace(/\s+/g, " ").trim().slice(0, FILL_MAX)) : null;
  }
}
