import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Folder,
  GraduationCap,
  LayoutGrid,
  Menu,
  NotebookPen,
  Plus,
  Settings,
} from "lucide-react";
import { SidebarInset, SidebarProvider, readSidebarCookie, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { AppSidebar } from "@/components/AppSidebar";
import { useQueryClient } from "@tanstack/react-query";
import { parentalKeys } from "@/services/parental";
import { useAppStore } from "@/store/appStore";
import { NEW_NOTE_PATH, isNote, notePath } from "@/lib/notes/isNote";
import { startPresenceTracking } from "@/store/presenceStore";
import { cn } from "@/lib/utils";
import { applySheetAttr, useSheet } from "@/lib/studySurface";

/*
  App shell — sidebar + framed content card. The content floats as a rounded,
  hairline-bordered card on the sidebar-coloured ground.

  The top strip carries the breadcrumb and nothing else: no border, no card
  fill, no utility controls, so it reads as the page's first line rather than
  as a toolbar. Search, theme, help, presence and the account menu all live in
  the sidebar (header row / footer shelf). The only control the strip still
  renders is the sidebar trigger, and only in the modes where it is the user's
  real route back to navigation — see ShellTrigger.

  EXCEPT ON THE STUDY SURFACE (`BARE_ROUTE`), where the strip is not rendered at
  all. That page is a document, and a white band above a cream page above a
  third block behind the notes was the whole complaint: the strip could never be
  covered by the page's own backdrop, because it is a SIBLING of the scrollport
  rather than inside it. Removing it hands those 42/49px to the scrollport and
  lets one material reach the top of the card.

  Scoped to that one route on purpose. Everywhere else the breadcrumb is the
  only visible way back — /dashboard/folder/:id, /dashboard/family/:childId and
  the profile page have no in-page back link at all — so removing it app-wide
  would strand those pages. On the study surface the two things the strip
  carried both have homes in the page's own header row: `ShellTrigger` is
  exported from here and rendered there (it is the ONLY touch affordance for
  navigation, and therefore for search, on a phone), and
  the breadcrumb's job is done by a real back link beside the `<h1>`, which
  already prints the session title.
*/

/** The routes that render without the top strip: the two spellings of the study
 *  page (with a session id, and the session-less entry that keeps old links
 *  working — App.tsx), and a blank note, which is a document the student writes
 *  rather than a page of app furniture. Anything added here MUST render
 *  <ShellTrigger /> itself, and inherits the chosen study sheet. */
const BARE_ROUTE = /^\/dashboard\/(?:note\/[^/]+|(?:[^/]+\/)?full-study)\/?$/;

const SIDEBAR_WIDTH = "13.75rem"; // 220px expanded (narrower than stock shadcn)
const SIDEBAR_WIDTH_ICON = "3rem"; // 48px icon rail

/*
  The sidebar rests as its 48px icon rail on every screen from tablet up, and
  slides out over the page on hover (ui/sidebar.tsx). 220px of navigation was
  width taken from the notes and Teach mode's board for nothing most of the time.
  A student who docks it open with the fold button (or Ctrl+B) keeps it open: that
  choice is saved (the sidebar:docked cookie) and wins on every later load.

  Tablets. Turning one re-decides only for a student who docked it: the rail in
  portrait (an iPad in portrait is too narrow to spend 220px on navigation), docked
  again in landscape. Only a real ROTATION does — the listener used to fire on any
  width crossing 1024px, so dragging a desktop window narrower folded the sidebar.
  A rotation's choice is not saved; the student's own is.
*/
const TABLET_RAIL = "(min-width: 768px) and (max-width: 1023.98px)";
const isTabletPortrait = () => typeof window !== "undefined" && window.matchMedia(TABLET_RAIL).matches;

function TabletRail() {
  const { setOpen } = useSidebar();
  useEffect(() => {
    // A desktop window made taller than it is wide flips (orientation: portrait)
    // too; only a touch device can actually be turned.
    if (navigator.maxTouchPoints === 0) return;
    const mql = window.matchMedia("(orientation: portrait)");
    const apply = () => setOpen(!window.matchMedia(TABLET_RAIL).matches && readSidebarCookie() === true, { persist: false });
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [setOpen]);
  return null;
}

const MODE_LABELS: Record<string, string> = {
  "full-study": "Full Study",
};

interface Crumb {
  label: string;
  to?: string;
}

/*
  The one control the top strip may render, and only on a phone, where the
  sidebar is a sheet and this is the only way into navigation (and so into
  search). On a desktop or tablet the sidebar always shows its own fold button —
  beside the logo when open, under it in the rail — so a second one up here would
  just be the same button twice.

  `isMobile` comes from ui/sidebar.tsx and is right on the first render, so a
  phone no longer flashes the desktop chevron here before the menu icon.
*/
export function ShellTrigger() {
  const { toggleSidebar, isMobile, openMobile } = useSidebar();

  if (!isMobile) return null;

  const label = "Open navigation";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      aria-expanded={openMobile}
      aria-label={label}
      title={label}
      // The glyph stays small so the strip still reads as empty, but the
      // TOUCH TARGET is extended past it with an invisible ::after. This
      // project sets a 14px root (index.css), so `size-9` computes to 31.5px
      // and `size-8` to 28px — both well under the 44px iOS / 48dp Android
      // guidance, and on a phone this button is the ONLY route into
      // navigation. The header is 42px tall, so a physically larger button
      // does not fit; -inset-2 brings the hit area to ~46px without changing
      // a single pixel of what is drawn.
      className={cn(
        "relative -ml-2 size-9 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground md:size-8",
        "after:absolute after:-inset-2 after:content-['']",
      )}
    >
      <Menu className="size-4" />
    </Button>
  );
}

function useCrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const { studySessions, folders, currentSession } = useAppStore();
  const queryClient = useQueryClient();

  return useMemo(() => {
    const crumbs: Crumb[] = [{ label: "Dashboard", to: "/dashboard" }];
    const rest = pathname.replace(/^\/dashboard\/?/, "").split("/").filter(Boolean);
    if (rest.length === 0) return crumbs;

    const [first, second] = rest;
    if (first === "folders") return [...crumbs, { label: "Study Folders" }];
    if (first === "calendar") return [...crumbs, { label: "Calendar" }];
    if (first === "folder") {
      const folder = folders.find((f) => String(f.id) === second);
      return [...crumbs, { label: "Study Folders", to: "/dashboard/folders" }, { label: folder?.name ?? "Folder" }];
    }
    if (first === "profile") return [...crumbs, { label: "Profile & Settings" }];
    if (first === "family") {
      if (!second) return [...crumbs, { label: "Family" }];
      // Read whatever the parental queries already hold — never fetch, and
      // never reach into the app store, which belongs to the signed-in user
      // rather than to the learner being viewed.
      const cached =
        queryClient.getQueryData<{ name: string }>(parentalKeys.child(second)) ??
        queryClient
          .getQueryData<{ id: string; name: string }[]>(parentalKeys.children())
          ?.find((c) => c.id === second);
      return [...crumbs, { label: "Family", to: "/dashboard/family" }, { label: cached?.name ?? "Learner" }];
    }
    // A note of their own: a session underneath, so its title is in the store.
    if (first === "note") {
      const note = studySessions.find((s) => s.id === second) ?? (currentSession?.id === second ? currentSession : null);
      const title = note?.title && note.title !== "Untitled note" ? note.title : "Untitled";
      return [...crumbs, { label: "Notes" }, { label: second === "new" ? "New note" : title }];
    }
    if (MODE_LABELS[first]) return [...crumbs, { label: MODE_LABELS[first] }];

    // /dashboard/:sessionId/:mode
    const session = studySessions.find((s) => s.id === first) ?? (currentSession?.id === first ? currentSession : null);
    const modeLabel = second ? MODE_LABELS[second] ?? second : undefined;
    return [
      ...crumbs,
      { label: session?.title ?? "Study session", to: modeLabel ? `/dashboard/${first}/full-study` : undefined },
      ...(modeLabel ? [{ label: modeLabel }] : []),
    ];
  }, [pathname, studySessions, folders, currentSession, queryClient]);
}

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { studySessions, folders, setCurrentSession } = useAppStore();

  // A note is a study session underneath (lib/notes/isNote.ts), but here it is
  // its own kind of thing: it opens at its own URL and is listed on its own.
  const sessions = useMemo(() => studySessions.filter((s) => !isNote(s)), [studySessions]);
  const notes = useMemo(
    () =>
      studySessions
        .filter(isNote)
        .sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)),
    [studySessions],
  );

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* The dialog's name for screen readers (Radix logs an error without one). */}
      <DialogTitle className="sr-only">Search</DialogTitle>
      <DialogDescription className="sr-only">Jump to a page, a study session, a note or a folder.</DialogDescription>
      <CommandInput placeholder="Search sessions, notes and folders…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => { setCurrentSession(null); go("/dashboard"); }}>
            <LayoutGrid className="mr-2 size-4" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/folders")}>
            <Folder className="mr-2 size-4" /> Study Folders
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/calendar")}>
            <CalendarDays className="mr-2 size-4" /> Calendar
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/profile")}>
            <Settings className="mr-2 size-4" /> Profile &amp; Settings
          </CommandItem>
          <CommandItem value="new note write dictate" onSelect={() => go(NEW_NOTE_PATH)}>
            <Plus className="mr-2 size-4" /> New note
          </CommandItem>
        </CommandGroup>
        {sessions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Study sessions">
              {sessions.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`session ${s.title}`}
                  onSelect={() => { setCurrentSession(s); go(`/dashboard/${s.id}/full-study`); }}
                >
                  <GraduationCap className="mr-2 size-4 text-muted-foreground" />
                  <span className="truncate">{s.title}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{s.progress}%</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {notes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notes">
              {notes.map((n) => (
                <CommandItem
                  // The id keeps two notes with the same title (or none) apart.
                  key={n.id}
                  value={`note ${n.title?.trim() || "Untitled note"} ${n.id}`}
                  onSelect={() => go(notePath(n.id))}
                >
                  <NotebookPen className="mr-2 size-4 text-muted-foreground" />
                  <span className="truncate">{n.title?.trim() || "Untitled note"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {folders.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Folders">
              {folders.map((f) => (
                <CommandItem key={f.id} value={`folder ${f.name}`} onSelect={() => go(`/dashboard/folder/${f.id}`)}>
                  <span className="mr-2 text-base leading-none">{f.icon}</span>
                  <span className="truncate">{f.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const crumbs = useCrumbs();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Docked open only when the student docked it (and not on an iPad in portrait);
  // otherwise the icon rail. Read once, on mount, like any default.
  const [defaultOpen] = useState(() => readSidebarCookie() === true && !isTabletPortrait());
  const userId = useAppStore((s) => s.userProfile?.id);
  const bare = BARE_ROUTE.test(useLocation().pathname);
  const sheet = useSheet();

  // The chosen sheet goes on <html>, not on the content card, because below md
  // the DOCUMENT scrolls: a background that stops at the content box leaves
  // overscroll — and the 8px gutter the inset card floats in — showing the app
  // palette underneath. Same problem, same fix, as `html:has(.lp)` in index.css.
  useEffect(() => {
    applySheetAttr(bare ? sheet : null);
    return () => applySheetAttr(null);
  }, [bare, sheet]);

  // Presence tracking lives for as long as the signed-in shell is mounted.
  useEffect(() => {
    if (!userId) return;
    return startPresenceTracking(userId);
  }, [userId]);

  // ⌘K / Ctrl+K is unchanged and still lives here — only the visible trigger
  // moved, into the sidebar's search row.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Exactly ⌘K / Ctrl+K. Adding shift or alt makes it someone else's shortcut —
      // a student whose talk key is ⌘⇧K would otherwise get search as well.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={{ "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON } as React.CSSProperties}
    >
      <TabletRail />
      <AppSidebar onSearch={() => setPaletteOpen(true)} />
      {/* On md+ the inset is a viewport-height card and pages scroll inside the
          content frame below, so the strip stays pinned without `sticky`. Below
          md the DOCUMENT scrolls, and this strip carries the only route into
          navigation (and therefore into search) — so there it sticks. z-30 sits
          under every floating layer already in the app: toasts z-100, ReadMode
          z-120, GuideDock z-130. */}
      <SidebarInset
        data-an-sheet={bare ? sheet : undefined}
        className={cn(
          "md:h-[calc(100svh-1rem)] md:overflow-hidden md:rounded-xl",
          // One material: with the gutter painted the same colour, a hairline
          // and a shadow would be the only thing left drawing a seam.
          bare ? "an-sheet-surface" : "md:border md:border-border md:shadow-sm",
        )}
      >
        {!bare && (
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-1 bg-background/90 px-4 backdrop-blur-sm md:static md:z-auto md:h-14 md:bg-transparent md:px-6 md:backdrop-blur-none">
          <ShellTrigger />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="min-w-0 flex-nowrap">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                // Only the MIDDLE crumb collapses on narrow screens, so a phone
                // keeps a working root link ("Dashboard / Chemistry Notes")
                // instead of degrading to a bare, unlinked page title.
                const middle = i > 0 && !last;
                return (
                  <Fragment key={`${c.label}-${i}`}>
                    {i > 0 && <BreadcrumbSeparator className={cn(middle && "hidden sm:block")} />}
                    <BreadcrumbItem className={cn("min-w-0", middle && "hidden sm:block")}>
                      {last || !c.to ? (
                        // Nothing on the right to truncate against any more.
                        <BreadcrumbPage className="max-w-[60vw] truncate md:max-w-none">{c.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          {/* flex-nowrap + min-w-0: a long session title
                              ellipsizes instead of wrapping the strip or
                              overflowing the inset's md:overflow-hidden */}
                          <Link to={c.to} className="truncate">
                            {c.label}
                          </Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        )}

        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">{children}</div>
      </SidebarInset>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </SidebarProvider>
  );
}
