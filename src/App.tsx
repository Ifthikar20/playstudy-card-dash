
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { useAppData } from "@/hooks/useAppData";
import { useAppStore } from "@/store/appStore";
import { AuthProvider } from "@/contexts/AuthContext";
import { apiClient } from "@/services/apiClient";
import { migrateLocalKeys } from "@/lib/localData";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { trackView } from "@/lib/analytics";
import StandardAccountRoute from "@/components/StandardAccountRoute";
import { AppShell } from "@/components/AppShell";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { useAuth } from "@/contexts/AuthContext";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ChildSignInPage from "./pages/ChildSignInPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import ContactPage from "./pages/ContactPage";
import Index from "./pages/Index";
import StudyFolders from "./pages/StudyFolders";
import CalendarPage from "./pages/CalendarPage";
import FolderDetailPage from "./pages/FolderDetailPage";
import ProfilePage from "./pages/ProfilePage";
import FamilyPage from "./pages/FamilyPage";
import ChildDetailPage from "./pages/ChildDetailPage";
import FullStudyPage from "./pages/FullStudyPage";
import NotFound from "./pages/NotFound";
import DevLoginPage from "./pages/DevLoginPage";
import DevBoardPage from "./pages/DevBoardPage";

const queryClient = new QueryClient();

// Carry a returning person's stored preferences across the rename to
// AnotherNotes. Idempotent, and studySurface.ts calls it too — that one reads
// its key during module evaluation, which happens BEFORE this file's body runs,
// so it cannot wait for this call. This is the catch-all for every other key,
// and the place the migration is visible from the app's entry point.
migrateLocalKeys();

// Initialize API client on app startup
apiClient.initialize().catch((error) => {
  console.error('[App] Failed to initialize API client:', error);
});

/** One page view per route change (lib/analytics). */
function PageViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackView(pathname);
  }, [pathname]);
  return null;
}

const AppContent = () => {
  return (
    <BrowserRouter>
      <PageViews />
      <AppErrorBoundary>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        {/* Kids sign in with a username and PIN, not an email */}
        <Route path="/kids" element={<ChildSignInPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        {/* Dev-only: scripted sign-in used by scripts/dev-login.mjs (tree-shaken from prod builds) */}
        {import.meta.env.DEV && <Route path="/dev-login" element={<DevLoginPage />} />}
        {/* Dev-only: the whiteboard's list looks in light and dark (tree-shaken from prod builds) */}
        {import.meta.env.DEV && <Route path="/dev-board" element={<DevBoardPage />} />}

        {/* Protected routes - require authentication */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AuthenticatedApp />
            </ProtectedRoute>
          }
        >
          <Route index element={<Index />} />
          <Route path="folders" element={<StudyFolders />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="folder/:folderId" element={<FolderDetailPage />} />
          <Route path="profile" element={<ProfilePage />} />

          {/* Family — guardian-only. A profile a guardian created is bounced
              back to the dashboard rather than shown something it cannot use. */}
          <Route
            path="family"
            element={
              <StandardAccountRoute>
                <FamilyPage />
              </StandardAccountRoute>
            }
          />
          <Route
            path="family/:childId"
            element={
              <StandardAccountRoute>
                <ChildDetailPage />
              </StandardAccountRoute>
            }
          />
          <Route path="settings" element={<Navigate to="/dashboard/profile" replace />} />

          {/* Study (the only mode: one scrolling note with a quiz per section) */}
          <Route path=":sessionId/full-study" element={<FullStudyPage />} />

          {/* Session-less entry keeps old links working */}
          <Route path="full-study" element={<FullStudyPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </AppErrorBoundary>
    </BrowserRouter>
  );
};

// Component that loads data only when authenticated
const AuthenticatedApp = () => {
  const { data, isError, error, isFetching, refetch } = useAppData();
  // fetch() rejects with a TypeError when nothing answers at all; an HTTP error status
  // comes back as an Error with the status in it.
  const unreachable = error instanceof TypeError;
  const { initializeFromAPI, isInitialized } = useAppStore();
  const { session, sessionLoading } = useAuth();

  // Initialize store when data is loaded
  useEffect(() => {
    if (data && !isInitialized) {
      initializeFromAPI(data);
    }
  }, [data, isInitialized, initializeFromAPI]);

  // First-login onboarding: full-screen takeover until the role question is answered
  if (session && session.next_route === "onboarding") {
    return <OnboardingFlow />;
  }

  // The shell renders straight away; every page loads its own sections
  // (skeletons per block) instead of a page-wide spinner. While the session
  // is still unknown we keep the content area empty so onboarding can't flash.
  return (
    <AppShell>
      {isError && !isInitialized ? (
        <div className="mx-auto mt-10 w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold">
            {unreachable ? "Couldn't reach the server" : "The server couldn't load your sessions"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {unreachable ? "It may be restarting." : "Something went wrong on its side."} Trying again every few
            seconds — your sessions and stats appear as soon as it answers.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-4 inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {isFetching ? "Trying…" : "Try now"}
          </button>
        </div>
      ) : !session && sessionLoading ? null : (
        <Outlet />
      )}
    </AppShell>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
