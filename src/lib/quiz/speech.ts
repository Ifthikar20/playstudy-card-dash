/*
  What the tutor says during a quiz on Teach mode's board: each question read out,
  a word on each answer, the answer when it's shown, the result at the end, and the
  invitation to a PDF part's quiz.

  The quiz (QuizRunner) puts these in its events' `say`; Teach mode speaks them and
  shows them as the pointer's caption. They're written to be heard: short, no symbols
  a voice would spell out, the blank read as "blank", and the options read aloud only
  when they're short enough to follow by ear.

  Self-contained apart from the marking rules it describes, so plain Node can check it.
*/
import type { Grade, PdfCheckpoint, QuizItem } from "./types.ts";
import { answerText, kindOf } from "./grade.ts";

/** Options longer than this (all of them together, in words) are left for the student to read. */
const READ_OPTIONS_UP_TO = 25;

const RIGHT_LINES = ["That's it.", "Spot on.", "Yes, that's right.", "Exactly.", "Nicely done."];
const WRONG_LINES = ["Not quite.", "Not this time.", "Not quite right."];

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/** "a, b or c" (or "and", "then"). */
function list(items: readonly string[], last: string): string {
  const xs = items.map((s) => s.trim()).filter(Boolean);
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} ${last} ${xs[xs.length - 1]}`;
}

/** The sentence as it should be heard: the blank said as "blank", end punctuation made sure of. */
function spoken(text: string): string {
  const s = text.replace(/_{3,}/g, "blank").replace(/\s+/g, " ").trim();
  return /[.?!:…]$/.test(s) ? s : `${s}.`;
}

const sentence = (s: string): string => {
  const t = s.replace(/\s+/g, " ").trim();
  return !t || /[.?!…]$/.test(t) ? t : `${t}.`;
};

/** The explanation's first sentence (the rest is on the screen). */
function firstSentence(text: string | null | undefined): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const m = t.match(/^.+?[.?!](?=\s+[A-Z0-9"'(]|$)/);
  return sentence(m ? m[0] : t);
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const count = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/**
 * The question read out: "Question 2 of 4. True or false: …". The number is left off
 * when it's the only one (a quick check says so instead: `check`). The options are
 * read too when they're short: every single and multi choice, and the items to put in
 * order, as long as they come to 25 words or fewer.
 */
export function questionLine(q: QuizItem, index: number, total: number, opts: { check?: boolean } = {}): string {
  const lead = opts.check ? "Quick check. " : total > 1 ? `Question ${index + 1} of ${total}. ` : "";
  const shortOptions = q.options.length > 0 && words(q.options.join(" ")) <= READ_OPTIONS_UP_TO;
  const body = spoken(q.question);
  switch (kindOf(q)) {
    case "true_false":
      return `${lead}True or false: ${body}`;
    case "multi":
      return `${lead}Select all that apply. ${body}${shortOptions ? ` ${sentence(list(q.options, "and"))}` : ""} Then press Check.`;
    case "order":
      return `${lead}Put these in order. ${body}${shortOptions ? ` ${sentence(list(q.options, "and"))}` : ""}`;
    case "categorize": {
      const cats = q.answer?.kind === "categorize" ? q.answer.categories : [];
      return `${lead}${body} Sort each one into ${sentence(list(cats, "or"))}`;
    }
    case "match":
      return `${lead}Match each one to its pair. ${body}`;
    case "fill":
      return `${lead}Fill in the blank: ${body}`;
    default:
      return `${lead}${body}${shortOptions ? ` Is it ${list(q.options, "or")}?` : ""}`;
  }
}

/** A word for a right answer; `i` picks which, so they don't all sound the same. */
export const rightLine = (i: number): string => RIGHT_LINES[Math.abs(Math.trunc(i)) % RIGHT_LINES.length];

/** A word for a wrong one. */
export const wrongLine = (i: number): string => WRONG_LINES[Math.abs(Math.trunc(i)) % WRONG_LINES.length];

/**
 * How close a wrong answer came, for the kinds marked in parts: "2 of 5 are in the
 * right place." Multi only says some are right: a count would tell how many to pick.
 * Nothing for single, true/false and fill, which are right or not.
 */
export function partialLine(q: QuizItem, g: Grade): string {
  if (g.correct) return "";
  const of = `${g.right} of ${g.total}`;
  switch (kindOf(q)) {
    case "multi":
      return "Some are right, but not all.";
    case "order":
      return g.right === 0 ? "None are in the right place yet." : `${of} ${g.right === 1 ? "is" : "are"} in the right place.`;
    case "categorize":
      return g.right === 0 ? "None are in the right group yet." : `${of} ${g.right === 1 ? "is" : "are"} in the right group.`;
    case "match":
      return g.right === 0 ? "None of the pairs are right yet." : `${of} pairs ${g.right === 1 ? "is" : "are"} right.`;
    default:
      return "";
  }
}

/** The answer said once it's shown: "It's mitochondria. They make the cell's energy." */
export function revealLine(q: QuizItem): string {
  const why = firstSentence(q.explanation);
  const tail = why ? ` ${why}` : "";
  switch (kindOf(q)) {
    case "true_false":
      return `It's ${answerText(q).toLowerCase()}.${tail}`;
    case "multi":
      return `The right ones are ${sentence(list(q.answer?.kind === "multi" ? q.answer.correct.map((i) => q.options[i]) : [], "and"))}${tail}`;
    case "order":
      return `The order is ${sentence(list(q.answer?.kind === "order" ? q.answer.correct.map((i) => q.options[i]) : [], "then"))}${tail}`;
    case "categorize":
    case "match":
      // Every item and its group, or every pair, is a lot to hear: it's on the board.
      return `Here's how they go.${tail}`;
    default:
      return `It's ${sentence(answerText(q))}${tail}`;
  }
}

/** The result, as the summary comes up. */
export function finishLine(right: number, total: number): string {
  if (total <= 0) return "";
  const then = "Press Continue when you're ready.";
  if (total === 1) return `${right ? "You got it." : "Not this time, but now you know."} ${then}`;
  if (right === total) return `You got all ${count(total)}. ${then}`;
  if (right <= 0) return `None this time, but now you've seen the answers. ${then}`;
  return `You got ${count(right)} of ${count(total)}. ${then}`;
}

/** "pages 3 to 5" / "page 3" / "slides 3 to 5", from a part's title. */
function stretch(cp: PdfCheckpoint): string {
  const unit = /^slide/i.test(cp.title.trim()) ? "slide" : "page";
  return cp.first === cp.last ? `${unit} ${cp.first}` : `${unit}s ${cp.first} to ${cp.last}`;
}

/** The tutor's invitation to a PDF part's quiz: "Quick check on pages 3 to 5, four questions on the board. …" */
export function pdfInviteLine(cp: PdfCheckpoint, n?: number): string {
  const howMany = n && n > 0 ? `${count(n)} question${n === 1 ? "" : "s"}` : "a few questions";
  return `Quick check on ${stretch(cp)}, ${howMany} on the board. Press Start when you're ready.`;
}

/** The same moment for a part already checked: no need to stop for it. */
export function pdfDoneLine(cp: PdfCheckpoint): string {
  return `You've already checked ${stretch(cp)}. Carry on, or try the questions again if you like.`;
}
