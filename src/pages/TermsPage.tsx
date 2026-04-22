import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsPage = () => {
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
          
          <h1 className="font-heading text-3xl font-bold text-foreground mb-8">Terms of Service</h1>
          
          <div className="space-y-8 text-muted-foreground text-sm leading-relaxed">
            <p>Last updated: January 2024</p>
            
            <section className="space-y-3">
              <h2 className="font-heading text-foreground font-semibold text-base">Acceptance of Terms</h2>
              <p>By using PlayStudy.ai, you agree to these terms. If you don't agree, please don't use our service.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="font-heading text-foreground font-semibold text-base">Use of Service</h2>
              <p>You may use our service for personal, non-commercial educational purposes. You're responsible for content you upload.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="font-heading text-foreground font-semibold text-base">Your Content</h2>
              <p>You retain ownership of materials you upload. By uploading, you grant us license to process and display your content to provide our services.</p>
            </section>
            
            <section className="space-y-3">
              <h2 className="font-heading text-foreground font-semibold text-base">Limitation of Liability</h2>
              <p>We provide the service "as is" without warranties. We're not liable for any damages arising from your use of the service.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsPage;
