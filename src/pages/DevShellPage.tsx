import { AppShell } from "@/components/AppShell";

/**
 * Dev-only route: /dev-shell
 *
 * The real app shell (sidebar, header) around filler content, so the sidebar's
 * rail, hover peek and docking can be checked without signing in or a backend.
 * Tree-shaken from production builds (see the route in App.tsx).
 */
export default function DevShellPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold">Sidebar check</h1>
        <p className="text-muted-foreground">
          Rest the mouse on the icon rail on the left: it slides out over the page, and folds a couple of seconds
          after the mouse leaves, or at once on a click here.
        </p>
        {Array.from({ length: 12 }, (_, i) => (
          <p key={i} className="leading-relaxed">
            Paragraph {i + 1}. Filler text standing in for notes, so the width the content gets is easy to see.
          </p>
        ))}
      </div>
    </AppShell>
  );
}
