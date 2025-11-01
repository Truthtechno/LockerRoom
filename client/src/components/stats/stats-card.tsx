import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: string;
  trendPercentage?: number;
  iconColor?: string;
}

export default function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendPercentage,
  iconColor = "text-accent",
}: StatsCardProps) {
  const isPositiveTrend = trendPercentage !== undefined ? trendPercentage >= 0 : null;
  const trendColor = isPositiveTrend === null 
    ? "text-gray-500 dark:text-muted-foreground"
    : isPositiveTrend 
    ? "text-green-600 dark:text-green-400" 
    : "text-red-600 dark:text-red-400";

  return (
    <div className="stats-card bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg shadow-md dark:shadow-md p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 ${iconColor.replace("text-", "bg-")}/20 rounded-lg flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${iconColor} ${iconColor === "text-accent" ? "dark:text-accent" : ""}`} />
            </div>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-foreground">{value}</p>
            {(description || trend || trendPercentage !== undefined) && (
              <div className="flex items-center space-x-1 mt-1">
                {trendPercentage !== undefined && (
                  <>
                    {isPositiveTrend ? (
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                    <p className={`text-sm font-medium ${trendColor}`}>
                      {Math.abs(trendPercentage).toFixed(1)}%
                    </p>
                  </>
                )}
                {(trend || description) && (
                  <p className={`text-sm ${trendPercentage === undefined ? (trend ? "text-amber-500 dark:text-amber-400 font-medium" : "text-gray-500 dark:text-muted-foreground") : trendColor}`}>
                    {trend || description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
