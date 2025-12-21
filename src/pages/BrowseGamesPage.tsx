import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Users, Star, Gamepad2, Lock } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";

const categories = ["All", "Memory Games", "Challenging & High XP", "Riddles"];

export default function BrowseGamesPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { games, currentSession, studySessions } = useAppStore();

  // Find the session if sessionId is provided
  const session = sessionId
    ? studySessions.find(s => s.id === sessionId) || currentSession
    : currentSession;

  // Check if a session has content (extractedTopics)
  const hasSessionContent = session?.extractedTopics && session.extractedTopics.length > 0;

  const filteredGames = games.filter((game) => {
    const matchesCategory = selectedCategory === "All" || game.category === selectedCategory;
    return matchesCategory;
  });

  // Determine if a game is playable
  const isGamePlayable = (gameId: number) => {
    // Games 7 and 8 are always playable (platformer and memory match)
    if (gameId === 7 || gameId === 8) return true;

    // Other games require session content
    return hasSessionContent;
  };

  const handlePlayGame = (gameId: number) => {
    // Check if game is playable
    if (!isGamePlayable(gameId)) {
      setDialogOpen(true);
      return;
    }

    // Map game IDs to routes
    if (gameId === 7) {
      navigate("/dashboard/platformer-game");
    } else if (gameId === 8) {
      // Memory Match game
      navigate("/dashboard/memory-match");
    } else {
      // Other games need session content - navigate to game mode with sessionId
      if (sessionId) {
        navigate(`/dashboard/${sessionId}/game-mode`);
      } else if (currentSession) {
        navigate(`/dashboard/${currentSession.id}/game-mode`);
      } else {
        // No session available, show create dialog
        setDialogOpen(true);
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <Gamepad2 className="text-primary" size={28} />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Game Zone</h1>
            </div>
            <p className="text-muted-foreground">Choose from memory games, challenging puzzles, and riddles</p>
          </div>

          {/* Category Pills */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80 transition-colors px-4 py-2 text-sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          {/* Games Grid - Retro Style */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredGames.map((game) => {
              const playable = isGamePlayable(game.id);
              return (
                <Card
                  key={game.id}
                  className={`group overflow-hidden transition-all border-2 bg-card ${
                    playable
                      ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-primary/50'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                  onClick={() => handlePlayGame(game.id)}
                >
                  {/* Game Thumbnail */}
                  <div className="relative aspect-[3/2] overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10">
                    <img
                      src={game.image}
                      alt={game.title}
                      className={`w-full h-full object-cover transition-transform ${
                        playable ? 'group-hover:scale-110' : 'grayscale'
                      }`}
                    />

                    {/* Overlay on Hover */}
                    {playable ? (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play size={32} className="text-white" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                        <Lock size={28} className="text-white/80" />
                        <span className="text-xs text-white/80 font-medium">Create Session</span>
                      </div>
                    )}

                  {/* Top Badges */}
                  <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                    <Badge
                      className="text-xs backdrop-blur-sm"
                      variant={game.difficulty === "Easy" ? "secondary" : game.difficulty === "Medium" ? "default" : "destructive"}
                    >
                      {game.difficulty}
                    </Badge>
                    <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
                      <Star size={10} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-xs font-bold text-white">{game.rating}</span>
                    </div>
                  </div>
                </div>

                {/* Game Info */}
                <div className="p-3 space-y-2">
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 min-h-[2.5rem]">
                    {game.title}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users size={12} />
                      <span>{(game.likes / 1000).toFixed(1)}k</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {game.category}
                    </Badge>
                  </div>
                </div>
              </Card>
              );
            })}
          </div>

          {filteredGames.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No games found matching your criteria</p>
            </div>
          )}
        </div>
      </main>

      <CreateStudySessionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
