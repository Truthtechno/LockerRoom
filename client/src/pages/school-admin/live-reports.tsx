import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Users, Award, Activity, GraduationCap, Eye, MessageCircle, Heart, Bookmark, Trophy, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SchoolAnalytics = {
  totalStudents: number;
  averageEngagementPerStudent: number;
  averageEngagementScore: number;
  gradeDistribution: Record<string, number>;
  genderDistribution: Record<string, number>;
  engagementStats: {
    studentId: string;
    totalPosts: number;
    totalEngagement: number;
    totalLikes: number;
    totalComments: number;
    totalViews: number;
    totalFollowers: number;
    engagementScore: number;
    avgEngagementPerPost: number;
  }[];
};

const COLORS = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

export default function LiveReports() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<string>("month");
  const [activeTab, setActiveTab] = useState<string>("overview");

  const { data: analytics, isLoading: analyticsLoading } = useQuery<SchoolAnalytics>({
    queryKey: ["/api/schools", user?.schoolId, "analytics", period],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("No school ID");
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${user.schoolId}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
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
    previousPeriodPosts?: number;
    previousPeriodEngagement?: number;
  }>({
    queryKey: ["/api/schools", user?.schoolId, "stats", period],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("No school ID");
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${user.schoolId}/stats?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: !!user?.schoolId,
    refetchInterval: 30000,
  });

  // Fetch engagement trends
  const { data: engagementTrends, isLoading: trendsLoading } = useQuery<any[]>({
    queryKey: ["/api/schools", user?.schoolId, "analytics", "engagement-trends", period],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("No school ID");
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${user.schoolId}/analytics/engagement-trends?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch trends");
      return response.json();
    },
    enabled: !!user?.schoolId,
    refetchInterval: 30000,
  });

  // Fetch post trends
  const { data: postTrends, isLoading: postTrendsLoading } = useQuery<any[]>({
    queryKey: ["/api/schools", user?.schoolId, "analytics", "post-trends", period],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("No school ID");
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${user.schoolId}/analytics/post-trends?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch post trends");
      return response.json();
    },
    enabled: !!user?.schoolId,
    refetchInterval: 30000,
  });

  // Fetch post analytics
  const { data: postAnalytics, isLoading: postAnalyticsLoading } = useQuery<any>({
    queryKey: ["/api/schools", user?.schoolId, "analytics", "posts", period],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("No school ID");
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${user.schoolId}/analytics/posts?limit=10&period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch post analytics");
      return response.json();
    },
    enabled: !!user?.schoolId,
    refetchInterval: 30000,
  });

  // Fetch student engagement
  const { data: studentEngagement, isLoading: studentEngagementLoading } = useQuery<any>({
    queryKey: ["/api/schools", user?.schoolId, "analytics", "student-engagement", period],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("No school ID");
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${user.schoolId}/analytics/student-engagement?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch student engagement");
      return response.json();
    },
    enabled: !!user?.schoolId,
    refetchInterval: 30000,
  });

  const isLoading = analyticsLoading || studentsLoading || statsLoading || trendsLoading || postTrendsLoading;

  // Debug logging
  console.log('📊 Live Reports Data:', {
    engagementTrends: engagementTrends?.length || 0,
    postTrends: postTrends?.length || 0,
    postAnalytics: postAnalytics ? 'loaded' : 'none',
    studentEngagement: studentEngagement ? 'loaded' : 'none',
    period
  });

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

  // Format engagement trends for chart
  const engagementChartData = engagementTrends && engagementTrends.length > 0
    ? engagementTrends.map(item => {
        try {
          // Handle both ISO string dates and already formatted dates
          const dateValue = typeof item.date === 'string' 
            ? (item.date.includes('T') || item.date.includes(':'))
              ? new Date(item.date)
              : new Date(item.date + 'T00:00:00')
            : new Date(item.date);
          
          return {
            date: dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            engagement: item.engagement || 0,
            posts: item.posts || 0
          };
        } catch (e) {
          console.warn('Error parsing engagement trend date:', item.date, e);
          return {
            date: String(item.date),
            engagement: item.engagement || 0,
            posts: item.posts || 0
          };
        }
      })
    : [];

  // Format post trends for chart
  const postTrendsChartData = postTrends && postTrends.length > 0
    ? postTrends.map(item => {
        try {
          const dateValue = typeof item.date === 'string'
            ? (item.date.includes('T') || item.date.includes(':'))
              ? new Date(item.date)
              : new Date(item.date + 'T00:00:00')
            : new Date(item.date);
          
          return {
            date: dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            posts: item.posts || 0,
            images: item.images || 0,
            videos: item.videos || 0
          };
        } catch (e) {
          console.warn('Error parsing post trend date:', item.date, e);
          return {
            date: String(item.date),
            posts: item.posts || 0,
            images: item.images || 0,
            videos: item.videos || 0
          };
        }
      })
    : [];

  // Format activity by day for chart
  const activityChartData = studentEngagement?.activityByDay && studentEngagement.activityByDay.length > 0
    ? studentEngagement.activityByDay.map((item: any) => {
        try {
          const dateValue = typeof item.date === 'string'
            ? (item.date.includes('T') || item.date.includes(':'))
              ? new Date(item.date)
              : new Date(item.date + 'T00:00:00')
            : new Date(item.date);
          
          return {
            date: dateValue.toLocaleDateString('en-US', { weekday: 'short' }),
            posts: item.posts || 0
          };
        } catch (e) {
          console.warn('Error parsing activity date:', item.date, e);
          return {
            date: String(item.date),
            posts: item.posts || 0
          };
        }
      })
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
          {/* Mobile Back Button and Title */}
          <div className="bg-card border-b border-border px-4 py-4 space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/school-admin")}
              className="w-full justify-start -ml-2"
              data-testid="back-to-admin"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
            <div className="space-y-3">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Live Reports & Analytics</h1>
                <p className="text-sm text-muted-foreground">Real-time insights into player performance and engagement</p>
              </div>
              <div className="flex items-center space-x-2">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Last 24 hours</SelectItem>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center space-x-2 bg-muted px-3 py-2 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-foreground">Live Data</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Desktop Header */}
        <div className="hidden lg:block bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Live Reports & Analytics</h1>
                <p className="text-sm text-muted-foreground">Real-time insights into player performance and engagement</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Last 24 hours</SelectItem>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              <div className="flex items-center space-x-2 bg-muted px-3 py-2 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-foreground">Live Data</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-8">
          <Card data-testid="stat-total-students">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Players</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{analytics?.totalStudents || 0}</div>
              <p className="text-xs text-muted-foreground">Registered players</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-engagement-score">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {analytics?.averageEngagementScore.toFixed(0) || '0'}/100
              </div>
              <p className="text-xs text-muted-foreground">Platform activity score</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-total-posts">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Content Posts</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{schoolStats?.totalPosts || 0}</div>
              <p className="text-xs text-muted-foreground">Player uploads</p>
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

        {/* Tabs for different analytics sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0 mb-4 sm:mb-8">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-4 sm:w-full">
              <TabsTrigger value="overview" className="flex-shrink-0">Overview</TabsTrigger>
              <TabsTrigger value="engagement" className="flex-shrink-0">Engagement</TabsTrigger>
              <TabsTrigger value="posts" className="flex-shrink-0">Posts</TabsTrigger>
              <TabsTrigger value="students" className="flex-shrink-0">Players</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4 sm:space-y-8">
        {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-4 sm:mb-8">
          {/* Grade Distribution */}
          <Card data-testid="chart-grade-distribution">
            <CardHeader>
              <CardTitle className="flex items-center">
                <GraduationCap className="w-5 h-5 mr-2 text-accent" />
                Grade Distribution
              </CardTitle>
              <CardDescription>Number of players per grade/class</CardDescription>
            </CardHeader>
            <CardContent>
                  <div className="w-full overflow-x-auto">
                    <ResponsiveContainer width="100%" height={300} minHeight={250}>
                      <BarChart data={gradeChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="students" fill="#FFD700" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
                  </div>
            </CardContent>
          </Card>

          {/* Gender Distribution */}
          <Card data-testid="chart-gender-distribution">
            <CardHeader>
              <CardTitle>Gender Distribution</CardTitle>
              <CardDescription>Player demographics breakdown</CardDescription>
            </CardHeader>
            <CardContent>
                  <div className="w-full overflow-x-auto">
                    <ResponsiveContainer width="100%" height={300} minHeight={250}>
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
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-4 sm:space-y-8">
            {/* Engagement Trends */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg sm:text-xl">Engagement Trends</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Total engagement (likes, comments, saves, views) over time</CardDescription>
              </CardHeader>
              <CardContent>
                {trendsLoading ? (
                  <div className="h-64 sm:h-96 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                  </div>
                ) : engagementChartData.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <ResponsiveContainer width="100%" height={300} minHeight={250}>
                      <LineChart data={engagementChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={engagementChartData.length > 7 ? -45 : 0} textAnchor={engagementChartData.length > 7 ? "end" : "middle"} height={engagementChartData.length > 7 ? 60 : 30} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Line type="monotone" dataKey="engagement" stroke="#FFD700" strokeWidth={2} name="Engagement" />
                        <Line type="monotone" dataKey="posts" stroke="#4ECDC4" strokeWidth={2} name="Posts" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 sm:h-96 flex flex-col items-center justify-center text-muted-foreground p-4">
                    <Activity className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm text-center">No engagement data available for the selected period</p>
                    <p className="text-xs text-center mt-2">Try selecting a different time period or check back later</p>
                    {engagementTrends && engagementTrends.length === 0 && (
                      <p className="text-xs text-center mt-2 text-amber-600">Period: {period}</p>
                    )}
                  </div>
                )}
            </CardContent>
          </Card>

            {/* Activity by Day */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg sm:text-xl">Posting Activity</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Daily posting activity over time</CardDescription>
              </CardHeader>
              <CardContent>
                {studentEngagementLoading ? (
                  <div className="h-64 sm:h-96 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                  </div>
                ) : activityChartData.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <ResponsiveContainer width="100%" height={300} minHeight={250}>
                      <BarChart data={activityChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="posts" fill="#45B7D1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 sm:h-96 flex flex-col items-center justify-center text-muted-foreground p-4">
                    <Activity className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm text-center">No posting activity data available</p>
                    <p className="text-xs text-center mt-2">Activity will appear as players post content</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="space-y-4 sm:space-y-8">
            {/* Post Trends */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg sm:text-xl">Post Creation Trends</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Posts created over time by content type</CardDescription>
            </CardHeader>
            <CardContent>
                {postTrendsLoading ? (
                  <div className="h-64 sm:h-96 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                  </div>
                ) : postTrendsChartData.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <ResponsiveContainer width="100%" height={300} minHeight={250}>
                      <LineChart data={postTrendsChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={postTrendsChartData.length > 7 ? -45 : 0} textAnchor={postTrendsChartData.length > 7 ? "end" : "middle"} height={postTrendsChartData.length > 7 ? 60 : 30} />
                        <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Line type="monotone" dataKey="posts" stroke="#FFD700" strokeWidth={2} name="Total Posts" />
                        <Line type="monotone" dataKey="images" stroke="#4ECDC4" strokeWidth={2} name="Images" />
                        <Line type="monotone" dataKey="videos" stroke="#FF6B6B" strokeWidth={2} name="Videos" />
                </LineChart>
              </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 sm:h-96 flex flex-col items-center justify-center text-muted-foreground p-4">
                    <FileText className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm text-center">No post data available for the selected period</p>
                    <p className="text-xs text-center mt-2">Try selecting a different time period</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Engagement Breakdown */}
            {postAnalyticsLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Card>
                  <CardContent className="p-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : postAnalytics?.engagementBreakdown ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg">Engagement Breakdown</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Total engagement by type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Heart className="w-4 h-4 text-red-500" />
                          <span className="text-sm">Likes</span>
                        </div>
                        <span className="font-bold text-sm sm:text-base">{postAnalytics.engagementBreakdown.likes?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <MessageCircle className="w-4 h-4 text-blue-500" />
                          <span className="text-sm">Comments</span>
                        </div>
                        <span className="font-bold text-sm sm:text-base">{postAnalytics.engagementBreakdown.comments?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Bookmark className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm">Saves</span>
                        </div>
                        <span className="font-bold text-sm sm:text-base">{postAnalytics.engagementBreakdown.saves?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Eye className="w-4 h-4 text-green-500" />
                          <span className="text-sm">Views</span>
                        </div>
                        <span className="font-bold text-sm sm:text-base">{postAnalytics.engagementBreakdown.views?.toLocaleString() || 0}</span>
                      </div>
                      <div className="border-t pt-2 mt-2 flex items-center justify-between font-bold">
                        <span className="text-sm">Total</span>
                        <span className="text-sm sm:text-base">{postAnalytics.engagementBreakdown.total?.toLocaleString() || 0}</span>
                      </div>
                    </div>
            </CardContent>
          </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg">Content Mix</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Distribution of content types</CardDescription>
            </CardHeader>
            <CardContent>
                    {postAnalytics.contentMix && (postAnalytics.contentMix.images > 0 || postAnalytics.contentMix.videos > 0) ? (
                      <ResponsiveContainer width="100%" height={200} minHeight={180}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Images', value: postAnalytics.contentMix.images || 0 },
                              { name: 'Videos', value: postAnalytics.contentMix.videos || 0 }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={60}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            <Cell fill="#4ECDC4" />
                            <Cell fill="#FF6B6B" />
                          </Pie>
                  <Tooltip />
                        </PieChart>
              </ResponsiveContainer>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                        No content mix data
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Heart className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm text-center">No engagement breakdown data available</p>
                    <p className="text-xs text-center mt-2">Data will appear as players post and engage</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Posts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg sm:text-xl">Top Performing Posts</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Posts with highest engagement</CardDescription>
              </CardHeader>
              <CardContent>
                {postAnalyticsLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                  </div>
                ) : postAnalytics?.topPosts && postAnalytics.topPosts.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {postAnalytics.topPosts.slice(0, 5).map((post: any, index: number) => (
                      <div key={post.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 border rounded-lg">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/20 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base truncate">{post.studentName}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">{post.sport || 'No sport'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                          <div className="flex items-center space-x-1">
                            <Heart className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>{post.likes || 0}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>{post.comments || 0}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>{post.views || 0}</span>
                          </div>
                          <Badge className="text-xs">{post.engagement || 0} total</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
                    <TrendingUp className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm text-center">No top posts data available</p>
                    <p className="text-xs text-center mt-2">Posts will appear here as players engage</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-4 sm:space-y-8">
            {studentEngagementLoading ? (
              <div className="space-y-4 sm:space-y-8">
                <Card>
                  <CardContent className="p-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : studentEngagement ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base sm:text-lg">Active Players</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl sm:text-3xl font-bold">{studentEngagement.activeStudents || 0}</div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                        {studentEngagement.activePercentage ? studentEngagement.activePercentage.toFixed(1) : '0.0'}% of total players
                      </p>
            </CardContent>
          </Card>
        </div>

                {/* Engagement Distribution */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg sm:text-xl">Engagement Distribution</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Number of players by engagement level</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {studentEngagement.engagementDistribution && studentEngagement.engagementDistribution.length > 0 ? (
                      <div className="w-full overflow-x-auto">
                        <ResponsiveContainer width="100%" height={300} minHeight={250}>
                          <BarChart data={studentEngagement.engagementDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Bar dataKey="count" fill="#FFD700" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-64 sm:h-96 flex flex-col items-center justify-center text-muted-foreground p-4">
                        <Users className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-sm text-center">No engagement distribution data available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-8">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Users className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm text-center">No player engagement data available</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Top Performers */}
        <Card data-testid="top-performers" className="mt-4 sm:mt-8">
          <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg sm:text-xl">
              <Trophy className="w-5 h-5 mr-2 text-accent" />
              Top Engaged Players
              </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Players with highest engagement and platform activity</CardDescription>
            </CardHeader>
            <CardContent>
            {analytics?.engagementStats && analytics.engagementStats.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {analytics.engagementStats
                  .sort((a, b) => b.totalEngagement - a.totalEngagement)
                  .slice(0, 6)
                  .map((stat, index) => {
                    const student = students?.find(s => s.id === stat.studentId);
                    return (
                      <div
                        key={stat.studentId}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-muted rounded-lg"
                        data-testid={`top-student-${index}`}
                      >
                        <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs sm:text-sm font-bold text-accent">#{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate">{student?.name || 'Unknown'}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {stat.totalPosts} post{stat.totalPosts !== 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {stat.totalFollowers} follower{stat.totalFollowers !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs flex-shrink-0">
                            {stat.totalEngagement.toLocaleString()} eng
                        </Badge>
                          <span className="text-xs text-muted-foreground">
                            {stat.avgEngagementPerPost} avg/post
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
                <Trophy className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm text-center">No engagement data yet</p>
                <p className="text-xs text-center mt-2">Top players will appear as they post and engage</p>
              </div>
            )}
            </CardContent>
          </Card>

        {/* Summary Insights */}
        <Card className="mt-4 sm:mt-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg sm:text-xl">Insights Summary</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Key insights based on {period === 'day' ? 'the last 24 hours' : period === 'week' ? 'the last 7 days' : period === 'month' ? 'the last 30 days' : 'all time'} data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-green-600 dark:text-green-400 text-sm sm:text-base flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Strengths & Highlights
                </h4>
                <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                  {(() => {
                    const strengths: JSX.Element[] = [];

                    // Engagement Score Insight
                    if (analytics && analytics.averageEngagementScore > 0) {
                      if (analytics.averageEngagementScore >= 50) {
                        strengths.push(
                          <li key="score-strong" className="flex items-start">
                            <span className="mr-2 text-green-600">•</span>
                            <span>Strong platform engagement score of <strong className="text-foreground">{analytics.averageEngagementScore.toFixed(0)}/100</strong> indicating active participation</span>
                          </li>
                        );
                      } else {
                        strengths.push(
                          <li key="score-growing" className="flex items-start">
                            <span className="mr-2 text-green-600">•</span>
                            <span>Engagement score of <strong className="text-foreground">{analytics.averageEngagementScore.toFixed(0)}/100</strong> shows growing platform activity</span>
                          </li>
                        );
                      }
                    }

                    // Post Activity Insight with Period Context
                    if (schoolStats && schoolStats.totalPosts > 0) {
                      const periodLabel = period === 'day' ? 'today' : period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'overall';
                      const isStrongActivity = schoolStats.totalPosts > (period === 'day' ? 5 : period === 'week' ? 20 : period === 'month' ? 50 : 100);
                      
                      strengths.push(
                        <li key="posts" className="flex items-start">
                          <span className="mr-2 text-green-600">•</span>
                          <span><strong className="text-foreground">{schoolStats.totalPosts}</strong> content {schoolStats.totalPosts === 1 ? 'post' : 'posts'} {periodLabel} {isStrongActivity ? 'showing strong content creation' : 'created by players'}</span>
                        </li>
                      );

                      // Post Growth Trend
                      if (schoolStats.previousPeriodPosts !== undefined && schoolStats.previousPeriodPosts > 0) {
                        const growth = ((schoolStats.totalPosts - schoolStats.previousPeriodPosts) / schoolStats.previousPeriodPosts) * 100;
                        if (growth > 10) {
                          strengths.push(
                            <li key="post-growth" className="flex items-start">
                              <span className="mr-2 text-green-600">•</span>
                              <span>Post creation <strong className="text-foreground">increased by {Math.abs(growth).toFixed(0)}%</strong> compared to previous period</span>
                            </li>
                          );
                        }
                      }
                    }

                    // Engagement Growth Trend
                    if (schoolStats && schoolStats.previousPeriodEngagement !== undefined && schoolStats.previousPeriodEngagement > 0) {
                      const engagementGrowth = ((schoolStats.totalEngagement - schoolStats.previousPeriodEngagement) / schoolStats.previousPeriodEngagement) * 100;
                      if (engagementGrowth > 10) {
                        strengths.push(
                          <li key="engagement-growth" className="flex items-start">
                            <span className="mr-2 text-green-600">•</span>
                            <span>Total engagement <strong className="text-foreground">increased by {Math.abs(engagementGrowth).toFixed(0)}%</strong> compared to previous period</span>
                          </li>
                        );
                      }
                    }

                    // Engagement Per Student
                    if (analytics && analytics.averageEngagementPerStudent > 0) {
                      if (analytics.averageEngagementPerStudent > 10) {
                        strengths.push(
                          <li key="high-engagement-rate" className="flex items-start">
                            <span className="mr-2 text-green-600">•</span>
                            <span>High engagement rate with <strong className="text-foreground">{analytics.averageEngagementPerStudent.toFixed(1)}</strong> interactions per active player</span>
                          </li>
                        );
                      } else {
                        strengths.push(
                          <li key="engagement-rate" className="flex items-start">
                            <span className="mr-2 text-green-600">•</span>
                            <span>Average of <strong className="text-foreground">{analytics.averageEngagementPerStudent.toFixed(1)}</strong> engagement interactions per active player</span>
                          </li>
                        );
                      }
                    }

                    // Total Engagement
                    if (schoolStats && schoolStats.totalEngagement > 0) {
                      const periodLabel = period === 'day' ? 'today' : period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'overall';
                      strengths.push(
                        <li key="total-engagement" className="flex items-start">
                          <span className="mr-2 text-green-600">•</span>
                          <span><strong className="text-foreground">{schoolStats.totalEngagement.toLocaleString()}</strong> total engagement interactions {periodLabel}</span>
                        </li>
                      );
                    }

                    // Active Students
                    if (analytics && analytics.engagementStats && analytics.engagementStats.length > 0) {
                      const periodLabel = period === 'day' ? 'today' : period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'overall';
                      strengths.push(
                        <li key="active-students" className="flex items-start">
                          <span className="mr-2 text-green-600">•</span>
                          <span><strong className="text-foreground">{analytics.engagementStats.length}</strong> {analytics.engagementStats.length === 1 ? 'player is' : 'players are'} actively creating and engaging with content {periodLabel}</span>
                        </li>
                      );
                    }

                    // Engagement Trends (upward)
                    if (engagementTrends && engagementTrends.length > 1) {
                      const recent = engagementTrends.slice(-Math.min(3, Math.floor(engagementTrends.length / 3)));
                      const older = engagementTrends.slice(0, -Math.min(3, Math.floor(engagementTrends.length / 3)));
                      if (older.length > 0 && recent.length > 0) {
                        const recentAvg = recent.reduce((sum: number, item: any) => sum + (item.engagement || 0), 0) / recent.length;
                        const olderAvg = older.reduce((sum: number, item: any) => sum + (item.engagement || 0), 0) / older.length;
                        if (recentAvg > olderAvg * 1.1 && olderAvg > 0) {
                          const trendPercent = ((recentAvg - olderAvg) / olderAvg) * 100;
                          strengths.push(
                            <li key="trending-up" className="flex items-start">
                              <span className="mr-2 text-green-600">•</span>
                              <span>Engagement is <strong className="text-foreground">trending upward</strong> with {trendPercent.toFixed(0)}% increase in recent activity</span>
                            </li>
                          );
                        }
                      }
                    }

                    // Post Trends (increasing)
                    if (postTrends && postTrends.length > 1) {
                      const recent = postTrends.slice(-Math.min(3, Math.floor(postTrends.length / 3)));
                      const older = postTrends.slice(0, -Math.min(3, Math.floor(postTrends.length / 3)));
                      if (older.length > 0 && recent.length > 0) {
                        const recentAvg = recent.reduce((sum: number, item: any) => sum + (item.posts || 0), 0) / recent.length;
                        const olderAvg = older.reduce((sum: number, item: any) => sum + (item.posts || 0), 0) / older.length;
                        if (recentAvg > olderAvg * 1.2 && olderAvg > 0) {
                          const trendPercent = ((recentAvg - olderAvg) / olderAvg) * 100;
                          strengths.push(
                            <li key="post-trending-up" className="flex items-start">
                              <span className="mr-2 text-green-600">•</span>
                              <span>Posting frequency is <strong className="text-foreground">increasing</strong> with {trendPercent.toFixed(0)}% more posts in recent period</span>
                            </li>
                          );
                        }
                      }
                    }

                    // Content Mix
                    if (postAnalytics && postAnalytics.contentMix && postAnalytics.contentMix.images > 0 && postAnalytics.contentMix.videos > 0) {
                      strengths.push(
                        <li key="content-mix" className="flex items-start">
                          <span className="mr-2 text-green-600">•</span>
                          <span>Healthy content mix with both images and videos being shared</span>
                        </li>
                      );
                    }

                    // Student Distribution
                    if (analytics && analytics.totalStudents > 0 && Object.keys(analytics.gradeDistribution || {}).length > 2) {
                      strengths.push(
                        <li key="grade-distribution" className="flex items-start">
                          <span className="mr-2 text-green-600">•</span>
                          <span>Well-distributed player body across <strong className="text-foreground">{Object.keys(analytics.gradeDistribution).length}</strong> grade levels</span>
                        </li>
                      );
                    }

                    // Engagement Breakdown Highlights
                    if (postAnalytics && postAnalytics.engagementBreakdown) {
                      const { likes = 0, comments = 0, views = 0, saves = 0 } = postAnalytics.engagementBreakdown;
                      const total = likes + comments + saves;
                      if (total > 0) {
                        if (comments / total > 0.3) {
                          strengths.push(
                            <li key="high-comments" className="flex items-start">
                              <span className="mr-2 text-green-600">•</span>
                              <span>Strong conversation activity with high comment-to-like ratio ({((comments / total) * 100).toFixed(0)}% comments)</span>
                            </li>
                          );
                        }
                        if (views > 0 && views > (likes + comments) * 3) {
                          strengths.push(
                            <li key="high-views" className="flex items-start">
                              <span className="mr-2 text-green-600">•</span>
                              <span>High content visibility with <strong className="text-foreground">{views.toLocaleString()}</strong> total views</span>
                            </li>
                          );
                        }
                        if (saves > 0 && saves / total > 0.15) {
                          strengths.push(
                            <li key="high-saves" className="flex items-start">
                              <span className="mr-2 text-green-600">•</span>
                              <span>Strong save rate ({((saves / total) * 100).toFixed(0)}%) indicating valuable, bookmark-worthy content</span>
                            </li>
                          );
                        }
                      }
                    }

                    // Student Engagement Activity
                    if (studentEngagement && studentEngagement.activePercentage > 0) {
                      if (studentEngagement.activePercentage >= 70) {
                        strengths.push(
                          <li key="high-participation" className="flex items-start">
                            <span className="mr-2 text-green-600">•</span>
                            <span>Excellent participation rate with <strong className="text-foreground">{studentEngagement.activePercentage.toFixed(1)}%</strong> of players actively engaging</span>
                          </li>
                        );
                      } else if (studentEngagement.activePercentage >= 50) {
                        strengths.push(
                          <li key="good-participation" className="flex items-start">
                            <span className="mr-2 text-green-600">•</span>
                            <span>Good participation with <strong className="text-foreground">{studentEngagement.activePercentage.toFixed(1)}%</strong> of players actively engaging</span>
                          </li>
                        );
                      }
                    }

                    // Empty State for Strengths
                    if (strengths.length === 0) {
                      if (!analytics || analytics.totalStudents === 0) {
                        strengths.push(
                          <li key="empty" className="flex items-start text-muted-foreground">
                            <span className="mr-2">•</span>
                            <span>Start encouraging players to create content to see insights here</span>
                          </li>
                        );
                      } else {
                        strengths.push(
                          <li key="no-data-period" className="flex items-start text-muted-foreground">
                            <span className="mr-2">•</span>
                            <span>No activity in the selected time period - try selecting a different period or encourage more engagement</span>
                          </li>
                        );
                      }
                    }

                    return strengths;
                  })()}
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-amber-600 dark:text-amber-400 text-sm sm:text-base flex items-center">
                  <Activity className="w-4 h-4 mr-2" />
                  Opportunities & Growth Areas
                </h4>
                <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                  {(() => {
                    const opportunities: JSX.Element[] = [];

                    // Low Student Participation
                    if (analytics && analytics.totalStudents > 0 && analytics.engagementStats) {
                      const participationRate = (analytics.engagementStats.length / analytics.totalStudents) * 100;
                      if (participationRate < 50) {
                        opportunities.push(
                          <li key="participation" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>Only <strong className="text-foreground">{participationRate.toFixed(0)}%</strong> of players ({analytics.engagementStats.length} of {analytics.totalStudents}) are actively posting - encourage more participation</span>
                          </li>
                        );
                      } else if (analytics.totalStudents > 1 && analytics.engagementStats.length === 1) {
                        opportunities.push(
                          <li key="participation" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>Only <strong className="text-foreground">{analytics.engagementStats.length} of {analytics.totalStudents}</strong> players are posting - encourage others to start sharing content</span>
                          </li>
                        );
                      }
                    } else if (studentEngagement && studentEngagement.activePercentage > 0 && studentEngagement.activePercentage < 50) {
                      opportunities.push(
                        <li key="participation" className="flex items-start">
                          <span className="mr-2 text-amber-600">•</span>
                          <span>Only <strong className="text-foreground">{studentEngagement.activePercentage.toFixed(1)}%</strong> of players are actively engaging - increase awareness and participation</span>
                        </li>
                      );
                    }

                    // Engagement Score Improvement
                    if (analytics && analytics.averageEngagementScore > 0) {
                      if (analytics.averageEngagementScore < 30) {
                        opportunities.push(
                          <li key="score-low" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>Engagement score of <strong className="text-foreground">{analytics.averageEngagementScore.toFixed(0)}/100</strong> is below optimal - focus on increasing interactions</span>
                          </li>
                        );
                      } else if (analytics.averageEngagementScore < 50) {
                        opportunities.push(
                          <li key="score-medium" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>Engagement score of <strong className="text-foreground">{analytics.averageEngagementScore.toFixed(0)}/100</strong> has room for growth - aim for 70+ to reach optimal engagement</span>
                          </li>
                        );
                      } else if (analytics.averageEngagementScore < 70) {
                        opportunities.push(
                          <li key="score-good" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>Engagement score is good at <strong className="text-foreground">{analytics.averageEngagementScore.toFixed(0)}/100</strong> - push towards 70+ for excellent performance</span>
                          </li>
                        );
                      }
                    }

                    // Content Mix Opportunities
                    if (postAnalytics && postAnalytics.contentMix) {
                      if (postAnalytics.contentMix.videos === 0 && postAnalytics.contentMix.images > 0) {
                        opportunities.push(
                          <li key="no-videos" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>No video content yet - video posts typically drive <strong className="text-foreground">3x more engagement</strong> than images</span>
                          </li>
                        );
                      } else if (postAnalytics.contentMix.videos > 0 && postAnalytics.contentMix.images > postAnalytics.contentMix.videos * 3) {
                        opportunities.push(
                          <li key="more-videos" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>More video content could boost engagement - videos receive significantly more interactions</span>
                          </li>
                        );
                      }
                    }

                    // Engagement Per Post Analysis
                    if (analytics && analytics.engagementStats && analytics.engagementStats.length > 0) {
                      const avgEngPerPost = analytics.engagementStats.reduce((sum: number, stat: any) => sum + stat.avgEngagementPerPost, 0) / analytics.engagementStats.length;
                      if (avgEngPerPost < 5 && avgEngPerPost > 0) {
                        opportunities.push(
                          <li key="low-eng-per-post" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>Low engagement per post (<strong className="text-foreground">{avgEngPerPost.toFixed(1)}</strong> avg) - encourage players to interact more with each other's content</span>
                          </li>
                        );
                      } else if (avgEngPerPost >= 5 && avgEngPerPost < 10) {
                        opportunities.push(
                          <li key="moderate-eng-per-post" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>Engagement per post is decent at <strong className="text-foreground">{avgEngPerPost.toFixed(1)}</strong> - aim for 10+ interactions per post for stronger engagement</span>
                          </li>
                        );
                      }
                    }

                    // Engagement Breakdown Analysis
                    if (postAnalytics && postAnalytics.engagementBreakdown) {
                      const { likes = 0, comments = 0, views = 0, saves = 0 } = postAnalytics.engagementBreakdown;
                      const total = likes + comments + saves;
                      if (total > 0) {
                        const commentRatio = comments / total;
                        if (commentRatio < 0.15) {
                          opportunities.push(
                            <li key="low-comments" className="flex items-start">
                              <span className="mr-2 text-amber-600">•</span>
                              <span>Comment activity is low ({((commentRatio * 100).toFixed(0))}% of engagement) - encourage meaningful conversations and feedback</span>
                            </li>
                          );
                        }
                        if (saves === 0) {
                          opportunities.push(
                            <li key="no-saves" className="flex items-start">
                              <span className="mr-2 text-amber-600">•</span>
                              <span>No saved content yet - saves indicate high-quality, valuable posts that players want to revisit</span>
                            </li>
                          );
                        } else if (saves / total < 0.1) {
                          opportunities.push(
                            <li key="few-saves" className="flex items-start">
                              <span className="mr-2 text-amber-600">•</span>
                              <span>Low save rate ({((saves / total) * 100).toFixed(0)}%) - focus on creating more valuable, bookmark-worthy content</span>
                            </li>
                          );
                        }
                      }
                    }

                    // Declining Engagement Trend
                    if (engagementTrends && engagementTrends.length > 3) {
                      const recent = engagementTrends.slice(-3);
                      const older = engagementTrends.slice(0, -3);
                      if (older.length > 0) {
                        const recentAvg = recent.reduce((sum: number, item: any) => sum + (item.engagement || 0), 0) / recent.length;
                        const olderAvg = older.reduce((sum: number, item: any) => sum + (item.engagement || 0), 0) / older.length;
                        if (recentAvg < olderAvg * 0.8 && olderAvg > 0) {
                          opportunities.push(
                            <li key="declining-trend" className="flex items-start">
                              <span className="mr-2 text-amber-600">•</span>
                              <span>Recent engagement is declining ({((recentAvg / olderAvg) * 100).toFixed(0)}% of previous average) - consider incentives or campaigns to boost activity</span>
                            </li>
                          );
                        }
                      }
                    }

                    // Post Frequency Analysis with Period Context
                    if (schoolStats) {
                      const periodLabel = period === 'day' ? 'today' : period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'overall';
                      const threshold = period === 'day' ? 3 : period === 'week' ? 10 : period === 'month' ? 30 : 100;
                      
                      if (schoolStats.totalPosts > 0 && schoolStats.totalPosts < threshold) {
                        opportunities.push(
                          <li key="few-posts" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>Only <strong className="text-foreground">{schoolStats.totalPosts}</strong> {schoolStats.totalPosts === 1 ? 'post' : 'posts'} {periodLabel} - encourage more frequent content sharing</span>
                          </li>
                        );
                      } else if (schoolStats.totalPosts === 0) {
                        opportunities.push(
                          <li key="no-posts" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>No posts {periodLabel} - encourage players to start sharing content</span>
                          </li>
                        );
                      }

                      // Declining Posts Trend
                      if (schoolStats.previousPeriodPosts !== undefined && schoolStats.previousPeriodPosts > 0 && schoolStats.totalPosts > 0) {
                        const decline = ((schoolStats.previousPeriodPosts - schoolStats.totalPosts) / schoolStats.previousPeriodPosts) * 100;
                        if (decline > 20) {
                          opportunities.push(
                            <li key="declining-posts" className="flex items-start">
                              <span className="mr-2 text-amber-600">•</span>
                              <span>Post creation <strong className="text-foreground">decreased by {decline.toFixed(0)}%</strong> compared to previous period - encourage consistent posting</span>
                            </li>
                          );
                        }
                      }

                      // Declining Engagement Trend
                      if (schoolStats.previousPeriodEngagement !== undefined && schoolStats.previousPeriodEngagement > 0 && schoolStats.totalEngagement > 0) {
                        const decline = ((schoolStats.previousPeriodEngagement - schoolStats.totalEngagement) / schoolStats.previousPeriodEngagement) * 100;
                        if (decline > 20) {
                          opportunities.push(
                            <li key="declining-engagement-stats" className="flex items-start">
                              <span className="mr-2 text-amber-600">•</span>
                              <span>Total engagement <strong className="text-foreground">decreased by {decline.toFixed(0)}%</strong> - focus on increasing interactions</span>
                            </li>
                          );
                        }
                      }
                    } else if (postTrends && postTrends.length > 0) {
                      const postsWithData = postTrends.filter((item: any) => (item.posts || 0) > 0);
                      if (postsWithData.length === 0) {
                        opportunities.push(
                          <li key="no-posts-period" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>No posts in the selected time period - encourage players to start sharing content</span>
                          </li>
                        );
                      }
                    }

                    // Follower Activity
                    if (analytics && analytics.engagementStats && analytics.engagementStats.length > 0) {
                      const avgFollowers = analytics.engagementStats.reduce((sum: number, stat: any) => sum + stat.totalFollowers, 0) / analytics.engagementStats.length;
                      if (avgFollowers < 3) {
                        opportunities.push(
                          <li key="low-followers" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>Average follower count is low (<strong className="text-foreground">{avgFollowers.toFixed(1)}</strong> per player) - encourage players to follow and connect with each other</span>
                          </li>
                        );
                      }
                    }

                    // Growth Recommendations (Always show if no specific issues found)
                    if (opportunities.length === 0 && analytics && analytics.totalStudents > 0) {
                      if (schoolStats && schoolStats.totalPosts > 0) {
                        opportunities.push(
                          <li key="general-growth" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>Maintain consistent posting schedule to build momentum and increase platform engagement</span>
                          </li>
                        );
                        if (analytics.totalStudents > analytics.engagementStats?.length) {
                          opportunities.push(
                            <li key="expand-participation" className="flex items-start">
                              <span className="mr-2 text-amber-600">•</span>
                              <span>Encourage more players to join the platform and start sharing content to grow your community</span>
                            </li>
                          );
                        }
                      } else {
                        opportunities.push(
                          <li key="start-posting" className="flex items-start">
                            <span className="mr-2 text-amber-600">•</span>
                            <span>Start encouraging players to create and share content regularly to build engagement</span>
                          </li>
                        );
                      }
                      
                      if (analytics.averageEngagementScore >= 70 && schoolStats && schoolStats.totalPosts > 10) {
                        opportunities.push(
                          <li key="excellent-metrics" className="flex items-start text-green-600 dark:text-green-400">
                            <span className="mr-2">•</span>
                            <span>Excellent engagement metrics! Continue maintaining this high level of activity</span>
                          </li>
                        );
                      }
                    }

                    // Empty State
                    if (opportunities.length === 0) {
                      if (!analytics || analytics.totalStudents === 0) {
                        opportunities.push(
                          <li key="empty-state" className="flex items-start text-muted-foreground">
                            <span className="mr-2">•</span>
                            <span>Add players and encourage content creation to unlock growth insights</span>
                          </li>
                        );
                      }
                    }

                    return opportunities;
                  })()}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}