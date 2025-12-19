import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Users, Star, Gamepad2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";

const categories = ["All", "Memory Games", "Challenging & High XP", "Riddles"];

export default function BrowseGamesPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { games } = useAppStore();

  const filteredGames = games.filter((game) => {
    const matchesCategory = selectedCategory === "All" || game.category === selectedCategory;
    return matchesCategory;
  });

  const handlePlayGame = (gameId: number) => {
    // Map game IDs to routes
    // For now, only game ID 7 (platformer) has a playable route
    if (gameId === 7) {
      navigate("/dashboard/platformer-game");
    } else {
      // Other games show the create session dialog
      setDialogOpen(true);
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
            {filteredGames.map((game) => (
              <Card
                key={game.id}
                className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 border-2 hover:border-primary/50 bg-card"
                onClick={() => handlePlayGame(game.id)}
              >
                {/* Game Thumbnail */}
                <div className="relative aspect-[3/2] overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10">
                  <img
                    src={game.image}
                    alt={game.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />

                  {/* Overlay on Hover */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={32} className="text-white" />
                  </div>

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
            ))}
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
