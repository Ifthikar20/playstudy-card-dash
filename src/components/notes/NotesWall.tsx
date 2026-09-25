import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, NotebookPen, Plus } from "lucide-react";
import { useAppStore, type StudySession, type Topic } from "@/store/appStore";
import { NEW_NOTE_PATH, isNote, notePath } from "@/lib/notes/isNote";

/*
  The student's own notes on the dashboard: pages they wrote or talked into, which
  open on the same screen as any study session (FullStudyPage), where the tutor can
  teach them back and quiz the student on them.

  They come from the store like everything else on this page — a note is a study
  session with sourceKind "note" — so creating, renaming or deleting one shows up
  here and in the sidebar's Notes group without a second fetch.
*/

function when(ms: number | null | undefined): string {
  if (!ms) return "";
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Every leaf section of a session — a note has exactly one. */
function leaves(topics: Topic[] | undefined): Topic[] {
  const out: Topic[] = [];
  const walk = (list: Topic[]) => list.forEach((t) => (t.subtopics?.length ? walk(t.subtopics) : !t.isCategory && out.push(t)));
  walk(topics ?? []);
  return out;
}

const textOf = (note: StudySession) => leaves(note.extractedTopics).map((t) => t.notes ?? "").join("\n\n");

/** A line of the note as the student reads it, without the Markdown around it. */
function preview(md: string): string {
  const flat = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[#>*_`~[\]()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > 160 ? `${flat.slice(0, 160).trimEnd()}…` : flat;
}

const words = (md: string) => (md.trim() ? md.trim().split(/\s+/).length : 0);

const openQuestions = (note: StudySession) =>
  leaves(note.extractedTopics).reduce((n, t) => n + (t.noteChecks ?? []).filter((c) => !c.answer).length, 0);

export function NotesWall() {
  const navigate = useNavigate();
  const sessions = useAppStore((s) => s.studySessions);

  const notes = useMemo(
    () =>
      sessions
        .filter(isNote)
        .sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)),
    [sessions],
  );

  return (
    // #notes is where the sidebar's "All notes" lands.
    <section id="notes" aria-label="Your own notes" className="scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Your own notes</p>
        <button
          type="button"
          onClick={() => navigate(NEW_NOTE_PATH)}
          className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3.5" />
          New note
        </button>
      </div>

      {notes.length === 0 ? (
        <button
          type="button"
          onClick={() => navigate(NEW_NOTE_PATH)}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-left transition-colors hover:border-foreground/30"
        >
          <Mic className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-sm font-medium">Start a note of your own</span>
            <span className="block text-xs text-muted-foreground">
              Type it or talk it out — then press Teach me and your tutor teaches it back, or quizzes you from the Quiz button at the top.
            </span>
          </span>
        </button>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {notes.slice(0, 6).map((note) => {
            const md = textOf(note);
            const open = openQuestions(note);
            return (
              <button
                key={note.id}
                type="button"
                onClick={() => navigate(notePath(note.id))}
                className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/30"
              >
                <span className="flex items-center gap-2">
                  <NotebookPen className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-semibold">{note.title || "Untitled note"}</span>
                  {open > 0 && (
                    <span
                      className="ml-auto shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                      title="Questions your tutor asked about this note"
                    >
                      {open} to check
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{preview(md) || "Empty so far."}</span>
                <span className="text-[11px] text-muted-foreground/80">
                  {words(md)} {words(md) === 1 ? "word" : "words"} · {when(note.updatedAt ?? note.createdAt)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
