import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { DashboardCard } from "@/components/DashboardCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";
import { 
  FolderPlus, 
  BookOpen, 
  Trophy, 
  TrendingUp,
  Clock,
  Target,
  Flame,
  Plus
} from "lucide-react";

const trendingGames = [
  { id: 1, title: "Math Speed Challenge", category: "Mathematics", image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop" },
  { id: 2, title: "Science Quiz Battle", category: "Science", image: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=300&fit=crop" },
  { id: 3, title: "History Trivia Rush", category: "History", image: "https://images.unsplash.com/photo-1461360370896-922624d12a74?w=400&h=300&fit=crop" },
  { id: 4, title: "Language Master", category: "Languages", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop" },
  { id: 5, title: "Geography Explorer", category: "Geography", image: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=300&fit=crop" },
  { id: 6, title: "Coding Challenge", category: "Programming", image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop" },
];

export default function Index() {
  const navigate = useNavigate();
  const [showCreateSession, setShowCreateSession] = useState(false);

  const dashboardItems = [
    {
      title: "Create Study Folder",
      description: "Start a new study session with custom materials",
      icon: FolderPlus,
      onClick: () => navigate("/folders")
    },
    {
      title: "Full Study Mode",
      description: "Complete learning path with progress tracking",
      icon: BookOpen,
      onClick: () => navigate("/full-study")
    },
    {
      title: "Achievements",
      description: "View your learning progress and badges",
      icon: Trophy,
      onClick: () => navigate("/achievements")
    },
    {
      title: "Performance Analytics",
      description: "Track your quiz scores and improvement",
      icon: TrendingUp,
      onClick: () => navigate("/analytics")
    },
    {
      title: "Study Timer",
      description: "Set focused study sessions with breaks",
      icon: Clock,
      onClick: () => navigate("/timer")
    },
    {
      title: "Learning Goals",
      description: "Set and track your study objectives",
      icon: Target,
      onClick: () => navigate("/goals")
    }
  ];

  return (
    <div className="min-h-screen bg-background flex w-full">
      <Sidebar />
      
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Welcome to Playstudy.ai
              </h1>
              <p className="text-muted-foreground">
                Transform your study materials into engaging, competitive quizzes
              </p>
            </div>
            <Button 
              size="lg" 
              className="gap-2 shadow-lg hover:shadow-xl transition-all"
              onClick={() => setShowCreateSession(true)}
            >
              <Plus size={20} />
              Create Study Session
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
            <div className="bg-card rounded-xl border border-border p-4 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-primary">12</div>
              <div className="text-xs md:text-sm text-muted-foreground">Study Sessions</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">85%</div>
              <div className="text-xs md:text-sm text-muted-foreground">Average Accuracy</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-purple-600 dark:text-purple-400">247</div>
              <div className="text-xs md:text-sm text-muted-foreground">Questions Answered</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-orange-600 dark:text-orange-400">18hrs</div>
              <div className="text-xs md:text-sm text-muted-foreground">Total Study Time</div>
            </div>
          </div>

          {/* Trending Games Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Flame className="text-orange-500" size={24} />
              Trending Games
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendingGames.map((game) => (
                <Card key={game.id} className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden">
                  <div className="relative h-40 overflow-hidden">
                    <img 
                      src={game.image} 
                      alt={game.title}
                      className="w-full h-full object-cover transition-transform hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="font-semibold text-white mb-1">{game.title}</h3>
                      <p className="text-xs text-white/80">{game.category}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Main Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {dashboardItems.map((item, index) => (
              <DashboardCard
                key={index}
                title={item.title}
                description={item.description}
                icon={item.icon}
                onClick={item.onClick}
              />
            ))}
          </div>
        </div>
      </div>

      <CreateStudySessionDialog 
        open={showCreateSession} 
        onOpenChange={setShowCreateSession} 
      />
    </div>
  );
}
