import { useMemo, useState } from "react";
import type { StudySession } from "@/store/appStore";
import { SectionQuiz } from "./SectionQuiz";
import { SectionFlashcards } from "./SectionFlashcards";
import { StudyDialogShell } from "./StudyDialogShell";
import { flattenSections, type WrongEntry } from "./sections";

/** The two study tools a section has. */
export type StudyTool = "quiz" | "flashcards";

/** Which tool is open, on which section (by its client-side topic id). */
export interface StudyTarget {
  kind: StudyTool;
  topicId: string;
}

/*
  A section's quiz or flashcards, over the notes.

  They used to be two rows at the foot of every section, which broke the notes
  into pieces. Now they open here, for one section (the exam plan's chips open
  this), so the notes read as one document. The whole session's quiz and cards
  have their own dialogs (SessionQuizDialog, SessionFlashcardsDialog). In Teach
  mode the board runs a section's quiz instead; see TeachMode.
*/
export function SectionStudyDialog({
  session,
  target,
  onClose,
  onWrong,
  onRight,
  onContinue,
  onHint,
}: {
  session: StudySession;
  /** What to show; null closes the dialog. */
  target: StudyTarget | null;
  onClose: () => void;
  onWrong: (e: WrongEntry) => void;
  onRight: (key: string) => void;
  /** The quiz's "Continue", after the dialog has closed: the page moves on past this section. */
  onContinue: (topicId: string) => void;
  /** A hint went up in the quiz (see SectionQuiz). */
  onHint?: (text: string) => void;
}) {
  // What was open stays on screen while the dialog fades out, rather than emptying first.
  const [last, setLast] = useState<StudyTarget | null>(target);
  if (target && target !== last) setLast(target);
  const shown = target ?? last;

  const sections = useMemo(() => flattenSections(session.extractedTopics), [session.extractedTopics]);
  const topic = shown ? sections.find((s) => s.topic.id === shown.topicId)?.topic : undefined;
  const quiz = shown?.kind !== "flashcards";

  return (
    <StudyDialogShell
      open={!!target}
      onClose={onClose}
      kind={quiz ? "quiz" : "flashcards"}
      title={`${quiz ? "Quiz" : "Flashcards"}${topic ? ` · ${topic.title}` : ""}`}
      description={quiz ? "A few challenging questions from these notes, one at a time." : "Tap a card to flip it. Every card is from these notes."}
    >
      {shown &&
        topic &&
        (quiz ? (
          <SectionQuiz
            key={`quiz:${topic.id}`}
            session={session}
            topic={topic}
            onWrong={onWrong}
            onRight={onRight}
            onHint={onHint}
            onDone={() => {
              onClose();
              onContinue(topic.id);
            }}
          />
        ) : (
          <SectionFlashcards key={`cards:${topic.id}`} session={session} topic={topic} onClose={onClose} />
        ))}
    </StudyDialogShell>
  );
}
