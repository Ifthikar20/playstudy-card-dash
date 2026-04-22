import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="airbnb-container flex items-center h-20">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-new.png" alt="PlayStudy" className="h-10 w-auto" />
          </Link>
        </div>
      </nav>

      <main className="airbnb-container py-12">
        <div className="max-w-2xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          
          <h1 className="font-heading text-3xl font-bold text-foreground mb-8">Privacy Policy</h1>
          
          <div className="space-y-8 text-muted-foreground text-sm leading-relaxed">
            <p>Last updated: January 2024</p>
            
            <section className="space-y-3">
              <h2 className="font-heading text-foreground font-semibold text-base">Information We Collect</h2>
              <p>We collect information you provide directly, including your email address and study materials you upload.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="font-heading text-foreground font-semibold text-base">How We Use Your Information</h2>
              <p>Your information is used to provide and improve our services, personalize your learning experience, and communicate with you.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="font-heading text-foreground font-semibold text-base">Data Security</h2>
              <p>We implement appropriate security measures to protect your personal information and study materials.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="font-heading text-foreground font-semibold text-base">Contact</h2>
              <p>Questions about this policy? <Link to="/contact" className="text-primary hover:underline">Contact us</Link>.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;
