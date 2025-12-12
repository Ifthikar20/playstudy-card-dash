
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { DashboardCard } from "@/components/DashboardCard";
import { 
  FolderPlus, 
  BookOpen, 
  Trophy, 
  TrendingUp,
  Clock,
  Target
} from "lucide-react";

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
      title: "Recent Studies",
      description: "Continue where you left off",
      icon: BookOpen,
      onClick: () => navigate("/folders")
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
        <div className="max-w-6xl mx-auto">
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

          {/* Recent Activity */}
          <div className="mt-8 bg-card rounded-xl border border-border p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4">Recent Activity</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <div className="font-medium text-foreground">Mathematics Quiz</div>
                  <div className="text-sm text-muted-foreground">Completed 15 questions • 92% accuracy</div>
                </div>
                <div className="text-sm text-muted-foreground">2 hours ago</div>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <div className="font-medium text-foreground">Science Study Session</div>
                  <div className="text-sm text-muted-foreground">Uploaded new material • Created 20 questions</div>
                </div>
                <div className="text-sm text-muted-foreground">Yesterday</div>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-foreground">History Quiz</div>
                  <div className="text-sm text-muted-foreground">Completed 25 questions • 78% accuracy</div>
                </div>
                <div className="text-sm text-muted-foreground">2 days ago</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
