import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Folder,
  GraduationCap,
  LayoutGrid,
  Menu,
  Settings,
} from "lucide-react";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
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
  navigation, and therefore for search, on a phone and on a collapsed rail), and
  the breadcrumb's job is done by a real back link beside the `<h1>`, which
  already prints the session title.
*/

/** The routes that render without the top strip. Both spellings of the study
 *  page: with a session id, and the session-less entry that keeps old links
 *  working (App.tsx). Anything added here MUST render <ShellTrigger /> itself. */
const BARE_ROUTE = /^\/dashboard\/(?:[^/]+\/)?full-study\/?$/;

const SIDEBAR_WIDTH = "13.75rem"; // 220px expanded (narrower than stock shadcn)
const SIDEBAR_WIDTH_ICON = "3rem"; // 48px icon rail

/*
  Tablets. An iPad in portrait is 768–1024 CSS px wide: enough for the desktop
  layout, but not enough to spend 220px of it on navigation — session titles
  start truncating three words in. So the sidebar drops to its icon rail in
  that range and comes back the moment the tablet is turned to landscape.
  A student who opens it by hand keeps it open until the next rotation.
*/
const TABLET_RAIL = "(min-width: 768px) and (max-width: 1023.98px)";
const isTabletPortrait = () => typeof window !== "undefined" && window.matchMedia(TABLET_RAIL).matches;

function TabletRail() {
  const { setOpen } = useSidebar();
  useEffect(() => {
    const mql = window.matchMedia(TABLET_RAIL);
    const apply = (e: MediaQueryListEvent) => setOpen(!e.matches);
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
  Does this device have a hover-capable pointer? A touch tablet sits at md+,
  where the sidebar's own collapse control is `showOnHover` (md:opacity-0) and
  SidebarRail is a 16px, tabIndex={-1}, hover-only strip — so without a mouse
  there would be no visible way to re-collapse an expanded sidebar. On those
  devices the strip keeps its trigger.
*/
const HOVER_POINTER = "(hover: hover) and (pointer: fine)";

function useHoverPointer() {
  const [hover, setHover] = useState(
    () => typeof window === "undefined" || !window.matchMedia || window.matchMedia(HOVER_POINTER).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(HOVER_POINTER);
    const apply = (e: MediaQueryListEvent) => setHover(e.matches);
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);
  return hover;
}

/*
  The one control the top strip may render — and it renders nothing at all on a
  hover-capable desktop with the sidebar already open, which is what makes the
  top "purely empty" there. Collapsing is then done from the sidebar's own brand
  row, the rail, or Ctrl+B.

  It also fixes a live a11y bug: `state` only tracks the desktop rail, so on a
  phone aria-expanded used to report `true` while the Sheet was shut.
*/
export function ShellTrigger() {
  const { state, toggleSidebar, isMobile, openMobile } = useSidebar();
  const hoverPointer = useHoverPointer();
  const collapsed = state === "collapsed";

  if (!isMobile && !collapsed && hoverPointer) return null;

  const expanded = isMobile ? openMobile : !collapsed;
  const label = isMobile ? "Open navigation" : expanded ? "Collapse sidebar" : "Expand sidebar";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      aria-expanded={expanded}
      aria-label={label}
      title={isMobile ? label : `${label} (Ctrl+B)`}
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
      {isMobile ? (
        <Menu className="size-4" />
      ) : expanded ? (
        <ChevronsLeft className="size-4" />
      ) : (
        <ChevronsRight className="size-4" />
      )}
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

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search sessions and folders…" />
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
        </CommandGroup>
        {studySessions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Study sessions">
              {studySessions.map((s) => (
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SidebarProvider
      defaultOpen={!isTabletPortrait()}
      style={{ "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON } as React.CSSProperties}
    >
      <TabletRail />
      <AppSidebar onSearch={() => setPaletteOpen(true)} />
      {/* On md+ the inset is a viewport-height card and pages scroll inside the
          content frame below, so the strip stays pinned without `sticky`. Below
          md the DOCUMENT scrolls, and this strip carries the only route into
          navigation (and therefore into search) — so there it sticks. z-30 sits
          under every floating layer already in the app: toasts z-100, ReadMode
          z-120, GuideDock z-130, the sticky-selection bubble z-140. */}
      <SidebarInset
        data-ps-sheet={bare ? sheet : undefined}
        className={cn(
          "md:h-[calc(100svh-1rem)] md:overflow-hidden md:rounded-xl",
          // One material: with the gutter painted the same colour, a hairline
          // and a shadow would be the only thing left drawing a seam.
          bare ? "ps-sheet-surface" : "md:border md:border-border md:shadow-sm",
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
