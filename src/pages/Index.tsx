import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { DashboardCard } from "@/components/DashboardCard";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FolderPlus, 
  BookOpen, 
  Trophy, 
  TrendingUp,
  Clock,
  Target,
  Flame,
  Users,
  Star,
  Gamepad2,
  Play
} from "lucide-react";

const trendingGames = [
  { id: 1, title: "Math Speed Challenge", players: 1240, rating: 4.8, category: "Mathematics" },
  { id: 2, title: "Science Quiz Battle", players: 890, rating: 4.7, category: "Science" },
  { id: 3, title: "History Trivia Rush", players: 756, rating: 4.6, category: "History" },
  { id: 4, title: "Language Master", players: 634, rating: 4.9, category: "Languages" },
  { id: 5, title: "Geography Explorer", players: 521, rating: 4.5, category: "Geography" },
  { id: 6, title: "Coding Challenge", players: 445, rating: 4.8, category: "Programming" },
];

const recentGames = [
  { id: 1, title: "Math Speed Challenge", score: 92, time: "2 hours ago" },
  { id: 2, title: "Science Quiz Battle", score: 85, time: "5 hours ago" },
  { id: 3, title: "History Trivia Rush", score: 78, time: "Yesterday" },
  { id: 4, title: "Language Master", score: 95, time: "Yesterday" },
  { id: 5, title: "Geography Explorer", score: 88, time: "2 days ago" },
  { id: 6, title: "Coding Challenge", score: 91, time: "2 days ago" },
  { id: 7, title: "Physics Fundamentals", score: 82, time: "3 days ago" },
  { id: 8, title: "Chemistry Quiz", score: 76, time: "4 days ago" },
  { id: 9, title: "Biology Basics", score: 89, time: "5 days ago" },
  { id: 10, title: "Art History", score: 94, time: "1 week ago" },
];

export default function Index() {
  const navigate = useNavigate();

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
      
      <div className="flex-1 flex flex-col lg:flex-row overflow-auto">
        {/* Left Side - Recent Games */}
        <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-border p-4 order-2 lg:order-1">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock size={20} />
            Recent Games
          </h2>
          <div className="space-y-2">
            {recentGames.map((game) => (
              <Card key={game.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground text-sm truncate">{game.title}</p>
                      <p className="text-xs text-muted-foreground">{game.time}</p>
                    </div>
                    <div className="text-sm font-semibold text-primary ml-2">{game.score}%</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-8 order-1 lg:order-2">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Welcome to Playstudy.ai
              </h1>
              <p className="text-muted-foreground">
                Transform your study materials into engaging, competitive quizzes
              </p>
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
                  <Card key={game.id} className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Gamepad2 className="text-primary" size={24} />
                        </div>
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Star size={14} fill="currentColor" />
                          <span className="text-sm font-medium">{game.rating}</span>
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">{game.title}</h3>
                      <p className="text-xs text-muted-foreground mb-3">{game.category}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users size={14} />
                          <span className="text-xs">{game.players.toLocaleString()} playing</span>
                        </div>
                        <button className="flex items-center gap-1 text-primary text-sm font-medium hover:underline">
                          <Play size={14} />
                          Play
                        </button>
                      </div>
                    </CardContent>
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
      </div>
    </div>
  );
}
