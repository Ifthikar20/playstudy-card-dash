/**
 * Tests for the quiz logic in src/lib/quiz: marking every kind of question (grade,
 * normalizeFill), saying the answer and the student's answer in words (answerText,
 * responseText), when Check is ready (isComplete), reading a question off the wire
 * (parseQuestion), and the tutor's lines (speech).
 *
 * Run: node --test scripts/tests/
 *
 * The marking cases live in src/lib/quiz/grading_cases.json, which the backend's
 * parity test reads too (a copy at tests/fixtures/quiz_grading_cases.json): the
 * browser marks the quiz and the server repeats it for the guardian's view, and
 * the two must never disagree. When the backend's copy is there, it must be the same file.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Grade, PdfCheckpoint, QuizItem, QuizResponse } from "../../src/lib/quiz/types.ts";
import {
  answerText,
  correctResponse,
  emptyResponse,
  fillAccepts,
  grade,
  isComplete,
  kindOf,
  normalizeFill,
  responseText,
} from "../../src/lib/quiz/grade.ts";
import { parseQuestion, parseQuestions } from "../../src/lib/quiz/parse.ts";
import {
  finishLine,
  partialLine,
  pdfDoneLine,
  pdfInviteLine,
  questionLine,
  revealLine,
  rightLine,
  wrongLine,
} from "../../src/lib/quiz/speech.ts";

// ── The shared cases ─────────────────────────────────────────────────────────

const CASES_PATH = fileURLToPath(new URL("../../src/lib/quiz/grading_cases.json", import.meta.url));
const BACKEND_CASES_PATH = fileURLToPath(new URL("../../../playstudy-backend/tests/fixtures/quiz_grading_cases.json", import.meta.url));

interface Cases {
  items: Record<string, unknown>;
  normalize: { name: string; input: string; expected: string }[];
  grade: { name: string; item: string; response: QuizResponse; expected: Grade }[];
  describe: { name: string; item: string; response: QuizResponse; answerText: string; responseText: string | null }[];
}
const cases: Cases = JSON.parse(readFileSync(CASES_PATH, "utf8"));

/** Every shared item, read the way the app reads the wire. */
const items: Record<string, QuizItem> = Object.fromEntries(
  Object.entries(cases.items).map(([name, raw]) => {
    const q = parseQuestion(raw);
    assert.ok(q, `shared item ${name} should parse`);
    return [name, q];
  }),
);

describe("shared grading cases", () => {
  test("the backend's copy, when there is one, is the same file", (t) => {
    if (!existsSync(BACKEND_CASES_PATH)) return t.skip("no backend copy yet");
    assert.equal(readFileSync(BACKEND_CASES_PATH, "utf8"), readFileSync(CASES_PATH, "utf8"));
  });

  for (const c of cases.normalize) {
    test(`normalizeFill: ${c.name}`, () => assert.equal(normalizeFill(c.input), c.expected));
  }
  for (const c of cases.grade) {
    test(`grade: ${c.name}`, () => assert.deepEqual(grade(items[c.item], c.response), c.expected));
  }
  for (const c of cases.describe) {
    test(`describe: ${c.name}`, () => {
      assert.equal(answerText(items[c.item]), c.answerText);
      assert.equal(responseText(items[c.item], c.response), c.responseText);
    });
  }

  test("every kind is covered", () => {
    const kinds = new Set(cases.grade.map((c) => kindOf(items[c.item])));
    assert.deepEqual([...kinds].sort(), ["categorize", "fill", "match", "multi", "order", "single", "true_false"]);
  });
});

// ── Marking, beyond the shared cases ─────────────────────────────────────────

describe("grade", () => {
  test("the right answer (correctResponse) is right, for every kind", () => {
    for (const [name, q] of Object.entries(items)) {
      const g = grade(q, correctResponse(q));
      assert.equal(g.correct, true, name);
      assert.equal(g.right, g.total, name);
    }
  });

  test("a fresh answer (emptyResponse) is never right", () => {
    for (const [name, q] of Object.entries(items)) assert.equal(grade(q, emptyResponse(q)).correct, false, name);
  });

  test("a question with no kind is single choice", () => {
    const legacy = { ...items.single, kind: undefined };
    assert.equal(kindOf(legacy), "single");
    assert.deepEqual(grade(legacy, { kind: "single", choice: 1 }), { correct: true, right: 1, total: 1 });
  });

  test("a kind whose answer is missing falls back to single choice", () => {
    const cut = { ...items.multi, answer: null };
    assert.equal(kindOf(cut), "single");
    assert.equal(grade(cut, { kind: "single", choice: 0 }).correct, true);
  });

  test("fillAccepts: the short-word rule (under 5 letters, exact only)", () => {
    assert.equal(fillAccepts(["ATP"], "atp"), true);
    assert.equal(fillAccepts(["ATP"], "ADP"), false);
    assert.equal(fillAccepts(["cell"], "cells"), false);
    assert.equal(fillAccepts(["nucleus"], "nucleas"), true);
    assert.equal(fillAccepts([""], ""), false);
  });
});

// ── Check is ready ───────────────────────────────────────────────────────────

describe("isComplete", () => {
  test("single and true/false: a pick", () => {
    assert.equal(isComplete(items.single, { kind: "single", choice: -1 }), false);
    assert.equal(isComplete(items.single, { kind: "single", choice: 2 }), true);
    assert.equal(isComplete(items.tf_true, { kind: "true_false", value: false }), true);
    assert.equal(isComplete(items.tf_true, emptyResponse(items.tf_true)), false);
  });
  test("multi: at least one ticked", () => {
    assert.equal(isComplete(items.multi, { kind: "multi", choices: [] }), false);
    assert.equal(isComplete(items.multi, { kind: "multi", choices: [3] }), true);
  });
  test("order: always (leaving it as it is is an answer too)", () => {
    assert.equal(isComplete(items.order, emptyResponse(items.order)), true);
  });
  test("categorize and match: every item placed or joined", () => {
    assert.equal(isComplete(items.categorize, { kind: "categorize", placed: [0, 1, 0, 1, -1] }), false);
    assert.equal(isComplete(items.categorize, { kind: "categorize", placed: [0, 1, 0, 1, 1] }), true);
    assert.equal(isComplete(items.match, { kind: "match", pairs: [0, 1, -1] }), false);
    assert.equal(isComplete(items.match, { kind: "match", pairs: [0, 1, 2] }), true);
  });
  test("fill: some text", () => {
    assert.equal(isComplete(items.fill_word, { kind: "fill", text: "  " }), false);
    assert.equal(isComplete(items.fill_word, { kind: "fill", text: "x" }), true);
  });
  test("an answer of another kind never is", () => {
    assert.equal(isComplete(items.order, { kind: "single", choice: 0 }), false);
    assert.equal(isComplete(items.fill_word, null), false);
  });
});

describe("responseText", () => {
  test("nothing to say for an answer of another kind, or none", () => {
    assert.equal(responseText(items.order, { kind: "single", choice: 0 }), null);
    assert.equal(responseText(items.single, undefined), null);
    assert.equal(responseText(items.single, { kind: "single", choice: 9 }), null);
  });
  test("a long typed answer is cut to 80 characters", () => {
    assert.equal(responseText(items.fill_word, { kind: "fill", text: "x".repeat(200) })?.length, 80);
  });
});

// ── Off the wire ─────────────────────────────────────────────────────────────

describe("parseQuestion", () => {
  const base = { id: 9, question: "What is the powerhouse of the cell?", options: ["Nucleus", "Mitochondrion"], correctAnswer: 1, explanation: "ATP." };

  test("an old question with no kind is single choice, id as a string", () => {
    const q = parseQuestion(base);
    assert.equal(q?.kind, "single");
    assert.equal(q?.id, "9");
    assert.equal(q?.answer, null);
  });
  test("an index kept as a string still reads", () => {
    assert.equal(parseQuestion({ ...base, correctAnswer: "1" })?.correctAnswer, 1);
  });
  test("single choice with its index off the end, or too few options, is dropped", () => {
    assert.equal(parseQuestion({ ...base, correctAnswer: 2 }), null);
    assert.equal(parseQuestion({ ...base, options: ["Only"], correctAnswer: 0 }), null);
    assert.equal(parseQuestion({ ...base, correctAnswer: "B" }), null);
  });
  test("no question, no id, a blank option: dropped", () => {
    assert.equal(parseQuestion({ ...base, question: "  " }), null);
    assert.equal(parseQuestion({ ...base, id: null }), null);
    assert.equal(parseQuestion({ ...base, options: ["Nucleus", " "] }), null);
    assert.equal(parseQuestion("nope"), null);
  });
  test("an unknown kind is dropped", () => {
    assert.equal(parseQuestion({ ...base, kind: "essay" }), null);
  });
  test("every shared item round-trips", () => {
    for (const [name, raw] of Object.entries(cases.items)) {
      const q = parseQuestion(raw);
      assert.ok(q, name);
      assert.equal(q.kind, (raw as { kind: string }).kind, name);
      assert.deepEqual(q.answer ?? null, (raw as { answer: unknown }).answer ?? null, name);
    }
  });
  test("true/false always has the two options", () => {
    const q = parseQuestion({ id: "t", kind: "true_false", question: "The sun is a star.", options: [], correctAnswer: 0, answer: { kind: "true_false", correct: true } });
    assert.deepEqual(q?.options, ["True", "False"]);
    assert.equal(parseQuestion({ id: "t", kind: "true_false", question: "The sun is a star.", options: [], answer: { kind: "true_false", correct: "yes" } }), null);
  });
  test("multi: sorted, and dropped when out of range, repeated or empty", () => {
    const raw = cases.items.multi as Record<string, unknown>;
    assert.deepEqual(parseQuestion({ ...raw, answer: { kind: "multi", correct: [4, 0, 1] } })?.answer, { kind: "multi", correct: [0, 1, 4] });
    assert.equal(parseQuestion({ ...raw, answer: { kind: "multi", correct: [0, 9] } }), null);
    assert.equal(parseQuestion({ ...raw, answer: { kind: "multi", correct: [0, 0] } }), null);
    assert.equal(parseQuestion({ ...raw, answer: { kind: "multi", correct: [] } }), null);
  });
  test("order and match must be a full permutation", () => {
    const order = cases.items.order as Record<string, unknown>;
    assert.equal(parseQuestion({ ...order, answer: { kind: "order", correct: [0, 0, 1, 2] } }), null);
    assert.equal(parseQuestion({ ...order, answer: { kind: "order", correct: [0, 1, 2] } }), null);
    const match = cases.items.match as Record<string, unknown>;
    assert.equal(parseQuestion({ ...match, answer: { kind: "match", rights: ["a", "b"], correct: [0, 1, 2] } }), null);
    assert.equal(parseQuestion({ ...match, answer: { kind: "match", rights: ["a", "b", "c"], correct: [0, 2, 2] } }), null);
  });
  test("categorize: one group per item, each in range, at least two groups", () => {
    const cat = cases.items.categorize as Record<string, unknown>;
    assert.equal(parseQuestion({ ...cat, answer: { kind: "categorize", categories: ["Plants", "Animals"], correct: [0, 1] } }), null);
    assert.equal(parseQuestion({ ...cat, answer: { kind: "categorize", categories: ["Plants", "Animals"], correct: [0, 1, 0, 2, 0] } }), null);
    assert.equal(parseQuestion({ ...cat, answer: { kind: "categorize", categories: ["Plants"], correct: [0, 0, 0, 0, 0] } }), null);
  });
  test("fill: needs an accepted answer; options may be missing", () => {
    const fill = { id: "f", kind: "fill", question: "Plants make ____.", answer: { kind: "fill", accept: ["glucose"] } };
    assert.deepEqual(parseQuestion(fill)?.options, []);
    assert.equal(parseQuestion({ ...fill, answer: { kind: "fill", accept: [] } }), null);
    assert.equal(parseQuestion({ ...fill, answer: { kind: "multi", correct: [0] } }), null);
  });
  test("a stand-in index out of range is made 0 for the other kinds", () => {
    const raw = cases.items.order as Record<string, unknown>;
    assert.equal(parseQuestion({ ...raw, correctAnswer: 12 })?.correctAnswer, 0);
  });
  test("source: kept when it has a page, dropped (not the question) when it doesn't", () => {
    const raw = cases.items.single as Record<string, unknown>;
    assert.deepEqual(parseQuestion({ ...raw, source: { page: 3, block: "p3:b4", quote: " the mitochondria " } })?.source, {
      page: 3,
      block: "p3:b4",
      quote: "the mitochondria",
    });
    assert.deepEqual(parseQuestion({ ...raw, source: { page: 2 } })?.source, { page: 2, block: null, quote: null });
    const bad = parseQuestion({ ...raw, source: { page: 0, block: "b1" } });
    assert.ok(bad);
    assert.equal(bad.source, null);
  });
  test("key and hint", () => {
    const raw = cases.items.single as Record<string, unknown>;
    assert.equal(parseQuestion({ ...raw, key: true })?.key, true);
    assert.equal(parseQuestion({ ...raw, key: "yes" })?.key, undefined);
    assert.equal(parseQuestion({ ...raw, hint: "  Think energy. " })?.hint, "Think energy.");
    assert.equal(parseQuestion({ ...raw, hint: " " })?.hint, null);
  });
  test("parseQuestions keeps the good ones, in order", () => {
    const list = parseQuestions([cases.items.single, { kind: "essay" }, cases.items.fill_word]);
    assert.deepEqual(
      list.map((q) => q.id),
      ["1", "8"],
    );
    assert.deepEqual(parseQuestions(null), []);
  });
});

// ── What the tutor says ──────────────────────────────────────────────────────

describe("speech", () => {
  test("questionLine: numbered, and the kind said first", () => {
    assert.match(questionLine(items.tf_true, 1, 4), /^Question 2 of 4\. True or false: Plant cells have a cell wall\.$/);
    assert.match(questionLine(items.multi, 0, 3), /^Question 1 of 3\. Select all that apply\. .* Then press Check\.$/);
    assert.match(questionLine(items.order, 0, 2), /Put these in order\./);
    assert.match(questionLine(items.categorize, 0, 2), /Sort each one into Plants or Animals\.$/);
    assert.match(questionLine(items.match, 0, 2), /Match each one to its pair\./);
    assert.equal(questionLine(items.fill_word, 0, 1), "Fill in the blank: The green pigment in leaves is called blank.");
  });
  test("questionLine: a quick check says so instead of a number", () => {
    assert.match(questionLine(items.single, 0, 1, { check: true }), /^Quick check\. Which organelle/);
    assert.doesNotMatch(questionLine(items.single, 0, 1), /Question 1 of 1/);
  });
  test("questionLine: short options are read, long ones aren't", () => {
    assert.match(questionLine(items.single, 0, 4), /Is it Nucleus, Mitochondrion, Ribosome or Golgi body\?$/);
    const long = { ...items.single, options: items.single.options.map((o) => `${o} which is a rather long option to read aloud`) };
    assert.doesNotMatch(questionLine(long, 0, 4), /Is it/);
  });
  test("right and wrong lines vary", () => {
    assert.notEqual(rightLine(0), rightLine(1));
    assert.notEqual(wrongLine(0), wrongLine(1));
    assert.equal(rightLine(-3), rightLine(3));
  });
  test("partialLine: counts for order, groups and pairs; never a count for multi", () => {
    assert.equal(partialLine(items.order, { correct: false, right: 2, total: 4 }), "2 of 4 are in the right place.");
    assert.equal(partialLine(items.order, { correct: false, right: 1, total: 4 }), "1 of 4 is in the right place.");
    assert.equal(partialLine(items.categorize, { correct: false, right: 3, total: 5 }), "3 of 5 are in the right group.");
    assert.equal(partialLine(items.match, { correct: false, right: 2, total: 3 }), "2 of 3 pairs are right.");
    assert.equal(partialLine(items.multi, { correct: false, right: 4, total: 5 }), "Some are right, but not all.");
    assert.equal(partialLine(items.single, { correct: false, right: 0, total: 1 }), "");
    assert.equal(partialLine(items.order, { correct: true, right: 4, total: 4 }), "");
  });
  test("revealLine: the answer, then the explanation's first sentence", () => {
    assert.equal(revealLine(items.single), "It's Mitochondrion. Mitochondria carry out aerobic respiration.");
    assert.equal(revealLine(items.tf_false), "It's false. They lose it to make room for haemoglobin.");
    assert.equal(revealLine(items.multi), "The right ones are Cell wall, Chloroplast and Large central vacuole. Both kinds of cell have mitochondria and ribosomes.");
    assert.match(revealLine(items.order), /^The order is Prophase, Metaphase, Anaphase then Telophase\./);
    assert.equal(revealLine(items.fill_word), "It's chlorophyll. Chlorophyll absorbs red and blue light.");
    assert.match(revealLine(items.categorize), /^Here's how they go\./);
    assert.equal(revealLine({ ...items.single, explanation: "" }), "It's Mitochondrion.");
  });
  test("finishLine", () => {
    assert.equal(finishLine(3, 4), "You got three of four. Press Continue when you're ready.");
    assert.equal(finishLine(4, 4), "You got all four. Press Continue when you're ready.");
    assert.match(finishLine(0, 4), /^None this time/);
    assert.match(finishLine(1, 1), /^You got it\./);
    assert.equal(finishLine(0, 0), "");
  });
  test("pdfInviteLine and pdfDoneLine", () => {
    const pages: PdfCheckpoint = { topicId: "pdfq-3-5", first: 3, last: 5, title: "Pages 3–5", anchorPage: 5 };
    const page: PdfCheckpoint = { topicId: "pdfq-7-7", first: 7, last: 7, title: "Page 7", anchorPage: 7 };
    const slides: PdfCheckpoint = { topicId: "pdfq-2-4", first: 2, last: 4, title: "Slides 2–4", anchorPage: 4 };
    assert.equal(pdfInviteLine(pages, 4), "Quick check on pages 3 to 5, four questions on the board. Press Start when you're ready.");
    assert.equal(pdfInviteLine(page, 1), "Quick check on page 7, one question on the board. Press Start when you're ready.");
    assert.equal(pdfInviteLine(slides), "Quick check on slides 2 to 4, a few questions on the board. Press Start when you're ready.");
    assert.match(pdfDoneLine(pages), /^You've already checked pages 3 to 5\./);
  });
});
