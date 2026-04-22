import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Gamepad2, TrendingUp, Users, Clock, Star, Sparkles, BookOpen, Zap, Shield } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation — Airbnb-style clean top bar */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="airbnb-container flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo-new.png"
              alt="PlayStudy"
              className="h-12 w-auto"
            />
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="rounded-full text-sm font-medium">
                Log in
              </Button>
            </Link>
            <Link to="/auth">
              <button className="airbnb-btn-primary text-sm px-5 py-2.5 rounded-lg">
                Sign up
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — Airbnb editorial style */}
      <section className="airbnb-container pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <Sparkles size={14} />
            AI-Powered Study Platform
          </div>

          <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-extrabold text-foreground leading-[1.1] tracking-tight">
            Study smarter.
            <br />
            <span className="text-primary">
              Play harder.
            </span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
            Transform your notes into interactive games. Upload anything and start learning in seconds — no flashcard creation required.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link to="/auth">
              <button className="airbnb-btn-primary text-base px-8 py-4 rounded-xl gap-2">
                Get started — it's free
                <ArrowRight size={18} />
              </button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" size="lg" className="rounded-xl h-[52px] px-8 text-base border-2 hover:border-foreground/30 gap-2">
                Watch demo
              </Button>
            </Link>
          </div>

          {/* Social proof strip */}
          <div className="mt-12 flex items-center gap-6 text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              <Users size={16} />
              <span>10K+ students</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <Star size={16} className="text-primary fill-primary" />
              <span>4.9 rating</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>500K+ study hours</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works — Airbnb 3-column feature grid */}
      <section className="bg-muted/50 border-t border-b border-border">
        <div className="airbnb-container py-20 md:py-28">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-3">How it works</p>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
              Three steps to better grades
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <StepCard
              step="01"
              icon={<Upload size={24} />}
              title="Upload anything"
              description="PDFs, notes, slides, or just paste text. Our AI extracts key concepts instantly."
            />
            <StepCard
              step="02"
              icon={<Gamepad2 size={24} />}
              title="Choose your game"
              description="Quizzes, flashcards, speed runs, or memory games. Learning becomes play."
            />
            <StepCard
              step="03"
              icon={<TrendingUp size={24} />}
              title="Track progress"
              description="Watch your knowledge grow. Earn XP, unlock achievements, and master every topic."
            />
          </div>
        </div>
      </section>

      {/* Feature Highlights — Airbnb card grid */}
      <section className="airbnb-container py-20 md:py-28">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
            Why students love PlayStudy
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureHighlight
            icon={<Zap size={20} />}
            title="AI-Generated Questions"
            description="Our AI reads your material and creates personalized questions across all difficulty levels."
          />
          <FeatureHighlight
            icon={<Gamepad2 size={20} />}
            title="Game-Based Learning"
            description="Platformer games, memory matches, speed runs — study materials become adventures."
          />
          <FeatureHighlight
            icon={<BookOpen size={20} />}
            title="Mentor Mode"
            description="Listen to AI narration that teaches you like a personal tutor guiding through content."
          />
          <FeatureHighlight
            icon={<TrendingUp size={20} />}
            title="Progress Tracking"
            description="Visual analytics show exactly what you've mastered and where to focus next."
          />
          <FeatureHighlight
            icon={<Shield size={20} />}
            title="Smart Spaced Repetition"
            description="Questions adapt to your performance, surfacing weak areas at the perfect time."
          />
          <FeatureHighlight
            icon={<Users size={20} />}
            title="Community Challenges"
            description="Compete with friends on leaderboards and earn XP through collaborative study."
          />
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-t border-b border-border">
        <div className="airbnb-container py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard value="95%" label="Retention rate" />
            <StatCard value="3x" label="Faster learning" />
            <StatCard value="50K+" label="Topics covered" />
            <StatCard value="4.9" label="Student rating" />
          </div>
        </div>
      </section>

      {/* Manifesto — Airbnb editorial block */}
      <section className="airbnb-container py-20 md:py-28">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-3xl bg-card border border-border p-10 md:p-16">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">Our belief</p>
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6 leading-tight">
              Learning shouldn't feel like a chore.
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                We believe the best learning happens when you're having fun. When curiosity takes over and studying feels like playing your favorite game.
              </p>
              <p>
                Traditional studying is broken. Highlighting textbooks. Rereading notes. Hoping it sticks. We knew there had to be a better way.
              </p>
              <p>
                So we built PlayStudy — a place where your notes become quizzes, your slides become flashcards, and your textbooks become games.
              </p>
              <p className="text-foreground font-medium pt-2">
                This is studying, reimagined. This is PlayStudy.
              </p>
            </div>

            <div className="mt-10 pt-8 border-t border-border">
              <p className="text-primary font-medium italic">
                — The PlayStudy Team
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="airbnb-container py-20 md:py-28">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to transform how you study?
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Join thousands of students who've made learning fun again.
          </p>
          <Link to="/auth">
            <button className="airbnb-btn-primary text-base px-10 py-4 rounded-xl gap-2">
              Get started free
              <ArrowRight size={18} />
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="airbnb-container py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo-new.png"
              alt="PlayStudy"
              className="h-8 w-auto opacity-50"
            />
            <span className="text-xs text-muted-foreground">© 2024 PlayStudy</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

const StepCard = ({ step, icon, title, description }: { step: string; icon: React.ReactNode; title: string; description: string }) => (
  <div className="text-center md:text-left">
    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto md:mx-0 mb-5">
      {icon}
    </div>
    <p className="text-xs font-bold text-primary tracking-wider uppercase mb-2">Step {step}</p>
    <h3 className="font-heading text-xl font-bold text-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

const FeatureHighlight = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="airbnb-card p-6 border border-border">
    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
      {icon}
    </div>
    <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

const StatCard = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center">
    <p className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-1">{value}</p>
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);

export default LandingPage;
