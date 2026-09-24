import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { StatRail } from "@/components/StatRail";
import { XpCard } from "@/components/XpCard";
import { StreakCard } from "@/components/StreakCard";
import { SourceLogo } from "@/components/SourceLogo";
import { StickyWall } from "@/components/StickyNotes";
import { ExamPlanCard } from "@/components/exam/ExamPlanCard";
import { NotesWall } from "@/components/notes/NotesWall";
import { useAppStore, type Folder, type StudySession } from "@/store/appStore";
import { moveSessionToFolder } from "@/services/folder-api";
import { fetchAppData, deleteStudySession } from "@/services/api";
import { connectSource, disconnectSource, listSources, type NoteSource } from "@/services/sources";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { folderLabelIcon, parseCover } from "@/lib/folderCovers";
import { isNote } from "@/lib/notes/isNote";

/*
  Dashboard — after the Flow reference: one greeting, a single ink banner,
  a plain list under a small-caps label, and a right rail of serif numerals.
  Every block loads on its own (skeletons), nothing takes over the page.
*/

const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Sessions per page of "Continue studying" - the list stays about as tall as the rail beside it. */
const PAGE_SIZE = 8;

/** Page buttons to show: all of them when there are few, else the ends and the pages around the current one. */
function pageList(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const keep = new Set([0, count - 1, current - 1, current, current + 1].filter((p) => p >= 0 && p < count));
  const out: (number | "gap")[] = [];
  [...keep].sort((a, b) => a - b).forEach((p, i, all) => {
    if (i > 0 && p - all[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

function completionOf(s: StudySession): number {
  const topics = s.extractedTopics ?? [];
  if (topics.length > 0) return Math.round((topics.filter((t) => t.completed).length / topics.length) * 100);
  return Math.max(0, Math.min(100, Math.round(s.progress ?? 0)));
}

export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isInitialized, studySessions: allSessions, folders, stats, userProfile, xp, setCurrentSession, initializeFromAPI } =
    useAppStore();
  // The student's own notes are sessions under the hood, but they aren't study material:
  // they live in the sidebar's Notes group and the notes wall below, never in this list.
  const studySessions = useMemo(() => allSessions.filter((s) => !isNote(s)), [allSessions]);

  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [activeFolder, setActiveFolder] = useState<number | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | "none" | null>(null);
  const [toDelete, setToDelete] = useState<StudySession | null>(null);
  const [page, setPage] = useState(0);

  const firstName = (userProfile?.name || "there").split(" ")[0];
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const sessions = useMemo(() => {
    const list = activeFolder == null ? studySessions : studySessions.filter((s) => s.folderId === activeFolder);
    return [...list].sort((a, b) => completionOf(a) - completionOf(b));
  }, [studySessions, activeFolder]);
  // One page of them. Clamped, so deleting the last session on the last page lands on the one before.
  const pageCount = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageSessions = sessions.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const pickFolder = (id: number | null) => {
    setActiveFolder(id);
    setPage(0);
  };
  const nextUp = useMemo(() => [...studySessions].sort((a, b) => completionOf(a) - completionOf(b)).find((s) => completionOf(s) < 100), [studySessions]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  // When a folder is selected, the "Next up" card wears that folder's cover as
  // a darkened background; with no folder selected it's the plain card.
  const nextUpImage = useMemo(() => {
    if (activeFolder == null) return undefined;
    return parseCover(folderById.get(activeFolder)?.icon)?.src;
  }, [activeFolder, folderById]);

  // ---- sources ---------------------------------------------------------------
  const [sources, setSources] = useState<NoteSource[] | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const loadSources = useCallback(async () => {
    try {
      setSources(await listSources());
    } catch {
      setSources([]);
    }
  }, []);
  useEffect(() => {
    loadSources();
  }, [loadSources]);
  useEffect(() => {
    // Return leg of a source connection: /dashboard#connected=<id>
    const m = window.location.hash.match(/connected=([a-z_]+)/);
    if (m) {
      window.history.replaceState(null, "", "/dashboard");
      loadSources().then(() => toast({ title: "Connected", description: `${m[1].replace("_", " ")} is now linked to your account.` }));
    }
  }, [loadSources, toast]);

  const onConnect = async (src: NoteSource) => {
    if (src.manual) {
      setShowCreateSession(true);
      return;
    }
    setConnecting(src.id);
    try {
      await connectSource(src.id); // navigates away on success
    } catch (e) {
      toast({ title: `Can't connect ${src.name}`, description: e instanceof Error ? e.message : undefined, variant: "destructive" });
      setConnecting(null);
    }
  };
  const onDisconnect = async (src: NoteSource) => {
    await disconnectSource(src.id);
    await loadSources();
    toast({ title: `${src.name} disconnected` });
  };

  // ---- sessions --------------------------------------------------------------
  const open = (s: StudySession) => {
    setCurrentSession(s);
    navigate(`/dashboard/${s.id}/full-study`);
  };
  const refresh = async () => initializeFromAPI(await fetchAppData());
  const moveTo = async (s: StudySession, folder: Folder | null) => {
    try {
      if (folder) await moveSessionToFolder(s.id, folder.id);
      await refresh();
      toast({ title: folder ? `Moved to ${folder.name}` : "Session moved" });
    } catch (e) {
      toast({ title: "Couldn't move session", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
  };
  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteStudySession(toDelete.id);
      await refresh();
      toast({ title: "Session deleted", description: `"${toDelete.title}" was removed.` });
    } catch (e) {
      toast({ title: "Couldn't delete session", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setToDelete(null);
    }
  };
  const onDrop = async (e: React.DragEvent, folder: Folder) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const s = studySessions.find((x) => x.id === id);
    setDragged(null);
    setDropTarget(null);
    if (s) await moveTo(s, folder);
  };

  const statItems = [
    { value: stats?.totalSessions ?? studySessions.length, label: "sessions" },
    { value: `${stats?.averageAccuracy ?? 0}%`, label: "accuracy" },
    { value: stats?.totalStudyTime ?? "0min", label: "studied" },
    { value: (stats?.questionsAnswered ?? 0).toLocaleString(), label: "answered" },
  ];

  return (
    <div className="fade-in mx-auto w-full max-w-6xl">
      {/* Greeting */}
      <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">
        Hey {firstName}, pick up where you left off
        <span className="ml-3 hidden align-middle text-sm font-normal text-muted-foreground lg:inline">
          or jump anywhere with{" "}
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">{isMac ? "⌘" : "Ctrl"}</kbd>{" "}
          +{" "}
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">K</kbd>
        </span>
      </h1>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_296px]">
        <div className="min-w-0 space-y-9">
          {/* Banner */}
          {!isInitialized ? (
            <Skeleton className="h-44 rounded-2xl" />
          ) : nextUp ? (
            <section
              className={cn(
                "relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl p-7 md:flex-row md:items-end md:p-8",
                nextUpImage ? "text-white" : "bg-foreground text-background",
              )}
            >
              {nextUpImage && (
                <>
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${nextUpImage})` }} />
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/90 via-black/72 to-black/45" />
                </>
              )}
              <div className="relative min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">Next up</p>
                <h2 className="font-display mt-2 truncate text-[30px] leading-tight md:text-[34px]">{nextUp.title}</h2>
                <p className="mt-1.5 text-sm opacity-80">
                  {nextUp.topics} topic{nextUp.topics === 1 ? "" : "s"} · {completionOf(nextUp)}% complete
                  {nextUp.time ? ` · last opened ${nextUp.time}` : ""}
                </p>
              </div>
              <div className="relative flex shrink-0 items-center gap-2">
                <Button
                  variant="ghost"
                  className={nextUpImage ? "text-white/85 hover:bg-white/15 hover:text-white" : "text-background/80 hover:bg-background/10 hover:text-background"}
                  onClick={() => setShowCreateSession(true)}
                >
                  <Plus className="size-4" />
                  New session
                </Button>
                <Button
                  className={nextUpImage ? "bg-white text-neutral-900 hover:bg-white/90" : "bg-background text-foreground hover:bg-background/90"}
                  onClick={() => open(nextUp)}
                >
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </section>
          ) : (
            <section className="flex flex-col justify-between gap-6 rounded-2xl bg-foreground p-7 text-background md:flex-row md:items-end md:p-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-60">Start here</p>
                <h2 className="font-display mt-2 text-[30px] leading-tight md:text-[34px]">Turn your notes into a game</h2>
                <p className="mt-1.5 max-w-md text-sm opacity-70">
                  Paste text, drop a PDF, or connect the place your notes already live. AnotherNotes builds the topics and questions.
                </p>
              </div>
              <Button className="shrink-0 bg-background text-foreground hover:bg-background/90" onClick={() => setShowCreateSession(true)}>
                Create study session
                <ArrowRight className="size-4" />
              </Button>
            </section>
          )}

          {/* An exam coming up: what today's plan asks for, per session. */}
          <ExamPlanCard />

          {/* Sessions */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Continue studying</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <FolderChip label="All" active={activeFolder == null} onClick={() => pickFolder(null)} />
                {folders.map((f) => (
                  <FolderChip
                    key={f.id}
                    label={`${folderLabelIcon(f.icon)}${f.name}`}
                    count={f.session_count}
                    active={activeFolder === f.id}
                    dropping={dropTarget === f.id}
                    dragging={!!dragged}
                    onClick={() => pickFolder(activeFolder === f.id ? null : f.id)}
                    onDragOver={(e) => { e.preventDefault(); setDropTarget(f.id); }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={(e) => onDrop(e, f)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setShowCreateFolder(true)}
                  className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <FolderPlus className="size-3.5" />
                  New folder
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-border bg-card">
              {!isInitialized ? (
                <div className="divide-y divide-border">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="ml-auto h-3 w-24" />
                    </div>
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-semibold">{activeFolder == null ? "No study sessions yet" : "Nothing in this folder yet"}</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    {activeFolder == null
                      ? "Create one from your notes, a PDF or a connected source, and it will show up here."
                      : "Drag a session onto the folder chip above, or use “Move to” on a session."}
                  </p>
                  {activeFolder == null && (
                    <Button size="sm" className="mt-4" onClick={() => setShowCreateSession(true)}>
                      Create study session
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-border">
                    {pageSessions.map((s) => {
                      const pct = completionOf(s);
                      const isNew = !!s.createdAt && Date.now() - s.createdAt < NEW_WINDOW_MS;
                      const folder = s.folderId != null ? folderById.get(s.folderId) : undefined;
                      return (
                        <li
                          key={s.id}
                          draggable
                          onDragStart={(e) => { setDragged(s.id); e.dataTransfer.setData("text/plain", s.id); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { setDragged(null); setDropTarget(null); }}
                          className={cn("group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50", dragged === s.id && "opacity-40")}
                        >
                          <span className="hidden w-20 shrink-0 text-xs tabular-nums text-muted-foreground sm:block">{s.time || "—"}</span>
                          <button type="button" onClick={() => open(s)} className="min-w-0 flex-1 text-left">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{s.title}</span>
                              {isNew && <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">New</span>}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {s.topics} topic{s.topics === 1 ? "" : "s"}
                              {folder ? ` · ${folderLabelIcon(folder.icon)}${folder.name}` : ""}
                            </span>
                          </button>
                          {/* On a phone the bar costs more room than the title can spare, so only the number rides along. */}
                          <div className="flex w-10 shrink-0 items-center gap-2 sm:w-28">
                            <div className="hidden h-1 flex-1 overflow-hidden rounded-full bg-muted sm:block">
                              <div className={cn("h-full rounded-full", pct >= 100 ? "bg-success" : "bg-chart-1")} style={{ width: `${Math.max(2, pct)}%` }} />
                            </div>
                            <span className="w-8 text-right text-xs font-semibold tabular-nums">{pct}%</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8" onClick={() => open(s)} aria-label="Open">
                                  <ArrowRight className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Open</TooltipContent>
                            </Tooltip>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8" aria-label="More">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-48">
                                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Move to</DropdownMenuLabel>
                                {folders.length === 0 && (
                                  <DropdownMenuItem onSelect={() => setShowCreateFolder(true)}>
                                    <FolderPlus /> Create a folder first
                                  </DropdownMenuItem>
                                )}
                                {folders.map((f) => (
                                  <DropdownMenuItem key={f.id} onSelect={() => moveTo(s, f)} disabled={s.folderId === f.id}>
                                    <FolderInput />
                                    <span className="truncate">{folderLabelIcon(f.icon)}{f.name}</span>
                                    {s.folderId === f.id && <Check className="ml-auto" />}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setToDelete(s)} className="text-destructive focus:text-destructive">
                                  <Trash2 /> Delete session
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {pageCount > 1 && (
                    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-2.5">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {currentPage * PAGE_SIZE + 1}–{Math.min(sessions.length, (currentPage + 1) * PAGE_SIZE)} of {sessions.length}
                      </span>
                      <nav aria-label="Pages of sessions" className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={currentPage === 0}
                          onClick={() => setPage(currentPage - 1)}
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        {pageList(currentPage, pageCount).map((p, i) =>
                          p === "gap" ? (
                            <span key={`gap-${i}`} className="w-5 text-center text-xs text-muted-foreground">
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPage(p)}
                              aria-label={`Page ${p + 1}`}
                              aria-current={p === currentPage ? "page" : undefined}
                              className={cn(
                                "h-7 min-w-7 rounded-md px-1.5 text-xs font-medium tabular-nums transition-colors",
                                p === currentPage ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              {p + 1}
                            </button>
                          ),
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={currentPage >= pageCount - 1}
                          onClick={() => setPage(currentPage + 1)}
                          aria-label="Next page"
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </nav>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Everything the student decided was worth keeping */}
          <StickyWall />

          {/* A page of their own: written or talked into, then checked. */}
          <NotesWall />

          {/* Sources */}
          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Your notes</p>
                <p className="mt-1 text-sm text-muted-foreground">Connect where your notes live and AnotherNotes reads them from there.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {sources === null
                ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[76px] rounded-2xl" />)
                : sources.map((src) => {
                    return (
                      <div key={src.id} className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5">
                        <span className="relative shrink-0">
                          <SourceLogo id={src.id} />
                          {src.connected && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-success text-background ring-2 ring-card">
                              <Check className="size-2.5" />
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{src.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {src.connected ? `Connected · ${src.account ?? "linked"}` : src.description}
                          </p>
                        </div>
                        {src.connected ? (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => onDisconnect(src)}>
                            Disconnect
                          </Button>
                        ) : src.manual ? (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onConnect(src)}>
                            Import
                          </Button>
                        ) : src.configured ? (
                          <Button size="sm" className="h-7 text-xs" disabled={connecting === src.id} onClick={() => onConnect(src)}>
                            {connecting === src.id ? <Loader2 className="size-3.5 animate-spin" /> : "Connect"}
                          </Button>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help text-xs text-muted-foreground">Needs setup</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-56 text-xs">
                              {src.name} needs {src.provider === "google" ? "Google" : src.provider === "microsoft" ? "Microsoft" : "Notion"} API
                              credentials on the server before it can be connected.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })}
            </div>
          </section>

        </div>

        {/* Right rail — a column beside the content on desktop; on tablet it
            becomes a two-up row under it rather than three stacked full-width
            cards you have to scroll past. */}
        {/* self-start + content-start: the rail keeps its own height. As a grid item it
            used to stretch to the full height of the long column beside it and share
            that height out between its cards, which drew them tall and mostly empty. */}
        <aside className="grid content-start gap-4 self-start sm:grid-cols-2 xl:grid-cols-1">
          <StatRail items={statItems} loading={!isInitialized} />
          {isInitialized ? (
            <XpCard xp={xp} studySeconds={userProfile?.studySeconds ?? 0} welcome={userProfile?.id ?? "me"} />
          ) : (
            <Skeleton className="h-28 rounded-2xl" />
          )}
          <div className="sm:col-span-2 xl:col-span-1">
            <StreakCard />
          </div>
        </aside>
      </div>

      <CreateStudySessionDialog open={showCreateSession} onOpenChange={setShowCreateSession} />
      <CreateFolderDialog open={showCreateFolder} onOpenChange={setShowCreateFolder} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Delete study session?
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" and all of its questions and progress will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FolderChip({
  label,
  count,
  active,
  dropping,
  dragging,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  label: string;
  count?: number;
  active?: boolean;
  dropping?: boolean;
  dragging?: boolean;
  onClick: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted",
        dragging && onDrop && !active && "border-dashed",
        dropping && "border-chart-1 bg-accent text-accent-foreground",
      )}
    >
      {label}
      {typeof count === "number" && <span className={cn("tabular-nums", active ? "opacity-70" : "text-muted-foreground")}>{count}</span>}
    </button>
  );
}
