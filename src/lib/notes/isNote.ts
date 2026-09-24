/*
  A note is a study session the student writes themselves.

  Since notes and study sessions became one screen (FullStudyPage), a note is stored
  as a StudySession with source_kind "note" and a single section. Everything that
  lists study material must decide which of the two it means: the dashboard's
  "Continue studying", the command palette, folders, the calendar and the stats are
  about study sessions; the sidebar's Notes group and the dashboard's own-notes wall
  are about notes.
*/

export const NOTE_KIND = "note";

/** True for a session that is really one of the student's own notes. */
export const isNote = (session?: { sourceKind?: string | null } | null): boolean => session?.sourceKind === NOTE_KIND;

/** True on a note's own URL — decided from the route, so it's right on the first render,
 *  before the session (and its sourceKind) has arrived. */
export const isNoteRoute = (pathname: string): boolean => /^\/dashboard\/note\//.test(pathname);

/** Where a note opens. */
export const notePath = (id: string): string => `/dashboard/note/${id}`;

/** A brand-new note is created by this route, exactly once, then replaced by its real URL. */
export const NEW_NOTE_PATH = "/dashboard/note/new";
