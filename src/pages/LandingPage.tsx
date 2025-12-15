import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ShootingStars from "@/components/ShootingStars";
import { Brain, ArrowRight } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[hsl(220,30%,8%)]">
      <ShootingStars />
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-white">PlayStudy.ai</span>
        </div>
        
        <div className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10">
              Log In
            </Button>
          </Link>
          <Link to="/auth">
            <Button className="bg-primary hover:bg-primary/90">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 lg:pt-32">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white max-w-3xl leading-tight">
          Study smarter.
          <span className="block text-primary mt-1">Play harder.</span>
        </h1>
        
        <p className="mt-6 text-base md:text-lg text-white/50 max-w-lg">
          Transform your notes into interactive games. Upload anything and start learning in seconds.
        </p>
        
        <div className="mt-8">
          <Link to="/auth">
            <Button size="lg" className="bg-primary hover:bg-primary/90 px-8 py-6 gap-2">
              Start Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Simple Feature Cards */}
      <section className="relative z-10 px-6 py-16 lg:px-12">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4">
          <SimpleCard title="Upload" description="PDFs, notes, or text" />
          <SimpleCard title="Play" description="Quizzes & flashcards" />
          <SimpleCard title="Learn" description="Track your progress" />
        </div>
      </section>

      {/* Games Preview */}
      <section className="relative z-10 px-6 py-16 lg:px-12">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-white/40 text-sm uppercase tracking-wider mb-8">Game Modes</p>
          <div className="flex flex-wrap justify-center gap-3">
            <GamePill emoji="❓" label="Quiz" />
            <GamePill emoji="🃏" label="Flashcards" />
            <GamePill emoji="⚡" label="Speed Run" />
            <GamePill emoji="🧠" label="Memory" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-20 lg:px-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-white/50 mb-4">Ready to start?</p>
          <Link to="/auth">
            <Button className="bg-primary hover:bg-primary/90">
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-white/10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
              <Brain className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-xs text-white/40">© 2024 PlayStudy.ai</span>
          </div>
          <div className="flex gap-6 text-xs text-white/40">
            <Link to="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
            <Link to="/contact" className="hover:text-white/60 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

const SimpleCard = ({ title, description }: { title: string; description: string }) => (
  <div className="p-6 rounded-xl bg-white/5 border border-white/10">
    <h3 className="text-white font-medium mb-1">{title}</h3>
    <p className="text-white/40 text-sm">{description}</p>
  </div>
);

const GamePill = ({ emoji, label }: { emoji: string; label: string }) => (
  <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
    <span>{emoji}</span>
    <span className="text-white/60 text-sm">{label}</span>
  </div>
);

export default LandingPage;
