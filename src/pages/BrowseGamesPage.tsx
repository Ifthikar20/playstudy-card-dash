import { useState } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
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

          {/* Games Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames.map((game) => (
              <Card 
                key={game.id} 
                className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 border-2 hover:border-primary/30"
              >
                {/* Image Header */}
                <div className="relative h-40 overflow-hidden">
                  <img 
                    src={game.image} 
                    alt={game.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <Badge 
                    className="absolute top-3 right-3"
                    variant={game.difficulty === "Easy" ? "secondary" : game.difficulty === "Medium" ? "default" : "destructive"}
                  >
                    {game.difficulty}
                  </Badge>
                  <div className="absolute top-3 left-3">
                    <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                      {game.category}
                    </Badge>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                    {game.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {game.description}
                  </p>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users size={14} />
                      <span className="font-medium">{game.likes.toLocaleString()}</span>
                      <span className="text-xs">students</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-yellow-500 fill-yellow-500" />
                      <span className="font-medium text-foreground">{game.rating}</span>
                    </div>
                  </div>

                  {/* Play Button */}
                  <Button 
                    className="w-full gap-2 mt-2" 
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDialogOpen(true);
                    }}
                  >
                    <Play size={18} />
                    Play Now
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

      <CreateStudySessionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
