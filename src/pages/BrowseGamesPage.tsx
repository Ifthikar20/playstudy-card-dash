import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
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

  const session = sessionId
    ? studySessions.find(s => s.id === sessionId) || currentSession
    : currentSession;

  const hasSessionContent = session?.extractedTopics && session.extractedTopics.length > 0;

  const filteredGames = games.filter((game) => {
    const matchesCategory = selectedCategory === "All" || game.category === selectedCategory;
    return matchesCategory;
  });

  const isGamePlayable = (gameId: number) => {
    if (gameId === 7 || gameId === 8) return true;
    return hasSessionContent;
  };

  const handlePlayGame = (gameId: number) => {
    if (!isGamePlayable(gameId)) {
      setDialogOpen(true);
      return;
    }

    if (gameId === 7) {
      navigate("/dashboard/platformer-game");
    } else if (gameId === 8) {
      navigate("/dashboard/memory-match");
    } else {
      if (sessionId) {
        navigate(`/dashboard/${sessionId}/game-mode`);
      } else if (currentSession) {
        navigate(`/dashboard/${currentSession.id}/game-mode`);
      } else {
        setDialogOpen(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="airbnb-container py-8 animate-fade-in-up">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-foreground mb-1">
            Game Zone
          </h1>
          <p className="text-muted-foreground text-sm">
            Choose from memory games, challenging puzzles, and riddles
          </p>
        </div>

        {/* Category Pills — Airbnb filter style */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              className={`airbnb-pill whitespace-nowrap text-sm ${
                selectedCategory === category ? 'airbnb-pill-active' : ''
              }`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Games Grid — Airbnb experience cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredGames.map((game) => {
            const playable = isGamePlayable(game.id);
            return (
              <div
                key={game.id}
                className={`airbnb-listing ${!playable ? 'opacity-60' : ''}`}
                onClick={() => handlePlayGame(game.id)}
              >
                {/* Game Image */}
                <div className="airbnb-listing-image relative">
                  <img
                    src={game.image}
                    alt={game.title}
                    className={`${!playable ? 'grayscale' : ''}`}
                  />

                  {/* Play overlay */}
                  {playable ? (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <Play size={20} className="text-foreground ml-0.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                      <Lock size={24} className="text-white" />
                      <span className="text-xs text-white font-medium">Create Session</span>
                    </div>
                  )}

                  {/* Difficulty pill */}
                  <div className="absolute top-3 left-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                      game.difficulty === 'Easy'
                        ? 'bg-green-500/80 text-white'
                        : game.difficulty === 'Medium'
                        ? 'bg-yellow-500/80 text-white'
                        : 'bg-red-500/80 text-white'
                    }`}>
                      {game.difficulty}
                    </span>
                  </div>
                </div>

                {/* Game Info — Airbnb listing text style */}
                <div className="pt-3 pb-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading font-semibold text-sm text-foreground line-clamp-1">
                      {game.title}
                    </h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star size={12} className="text-foreground fill-foreground" />
                      <span className="text-sm font-medium">{game.rating}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{game.category}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Users size={12} />
                    <span>{(game.likes / 1000).toFixed(1)}k plays</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredGames.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No games found matching your criteria</p>
          </div>
        )}
      </main>

      <CreateStudySessionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
