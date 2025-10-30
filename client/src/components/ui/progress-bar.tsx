import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
}

export default function ProgressBar({ progress, className, showPercentage = true }: ProgressBarProps) {
  return (
    <div className={cn("w-full bg-muted rounded-full h-2", className)}>
      <div
        className="bg-accent h-2 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
      {showPercentage && (
        <div className="text-xs text-muted-foreground mt-1 text-center">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
}
