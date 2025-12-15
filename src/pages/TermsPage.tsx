import { Link } from "react-router-dom";
import { Brain, ArrowLeft } from "lucide-react";
import ShootingStars from "@/components/ShootingStars";

const TermsPage = () => {
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
          
          <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>
          
          <div className="space-y-6 text-white/60 text-sm leading-relaxed">
            <p>Last updated: January 2024</p>
            
            <section className="space-y-3">
              <h2 className="text-white font-medium text-base">Acceptance of Terms</h2>
              <p>By using PlayStudy.ai, you agree to these terms. If you don't agree, please don't use our service.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="text-white font-medium text-base">Use of Service</h2>
              <p>You may use our service for personal, non-commercial educational purposes. You're responsible for content you upload.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="text-white font-medium text-base">Your Content</h2>
              <p>You retain ownership of materials you upload. By uploading, you grant us license to process and display your content to provide our services.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="text-white font-medium text-base">Limitation of Liability</h2>
              <p>We provide the service "as is" without warranties. We're not liable for any damages arising from your use of the service.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsPage;
