import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppStore, type StudySession } from "@/store/appStore";
import { createNote } from "@/services/notes";
import { notePath } from "@/lib/notes/isNote";

/*
  /dashboard/note/new — makes a note and hands over to it.

  A note is a one-section study session, so it needs a real id before the note screen
  (FullStudyPage) can open it. This creates it exactly once — the ref survives React's
  double-run of effects in development, which would otherwise make two — puts it in
  the store so the sidebar lists it straight away, and REPLACES this URL with the
  note's own, so Back doesn't bring the student here to make another.
*/

export default function NewNotePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const addSession = useAppStore((s) => s.addSession);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void createNote()
      .then((note) => {
        addSession({
          // The create answer is the full-session shape; the list also wants these.
          progress: 0,
          topics: 1,
          time: "0 min",
          hasFullStudy: true,
          hasSpeedRun: false,
          hasQuiz: false,
          createdAt: Date.now(),
          ...(note as unknown as StudySession),
        });
        navigate(notePath(note.id), { replace: true, state: { fresh: true } });
      })
      .catch((e) => {
        toast({
          title: "Couldn't start a new note",
          description: e instanceof Error ? e.message : "Try again in a moment.",
          variant: "destructive",
        });
        navigate("/dashboard", { replace: true });
      });
  }, [addSession, navigate, toast]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      Opening a new note…
    </div>
  );
}
