import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  ChevronsLeft,
  ChevronsUpDown,
  FileText,
  Folder,
  HelpCircle,
  LayoutGrid,
  LogOut,
  Moon,
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeToggle";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { logout } from "@/services/api";
import { formatDuration, usePresenceStore } from "@/store/presenceStore";

/*
  App sidebar — shadcn inset / icon-collapsible shell: quiet groups, active
  state is only a darker pill, no accent colour on nav items, tooltips only
  when collapsed (Cmd/Ctrl+B toggles).

  It is also the whole of the app's chrome. Search is the last row of the
  header, directly above the nav groups; presence, theme and help sit on a
  utility shelf at the foot, above the account menu. The page's top strip
  carries the breadcrumb and nothing else.
*/

interface NavItem {
  title: string;
  to: string;
  icon: LucideIcon;
  /** path prefix that marks this item active */
  match: string;
  exact?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { title: "Dashboard", to: "/dashboard", icon: LayoutGrid, match: "/dashboard", exact: true },
      { title: "Study Folders", to: "/dashboard/folders", icon: Folder, match: "/dashboard/folder" },
      { title: "Calendar", to: "/dashboard/calendar", icon: CalendarDays, match: "/dashboard/calendar" },
    ],
  },
  {
    group: "Family",
    items: [
      { title: "Family", to: "/dashboard/family", icon: Users, match: "/dashboard/family" },
    ],
  },
  {
    group: "Account",
    items: [
      { title: "Profile & Settings", to: "/dashboard/profile", icon: Settings, match: "/dashboard/profile" },
    ],
  },
];

/** Full Study is the one way to study: a scrolling note with a quiz per section.
 *  With a session open it deep-links into it, otherwise it opens the picker. */
const studyPath = (sessionId?: string) => (sessionId ? `/dashboard/${sessionId}/full-study` : "/dashboard/full-study");

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

/*
  Footer utility icon. Unlike SidebarMenuButton's tooltip — which the primitive
  hides unless the rail is collapsed (ui/sidebar.tsx:584) — this one fires at
  every width on purpose: these are 32px glyphs and the tooltip is their label.
  TooltipProvider is already mounted by SidebarProvider (ui/sidebar.tsx:132).
*/
function FootIcon({
  label,
  href,
  onClick,
  children,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className =
    "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          // /contact is a public, shell-less route — a new tab keeps the
          // dashboard (and any open study session) where it is.
          <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={className}>
            {children}
          </a>
        ) : (
          <button type="button" onClick={onClick} aria-label={label} className={className}>
            {children}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="right" align="center" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

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

export function AppSidebar({ onSearch }: { onSearch: () => void }) {
  const { pathname } = useLocation();
  const { currentSession, setCurrentSession, userProfile } = useAppStore();
  const activeSeconds = usePresenceStore((s) => s.activeSeconds);
  const { session } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const org = session?.org ?? null;

  /*
    On a phone this sidebar is a Radix Sheet and the palette is a Radix Dialog.
    Mounting the second while the first is still open stacks two focus traps and
    two scroll locks, and can leave the body with pointer-events:none once they
    unwind. SheetContent's close animation is 300ms (ui/sheet.tsx:32), so hand
    the screen over after it, not on the next frame.
  */
  const handoff = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(handoff.current), []);
  const openSearch = () => {
    if (!isMobile) {
      onSearch();
      return;
    }
    setOpenMobile(false);
    handoff.current = window.setTimeout(onSearch, 320);
  };
  /* Nav links never closed the sheet, so a tap landed you on the new page with
     the menu still covering it. With search and theme now living in here, the
     sheet is opened far more often, so this stops being cosmetic. */
  const closeOnNav = () => {
    if (isMobile) setOpenMobile(false);
  };
  // A guardian-created profile has no Family section — it is the one being
  // followed, not the one following.
  const isManagedChild = session?.user.account_kind === "managed_child";

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.match : pathname.startsWith(item.match);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          {/* Brand row */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="PlayStudy">
              <Link to="/dashboard" onClick={() => { setCurrentSession(null); closeOnNav(); }}>
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <img src="/ps-logo.png" alt="" className="size-6 object-contain" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold tracking-tight">Playstudy.ai</span>
                  <span className="truncate text-xs text-muted-foreground tabular-nums">
                    {userProfile ? (activeSeconds >= 60 ? `${formatDuration(activeSeconds)} studied` : "Studying now") : "Study smarter"}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
            {/* The collapse control the top strip used to own. SidebarMenuAction
                already carries group-data-[collapsible=icon]:hidden, so it
                vanishes in the rail exactly when the strip's expand chevron
                appears. `showOnHover` is md:opacity-0 but reveals on hover AND
                focus-within, so it stays tab-focusable at all times — strictly
                better than SidebarRail, which is tabIndex={-1}. That rule never
                matches inside the mobile Sheet, where this is opacity-1 and
                becomes the close button the Sheet lacks ([&>button]:hidden). */}
            <SidebarMenuAction
              showOnHover
              onClick={toggleSidebar}
              aria-label={isMobile ? "Close navigation" : "Collapse sidebar"}
              title={isMobile ? "Close navigation" : "Collapse sidebar (Ctrl+B)"}
              className="text-muted-foreground"
            >
              {isMobile ? <X /> : <ChevronsLeft />}
            </SidebarMenuAction>
          </SidebarMenuItem>

          {/* Organisation strip — org members only; quiet on purpose (hover is the affordance) */}
          {org && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="sm" tooltip={org.name} className="h-7 text-muted-foreground">
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
              and ⌘K/Ctrl+K are untouched and only the trigger moved. `tooltip`
              is mandatory — the collapsed rail is the only place tooltips fire
              (ui/sidebar.tsx:584) and this would otherwise be an unlabelled
              magnifier there. */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={openSearch}
              tooltip={`Search  ${KBD}`}
              aria-keyshortcuts="Meta+K Control+K"
              className="text-muted-foreground hover:text-sidebar-accent-foreground"
            >
              <Search />
              {/* explicit: the variants' [&>span:last-child]:truncate does not
                  reach this span when the kbd renders after it */}
              <span className="truncate">Search</span>
              {/* Gated in JS rather than by `hidden md:inline-block`: a phone
                  has no ⌘ to press, and a JS gate also keeps this off the
                  Tailwind md:-vs-group-data ordering gamble. The rail rule is
                  still `!hidden` so ml-auto can never push it into the 32px
                  icon button. */}
              {!isMobile && (
                <kbd className="ml-auto rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-semibold tracking-wide group-data-[collapsible=icon]:!hidden">
                  {KBD}
                </kbd>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV.filter((group) => group.group !== "Family" || !isManagedChild).map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.title}>
                    <Link
                      to={item.to}
                      onClick={() => {
                        if (item.match === "/dashboard" || item.match === "/dashboard/folder") setCurrentSession(null);
                        closeOnNav();
                      }}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        {/* Study */}
        <SidebarGroup>
          <SidebarGroupLabel>Study</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.includes("/full-study")} tooltip="Full Study">
                <Link to={studyPath(currentSession?.id)} onClick={closeOnNav}>
                  <BookOpen />
                  <span>Full Study</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {currentSession && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="sm" tooltip={currentSession.title} className="text-muted-foreground">
                  <Link to={studyPath(currentSession.id)} onClick={closeOnNav}>
                    <FileText />
                    <span className="truncate">{currentSession.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* Utility shelf — everything the top-right used to carry. A row when
              there is width, a centred icon stack in the 3rem rail (footer p-2
              leaves 34px there, so the 32px squares fit). PresenceIndicator is
              unmoved and still inside SidebarProvider, which its useSidebar()
              call requires. */}
          <SidebarMenuItem className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center">
            <PresenceIndicator />
            <div className="ml-auto flex items-center gap-0.5 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:flex-col">
              {/* Glyph convention matches the account dropdown's theme item
                  below — show the mode you are switching TO. Dropping the
                  header's <ThemeToggle/> in verbatim would have put two
                  contradictory icons 40px apart. */}
              <FootIcon label={isDark ? "Light mode" : "Dark mode"} onClick={toggleTheme}>
                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </FootIcon>
              <FootIcon label="Help & contact" href="/contact">
                <HelpCircle className="size-4" />
              </FootIcon>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* No `tooltip` here: it would wrap the trigger and swallow the dropdown props. */}
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
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
              <DropdownMenuContent align="end" side="top" sideOffset={4} className="min-w-56 rounded-lg">
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
