import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import StatsCard from "@/components/stats/stats-card";
import { Users, FileText, Heart, Trophy, UserPlus, BarChart3, Settings, LogOut, Search, Clock, Image, Video, RefreshCw, ChevronRight, Megaphone, TrendingUp, TrendingDown, Eye, MessageCircle, Bookmark, Activity, Award, Target, Zap, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnouncementModal } from "@/components/ui/announcement-modal";
import { AnnouncementManagement } from "@/components/admin/announcement-management";
import { DashboardBanner } from "@/components/ui/dashboard-banner";
import { StudentLimitCard } from "@/components/school/student-limit-card";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Types for our API responses
interface RecentActivity {
  id: string;
  studentId: string;
  studentName: string;
  studentProfilePic?: string;
  sport?: string;
  postType: 'image' | 'video';
  content?: string;
  mediaUrl?: string;
  createdAt: string;
  engagement: number;
  likes: number;
  comments: number;
}

interface TopPerformer {
  studentId: string;
  studentName: string;
  studentProfilePic?: string;
  sport?: string;
  totalEngagement: number;
  postsCount: number;
  mediaUrl?: string;
}

interface SchoolStats {
  totalStudents: number;
  totalPosts: number;
  totalEngagement: number;
  activeSports: number;
  previousPeriodPosts?: number;
  previousPeriodEngagement?: number;
}

interface EngagementBreakdown {
  likes: number;
  comments: number;
  views: number;
  saves: number;
  total: number;
}

const COLORS = ['#FFD700', '#4ECDC4', '#FF6B6B', '#95E1D3', '#F38181', '#AA96DA'];

// Helper function to format time ago
function timeAgo(date: string): string {
  const now = new Date();
  const postDate = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

// Skeleton components for loading states
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-12 w-12 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="p-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TopPerformersSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center space-x-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SchoolAdmin() {
  const { user, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<string>("month");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAllPerformers, setShowAllPerformers] = useState(false);
  
  // Limit items for better UX
  const ACTIVITY_LIMIT = 5;
  const PERFORMERS_LIMIT = 5;

  const handleLogout = () => {
    logout(); // logout() now handles clearing data and redirecting
  };

  const handleAddStudent = () => {
    setLocation("/school-admin/add-student");
  };

  const handleViewReports = () => {
    setLocation("/school-admin/live-reports");
  };

  const handleStudentSearch = () => {
    setLocation("/school-admin/student-search");
  };

  const handleRefreshData = () => {
    console.log("🔄 Refreshing dashboard data for schoolId:", user?.schoolId);
    
    // Invalidate and refetch all school admin dashboard queries
    queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "recent-activity"] });
    queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "top-performers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId] });
    queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "analytics", "engagement-trends"] });
    queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "analytics", "posts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "analytics", "student-engagement"] });
    
    // Also invalidate any related queries that might affect the dashboard
    queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "students"] });
    queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    
    toast({
      title: "Data Refreshed",
      description: "Dashboard data has been refreshed with the latest information.",
    });
  };

  // Fetch school info with caching
  const { data: schoolInfo, isLoading: schoolLoading } = useQuery<{
    id: string;
    name: string;
    subscriptionPlan: string;
    maxStudents: number;
  }>({
    queryKey: ["/api/schools", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("No school ID available");
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${user.schoolId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch school info");
      return response.json();
    },
    enabled: !!user?.schoolId,
    staleTime: 10000, // Cache for 10 seconds (reduced for better responsiveness)
  });

  // Fetch school stats with caching and period
  const { data: schoolStats, isLoading: statsLoading } = useQuery<SchoolStats & { previousPeriodPosts?: number; previousPeriodEngagement?: number }>({
    queryKey: ["/api/schools", user?.schoolId, "stats", period],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("No school ID available");
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${user.schoolId}/stats?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch school stats");
      const data = await response.json();
      console.log("📊 School stats received:", data);
      return data;
    },
    enabled: !!user?.schoolId,
    staleTime: 10000, // Cache for 10 seconds (reduced for better responsiveness)
  });

  // Fetch recent activity with caching
  const { data: recentActivity, isLoading: activityLoading } = useQuery<RecentActivity[]>({
    queryKey: ["/api/schools", user?.schoolId, "recent-activity"],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("No school ID available");
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${user.schoolId}/recent-activity?limit=5`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch recent activity");
      const data = await response.json();
      console.log("📈 Recent activity received:", data);
      return data;
    },
    enabled: !!user?.schoolId,
    staleTime: 10000, // Cache for 10 seconds (reduced for better responsiveness)
  });

  // Fetch top performers with caching
  const { data: topPerformers, isLoading: performersLoading } = useQuery<TopPerformer[]>({
    queryKey: ["/api/schools", user?.schoolId, "top-performers"],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("No school ID available");
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${user.schoolId}/top-performers?limit=5`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch top performers");
      const data = await response.json();
      console.log("🏆 Top performers received:", data);
      return data;
    },
    enabled: !!user?.schoolId,
    staleTime: 10000,
  });

  // Fetch engagement trends for mini chart
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
    staleTime: 10000,
  });

  // Fetch post analytics for breakdown (period-aware)
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
    staleTime: 10000,
  });

  // Fetch student engagement metrics
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
    staleTime: 10000,
  });

  // Calculate trend percentages (after all queries are defined)
  const postsTrend = schoolStats?.previousPeriodPosts !== undefined && schoolStats.previousPeriodPosts > 0
    ? ((schoolStats.totalPosts - schoolStats.previousPeriodPosts) / schoolStats.previousPeriodPosts) * 100
    : undefined;
  
  const engagementTrend = schoolStats?.previousPeriodEngagement !== undefined && schoolStats.previousPeriodEngagement > 0
    ? ((schoolStats.totalEngagement - schoolStats.previousPeriodEngagement) / schoolStats.previousPeriodEngagement) * 100
    : undefined;

  // Process engagement trends for chart
  const engagementChartData = engagementTrends && engagementTrends.length > 0
    ? engagementTrends.map(item => {
        try {
          const dateValue = typeof item.date === 'string' 
            ? (item.date.includes('T') || item.date.includes(':'))
              ? new Date(item.date)
              : new Date(item.date + 'T00:00:00')
            : new Date(item.date);
          
          return {
            date: dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            engagement: item.engagement || 0,
          };
        } catch (e) {
          return {
            date: String(item.date),
            engagement: item.engagement || 0,
          };
        }
      })
    : [];

  // Calculate engagement breakdown
  const engagementBreakdown: EngagementBreakdown | null = postAnalytics?.engagementBreakdown 
    ? {
        likes: postAnalytics.engagementBreakdown.likes || 0,
        comments: postAnalytics.engagementBreakdown.comments || 0,
        views: postAnalytics.engagementBreakdown.views || 0,
        saves: postAnalytics.engagementBreakdown.saves || 0,
        total: postAnalytics.engagementBreakdown.total || 0,
      }
    : null;

  // Prepare breakdown data for pie chart
  const breakdownChartData = engagementBreakdown && engagementBreakdown.total > 0
    ? [
        { name: 'Likes', value: engagementBreakdown.likes, color: '#FF6B6B' },
        { name: 'Comments', value: engagementBreakdown.comments, color: '#4ECDC4' },
        { name: 'Views', value: engagementBreakdown.views, color: '#95E1D3' },
        { name: 'Saves', value: engagementBreakdown.saves, color: '#FFD700' },
      ].filter(item => item.value > 0)
    : [];

  // Calculate key metrics (period-aware)
  const activeStudentPercentage = schoolStats && schoolStats.totalStudents > 0 && studentEngagement
    ? ((studentEngagement.activeStudents || 0) / schoolStats.totalStudents * 100).toFixed(1)
    : '0';

  const avgEngagementPerStudent = schoolStats && schoolStats.totalStudents > 0 && schoolStats.totalEngagement > 0
    ? (schoolStats.totalEngagement / schoolStats.totalStudents).toFixed(1)
    : '0';

  const avgEngagementPerPost = schoolStats && schoolStats.totalPosts > 0 && schoolStats.totalEngagement > 0
    ? (schoolStats.totalEngagement / schoolStats.totalPosts).toFixed(1)
    : '0';

  // Show loading state for initial data fetch
  if ((statsLoading && !schoolStats) || (schoolLoading && !schoolInfo)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
        </div>
        
        {/* Page Title */}
        <div className="mb-8 px-4 sm:px-6 lg:px-8 pt-8">
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">Academy Dashboard</h1>
              <p className="text-muted-foreground text-sm lg:text-base">
                {schoolLoading ? "Loading..." : schoolInfo?.name || "Academy Not Found"}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                onClick={handleRefreshData}
                variant="outline"
                size="sm"
                className="p-2"
                data-testid="button-refresh-data"
                title="Refresh Data"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Last 7 days</SelectItem>
                  <SelectItem value="month">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAddStudent}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                data-testid="button-add-student"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Player
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-8">
            {/* Dashboard Banners */}
            <DashboardBanner />
            
            {/* Student Enrollment Limit Card */}
            <div className="mb-8">
              <StudentLimitCard />
            </div>
            
            {/* Advanced KPI Cards */}
            {statsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-3">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-8 w-16" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Posts</CardTitle>
                      <FileText className="h-4 w-4 text-blue-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{schoolStats?.totalPosts || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {period === "week" ? "Last 7 days" : period === "month" ? "Last 30 days" : "All time"}
                      {postsTrend !== undefined && (
                        <span className={`ml-2 ${postsTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {postsTrend >= 0 ? '↑' : '↓'} {Math.abs(postsTrend).toFixed(1)}%
                        </span>
                      )}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Active Players</CardTitle>
                      <Activity className="h-4 w-4 text-green-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{activeStudentPercentage}%</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {studentEngagement?.activeStudents || 0} of {schoolStats?.totalStudents || 0} players
                      <span className="block mt-1">{period === "week" ? "Last 7 days" : period === "month" ? "Last 30 days" : "All time"}</span>
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Avg Engagement/Player</CardTitle>
                      <Zap className="h-4 w-4 text-purple-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{avgEngagementPerStudent}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Interactions per player
                      <span className="block mt-1">{period === "week" ? "Last 7 days" : period === "month" ? "Last 30 days" : "All time"}</span>
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Players</CardTitle>
                      <Users className="h-4 w-4 text-amber-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{schoolStats?.totalStudents || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Registered to academy</p>
                  </CardContent>
                </Card>
              </div>
            )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Engagement Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement Trends</CardTitle>
              <CardDescription>
                Total engagement over {period === 'week' ? 'the last 7 days' : period === 'month' ? 'the last 30 days' : 'all time'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : engagementChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={engagementChartData}>
                    <defs>
                      <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#FFD700" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="engagement" stroke="#FFD700" fillOpacity={1} fill="url(#colorEngagement)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No engagement data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Engagement Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement Breakdown</CardTitle>
              <CardDescription>
                Distribution of engagement types {period === 'week' ? 'over the last 7 days' : period === 'month' ? 'over the last 30 days' : 'overall'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {postAnalyticsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : breakdownChartData.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={breakdownChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {breakdownChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                    {engagementBreakdown && (
                      <>
                        <div className="flex items-center space-x-2">
                          <Heart className="w-4 h-4 text-red-500" />
                          <div>
                            <p className="text-sm font-medium">{engagementBreakdown.likes.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Likes</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MessageCircle className="w-4 h-4 text-blue-500" />
                          <div>
                            <p className="text-sm font-medium">{engagementBreakdown.comments.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Comments</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Eye className="w-4 h-4 text-green-500" />
                          <div>
                            <p className="text-sm font-medium">{engagementBreakdown.views.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Views</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Bookmark className="w-4 h-4 text-yellow-500" />
                          <div>
                            <p className="text-sm font-medium">{engagementBreakdown.saves.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Saves</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <PieChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No engagement breakdown data</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* School Management - First on mobile, second on desktop */}
          <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
            {/* Top Performing Students */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Top Performers</h2>
                    <p className="text-sm text-muted-foreground">
                      Most engaged students {period === "week" ? "this week" : period === "month" ? "this month" : "overall"}
                    </p>
                  </div>
                  {topPerformers && topPerformers.length > PERFORMERS_LIMIT && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllPerformers(!showAllPerformers)}
                      className="text-xs sm:text-sm"
                    >
                      {showAllPerformers ? "Show Less" : "View All"}
                      <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${showAllPerformers ? 'rotate-90' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
              {/* Debug logging for performers data */}
              {topPerformers && (() => {
                console.log("🏆 Rendering performers with data:", topPerformers);
                return null;
              })()}
              
              {performersLoading ? (
                <TopPerformersSkeleton />
              ) : topPerformers && topPerformers.length > 0 ? (
                <div className="max-h-[500px] overflow-y-auto">
                  <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
                    {(showAllPerformers ? topPerformers : topPerformers.slice(0, PERFORMERS_LIMIT)).map((performer, index) => (
                      <div key={performer.studentId} className="flex items-center space-x-3">
                        <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          index === 0 ? 'bg-accent' : 
                          index === 1 ? 'bg-secondary/80' : 
                          'bg-muted'
                        }`}>
                          <span className={`text-xs sm:text-sm font-bold ${
                            index === 0 ? 'text-accent-foreground' : 
                            index === 1 ? 'text-secondary-foreground' : 
                            'text-muted-foreground'
                          }`}>
                            {index + 1}
                          </span>
                        </div>
                        <Avatar className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 flex-shrink-0">
                          <AvatarImage 
                            src={performer.studentProfilePic || performer.mediaUrl || ""} 
                            alt={performer.studentName} 
                          />
                          <AvatarFallback>{performer.studentName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm sm:text-base truncate">{performer.studentName}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {performer.totalEngagement.toLocaleString()} engagement • {performer.sport}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!showAllPerformers && topPerformers.length > PERFORMERS_LIMIT && (
                    <div className="p-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllPerformers(true)}
                        className="w-full"
                      >
                        Show {topPerformers.length - PERFORMERS_LIMIT} more performers
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No performers yet</p>
                  <p className="text-sm">Students need to post content to appear here</p>
                </div>
              )}
            </div>

            {/* Quick Actions - Accordion on mobile */}
            <div className="bg-card border border-border rounded-xl shadow-sm">
              <Disclosure defaultOpen={true}>
                {({ open }: { open: boolean }) => (
                  <div>
                    <DisclosureButton 
                      className="w-full px-4 sm:px-6 py-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
                      <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
                    </DisclosureButton>
                    <DisclosurePanel className="px-4 sm:px-6 pb-4 sm:pb-6">
                      <div className="space-y-3">
                <Button
                  onClick={handleAddStudent}
                  className="w-full justify-start bg-accent hover:bg-accent/90 text-accent-foreground"
                  data-testid="button-add-new-student"
                >
                  <UserPlus className="w-5 h-5 mr-3" />
                  Add New Student
                </Button>
                <Button
                  onClick={handleViewReports}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-view-reports"
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  View Reports
                </Button>
                <Button
                  onClick={handleStudentSearch}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-student-search"
                >
                  <Search className="w-5 h-5 mr-3" />
                  Student Search & Ratings
                </Button>
                
                <AnnouncementModal userRole="school_admin" schoolId={user?.schoolId || undefined}>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    data-testid="button-create-announcement"
                  >
                    <Megaphone className="w-5 h-5 mr-3" />
                    Create Announcement
                  </Button>
                </AnnouncementModal>
                      </div>
                    </DisclosurePanel>
                  </div>
                )}
              </Disclosure>
            </div>
          </div>

          {/* Recent Activity - Second on mobile, first on desktop */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Recent Student Activity</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {period === "week" ? "Last 7 days" : period === "month" ? "Last 30 days" : "All time"}
                    </p>
                  </div>
                  {recentActivity && recentActivity.length > ACTIVITY_LIMIT && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllActivity(!showAllActivity)}
                      className="text-xs sm:text-sm"
                    >
                      {showAllActivity ? "Show Less" : `View All (${recentActivity.length})`}
                      <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${showAllActivity ? 'rotate-90' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {/* Debug logging for activity data */}
                {recentActivity && (() => {
                  console.log("📈 Rendering activity with data:", recentActivity);
                  return null;
                })()}
                
                {activityLoading ? (
                  <ActivitySkeleton />
                ) : recentActivity && recentActivity.length > 0 ? (
                  <>
                    {(showAllActivity ? recentActivity : recentActivity.slice(0, ACTIVITY_LIMIT)).map((activity) => (
                      <div key={activity.id} className="p-3 sm:p-6 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center space-x-3 sm:space-x-4">
                          <Avatar className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 flex-shrink-0">
                            <AvatarImage 
                              src={activity.studentProfilePic || activity.mediaUrl || ""} 
                              alt={activity.studentName} 
                            />
                            <AvatarFallback>{activity.studentName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm text-foreground">
                              <span className="font-medium">{activity.studentName}</span> posted a new {activity.postType}
                              {activity.content && (
                                <span className="text-muted-foreground">: {activity.content}</span>
                              )}
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 text-xs sm:text-sm text-muted-foreground">
                              <span>{activity.sport}</span>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{timeAgo(activity.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                            {activity.engagement} engagement
                          </div>
                        </div>
                      </div>
                    ))}
                    {!showAllActivity && recentActivity.length > ACTIVITY_LIMIT && (
                      <div className="p-4 text-center border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAllActivity(true)}
                          className="w-full"
                        >
                          Show {recentActivity.length - ACTIVITY_LIMIT} more activities
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No recent activity yet</p>
                    <p className="text-sm">Students haven't posted anything recently</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="announcements" className="space-y-8">
            <AnnouncementManagement userRole="school_admin" schoolId={user?.schoolId || undefined} />
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}