
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
        "bg-white rounded-xl border border-gray-200 p-6 cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:border-blue-300 hover:-translate-y-1",
        "group",
        className
      )}
    >
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
          <Icon size={24} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
            {title}
          </h3>
          <p className="text-gray-600 mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}
