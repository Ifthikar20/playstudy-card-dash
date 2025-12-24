import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ShootingStars from "@/components/ShootingStars";
import { ArrowRight, Upload, Gamepad2, TrendingUp, Users, Clock } from "lucide-react";

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
            className="h-36 w-auto"
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
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white max-w-4xl leading-tight">
          <img src="/canva-new.png" alt="Play" className="inline-block h-12 md:h-16 lg:h-[4.5rem] align-baseline mr-2" /> smarter.
          <span className="block text-primary mt-1 overflow-hidden whitespace-nowrap border-r-4 border-primary animate-typewriter">
            Play harder.
          </span>
        </h1>
        
        <p className="mt-6 text-lg md:text-xl text-white/50 max-w-xl">
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
      <section className="relative z-10 px-6 py-24 lg:px-12 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <p className="text-white/40 text-sm uppercase tracking-wider text-center mb-4">How It Works</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-20">
            Three steps to smarter studying
          </h2>
          
          <div className="relative">
            {/* SVG Curved Path - Behind cards */}
            <svg 
              className="absolute left-0 top-0 w-full h-full pointer-events-none hidden md:block -z-10"
              viewBox="0 0 1000 1400"
              fill="none"
              preserveAspectRatio="xMidYMid slice"
            >
              {/* Curved path from Step 1 to Step 2 */}
              <path
                d="M 700 280 Q 900 350, 850 480 Q 800 600, 500 650 Q 200 700, 250 800"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                strokeDasharray="12 10"
                strokeLinecap="round"
                fill="none"
                opacity="0.35"
              />
              {/* Curved path from Step 2 to Step 3 */}
              <path
                d="M 250 850 Q 100 950, 200 1050 Q 350 1150, 500 1100 Q 700 1050, 750 1150"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                strokeDasharray="12 10"
                strokeLinecap="round"
                fill="none"
                opacity="0.35"
              />
            </svg>

            {/* Mobile dotted line */}
            <div className="md:hidden absolute left-6 top-0 bottom-0 w-0.5 border-l-2 border-dashed border-primary/30 -z-10" />

            <div className="flex flex-col gap-20 relative z-10">
              {/* Step 1 - Right aligned */}
              <div className="flex justify-center md:justify-end md:pr-8">
                <div className="w-full max-w-2xl">
                  <FeatureCard
                    icon={<Upload className="w-7 h-7" />}
                    step="01"
                    title="Upload Content"
                    description="Drop your PDFs, notes, slides, or paste text. Our AI extracts key concepts instantly."
                    animationType="upload"
                  />
                </div>
              </div>
              
              {/* Step 2 - Left aligned */}
              <div className="flex justify-center md:justify-start md:pl-8">
                <div className="w-full max-w-2xl">
                  <FeatureCard
                    icon={<Gamepad2 className="w-7 h-7" />}
                    step="02"
                    title="Choose Your Game"
                    description="Pick from quizzes, flashcards, speed runs, or memory games. Learning becomes play."
                    animationType="game"
                  />
                </div>
              </div>
              
              {/* Step 3 - Right aligned */}
              <div className="flex justify-center md:justify-end md:pr-8">
                <div className="w-full max-w-2xl">
                  <FeatureCard
                    icon={<TrendingUp className="w-7 h-7" />}
                    step="03"
                    title="Track Progress"
                    description="Watch your knowledge grow. Earn XP, unlock achievements, and master every topic."
                    animationType="progress"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Grid - 5 Cards */}
      <section className="relative z-10 px-6 py-16 lg:px-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-16">
            Why Choose PlayStudy
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-auto">
            {/* Card 1 */}
            <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden flex flex-col min-h-[320px] md:col-start-1 md:row-start-1">
              <img
                src="/image-card-1.png"
                alt="New game added every week"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Card 2 - Center/Tall */}
            <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden flex flex-col md:min-h-[660px] md:col-start-2 md:row-span-2">
              <div className="p-8 flex-1 flex flex-col justify-start items-center text-center">
                <h3 className="text-4xl md:text-5xl font-bold text-white mb-0">
                  Card 2
                </h3>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden flex flex-col min-h-[320px] relative md:col-start-3 md:row-start-1">
              <span className="absolute top-5 right-5 bg-primary text-white px-3 py-1.5 rounded-md text-xs font-semibold">
                New
              </span>
              <div className="p-8 flex-1 flex flex-col justify-start">
                <h3 className="text-xl font-bold text-white leading-snug">
                  Card 3
                </h3>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden flex flex-col min-h-[320px] md:col-start-1 md:row-start-2">
              <video
                src="/video-card4.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            </div>

            {/* Card 5 */}
            <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden flex flex-col min-h-[320px] md:col-start-3 md:row-start-2">
              <div className="p-8 flex-1 flex flex-col justify-start">
                <h3 className="text-xl font-bold text-white leading-snug">
                  Card 5
                </h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Manifesto Section */}
      <section className="relative z-10 px-6 py-24 lg:px-12">
        <div className="max-w-2xl mx-auto">
          <div className="p-10 md:p-16 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10">
            <p className="font-handwritten text-primary text-xs md:text-sm mb-4">Our Manifesto</p>
            <h2 className="font-handwritten text-xl md:text-2xl lg:text-3xl text-white mb-6 leading-tight">
              Learning shouldn't feel like a chore.
            </h2>
            <div className="space-y-4 font-handwritten text-sm md:text-base text-white/70 leading-relaxed">
              <p>
                We believe the best learning happens when you're having fun. When curiosity takes over and studying feels like playing your favorite game.
              </p>
              <p>
                Traditional studying is broken. Highlighting textbooks. Rereading notes. Hoping it sticks. We knew there had to be a better way.
              </p>
              <p>
                So we built PlayStudy — a place where your notes become quizzes, your slides become flashcards, and your textbooks become games. Where every answer earns XP, every topic mastered is a level up, and learning becomes something you actually want to do.
              </p>
              <p className="text-white pt-4">
                This is studying, reimagined. This is PlayStudy.
              </p>
            </div>
            
            {/* Signature */}
            <div className="mt-12 pt-8 border-t border-white/10">
              <p className="font-handwritten text-base md:text-lg text-primary italic">
                — The PlayStudy Team
              </p>
            </div>
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
              className="h-24 w-auto opacity-40"
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

const FeatureCard = ({ icon, step, title, description, animationType }: { icon: React.ReactNode; step: string; title: string; description: string; animationType: 'upload' | 'game' | 'progress' }) => (
  <div className="group p-4 md:p-6 rounded-3xl bg-[#1a1a1a]/90 border border-white/10 hover:border-white/30 transition-all duration-300 backdrop-blur-sm shadow-xl">
    {/* Animated SVG Placeholder */}
    <div className="w-full h-80 md:h-96 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-white/10 mb-4 flex items-center justify-center overflow-hidden">
      {animationType === 'upload' && (
        <svg viewBox="0 0 200 150" className="w-64 h-48 md:w-80 md:h-60">
          {/* Document */}
          <rect x="60" y="30" width="80" height="100" rx="6" fill="hsl(var(--primary))" opacity="0.2" className="animate-pulse" />
          <rect x="70" y="50" width="40" height="4" rx="2" fill="hsl(var(--primary))" opacity="0.5" />
          <rect x="70" y="62" width="55" height="4" rx="2" fill="hsl(var(--primary))" opacity="0.4" />
          <rect x="70" y="74" width="35" height="4" rx="2" fill="hsl(var(--primary))" opacity="0.3" />
          <rect x="70" y="86" width="50" height="4" rx="2" fill="hsl(var(--primary))" opacity="0.4" />
          {/* Upload Arrow */}
          <g className="animate-bounce" style={{ animationDuration: '2s' }}>
            <path d="M100 20 L110 35 L103 35 L103 48 L97 48 L97 35 L90 35 Z" fill="hsl(var(--primary))" />
          </g>
        </svg>
      )}
      {animationType === 'game' && (
        <svg viewBox="0 0 200 150" className="w-64 h-48 md:w-80 md:h-60">
          {/* Game Controller */}
          <rect x="40" y="50" width="120" height="60" rx="30" fill="hsl(var(--primary))" opacity="0.2" className="animate-pulse" />
          {/* D-pad */}
          <rect x="60" y="72" width="20" height="8" rx="2" fill="hsl(var(--primary))" opacity="0.6" />
          <rect x="66" y="66" width="8" height="20" rx="2" fill="hsl(var(--primary))" opacity="0.6" />
          {/* Buttons */}
          <circle cx="130" cy="70" r="6" fill="hsl(var(--primary))" opacity="0.7" className="animate-ping" style={{ animationDuration: '2s' }} />
          <circle cx="145" cy="80" r="6" fill="hsl(var(--primary))" opacity="0.5" />
          <circle cx="130" cy="90" r="6" fill="hsl(var(--primary))" opacity="0.5" />
          <circle cx="115" cy="80" r="6" fill="hsl(var(--primary))" opacity="0.5" />
        </svg>
      )}
      {animationType === 'progress' && (
        <svg viewBox="0 0 200 150" className="w-64 h-48 md:w-80 md:h-60">
          {/* Chart bars */}
          <rect x="40" y="100" width="25" height="30" rx="4" fill="hsl(var(--primary))" opacity="0.3">
            <animate attributeName="height" values="30;45;30" dur="2s" repeatCount="indefinite" />
            <animate attributeName="y" values="100;85;100" dur="2s" repeatCount="indefinite" />
          </rect>
          <rect x="75" y="70" width="25" height="60" rx="4" fill="hsl(var(--primary))" opacity="0.5">
            <animate attributeName="height" values="60;80;60" dur="2s" repeatCount="indefinite" begin="0.3s" />
            <animate attributeName="y" values="70;50;70" dur="2s" repeatCount="indefinite" begin="0.3s" />
          </rect>
          <rect x="110" y="50" width="25" height="80" rx="4" fill="hsl(var(--primary))" opacity="0.7">
            <animate attributeName="height" values="80;100;80" dur="2s" repeatCount="indefinite" begin="0.6s" />
            <animate attributeName="y" values="50;30;50" dur="2s" repeatCount="indefinite" begin="0.6s" />
          </rect>
          <rect x="145" y="30" width="25" height="100" rx="4" fill="hsl(var(--primary))" opacity="0.9">
            <animate attributeName="height" values="100;110;100" dur="2s" repeatCount="indefinite" begin="0.9s" />
            <animate attributeName="y" values="30;20;30" dur="2s" repeatCount="indefinite" begin="0.9s" />
          </rect>
          {/* Trend line */}
          <path d="M52 95 L87 60 L122 40 L157 25" stroke="hsl(var(--primary))" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
        </svg>
      )}
    </div>
    
    <div className="flex items-center gap-4 mb-5">
      <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary/30 transition-colors">
        {icon}
      </div>
      <span className="text-primary text-4xl font-bold font-mono">{step}</span>
    </div>
    <h3 className="text-white text-2xl font-semibold mb-4">{title}</h3>
    <p className="text-white/60 text-lg leading-relaxed">{description}</p>
  </div>
);

const StatCard = ({ value, label }: { value: string; label: string }) => (
  <div>
    <p className="text-2xl md:text-3xl font-bold text-primary mb-1">{value}</p>
    <p className="text-white/50 text-sm">{label}</p>
  </div>
);

export default LandingPage;
