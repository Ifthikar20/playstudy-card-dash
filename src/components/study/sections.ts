import { useMemo } from "react";
import { useAppStore, type Question, type StudySession, type Topic } from "@/store/appStore";
import type { QuizEvent, QuizItem } from "@/lib/quiz/types";

/*
  What the study tools (a section's quiz and flashcards) know about the page they
  are on. They used to live inside each section of Full Study; now they open in a
  dialog, or on Teach mode's board, so they find their section for themselves.
*/

/** One section of a session: a leaf topic, numbered in reading order. */
export interface Section {
  topic: Topic;
  index: number; // 1-based
  category: string;
}

/**
 * A question the learner got wrong, remembered across the whole session. A PDF's
 * question (origin "pdf") is filed under its checkpoint: topicId "pdfq-A-B", the
 * checkpoint's title ("Pages 3–5") and its first page as the index.
 */
export interface WrongEntry {
  key: string;
  topicId: string;
  sectionTitle: string;
  sectionIndex: number;
  question: Question;
  /** Where it was asked: a section's notes (the default) or a PDF's pages. */
  origin?: "notes" | "pdf";
}

/**
 * A study tool Teach mode's board asks the page to draw in its panel (TeachMode's
 * `renderPanel`). The page draws it because the quiz belongs to the study store and
 * the wrong-questions list, which the board knows nothing about.
 *
 * - quiz: the section's quiz, started at once.
 * - invite: the end-of-section hand-off. "Quiz time" with Start quiz and Skip for
 *   now (a section already done says so, with Retry); Start runs the quiz in place.
 * - flashcards: the section's cards, straight away.
 *
 * On a PDF the topicId is a checkpoint's ("pdfq-3-5") and the page draws its PdfQuiz;
 * with `only`, it is a one-question quick check in the middle of the lesson.
 */
export interface StudyPanel {
  kind: "quiz" | "flashcards" | "invite";
  /** The section, by TeachSection.topicId, or a PDF checkpoint's "pdfq-A-B". */
  topicId: string;
  /** What the board calls it ("Pages 3–5"), where the page can't work it out from topicId alone. */
  title?: string;
  /** Close the panel and carry on: the quiz's Continue, "Skip for now", the last card's Finish. */
  onDone: () => void;
  /** The invitation was taken up (or a retry began): the quiz is on its way. */
  onStart?: () => void;
  /** The quiz just showed a hint that arrived late (after its question's 'answered'
   *  event): the tutor says it too, in its speech bubble and out loud. */
  onHint?: (text: string) => void;
  /** Everything the running quiz does, for the tutor to say (a non-empty `say`) and point at. */
  onEvent?: (e: QuizEvent) => void;
  /** The quiz reached its end (its result is up, or a quick check was answered): no longer underway. */
  onFinished?: () => void;
  /** "See it on page N": underline where a PDF question's answer is (q.source). */
  onShowSource?: (q: QuizItem) => void;
  /** "Ask about this": the tutor listens for a question about the one on the board. */
  onAsk?: () => void;
  /** A quick check: only these questions (by id), not the whole quiz. */
  only?: string[];
  /** "check" for a quick check mid-lesson, "quiz" for the end of a part (the default). */
  mode?: "check" | "quiz";
}

export function flattenSections(topics: Topic[] | undefined): Section[] {
  const out: Section[] = [];
  const walk = (list: Topic[], category: string) => {
    for (const t of list) {
      if (t.subtopics && t.subtopics.length) walk(t.subtopics, t.title);
      else if (!t.isCategory) out.push({ topic: t, index: out.length + 1, category });
    }
  };
  walk(topics ?? [], "");
  return out;
}

/**
 * The section as the store has it NOW, with its place in the session.
 *
 * The quiz writes into the store (fresh questions, a score, "completed") and reads
 * them straight back, so it can't work from a copy of the topic taken when it was
 * opened: a board panel or a dialog may be handed one. Found by id, then by the
 * database id (the dashboard's copy of a session numbers its topics differently),
 * and the copy it was given is the last resort.
 */
export function useLiveSection(session: StudySession, topic: Topic): { section: Section; total: number } {
  const live = useAppStore((s) => (s.currentSession?.id === session.id ? s.currentSession : null)) ?? session;
  const sections = useMemo(() => flattenSections(live.extractedTopics), [live.extractedTopics]);
  const found =
    sections.find((s) => s.topic.id === topic.id) ??
    (topic.db_id != null ? sections.find((s) => s.topic.db_id === topic.db_id) : undefined);
  return { section: found ?? { topic, index: 1, category: "" }, total: Math.max(sections.length, 1) };
}
