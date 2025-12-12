import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";
import { useAppStore } from "@/store/appStore";
import {
  Flame,
  Plus,
  Upload,
  Gamepad2,
  Rocket
} from "lucide-react";

export default function Index() {
  const [showCreateSession, setShowCreateSession] = useState(false);
  const { games, stats } = useAppStore();

  // Get top 6 games by rating for trending section
  const trendingGames = [...games]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 6);


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

          {/* How to Use Playstudy - 3 Steps */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              How to Use Playstudy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card rounded-xl border border-border p-6 text-center hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="text-primary" size={24} />
                </div>
                <div className="text-2xl font-bold text-primary mb-2">1</div>
                <h3 className="font-semibold text-foreground mb-1">Upload Study Content</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your notes, PDFs, or paste text to get started
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6 text-center hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gamepad2 className="text-primary" size={24} />
                </div>
                <div className="text-2xl font-bold text-primary mb-2">2</div>
                <h3 className="font-semibold text-foreground mb-1">Choose Study Mode</h3>
                <p className="text-sm text-muted-foreground">
                  Pick Full Study, Speed Run, or Game Mode
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6 text-center hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Rocket className="text-primary" size={24} />
                </div>
                <div className="text-2xl font-bold text-primary mb-2">3</div>
                <h3 className="font-semibold text-foreground mb-1">Start Play Studying</h3>
                <p className="text-sm text-muted-foreground">
                  Learn through interactive quizzes and earn points
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
            <div className="bg-card rounded-xl border border-border p-4 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-primary">{stats.totalSessions}</div>
              <div className="text-xs md:text-sm text-muted-foreground">Study Sessions</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">{stats.averageAccuracy}%</div>
              <div className="text-xs md:text-sm text-muted-foreground">Average Accuracy</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.questionsAnswered}</div>
              <div className="text-xs md:text-sm text-muted-foreground">Questions Answered</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.totalStudyTime}</div>
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

        </div>
      </div>

      <CreateStudySessionDialog 
        open={showCreateSession} 
        onOpenChange={setShowCreateSession} 
      />
    </div>
  );
}
