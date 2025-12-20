
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
import { LoadingSpinner } from "@/components/LoadingSpinner";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import ContactPage from "./pages/ContactPage";
import Index from "./pages/Index";
import StudyFolders from "./pages/StudyFolders";
import FolderDetailPage from "./pages/FolderDetailPage";
import QuizPage from "./pages/QuizPage";
import SpeedRunPage from "./pages/SpeedRunPage";
import ProfilePage from "./pages/ProfilePage";
import FullStudyPage from "./pages/FullStudyPage";
import BrowseGamesPage from "./pages/BrowseGamesPage";
import GameModePage from "./pages/GameModePage";
import PlatformerGamePage from "./pages/PlatformerGamePage";
import MemoryMatchGamePage from "./pages/MemoryMatchGamePage";
import MentorModePage from "./pages/MentorModePage";
import NotFound from "./pages/NotFound";

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
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/contact" element={<ContactPage />} />

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
          <Route path="folder/:folderId" element={<FolderDetailPage />} />
          <Route path="browse-games" element={<BrowseGamesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<Navigate to="/dashboard/profile" replace />} />

          {/* Session-specific routes */}
          <Route path=":sessionId/full-study" element={<FullStudyPage />} />
          <Route path=":sessionId/speedrun" element={<SpeedRunPage />} />
          <Route path=":sessionId/mentor" element={<MentorModePage />} />
          <Route path=":sessionId/browse-games" element={<BrowseGamesPage />} />
          <Route path=":sessionId/platformer-game" element={<PlatformerGamePage />} />
          <Route path=":sessionId/memory-match" element={<MemoryMatchGamePage />} />

          {/* Legacy routes for backward compatibility */}
          <Route path="quiz/:topic" element={<QuizPage />} />
          <Route path="speedrun" element={<SpeedRunPage />} />
          <Route path="full-study" element={<FullStudyPage />} />
          <Route path="game-mode" element={<GameModePage />} />
          <Route path="platformer-game" element={<PlatformerGamePage />} />
          <Route path="memory-match" element={<MemoryMatchGamePage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

// Component that loads data only when authenticated
const AuthenticatedApp = () => {
  const { data, isLoading, isError } = useAppData();
  const { initializeFromAPI, isInitialized } = useAppStore();

  // Initialize store when data is loaded
  useEffect(() => {
    console.log('[AuthenticatedApp] Data loaded:', !!data, 'isInitialized:', isInitialized);
    if (data && !isInitialized) {
      console.log('[AuthenticatedApp] Initializing store with data...');
      initializeFromAPI(data);
    }
  }, [data, isInitialized, initializeFromAPI]);

  console.log('[AuthenticatedApp] State:', { isLoading, isError, hasData: !!data });

  // Show loading state
  if (isLoading) {
    console.log('[AuthenticatedApp] Showing loading spinner...');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner message="Loading your dashboard..." size="lg" />
      </div>
    );
  }

  // Show error state
  if (isError) {
    console.log('[AuthenticatedApp] Showing error state...');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-foreground mb-2">Connection Error</h2>
          <p className="text-muted-foreground mb-4">
            Unable to connect to the server. Using offline mode with sample data.
          </p>
          <p className="text-sm text-muted-foreground">
            The app will continue to function with limited features.
          </p>
        </div>
      </div>
    );
  }

  // Render the outlet for nested routes
  console.log('[AuthenticatedApp] Rendering dashboard content...');
  return <Outlet />;
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
