import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  className?: string;
}

export function DashboardCard({ 
  title, 
  description, 
  icon: Icon, 
  onClick, 
  className 
}: DashboardCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "airbnb-card border border-border p-6 cursor-pointer group",
        className
      )}
    >
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/15 transition-colors">
          <Icon size={22} className="text-primary" />
        </div>
        <div>
          <h3 className="font-heading font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
}
