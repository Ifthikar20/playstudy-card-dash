
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { useAppData } from "@/hooks/useAppData";
import { useAppStore } from "@/store/appStore";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import Index from "./pages/Index";
import StudyFolders from "./pages/StudyFolders";
import QuizPage from "./pages/QuizPage";
import SpeedRunPage from "./pages/SpeedRunPage";
import ProfilePage from "./pages/ProfilePage";
import FullStudyPage from "./pages/FullStudyPage";
import BrowseGamesPage from "./pages/BrowseGamesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Protected routes - require authentication */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AuthenticatedApp />
            </ProtectedRoute>
          }
        >
          <Route index element={<Index />} />
          <Route path="folders" element={<StudyFolders />} />
          <Route path="quiz/:topic" element={<QuizPage />} />
          <Route path="speedrun" element={<SpeedRunPage />} />
          <Route path="speedrun/:topic" element={<SpeedRunPage />} />
          <Route path="full-study" element={<FullStudyPage />} />
          <Route path="full-study/:sessionId" element={<FullStudyPage />} />
          <Route path="browse-games" element={<BrowseGamesPage />} />
          <Route path="achievements" element={<Index />} />
          <Route path="analytics" element={<Index />} />
          <Route path="timer" element={<Index />} />
          <Route path="goals" element={<Index />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<Index />} />
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
    if (data && !isInitialized) {
      initializeFromAPI(data);
    }
  }, [data, isInitialized, initializeFromAPI]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (isError) {
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
  return <Outlet />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
