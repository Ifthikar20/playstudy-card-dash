import { useState } from "react";
import { Calculator, FlaskConical, Scroll, Sparkles } from "lucide-react";
import { TopNavbar } from "@/components/play-study/TopNavbar";
import { GameCard } from "@/components/play-study/GameCard";
import { MobileBottomNav } from "@/components/play-study/MobileBottomNav";
import { LeaderboardWidget } from "@/components/play-study/LeaderboardWidget";
import { DailyChallengeCard } from "@/components/play-study/DailyChallengeCard";
import { QuestionModal } from "@/components/play-study/QuestionModal";

const games = [
  {
    id: "math-runner",
    title: "Math Runner",
    category: "Mathematics",
    difficulty: "Easy" as const,
    points: 100,
    icon: <Calculator className="h-12 w-12 sm:h-16 sm:w-16" />,
    progress: 35,
  },
  {
    id: "science-lab",
    title: "Science Lab Escape",
    category: "Science",
    difficulty: "Medium" as const,
    points: 250,
    icon: <FlaskConical className="h-12 w-12 sm:h-16 sm:w-16" />,
    progress: 0,
  },
  {
    id: "history-quest",
    title: "History Quest",
    category: "History",
    difficulty: "Hard" as const,
    points: 500,
    icon: <Scroll className="h-12 w-12 sm:h-16 sm:w-16" />,
    progress: 60,
  },
  {
    id: "word-wizard",
    title: "Word Wizard",
    category: "Language",
    difficulty: "Easy" as const,
    points: 150,
    icon: <Sparkles className="h-12 w-12 sm:h-16 sm:w-16" />,
    progress: 0,
  },
];

const sampleQuestion = {
  id: "q1",
  question: "What is the capital of France?",
  options: ["London", "Berlin", "Paris", "Madrid"],
  correctIndex: 2,
  hint: "It's known as the City of Light",
};

export default function PlayStudyDashboard() {
  const [points, setPoints] = useState(1250);
  const [level, setLevel] = useState(5);
  const [activeTab, setActiveTab] = useState("games");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);

  const handlePlayGame = (gameId: string) => {
    // Simulate game starting and triggering a question
    setShowQuestion(true);
  };

  const handleAnswer = (correct: boolean, timeLeft: number) => {
    if (correct) {
      const bonusPoints = Math.floor(timeLeft * 2);
      setPoints((prev) => prev + 25 + bonusPoints);
    }
    setShowQuestion(false);
  };

  const handleHintUsed = () => {
    setPoints((prev) => Math.max(0, prev - 5));
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNavbar
        points={points}
        level={level}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <main className="container px-4 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            Welcome back! 👋
          </h1>
          <p className="text-muted-foreground">
            Ready to learn and earn points today?
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Games */}
          <div className="lg:col-span-2 space-y-6">
            {/* Daily Challenge */}
            <DailyChallengeCard
              title="Complete 5 Games"
              description="Play and complete any 5 games to earn bonus points"
              reward={500}
              progress={2}
              total={5}
              timeLeft="8h 32m"
              onStart={() => {}}
            />

            {/* Games Section */}
            <section>
              <h2 className="text-lg sm:text-xl font-bold mb-4">
                🎮 Games Library
              </h2>

              {/* Responsive Game Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4 sm:gap-6">
                {games.map((game) => (
                  <GameCard
                    key={game.id}
                    title={game.title}
                    category={game.category}
                    difficulty={game.difficulty}
                    points={game.points}
                    icon={game.icon}
                    progress={game.progress}
                    onPlay={() => handlePlayGame(game.id)}
                  />
                ))}
              </div>
            </section>
          </div>

          {/* Right Column - Leaderboard */}
          <aside className="space-y-6">
            <LeaderboardWidget />

            {/* Streak Counter */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <span className="text-2xl">🔥</span>
                </div>
                <div>
                  <p className="font-bold">3 Day Streak!</p>
                  <p className="text-xs text-muted-foreground">
                    Keep it going for bonus points
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-2 rounded-full ${
                      i < 3 ? "gradient-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-bold mb-3">📊 Your Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Games Played</span>
                  <span className="font-medium">24</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Accuracy</span>
                  <span className="font-medium text-success">78%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Best Streak</span>
                  <span className="font-medium">12x</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Question Modal */}
      <QuestionModal
        question={sampleQuestion}
        timeLimit={30}
        onAnswer={handleAnswer}
        onHintUsed={handleHintUsed}
        hintCost={5}
        isOpen={showQuestion}
      />
    </div>
  );
}
