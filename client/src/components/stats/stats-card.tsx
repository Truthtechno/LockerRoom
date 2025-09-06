import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: string;
  iconColor?: string;
}

export default function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  iconColor = "text-accent",
}: StatsCardProps) {
  return (
    <div className="stats-card border border-border rounded-xl p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`w-12 h-12 ${iconColor.replace("text-", "bg-")}/20 rounded-lg flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {(description || trend) && (
            <p className={`text-sm ${trend ? "text-accent" : "text-muted-foreground"}`}>
              {trend || description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
