
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { useAppData } from "@/hooks/useAppData";
import { useAppStore } from "@/store/appStore";
import { AuthProvider } from "@/contexts/AuthContext";
import { apiClient } from "@/services/apiClient";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import FullStudyPage from "./pages/FullStudyPage";
import NotFound from "./pages/NotFound";
import DevLoginPage from "./pages/DevLoginPage";

const queryClient = new QueryClient();

// Initialize API client on app startup
apiClient.initialize().catch((error) => {
  console.error('[App] Failed to initialize API client:', error);
});

const AppContent = () => {
  return (
    <BrowserRouter>
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
          <Route path="settings" element={<Navigate to="/dashboard/profile" replace />} />

          {/* Study (the only mode: one scrolling note with a quiz per section) */}
          <Route path=":sessionId/full-study" element={<FullStudyPage />} />

          {/* Session-less entry keeps old links working */}
          <Route path="full-study" element={<FullStudyPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

// Component that loads data only when authenticated
const AuthenticatedApp = () => {
  const { data, isError, refetch } = useAppData();
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
          <p className="text-sm font-semibold">Couldn't reach the server</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Your sessions and stats will appear once the backend responds.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
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
