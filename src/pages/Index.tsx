
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
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to Playstudy.ai
            </h1>
            <p className="text-gray-600">
              Transform your study materials into engaging, competitive quizzes
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-2xl font-bold text-blue-600">12</div>
              <div className="text-sm text-gray-600">Study Sessions</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-2xl font-bold text-green-600">85%</div>
              <div className="text-sm text-gray-600">Average Accuracy</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-2xl font-bold text-purple-600">247</div>
              <div className="text-sm text-gray-600">Questions Answered</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-2xl font-bold text-orange-600">18hrs</div>
              <div className="text-sm text-gray-600">Total Study Time</div>
            </div>
          </div>

          {/* Main Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <div className="font-medium text-gray-900">Mathematics Quiz</div>
                  <div className="text-sm text-gray-600">Completed 15 questions • 92% accuracy</div>
                </div>
                <div className="text-sm text-gray-500">2 hours ago</div>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <div className="font-medium text-gray-900">Science Study Session</div>
                  <div className="text-sm text-gray-600">Uploaded new material • Created 20 questions</div>
                </div>
                <div className="text-sm text-gray-500">Yesterday</div>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-gray-900">History Quiz</div>
                  <div className="text-sm text-gray-600">Completed 25 questions • 78% accuracy</div>
                </div>
                <div className="text-sm text-gray-500">2 days ago</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
