import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Users, Award, Activity, GraduationCap } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type SchoolAnalytics = {
  totalStudents: number;
  averageSchoolRating: number;
  gradeDistribution: Record<string, number>;
  genderDistribution: Record<string, number>;
  ratingsStats: {
    studentId: string;
    avgRating: number;
    ratingsCount: number;
  }[];
};

const COLORS = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

export default function LiveReports() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: analytics, isLoading: analyticsLoading } = useQuery<SchoolAnalytics>({
    queryKey: ["/api/schools", user?.schoolId, "analytics"],
    refetchInterval: 30000, // Refresh every 30 seconds for live data
    enabled: !!user?.schoolId,
  });

  const { data: students, isLoading: studentsLoading } = useQuery<any[]>({
    queryKey: ["/api/schools", user?.schoolId, "students"],
    enabled: !!user?.schoolId,
  });

  const { data: schoolStats, isLoading: statsLoading } = useQuery<{
    totalStudents: number;
    totalPosts: number;
    totalEngagement: number;
    activeSports: number;
  }>({
    queryKey: ["/api/schools", user?.schoolId, "stats"],
    enabled: !!user?.schoolId,
  });

  const isLoading = analyticsLoading || studentsLoading || statsLoading;

  // Process data for charts
  const gradeChartData = analytics?.gradeDistribution 
    ? Object.entries(analytics.gradeDistribution).map(([grade, count]) => ({
        grade,
        students: count,
      }))
    : [];

  const genderChartData = analytics?.genderDistribution
    ? Object.entries(analytics.genderDistribution).map(([gender, count]) => ({
        name: gender,
        value: count,
      }))
    : [];

  // Mock performance data (in a real app, this would come from actual student performance tracking)
  const performanceData = [
    { month: 'Jan', academic: 85, athletic: 78, behavior: 92 },
    { month: 'Feb', academic: 87, athletic: 82, behavior: 89 },
    { month: 'Mar', academic: 90, athletic: 85, behavior: 94 },
    { month: 'Apr', academic: 88, athletic: 88, behavior: 91 },
    { month: 'May', academic: 92, athletic: 90, behavior: 95 },
    { month: 'Jun', academic: 94, athletic: 87, behavior: 93 },
  ];

  const attendanceData = [
    { day: 'Mon', present: 95, absent: 5 },
    { day: 'Tue', present: 98, absent: 2 },
    { day: 'Wed', present: 92, absent: 8 },
    { day: 'Thu', present: 96, absent: 4 },
    { day: 'Fri', present: 89, absent: 11 },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/school-admin")}
                className="mr-4"
                data-testid="back-to-admin"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Live Reports & Analytics</h1>
                <p className="text-sm text-muted-foreground">Real-time insights into student performance and engagement</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 bg-muted px-3 py-2 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-foreground">Live Data</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="stat-total-students">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{analytics?.totalStudents || 0}</div>
              <p className="text-xs text-muted-foreground">Registered students</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-avg-rating">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {analytics?.averageSchoolRating.toFixed(1) || '0.0'}/5
              </div>
              <p className="text-xs text-muted-foreground">School performance</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-total-posts">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Content Posts</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{schoolStats?.totalPosts || 0}</div>
              <p className="text-xs text-muted-foreground">Student uploads</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-engagement">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engagement</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{schoolStats?.totalEngagement || 0}</div>
              <p className="text-xs text-muted-foreground">Total interactions</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Grade Distribution */}
          <Card data-testid="chart-grade-distribution">
            <CardHeader>
              <CardTitle className="flex items-center">
                <GraduationCap className="w-5 h-5 mr-2 text-accent" />
                Grade Distribution
              </CardTitle>
              <CardDescription>Number of students per grade/class</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={gradeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="students" fill="#FFD700" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gender Distribution */}
          <Card data-testid="chart-gender-distribution">
            <CardHeader>
              <CardTitle>Gender Distribution</CardTitle>
              <CardDescription>Student demographics breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={genderChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {genderChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Performance Trends */}
          <Card data-testid="chart-performance-trends">
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Academic, athletic, and behavioral performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[60, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="academic" stroke="#FFD700" strokeWidth={2} />
                  <Line type="monotone" dataKey="athletic" stroke="#FFA500" strokeWidth={2} />
                  <Line type="monotone" dataKey="behavior" stroke="#FF6B6B" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Attendance Overview */}
          <Card data-testid="chart-attendance">
            <CardHeader>
              <CardTitle>Weekly Attendance</CardTitle>
              <CardDescription>Daily attendance patterns (current week)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#4ECDC4" stackId="a" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="absent" fill="#FF6B6B" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Performers */}
        {analytics?.ratingsStats && analytics.ratingsStats.length > 0 && (
          <Card data-testid="top-performers">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Award className="w-5 h-5 mr-2 text-accent" />
                Top Rated Students
              </CardTitle>
              <CardDescription>Students with the highest average ratings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analytics.ratingsStats
                  .sort((a, b) => b.avgRating - a.avgRating)
                  .slice(0, 6)
                  .map((stat, index) => {
                    const student = students?.find(s => s.id === stat.studentId);
                    return (
                      <div
                        key={stat.studentId}
                        className="flex items-center space-x-3 p-3 bg-muted rounded-lg"
                        data-testid={`top-student-${index}`}
                      >
                        <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-accent">#{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{student?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {stat.ratingsCount} rating{stat.ratingsCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {stat.avgRating.toFixed(1)}/5
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Insights */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Insights Summary</CardTitle>
            <CardDescription>Key takeaways from your school's data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-green-600">Strengths</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• High overall school rating of {analytics?.averageSchoolRating.toFixed(1) || '0.0'}/5</li>
                  <li>• {analytics?.totalStudents || 0} active students enrolled</li>
                  <li>• Strong student engagement with {schoolStats?.totalPosts || 0} content posts</li>
                  <li>• Diverse student body across {Object.keys(analytics?.gradeDistribution || {}).length} grade levels</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-amber-600">Opportunities</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Monitor Friday attendance patterns for improvement</li>
                  <li>• Encourage more student profile completions</li>
                  <li>• Expand rating participation across all students</li>
                  <li>• Consider additional performance tracking metrics</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}