import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ShootingStars from "@/components/ShootingStars";
import { BookOpen, Zap, Trophy, Brain, Upload, Gamepad2, ArrowRight } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[hsl(220,30%,8%)]">
      {/* Space background */}
      <ShootingStars />
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-white">PlayStudy.ai</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-white/70 hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-white/70 hover:text-white transition-colors">How it Works</a>
          <a href="#games" className="text-white/70 hover:text-white transition-colors">Games</a>
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
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-20 pb-32 lg:pt-32">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white max-w-4xl leading-tight">
          Turn Study Materials Into
          <span className="block text-primary mt-2">Interactive Games</span>
        </h1>
        
        <p className="mt-6 text-lg md:text-xl text-white/60 max-w-2xl">
          Upload your notes, PDFs, or paste any text. PlayStudy.ai transforms your content into 
          engaging quizzes, flashcards, and speed runs that make learning feel like play.
        </p>
        
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link to="/auth">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-6 gap-2">
              Start Learning Free
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-white/20 text-white hover:bg-white/10">
              See How It Works
            </Button>
          </a>
        </div>
        
        <p className="mt-4 text-sm text-white/40">No credit card required • Free to start</p>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 px-6 py-20 lg:px-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Everything You Need to Master Any Subject
          </h2>
          <p className="text-white/60 text-center mb-16 max-w-2xl mx-auto">
            From quick study sessions to deep learning marathons, PlayStudy adapts to your style.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Upload className="w-6 h-6" />}
              title="Upload Anything"
              description="PDFs, notes, text, or paste directly. Our AI extracts key concepts automatically."
            />
            <FeatureCard 
              icon={<Gamepad2 className="w-6 h-6" />}
              title="Gamified Learning"
              description="Turn boring material into engaging quizzes, flashcards, and competitive games."
            />
            <FeatureCard 
              icon={<Zap className="w-6 h-6" />}
              title="Speed Runs"
              description="Race against the clock with timed challenges. Perfect for exam prep."
            />
            <FeatureCard 
              icon={<BookOpen className="w-6 h-6" />}
              title="Full Study Mode"
              description="Deep dive into topics with structured learning paths and progress tracking."
            />
            <FeatureCard 
              icon={<Trophy className="w-6 h-6" />}
              title="Earn XP & Rewards"
              description="Track your progress, earn experience points, and unlock achievements."
            />
            <FeatureCard 
              icon={<Brain className="w-6 h-6" />}
              title="Smart Review"
              description="Spaced repetition ensures you remember what you learn, long-term."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 px-6 py-20 lg:px-12 bg-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
            Start Learning in 3 Simple Steps
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard 
              number="1"
              title="Upload Your Content"
              description="Drag and drop your study materials or paste text directly. We support PDFs, documents, and plain text."
            />
            <StepCard 
              number="2"
              title="Choose Your Mode"
              description="Full Study for deep learning, Speed Run for quick practice, or browse our game library for variety."
            />
            <StepCard 
              number="3"
              title="Start Play Studying"
              description="Engage with interactive quizzes, earn XP, track your progress, and master any subject."
            />
          </div>
        </div>
      </section>

      {/* Games Section */}
      <section id="games" className="relative z-10 px-6 py-20 lg:px-12">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Learning Games That Actually Work
          </h2>
          <p className="text-white/60 mb-12 max-w-2xl mx-auto">
            Our game modes are designed by learning scientists to maximize retention and make studying enjoyable.
          </p>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <GameCard title="Quick Quiz" emoji="❓" />
            <GameCard title="Flip Cards" emoji="🃏" />
            <GameCard title="Speed Run" emoji="⚡" />
            <GameCard title="Memory Match" emoji="🧠" />
          </div>
          
          <Link to="/auth" className="inline-block mt-12">
            <Button size="lg" className="bg-primary hover:bg-primary/90 gap-2">
              Explore All Games
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 py-24 lg:px-12">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl p-12 border border-primary/20">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform How You Study?
          </h2>
          <p className="text-white/60 mb-8">
            Join thousands of students who've made learning fun with PlayStudy.ai
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-10 py-6">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-sm text-white/60">© 2024 PlayStudy.ai</span>
          </div>
          <div className="flex gap-6 text-sm text-white/40">
            <a href="#" className="hover:text-white/60 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/60 transition-colors">Terms</a>
            <a href="#" className="hover:text-white/60 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-white/60 text-sm">{description}</p>
  </div>
);

const StepCard = ({ number, title, description }: { number: string; title: string; description: string }) => (
  <div className="text-center">
    <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto mb-4">
      {number}
    </div>
    <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
    <p className="text-white/60">{description}</p>
  </div>
);

const GameCard = ({ title, emoji }: { title: string; emoji: string }) => (
  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 transition-all cursor-pointer">
    <div className="text-4xl mb-3">{emoji}</div>
    <h3 className="text-white font-medium">{title}</h3>
  </div>
);

export default LandingPage;
