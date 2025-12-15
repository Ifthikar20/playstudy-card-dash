import { Link } from "react-router-dom";
import { Brain, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ShootingStars from "@/components/ShootingStars";

const ContactPage = () => {
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
        <div className="max-w-md mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 text-sm mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          
          <h1 className="text-3xl font-bold text-white mb-2">Contact</h1>
          <p className="text-white/50 text-sm mb-8">Have a question? We'd love to hear from you.</p>
          
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <Input 
                placeholder="Your email" 
                type="email"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl"
              />
            </div>
            <div>
              <Input 
                placeholder="Subject" 
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl"
              />
            </div>
            <div>
              <Textarea 
                placeholder="Your message" 
                rows={4}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl resize-none"
              />
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90 rounded-xl">
              Send Message
            </Button>
          </form>
          
          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-white/40 text-sm mb-2">Or email us directly</p>
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
