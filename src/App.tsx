import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PlayStudyDashboard from "./pages/PlayStudyDashboard";
import StudyFolders from "./pages/StudyFolders";
import QuizPage from "./pages/QuizPage";
import SpeedRunPage from "./pages/SpeedRunPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PlayStudyDashboard />} />
          <Route path="/folders" element={<StudyFolders />} />
          <Route path="/quiz/:topic" element={<QuizPage />} />
          <Route path="/speedrun" element={<SpeedRunPage />} />
          <Route path="/speedrun/:topic" element={<SpeedRunPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
