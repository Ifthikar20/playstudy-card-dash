import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ContactPage = () => {
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
        <div className="max-w-md mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          
          <h1 className="font-heading text-3xl font-bold text-foreground mb-2">Contact</h1>
          <p className="text-muted-foreground text-sm mb-8">Have a question? We'd love to hear from you.</p>
          
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <Input 
                placeholder="Your email" 
                type="email"
                className="h-12 rounded-xl border-2"
              />
            </div>
            <div>
              <Input 
                placeholder="Subject" 
                className="h-12 rounded-xl border-2"
              />
            </div>
            <div>
              <Textarea 
                placeholder="Your message" 
                rows={4}
                className="rounded-xl border-2 resize-none"
              />
            </div>
            <button className="airbnb-btn-primary w-full h-12 rounded-xl text-sm">
              Send Message
            </button>
          </form>
          
          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-muted-foreground text-sm mb-2">Or email us directly</p>
            <a href="mailto:hello@playstudy.ai" className="inline-flex items-center gap-2 text-primary hover:underline text-sm">
              <Mail className="w-4 h-4" />
              hello@playstudy.ai
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContactPage;
