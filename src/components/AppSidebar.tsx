import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  ChevronsUpDown,
  FileText,
  Folder,
  LayoutGrid,
  LogOut,
  Moon,
  Settings,
  Sun,
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
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
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeToggle";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { logout } from "@/services/api";
import { formatDuration, usePresenceStore } from "@/store/presenceStore";

/*
  App sidebar — shadcn inset / icon-collapsible shell, styled after the Cansee
  reference: quiet groups, active state is only a darker pill, no accent colour
  on nav items, tooltips only when collapsed (Cmd/Ctrl+B toggles).
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
  if (!u?.role) return "";
  if (u.role === "student") return "Student";
  if (u.teacher_type === "organization" && session?.org) return `Teacher · ${session.org.name}`;
  return u.teacher_type === "individual" ? "Independent teacher" : "Teacher";
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

export function AppSidebar() {
  const { pathname } = useLocation();
  const { currentSession, setCurrentSession, userProfile } = useAppStore();
  const activeSeconds = usePresenceStore((s) => s.activeSeconds);
  const { session } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const org = session?.org ?? null;

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.match : pathname.startsWith(item.match);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          {/* Brand row */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="PlayStudy">
              <Link to="/dashboard" onClick={() => setCurrentSession(null)}>
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
          </SidebarMenuItem>

          {/* Organisation strip — org members only; quiet on purpose (hover is the affordance) */}
          {org && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="sm" tooltip={org.name} className="h-7 text-muted-foreground">
                <Link to="/dashboard/profile">
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
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
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
                <Link to={studyPath(currentSession?.id)}>
                  <BookOpen />
                  <span>Full Study</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {currentSession && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="sm" tooltip={currentSession.title} className="text-muted-foreground">
                  <Link to={studyPath(currentSession.id)}>
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
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <PresenceIndicator />
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
                  <Link to="/dashboard/profile">
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
