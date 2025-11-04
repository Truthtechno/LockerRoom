import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  Users, 
  DollarSign, 
  Star, 
  TrendingUp,
  TrendingDown,
  Eye, 
  Clock,
  CheckCircle,
  MessageCircle,
  RefreshCw,
  Activity,
  Award,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  BarChart3,
  Calendar
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { timeAgo } from "@/lib/timeAgo";
import { AdminDashboardSkeleton } from "@/components/ui/admin-skeleton";
import { DashboardBanner } from "@/components/ui/dashboard-banner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AnalyticsData {
  totals: {
    total_submissions: number;
    paid: number;
    reviewed: number;
    feedback_sent: number;
    avg_rating: number;
    total_scouts: number;
    total_revenue?: number;
    avg_submission_value?: number;
  };
  topStudents: Array<{
    student_id: string;
    name: string;
    avg_rating: number;
    total_submissions: number;
  }>;
  topSchools: Array<{
    school_id: string;
    name: string;
    avg_rating: number;
    total_submissions: number;
  }>;
}

export default function ScoutAdminDashboard() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<string>("all");
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [showAllSchools, setShowAllSchools] = useState(false);

  // Fetch analytics data
  const { data: analytics, isLoading, error, refetch } = useQuery<AnalyticsData>({
    queryKey: ["/api/xen-watch/analytics/overview", period],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/xen-watch/analytics/overview${period !== 'all' ? `?timeFilter=${period}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      return data;
    },
    enabled: !!user && !authLoading,
    retry: 3,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Fetch recent submissions for activity feed
  const { data: recentSubmissions } = useQuery({
    queryKey: ["/api/xen-watch/admin/submissions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/xen-watch/admin/submissions?limit=10&page=1");
      if (!response.ok) throw new Error('Failed to fetch recent submissions');
      return response.json();
    },
    enabled: !!user && !authLoading,
    retry: 2,
    staleTime: 10000
  });

  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/analytics/overview"] });
    queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/admin/submissions"] });
    refetch();
    toast({
      title: "Data Refreshed",
      description: "Dashboard data has been refreshed with the latest information.",
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-0">
          <AdminDashboardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <div className="text-destructive mb-4">
                Failed to load dashboard
              </div>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate completion rate
  const completionRate = analytics?.totals?.total_submissions 
    ? ((analytics.totals.feedback_sent / analytics.totals.total_submissions) * 100).toFixed(1)
    : '0';

  // Calculate average submissions per scout
  const avgSubmissionsPerScout = analytics?.totals?.total_scouts && analytics.totals.total_scouts > 0
    ? (analytics.totals.total_submissions / analytics.totals.total_scouts).toFixed(1)
    : '0';

  // Format revenue value - show actual amount if < $1k, otherwise show in k format
  const formatRevenue = (revenue: number): string => {
    if (!revenue || revenue === 0) return '$0';
    if (revenue >= 1000) {
      return `$${(revenue / 1000).toFixed(1)}k`;
    }
    return `$${revenue.toFixed(2)}`;
  };

  // Stats cards with advanced styling
  const statsCards = [
    {
      title: "Total Scouts",
      value: analytics?.totals?.total_scouts || 0,
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      borderColor: "border-l-purple-500",
      description: "Active scout accounts"
    },
    {
      title: "Total Submissions",
      value: analytics?.totals?.total_submissions || 0,
      icon: Eye,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      borderColor: "border-l-blue-500",
      description: `${analytics?.totals?.reviewed || 0} in review`
    },
    {
      title: "Finalized",
      value: analytics?.totals?.feedback_sent || 0,
      icon: CheckCircle,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
      borderColor: "border-l-emerald-500",
      description: `${completionRate}% completion rate`
    },
    {
      title: "Revenue",
      value: formatRevenue(analytics?.totals?.total_revenue || 0),
      icon: DollarSign,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
      borderColor: "border-l-amber-500",
      description: `${analytics?.totals?.paid || 0} paid submissions`
    }
  ];

  // Secondary metrics cards
  const secondaryMetrics = [
    {
      title: "Avg Rating",
      value: (analytics?.totals?.avg_rating || 0).toFixed(1),
      icon: Star,
      color: "text-yellow-600 dark:text-yellow-400",
      description: "Across all reviews"
    },
    {
      title: "Avg/Scout",
      value: avgSubmissionsPerScout,
      icon: Target,
      color: "text-indigo-600 dark:text-indigo-400",
      description: "Submissions per scout"
    },
    {
      title: "In Review",
      value: analytics?.totals?.reviewed || 0,
      icon: Clock,
      color: "text-orange-600 dark:text-orange-400",
      description: "Pending review"
    },
    {
      title: "Avg Value",
      value: `$${((analytics?.totals?.avg_submission_value || 0)).toFixed(2)}`,
      icon: DollarSign,
      color: "text-green-600 dark:text-green-400",
      description: "Per submission"
    }
  ];

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
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">Scout Admin Dashboard</h1>
              <p className="text-muted-foreground text-sm lg:text-base">
                Monitor XEN Watch submissions and scout performance
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                onClick={handleRefreshData}
                variant="outline"
                size="sm"
                className="p-2"
                title="Refresh Data"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="6m">Last 6 months</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center space-x-2 bg-muted px-3 py-2 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-foreground">Live Data</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          {/* Dashboard Banners */}
          <DashboardBanner />

          {/* Primary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            {statsCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className={`border-l-4 ${stat.borderColor}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                      <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {secondaryMetrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{metric.title}</p>
                        <p className="text-xl font-bold text-foreground">{metric.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
                      </div>
                      <Icon className={`w-5 h-5 ${metric.color} opacity-50`} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Top Schools Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Schools by Average Rating</CardTitle>
                <CardDescription>
                  Schools with the highest average scout ratings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {analytics?.topSchools && analytics.topSchools.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.topSchools.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="avg_rating" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No school data available</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Students Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Students by Average Rating</CardTitle>
                <CardDescription>
                  Students with the highest average scout ratings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {analytics?.topStudents && analytics.topStudents.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.topStudents.slice(0, 10)}>
                        <defs>
                          <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis />
                        <Tooltip />
                        <Area 
                          type="monotone" 
                          dataKey="avg_rating" 
                          stroke="#10b981" 
                          fillOpacity={1}
                          fill="url(#colorRating)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No student data available</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Tables and Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Top Students Table */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Top Performing Students</CardTitle>
                    <CardDescription>
                      Students with the highest ratings and most submissions
                    </CardDescription>
                  </div>
                  {analytics?.topStudents && analytics.topStudents.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllStudents(!showAllStudents)}
                    >
                      {showAllStudents ? "Show Less" : "View All"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(showAllStudents ? analytics?.topStudents : analytics?.topStudents?.slice(0, 5))?.map((student, index) => (
                    <div key={student.student_id} className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{student.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {student.total_submissions} submission{student.total_submissions !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold text-lg">{student.avg_rating.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                  {(!analytics?.topStudents || analytics.topStudents.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No student data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest submission activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <div className="space-y-3">
                    {recentSubmissions?.submissions?.slice(0, 10).map((item: any) => {
                      const submission = item.submission || item;
                      return (
                        <div key={submission.id} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {item.student?.name || submission.student?.name || 'Unknown Student'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {submission.status === 'finalized' ? 'Finalized' : 
                                 submission.status === 'in_review' ? 'In Review' : 
                                 submission.status || 'Unknown'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {submission.createdAt ? timeAgo(submission.createdAt) : 'Unknown time'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(!recentSubmissions?.submissions || recentSubmissions.submissions.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No recent activity</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Top Schools Table */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Top Performing Schools</CardTitle>
                  <CardDescription>
                    Schools with the highest average ratings and submission counts
                  </CardDescription>
                </div>
                {analytics?.topSchools && analytics.topSchools.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllSchools(!showAllSchools)}
                  >
                    {showAllSchools ? "Show Less" : "View All"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>School Name</TableHead>
                      <TableHead>Submissions</TableHead>
                      <TableHead>Avg Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(showAllSchools ? analytics?.topSchools : analytics?.topSchools?.slice(0, 10))?.map((school, index) => (
                      <TableRow key={school.school_id}>
                        <TableCell className="font-medium">
                          #{index + 1}
                        </TableCell>
                        <TableCell className="font-medium">{school.name}</TableCell>
                        <TableCell>{school.total_submissions}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span className="font-semibold">{school.avg_rating.toFixed(1)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!analytics?.topSchools || analytics.topSchools.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No school data available</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Access specialized management dashboards and tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Button 
                  onClick={() => window.location.href = '/xen-watch/scout-queue'}
                  className="h-28 flex flex-col items-center justify-center space-y-3 p-6 hover:scale-105 transition-transform"
                  variant="outline"
                >
                  <Eye className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Review Submissions</div>
                    <div className="text-xs text-muted-foreground mt-1">View and manage all submissions</div>
                  </div>
                </Button>
                <Button 
                  onClick={() => window.location.href = '/scouts/admin/manage-scouts'}
                  className="h-28 flex flex-col items-center justify-center space-y-3 p-6 hover:scale-105 transition-transform"
                  variant="outline"
                >
                  <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Manage Scouts</div>
                    <div className="text-xs text-muted-foreground mt-1">Create and manage scout accounts</div>
                  </div>
                </Button>
                <Button 
                  onClick={() => window.location.href = '/scouts/admin/xen-watch-analytics'}
                  className="h-28 flex flex-col items-center justify-center space-y-3 p-6 hover:scale-105 transition-transform"
                  variant="outline"
                >
                  <TrendingUp className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">XEN Watch Analytics</div>
                    <div className="text-xs text-muted-foreground mt-1">Revenue and performance insights</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
