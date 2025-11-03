import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function StudentLimitCard() {
  const { user } = useAuth();

  const { data: enrollmentStatus, isLoading } = useQuery({
    queryKey: ["/api/school-admin/enrollment-status"],
    queryFn: async () => {
      const response = await fetch('/api/school-admin/enrollment-status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch enrollment status');
      return response.json();
    },
    enabled: !!user?.schoolId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading || !enrollmentStatus?.enrollmentStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Student Enrollment
          </CardTitle>
          <CardDescription>Loading enrollment status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const status = enrollmentStatus.enrollmentStatus;
  const utilization = status.utilizationPercentage;
  const isAtLimit = status.warningLevel === 'at_limit';
  const isApproaching = status.warningLevel === 'approaching';

  // Progress bar color
  let progressColor = "bg-green-500";
  if (utilization >= 100) {
    progressColor = "bg-red-500";
  } else if (utilization >= 80) {
    progressColor = "bg-yellow-500";
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Student Enrollment
          </CardTitle>
          <CardDescription>
            Current enrollment status and capacity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Enrolled Students</span>
              <span className="font-semibold">
                {status.currentCount} / {status.maxStudents}
              </span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div 
                className={`h-full ${progressColor} transition-all`}
                style={{ width: `${Math.min(100, utilization)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{status.availableSlots} slot(s) available</span>
              <span>{utilization.toFixed(1)}% utilized</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {(isAtLimit || isApproaching) && (
        <Alert variant={isAtLimit ? "destructive" : "default"} className={isApproaching ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800" : ""}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {isAtLimit ? "Enrollment Limit Reached" : "Approaching Enrollment Limit"}
          </AlertTitle>
          <AlertDescription>
            {isAtLimit
              ? `You've reached your student limit (${status.currentCount}/${status.maxStudents}). Cannot enroll new students. Please contact system admin to increase capacity.`
              : `You're approaching your student limit (${status.currentCount}/${status.maxStudents}). ${status.availableSlots} slot(s) remaining. Consider contacting system admin to increase capacity.`}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

