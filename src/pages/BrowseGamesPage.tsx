import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Play, Heart, Star } from "lucide-react";
import { useAppStore } from "@/store/appStore";

const categories = ["All", "Mathematics", "Science", "History", "Languages", "Geography", "Programming", "Arts", "Music", "Business"];

export default function BrowseGamesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const { games, likeGame } = useAppStore();

  const filteredGames = games.filter((game) => {
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || game.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Browse Games</h1>
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

          {/* Games Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredGames.map((game) => (
              <Card key={game.id} className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1">
                <div className="relative h-36 overflow-hidden">
                  <img 
                    src={game.image} 
                    alt={game.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <Badge 
                    className="absolute top-2 right-2"
                    variant={game.difficulty === "Easy" ? "secondary" : game.difficulty === "Medium" ? "default" : "destructive"}
                  >
                    {game.difficulty}
                  </Badge>
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="font-semibold text-white text-sm mb-1">{game.title}</h3>
                    <p className="text-xs text-white/80">{game.category}</p>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <button 
                      onClick={(e) => { e.stopPropagation(); likeGame(game.id); }}
                      className="flex items-center gap-1 hover:text-pink-500 transition-colors"
                    >
                      <Heart size={14} className="hover:fill-pink-500" />
                      {game.likes.toLocaleString()} students
                    </button>
                    <span className="flex items-center gap-1">
                      <Star size={14} className="text-yellow-500 fill-yellow-500" />
                      {game.rating}
                    </span>
                  </div>
                  <Button size="sm" className="h-8 gap-1">
                    <Play size={14} />
                    Play
                  </Button>
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
    </div>
  );
}
