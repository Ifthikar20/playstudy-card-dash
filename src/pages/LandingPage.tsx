import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ShootingStars from "@/components/ShootingStars";
import { Brain, ArrowRight, Upload, Gamepad2, TrendingUp, Zap, Users, Clock } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[hsl(220,30%,8%)]">
      <ShootingStars />
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2">
          <img
            src="/logo-new.png"
            alt="PlayStudy"
            className="h-48 w-auto"
          />
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
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 lg:pt-28">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm text-white/60">AI-Powered Learning</span>
        </div>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white max-w-4xl leading-tight">
          Study smarter.
          <span className="block text-primary mt-1">Play harder.</span>
        </h1>
        
        <p className="mt-6 text-base md:text-lg text-white/50 max-w-xl">
          Transform your notes into interactive games. Upload anything and start learning in seconds.
        </p>
        
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link to="/auth">
            <Button size="lg" className="bg-primary hover:bg-primary/90 px-8 py-6 gap-2">
              Start Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 px-8 py-6">
            Watch Demo
          </Button>
        </div>

        {/* Social Proof */}
        <div className="mt-12 flex items-center gap-6 text-white/40 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>10K+ students</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>500K+ study hours</span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 px-6 py-16 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <p className="text-white/40 text-sm uppercase tracking-wider text-center mb-10">How It Works</p>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Upload className="w-5 h-5" />}
              step="01"
              title="Upload Content" 
              description="Drop your PDFs, notes, slides, or paste text. Our AI extracts key concepts instantly."
            />
            <FeatureCard 
              icon={<Gamepad2 className="w-5 h-5" />}
              step="02"
              title="Choose Your Game" 
              description="Pick from quizzes, flashcards, speed runs, or memory games. Learning becomes play."
            />
            <FeatureCard 
              icon={<TrendingUp className="w-5 h-5" />}
              step="03"
              title="Track Progress" 
              description="Watch your knowledge grow. Earn XP, unlock achievements, and master every topic."
            />
          </div>
        </div>
      </section>

      {/* Manifesto Section */}
      <section className="relative z-10 px-6 py-20 lg:px-12">
        <div className="max-w-3xl mx-auto">
          <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10">
            <p className="text-primary text-sm uppercase tracking-wider mb-4">Our Manifesto</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 leading-relaxed">
              Learning shouldn't feel like a chore.
            </h2>
            <div className="space-y-4 text-white/60 leading-relaxed">
              <p>
                We believe the best learning happens when you're having fun. When curiosity takes over and studying feels like playing your favorite game.
              </p>
              <p>
                Traditional studying is broken. Highlighting textbooks. Rereading notes. Hoping it sticks. We knew there had to be a better way.
              </p>
              <p>
                So we built PlayStudy — a place where your notes become quizzes, your slides become flashcards, and your textbooks become games. Where every answer earns XP, every topic mastered is a level up, and learning becomes something you actually want to do.
              </p>
              <p className="text-white font-medium pt-2">
                This is studying, reimagined. This is PlayStudy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Game Modes */}
      <section className="relative z-10 px-6 py-16 lg:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-white/40 text-sm uppercase tracking-wider mb-8">Game Modes</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <GameCard emoji="❓" label="Quiz Mode" description="Test your knowledge" />
            <GameCard emoji="🃏" label="Flashcards" description="Quick recall training" />
            <GameCard emoji="⚡" label="Speed Run" description="Race against time" />
            <GameCard emoji="🧠" label="Memory" description="Deep retention" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 px-6 py-16 lg:px-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <StatCard value="95%" label="Retention Rate" />
            <StatCard value="3x" label="Faster Learning" />
            <StatCard value="50K+" label="Topics Covered" />
            <StatCard value="4.9" label="User Rating" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-20 lg:px-12">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Ready to transform how you study?</h2>
          <p className="text-white/50 mb-8">Join thousands of students who've made learning fun again.</p>
          <Link to="/auth">
            <Button size="lg" className="bg-primary hover:bg-primary/90 px-10 py-6 gap-2">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-white/10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img
              src="/logo-new.png"
              alt="PlayStudy"
              className="h-28 w-auto opacity-40"
            />
            <span className="text-xs text-white/40">© 2024</span>
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

const FeatureCard = ({ icon, step, title, description }: { icon: React.ReactNode; step: string; title: string; description: string }) => (
  <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
        {icon}
      </div>
      <span className="text-white/30 text-sm font-mono">{step}</span>
    </div>
    <h3 className="text-white font-semibold mb-2">{title}</h3>
    <p className="text-white/50 text-sm leading-relaxed">{description}</p>
  </div>
);

const GameCard = ({ emoji, label, description }: { emoji: string; label: string; description: string }) => (
  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors text-center">
    <span className="text-2xl mb-3 block">{emoji}</span>
    <h3 className="text-white font-medium text-sm mb-1">{label}</h3>
    <p className="text-white/40 text-xs">{description}</p>
  </div>
);

const StatCard = ({ value, label }: { value: string; label: string }) => (
  <div>
    <p className="text-2xl md:text-3xl font-bold text-primary mb-1">{value}</p>
    <p className="text-white/50 text-sm">{label}</p>
  </div>
);

export default LandingPage;
