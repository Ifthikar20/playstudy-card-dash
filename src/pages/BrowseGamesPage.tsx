import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Play, Users, Star, Gamepad2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";

const categories = ["All", "Mathematics", "Science", "History", "Languages", "Geography", "Programming", "Arts", "Music", "Business"];

export default function BrowseGamesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { games, likeGame } = useAppStore();

  const filteredGames = games.filter((game) => {
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || game.category === selectedCategory;
    return matchesSearch && matchesCategory;
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
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Browse Games</h1>
            </div>
            <p className="text-muted-foreground">Discover and play educational games across all subjects</p>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input 
                  placeholder="Search games..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" className="gap-2">
                <Filter size={18} />
                Filters
              </Button>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80 transition-colors px-4 py-1.5"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          {/* Games Grid - Netflix Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGames.map((game) => (
              <Card 
                key={game.id} 
                className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 border hover:border-primary/30"
              >
                <div className="flex h-36">
                  {/* Image Side */}
                  <div className="relative w-44 shrink-0 overflow-hidden">
                    <img 
                      src={game.image} 
                      alt={game.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />
                    <Badge 
                      className="absolute top-2 left-2 text-xs"
                      variant={game.difficulty === "Easy" ? "secondary" : game.difficulty === "Medium" ? "default" : "destructive"}
                    >
                      {game.difficulty}
                    </Badge>
                  </div>

                  {/* Content Side */}
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {game.category}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Star size={12} className="text-yellow-500 fill-yellow-500" />
                          <span className="text-xs font-medium text-foreground">{game.rating}</span>
                        </div>
                      </div>
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {game.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {game.description}
                      </p>
                    </div>

                    {/* Bottom Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users size={12} />
                        <span className="text-xs font-medium">{game.likes.toLocaleString()} students</span>
                      </div>
                      <Button
                        size="icon"
                        className="rounded-full h-10 w-10 shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayGame(game.id);
                        }}
                      >
                        <Play size={16} className="ml-0.5" />
                      </Button>
                    </div>
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
