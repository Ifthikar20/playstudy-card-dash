/*
  The shape of a quiz question of every kind, shared by the notes quiz, the PDF quiz,
  the board and the dialogs (and mirrored on the server in app/core/quiz_kinds.py).

  Seven kinds. "single" is the original four-option question, and a question with no
  `kind` at all is one of those, so every question stored before this file existed
  still reads the same. The others carry their answer in `answer`; `options` and
  `correctAnswer` always hold something a single-choice reader can live with.

  Kept free of imports (type-only, erasable) so plain Node can run the quiz logic's
  checks against it.
*/

export type QuestionKind = "single" | "multi" | "true_false" | "order" | "categorize" | "fill" | "match";

export type QuestionAnswer =
  /** Select all that apply: the option indices that are right, sorted (2 to n-1 of them). */
  | { kind: "multi"; correct: number[] }
  | { kind: "true_false"; correct: boolean }
  /** Put in order: correct[k] = the options index of the item that belongs at position k. */
  | { kind: "order"; correct: number[] }
  /** Sort into groups: correct[i] = the category index options[i] belongs in. */
  | { kind: "categorize"; categories: string[]; correct: number[] }
  /** Fill in the blank: 1 to 4 accepted answers, the first one the canonical form. */
  | { kind: "fill"; accept: string[] }
  /** Match pairs: options are the left-hand items, `rights` the right-hand ones (shuffled);
   *  correct[i] = the rights index that goes with options[i]. */
  | { kind: "match"; rights: string[]; correct: number[] };

/** Where in a PDF the answer is: the page, the block Teach mode indexed it as, the exact words. */
export interface QuestionSource {
  page: number;
  block?: string | null;
  quote?: string | null;
}

/** One question as the quiz code sees it (appStore's Question is this plus nothing it needs). */
export interface QuizItem {
  id: string;
  /** Missing means "single". */
  kind?: QuestionKind;
  question: string;
  /** single/multi: the choices. order: the items, shuffled. categorize: the items to sort.
   *  match: the left-hand items. true_false: ["True", "False"]. fill: []. */
  options: string[];
  /** single: the right option. Other kinds: a legacy stand-in, never used to grade them. */
  correctAnswer: number;
  answer?: QuestionAnswer | null;
  explanation: string;
  hint?: string | null;
  /** PDF quizzes: where the answer is on the page. */
  source?: QuestionSource | null;
  /** PDF quizzes: one of the ideas that matter most, so the tutor may ask it mid-lesson,
   *  right after explaining the paragraph it comes from. */
  key?: boolean;
}

/** What the student answered. */
export type QuizResponse =
  | { kind: "single"; choice: number }
  | { kind: "true_false"; value: boolean }
  | { kind: "multi"; choices: number[] }
  /** order[k] = the options index placed at position k */
  | { kind: "order"; order: number[] }
  /** per option: the category index it was placed in, -1 = not placed yet */
  | { kind: "categorize"; placed: number[] }
  | { kind: "fill"; text: string }
  /** per left-hand item: the rights index joined to it, -1 = not joined yet */
  | { kind: "match"; pairs: number[] };

/** How an answer went. `right`/`total` count parts (items in place, pairs joined, options
 *  judged right); 1/1 or 0/1 for single, true/false and fill. Only `correct` scores. */
export interface Grade {
  correct: boolean;
  right: number;
  total: number;
}

/** What a running quiz tells whoever is hosting it; a non-empty `say` is meant to be spoken. */
export type QuizEvent =
  | { type: "question"; index: number; total: number; q: QuizItem; say: string }
  | { type: "answered"; index: number; q: QuizItem; correct: boolean; grade: Grade; hint: string | null; say: string }
  | { type: "retried"; index: number; q: QuizItem; correct: boolean; say: string }
  | { type: "revealed"; index: number; q: QuizItem; say: string }
  | { type: "finished"; right: number; total: number; say: string };

/** A stretch of a PDF that gets its own quiz: about 400 words of text, 1 to 4 pages. */
export interface PdfCheckpoint {
  /** `pdfq-${first}-${last}` */
  topicId: string;
  first: number;
  last: number;
  /** "Page 3", "Pages 3–5", "Slides 3–5" */
  title: string;
  /** The last page in the stretch with real text: the lesson reaches the quiz there. */
  anchorPage: number;
}
