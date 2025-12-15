import { Link } from "react-router-dom";
import { Brain, ArrowLeft } from "lucide-react";
import ShootingStars from "@/components/ShootingStars";

const PrivacyPage = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[hsl(220,30%,8%)]">
      <ShootingStars />
      
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-white">PlayStudy.ai</span>
        </Link>
      </nav>

      <main className="relative z-10 px-6 py-16 lg:px-12">
        <div className="max-w-2xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 text-sm mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          
          <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
          
          <div className="space-y-6 text-white/60 text-sm leading-relaxed">
            <p>Last updated: January 2024</p>
            
            <section className="space-y-3">
              <h2 className="text-white font-medium text-base">Information We Collect</h2>
              <p>We collect information you provide directly, including your email address and study materials you upload.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="text-white font-medium text-base">How We Use Your Information</h2>
              <p>Your information is used to provide and improve our services, personalize your learning experience, and communicate with you.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="text-white font-medium text-base">Data Security</h2>
              <p>We implement appropriate security measures to protect your personal information and study materials.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="text-white font-medium text-base">Contact</h2>
              <p>Questions about this policy? <Link to="/contact" className="text-primary hover:underline">Contact us</Link>.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;
