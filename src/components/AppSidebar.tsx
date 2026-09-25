import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  ChevronsUpDown,
  Folder,
  HelpCircle,
  LayoutGrid,
  LibraryBig,
  LogOut,
  Moon,
  NotebookPen,
  PanelLeft,
  PlayCircle,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTooltip,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppStore, type StudySession, type Topic } from "@/store/appStore";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeToggle";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { logout } from "@/services/api";
import { NEW_NOTE_PATH, isNote, notePath } from "@/lib/notes/isNote";
import { formatDuration, usePresenceStore } from "@/store/presenceStore";
import { cn } from "@/lib/utils";

/*
  App sidebar — shadcn inset / icon-collapsible shell: quiet groups, active
  state is only a darker pill, no accent colour on nav items, tooltips only
  when collapsed (Cmd/Ctrl+B toggles).

  It is also the whole of the app's chrome. Search is the last row of the
  header, directly above the nav groups; presence, theme and help sit on a
  utility shelf at the foot, above the account menu. The page's top strip
  carries the breadcrumb and nothing else.

  STURDY BY CONSTRUCTION. Folding changes the panel's width and nothing else:
  every row has the same height, padding and order expanded and folded, so no
  icon moves in x or y (the pill starts at x=14 and every glyph is centred on
  x=28 in both states). The brand block is two fixed rows in both states. The
  one group whose length differs — Notes, a list when open and one icon in the
  rail — is the last thing in the scroll area, and everything else below it is
  in the footer, which is anchored to the bottom, so nothing can sit under it.
*/

interface NavItem {
  title: string;
  to: string;
  icon: LucideIcon;
  /** path prefix that marks this item active */
  match: string;
  exact?: boolean;
}

const OVERVIEW: NavItem[] = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutGrid, match: "/dashboard", exact: true },
  { title: "Study Folders", to: "/dashboard/folders", icon: Folder, match: "/dashboard/folder" },
  { title: "Calendar", to: "/dashboard/calendar", icon: CalendarDays, match: "/dashboard/calendar" },
];

/* Family and Profile were two groups of one item each, and each label cost a
   28px row. Both now sit at the foot, above the utility rows. */
const YOU: NavItem[] = [
  { title: "Family", to: "/dashboard/family", icon: Users, match: "/dashboard/family" },
  { title: "Profile & Settings", to: "/dashboard/profile", icon: Settings, match: "/dashboard/profile" },
];

/** Full Study is the one way to study: a scrolling note with one Quiz button at the top.
 *  With a session open it deep-links into it, otherwise it opens the picker. */
const studyPath = (sessionId?: string) => (sessionId ? `/dashboard/${sessionId}/full-study` : "/dashboard/full-study");

/** How many of the student's own notes the Notes group lists before "All notes". */
const RECENT_NOTES = 6;
/** The dashboard's notes wall (NotesWall carries id="notes"). */
const ALL_NOTES_PATH = "/dashboard#notes";

const ROLE_LABELS: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member" };

function roleLine(session: ReturnType<typeof useAuth>["session"]): string {
  const u = session?.user;
  if (u?.account_kind === "managed_child") return "Student";
  if (!u?.role) return "";
  if (u.role === "student") return u.child_count > 0 ? "Student · Parent" : "Student";
  if (u.teacher_type === "organization" && session?.org) return `Teacher · ${session.org.name}`;
  return u.teacher_type === "individual" ? "Independent teacher" : "Teacher";
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const KBD = isMac ? "⌘K" : "Ctrl+K";
const FOLD_KBD = isMac ? "⌘B" : "Ctrl+B";

function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Does the tutor have an unanswered question about any section of this note? */
function hasOpenChecks(note: StudySession): boolean {
  const walk = (topics: Topic[] | undefined): boolean =>
    (topics ?? []).some((t) => (t.subtopics?.length ? walk(t.subtopics) : (t.noteChecks ?? []).some((c) => !c.answer)));
  return walk(note.extractedTopics);
}

const noteTitle = (note: StudySession) => note.title?.trim() || "Untitled note";

/** The amber "the tutor asked you something" dot. */
function CheckDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full bg-amber-500", className)} />;
}

/*
  The one fold button. Always visible, the same 28px square in both states, and
  the ONLY element that changes place when the sidebar folds: at the right of the
  brand row when expanded, directly under the logo in the rail (and while the rail
  peeks out, so it never jumps from under a resting pointer). Keeping one element
  rather than two means a keyboard user who folds with Enter can unfold with Enter.
  On a phone it is the sheet's close button, with a 44px hit area.
*/
function FoldButton() {
  const { state, isMobile, toggleSidebar } = useSidebar();
  const expanded = isMobile || state === "expanded";
  const label = isMobile ? "Close navigation" : expanded ? "Collapse sidebar" : "Expand sidebar";
  return (
    <SidebarTooltip
      always
      tooltip={{
        children: (
          <span className="flex items-center gap-2">
            {label}
            <kbd className="rounded border border-border px-1 text-[10px] font-semibold tracking-wide text-muted-foreground">{FOLD_KBD}</kbd>
          </span>
        ),
        className: "text-xs",
      }}
    >
      <button
        type="button"
        data-no-peek
        onClick={toggleSidebar}
        aria-label={label}
        aria-expanded={expanded}
        aria-keyshortcuts={isMobile ? undefined : "Meta+B Control+B"}
        className={cn(
          "absolute right-0 top-0 z-10 flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4",
          // Folded (and peeking): directly under the logo.
          "group-data-[state=collapsed]:left-0 group-data-[state=collapsed]:right-auto group-data-[state=collapsed]:top-[calc(2rem+4px)]",
          isMobile && "after:absolute after:-inset-[8px] after:content-['']",
        )}
      >
        {isMobile ? <X /> : <PanelLeft />}
      </button>
    </SidebarTooltip>
  );
}

export function AppSidebar({ onSearch }: { onSearch: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const currentSession = useAppStore((s) => s.currentSession);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const userProfile = useAppStore((s) => s.userProfile);
  const studySessions = useAppStore((s) => s.studySessions);
  const activeSeconds = usePresenceStore((s) => s.activeSeconds);
  const { session } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { isMobile, setOpenMobile, state, closePeek } = useSidebar();
  const org = session?.org ?? null;
  // The rail's SHAPE (one Notes icon, fold button under the logo) holds while it
  // peeks out; only the labels come and go. The phone sheet is always full shape.
  const rail = !isMobile && state === "collapsed";

  /*
    On a phone this sidebar is a Radix Sheet and the palette is a Radix Dialog.
    Mounting the second while the first is still open stacks two focus traps and
    two scroll locks, and can leave the body with pointer-events:none once they
    unwind. SheetContent's close animation is 300ms (ui/sheet.tsx:32), so hand
    the screen over after it, not on the next frame.
  */
  const handoff = useRef<number | undefined>(undefined);
  const scrollPoll = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(handoff.current);
      window.clearInterval(scrollPoll.current);
    },
    [],
  );
  const openSearch = () => {
    closePeek();
    if (!isMobile) {
      onSearch();
      return;
    }
    setOpenMobile(false);
    handoff.current = window.setTimeout(onSearch, 320);
  };
  /* Nav links never closed the sheet, so a tap landed you on the new page with
     the menu still covering it. With search and theme now living in here, the
     sheet is opened far more often, so this stops being cosmetic. On a desktop a
     peek folds away the same way instead of hanging over the new page. */
  const closeOnNav = () => {
    if (isMobile) setOpenMobile(false);
    else closePeek();
  };
  // Any navigation, however it happened (the palette, a link in the page, Back).
  useEffect(() => {
    closePeek();
  }, [pathname, closePeek]);

  // A guardian-created profile has no Family section — it is the one being
  // followed, not the one following.
  const isManagedChild = session?.user.account_kind === "managed_child";
  const you = YOU.filter((item) => item.match !== "/dashboard/family" || !isManagedChild);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.match : pathname.startsWith(item.match);

  // Notes are study sessions too (source_kind "note"), but they are not what
  // Full Study or "Continue" mean.
  const studySession = currentSession && !isNote(currentSession) ? currentSession : null;
  const notes = useMemo(
    () =>
      studySessions
        .filter(isNote)
        .sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)),
    [studySessions],
  );
  const recentNotes = notes.slice(0, RECENT_NOTES);
  const anyOpenChecks = useMemo(() => notes.some(hasOpenChecks), [notes]);

  /* "All notes" lands on the dashboard's notes wall. The router does not scroll to
     a hash, and the wall renders only once the dashboard has its data, so look for
     it for a moment rather than once. */
  const showAllNotes = () => {
    closeOnNav();
    navigate(ALL_NOTES_PATH);
    window.clearInterval(scrollPoll.current);
    let tries = 0;
    scrollPoll.current = window.setInterval(() => {
      const wall = document.getElementById("notes");
      if (wall || ++tries > 20) {
        window.clearInterval(scrollPoll.current);
        wall?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const navRow = (item: NavItem, onClick?: () => void) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.title}>
        <Link
          to={item.to}
          onClick={() => {
            onClick?.();
            closeOnNav();
          }}
        >
          <item.icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          {/* Brand block: two fixed 28px rows in every state. Row one is the logo
              link; row two is the "studied" line when expanded and the fold button
              in the rail, so the rows under it sit at the same height either way.
              The logo is flush with the pill (px-0) so it is centred on the same
              x as every icon below it, folded or not. */}
          <SidebarMenuItem className="h-[calc(4rem+4px)]">
            <SidebarMenuButton asChild tooltip="AnotherNotes" className="px-0 pr-10 group-data-[collapsible=icon]:pr-0">
              <Link to="/dashboard" onClick={() => { setCurrentSession(null); closeOnNav(); }}>
                <img src="/an-logo.svg" alt="" className="size-8 shrink-0" />
                <span className="truncate text-sm font-semibold tracking-tight">AnotherNotes</span>
              </Link>
            </SidebarMenuButton>
            <span className="pointer-events-none absolute left-10 top-[calc(2rem-2px)] truncate pr-2 text-xs tabular-nums text-muted-foreground group-data-[state=collapsed]:hidden">
              {userProfile ? (activeSeconds >= 60 ? `${formatDuration(activeSeconds)} studied` : "Studying now") : "Study smarter"}
            </span>
            <FoldButton />
          </SidebarMenuItem>

          {/* Organisation strip — org members only; quiet on purpose (hover is the affordance) */}
          {org && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={org.name} className="text-muted-foreground">
                <Link to="/dashboard/profile" onClick={closeOnNav}>
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-sidebar-border bg-sidebar text-[0.55rem] font-semibold text-muted-foreground">
                    {org.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">{org.name}</span>
                  {session?.user.org_role && (
                    <span className="ml-auto shrink-0 rounded-full border border-sidebar-border px-1.5 py-px text-[0.6rem] font-medium">
                      {ROLE_LABELS[session.user.org_role] ?? session.user.org_role}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {/* SEARCH — the first thing in the sidebar, above every nav group,
              where the Notion reference puts it. A button dressed as a field:
              it opens the CommandDialog AppShell already mounts, so the modal
              and ⌘K/Ctrl+K are untouched and only the trigger moved. The
              tooltip is its label in the rail. */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={openSearch}
              tooltip={`Search ${KBD}`}
              aria-label="Search"
              aria-keyshortcuts="Meta+K Control+K"
              className="text-muted-foreground hover:text-sidebar-accent-foreground"
            >
              <Search />
              {/* explicit: the variants' [&>span:last-child]:truncate does not
                  reach this span when the kbd renders after it */}
              <span className="truncate">Search</span>
              {/* Gated in JS rather than by `hidden md:inline-block`: a phone
                  has no ⌘ to press. Hidden in the rail by index.css. */}
              {!isMobile && (
                <kbd className="ml-auto rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
                  {KBD}
                </kbd>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* The first group needs no heading: Search sits right above it. Its
            28px would have pushed the Notes icon off a 640px-tall laptop rail. */}
        <SidebarGroup>
          <SidebarMenu>
            {OVERVIEW.map((item) =>
              navRow(item, item.match === "/dashboard" || item.match === "/dashboard/folder" ? () => setCurrentSession(null) : undefined),
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* Study */}
        <SidebarGroup>
          <SidebarGroupLabel>Study</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.includes("/full-study")} tooltip="Full Study">
                <Link to={studyPath(studySession?.id)} onClick={closeOnNav}>
                  <BookOpen />
                  <span>Full Study</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {studySession && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={`Continue: ${studySession.title}`}
                  className="text-xs text-muted-foreground"
                >
                  <Link to={studyPath(studySession.id)} onClick={closeOnNav}>
                    <PlayCircle />
                    <span className="truncate">{studySession.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* Notes — the student's own notes, which open on the same screen as a
            study session. Straight from the store (a note is a study session with
            sourceKind "note"), so creating, renaming or deleting one shows here at
            once. In the rail it is ONE icon that opens a menu, never an icon per note.
            It is the LAST group in the scroll area on purpose: the list is longer
            than the one rail icon, and with nothing below it, that difference can
            never move another icon. */}
        <SidebarGroup>
          <SidebarGroupLabel>Notes</SidebarGroupLabel>
          {!rail && (
            <SidebarGroupAction asChild>
              <Link to={NEW_NOTE_PATH} onClick={closeOnNav} aria-label="New note" title="New note">
                <Plus />
              </Link>
            </SidebarGroupAction>
          )}
          <SidebarMenu>
            {rail ? (
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Notes"
                      isActive={pathname.startsWith("/dashboard/note/")}
                      aria-label={anyOpenChecks ? "Notes (the tutor has a question)" : "Notes"}
                      className="data-[state=open]:bg-sidebar-accent"
                    >
                      <span className="relative flex size-4 shrink-0 items-center justify-center">
                        <NotebookPen className="size-4" />
                        {anyOpenChecks && <CheckDot className="absolute -right-0.5 -top-0.5 ring-2 ring-sidebar" />}
                      </span>
                      <span>Notes</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-60 rounded-lg">
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Notes</DropdownMenuLabel>
                    {recentNotes.map((note) => (
                      <DropdownMenuItem key={note.id} asChild>
                        <Link to={notePath(note.id)} onClick={closeOnNav} className={cn(pathname === notePath(note.id) && "font-medium")}>
                          <NotebookPen className="size-4 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{noteTitle(note)}</span>
                          {hasOpenChecks(note) && <CheckDot />}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    {recentNotes.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem asChild>
                      <Link to={NEW_NOTE_PATH} onClick={closeOnNav}>
                        <Plus className="size-4" />
                        New note
                      </Link>
                    </DropdownMenuItem>
                    {notes.length > 0 && (
                      <DropdownMenuItem onSelect={showAllNotes}>
                        <LibraryBig className="size-4" />
                        All notes
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{notes.length}</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ) : recentNotes.length === 0 ? (
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="text-xs text-muted-foreground">
                  <Link to={NEW_NOTE_PATH} onClick={closeOnNav}>
                    <NotebookPen />
                    <span>New note</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              <>
                {recentNotes.map((note) => {
                  const open = hasOpenChecks(note);
                  return (
                    <SidebarMenuItem key={note.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === notePath(note.id)}
                        className={cn("text-xs", open && "pr-6")}
                      >
                        <Link to={notePath(note.id)} onClick={closeOnNav}>
                          <NotebookPen />
                          <span className="truncate">{noteTitle(note)}</span>
                        </Link>
                      </SidebarMenuButton>
                      {open && (
                        <SidebarMenuBadge className="!top-0 h-8" title="The tutor has a question about this note">
                          <CheckDot />
                          <span className="sr-only">The tutor has a question about this note</span>
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="text-xs text-muted-foreground">
                    <Link to={ALL_NOTES_PATH} onClick={(e) => { e.preventDefault(); showAllNotes(); }}>
                      <LibraryBig />
                      <span>All notes</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* Family and Profile live down here, anchored to the bottom with the
              account menu, rather than under the Notes list, where a longer list
              pushed them down (and off a short screen) whenever it unfolded. */}
          {you.map((item) => navRow(item))}
          {/* Utility shelf — a column of 28px rows in BOTH states (labelled when
              there is width), so folding never re-flows it: it used to switch
              from a row to a column mid-animation and every icon in it moved. */}
          <SidebarMenuItem>
            <PresenceIndicator />
          </SidebarMenuItem>
          <SidebarMenuItem>
            {/* Glyph convention matches the account dropdown's theme item
                below — show the mode you are switching TO. */}
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={isDark ? "Light mode" : "Dark mode"}
              className="text-muted-foreground hover:text-sidebar-accent-foreground"
            >
              {isDark ? <Sun /> : <Moon />}
              <span>{isDark ? "Light mode" : "Dark mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Help & contact" className="text-muted-foreground hover:text-sidebar-accent-foreground">
              {/* /contact is a public, shell-less route — a new tab keeps the
                  dashboard (and any open study session) where it is. */}
              <a href="/contact" target="_blank" rel="noreferrer">
                <HelpCircle />
                <span>Help &amp; contact</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* The name is display:none in the rail, which left the initials
                    as the button's whole accessible name ("SU"). */}
                <SidebarMenuButton
                  size="lg"
                  tooltip={userProfile?.name ?? "Account"}
                  aria-label={`Account menu for ${userProfile?.name ?? "you"}`}
                  className="px-0 pr-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                      {initials(userProfile?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-semibold">{userProfile?.name ?? "Account"}</span>
                    <span className="truncate text-xs text-muted-foreground">{userProfile?.email ?? ""}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              {/* Beside the rail it opens to the right, clear of the shelf above it. */}
              <DropdownMenuContent
                align="end"
                side={rail ? "right" : "top"}
                sideOffset={rail ? 8 : 4}
                className="min-w-56 rounded-lg"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="grid leading-tight">
                    <span className="truncate text-sm font-semibold">{userProfile?.name ?? "Account"}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[roleLine(session), userProfile && activeSeconds >= 60 ? `${formatDuration(activeSeconds)} studied` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/profile" onClick={closeOnNav}>
                    <Settings className="size-4" />
                    Profile &amp; Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleTheme(); }}>
                  {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  {isDark ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
