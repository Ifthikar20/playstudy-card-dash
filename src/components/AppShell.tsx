import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Folder,
  GraduationCap,
  LayoutGrid,
  Search,
  Settings,
} from "lucide-react";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAppStore } from "@/store/appStore";
import { startPresenceTracking } from "@/store/presenceStore";
import { cn } from "@/lib/utils";

/*
  App shell — sidebar + framed content card, per the Cansee reference:
  the content floats as a rounded, hairline-bordered card on the sidebar-
  coloured ground; a 4rem header carries the trigger, breadcrumbs and a ⌘K
  search pill; pages render inside a padded flex column.
*/

const SIDEBAR_WIDTH = "13.75rem"; // 220px expanded (narrower than stock shadcn)
const SIDEBAR_WIDTH_ICON = "3rem"; // 48px icon rail

const MODE_LABELS: Record<string, string> = {
  "full-study": "Full Study",
};

interface Crumb {
  label: string;
  to?: string;
}

function SidebarChevronTrigger({ className }: { className?: string }) {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
      className={cn("size-9 border border-border bg-muted/60 shadow-sm hover:bg-muted", className)}
    >
      {collapsed || isMobile ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
    </Button>
  );
}

function useCrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const { studySessions, folders, currentSession } = useAppStore();

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
    if (MODE_LABELS[first]) return [...crumbs, { label: MODE_LABELS[first] }];

    // /dashboard/:sessionId/:mode
    const session = studySessions.find((s) => s.id === first) ?? (currentSession?.id === first ? currentSession : null);
    const modeLabel = second ? MODE_LABELS[second] ?? second : undefined;
    return [
      ...crumbs,
      { label: session?.title ?? "Study session", to: modeLabel ? `/dashboard/${first}/full-study` : undefined },
      ...(modeLabel ? [{ label: modeLabel }] : []),
    ];
  }, [pathname, studySessions, folders, currentSession]);
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

  // Presence tracking lives for as long as the signed-in shell is mounted.
  useEffect(() => {
    if (!userId) return;
    return startPresenceTracking(userId);
  }, [userId]);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

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
      style={{ "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON } as React.CSSProperties}
    >
      <AppSidebar />
      {/* On md+ the inset is a viewport-height card and pages scroll inside the
          content frame below, so the header stays pinned. Below md the document scrolls. */}
      <SidebarInset className="md:h-[calc(100svh-1rem)] md:overflow-hidden md:rounded-xl md:border md:border-border md:shadow-sm">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card transition-[width,height] ease-linear">
          <div className="flex min-w-0 items-center gap-2 px-4 md:px-6">
            <SidebarChevronTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  return (
                    <Fragment key={`${c.label}-${i}`}>
                      {i > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                      <BreadcrumbItem className={cn(!last && "hidden md:block")}>
                        {last || !c.to ? (
                          <BreadcrumbPage className="max-w-[40vw] truncate">{c.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={c.to}>{c.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="ml-auto flex items-center gap-2 px-4 md:px-6">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-full border border-border bg-muted px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-ring hover:bg-background"
            >
              <Search size={14} strokeWidth={1.8} />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
                {isMac ? "⌘+K" : "Ctrl+K"}
              </kbd>
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">{children}</div>
      </SidebarInset>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </SidebarProvider>
  );
}
