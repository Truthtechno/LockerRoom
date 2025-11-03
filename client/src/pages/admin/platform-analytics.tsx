import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  Users, 
  Building2, 
  FileText, 
  Calendar, 
  Activity, 
  DollarSign,
  ArrowUp,
  ArrowDown,
  Eye,
  MessageCircle,
  Heart,
  Bookmark
} from "lucide-react";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useAuth } from "@/hooks/use-auth";

type PlatformOverview = {
  totals: {
    users: number;
    schools: number;
    posts: number;
    engagement: number;
    revenue: number;
  };
  trends: {
    userGrowth: number;
    revenueGrowth: number;
    engagementGrowth: number;
  };
  periodComparison: {
    users: number;
    schools: number;
    posts: number;
    engagement: number;
  };
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
};

type UserAnalytics = {
  total: number;
  byRole: { [key: string]: number };
  growth: {
    period: number;
    percentage: number;
  };
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  newUsers: Array<{ date: string; count: number }>;
};

type SchoolAnalytics = {
  total: number;
  active: number;
  byFrequency: { monthly: number; annual: number };
  byPlan: { premium: number; standard: number };
  newSchools: Array<{ date: string; count: number }>;
  topSchools: Array<{
    schoolId: string;
    name: string;
    studentCount: number;
    postCount: number;
    engagement: number;
  }>;
  atRisk: Array<{
    schoolId: string;
    name: string;
    reason: string;
    expiresAt?: string;
  }>;
};

type RevenueAnalytics = {
  mrr: number;
  arr: number;
  byFrequency?: {
    monthly: { count: number; revenue: number };
    annual: { count: number; revenue: number };
  };
  byPlan: {
    premium: { count: number; revenue: number };
    standard: { count: number; revenue: number };
  };
  trends: Array<{ month: string; mrr: number; arr: number }>;
  churnRisk: Array<{
    schoolId: string;
    name: string;
    renewalDate: string;
    monthlyRevenue: number;
  }>;
};

type ContentAnalytics = {
  totalPosts: number;
  byType: { image: number; video: number; announcement: number };
  trends: Array<{ date: string; count: number }>;
  engagement: {
    total: number;
    averagePerPost: number;
    breakdown: {
      likes: number;
      comments: number;
      views: number;
    };
  };
  topPosts: Array<{
    postId: string;
    studentId: string;
    schoolId: string;
    engagement: number;
  }>;
};

type EngagementAnalytics = {
  total: {
    likes: number;
    comments: number;
    views: number;
    saves: number;
  };
  trends: Array<{
    date: string;
    likes: number;
    comments: number;
    views: number;
    saves: number;
  }>;
  bySchool: Array<{
    schoolId: string;
    name: string;
    engagement: number;
  }>;
  peakTimes: Array<{
    hour: number;
    engagement: number;
  }>;
};

type GrowthTrends = {
  data: Array<{ date: string; value: number; change: number }>;
  growthRate: number;
  comparison: {
    previousPeriod: number;
    percentage: number;
  };
};

const COLORS = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

export default function PlatformAnalytics() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [period, setPeriod] = useState<string>("month");
  const [growthMetric, setGrowthMetric] = useState<string>("users");
  const [growthPeriod, setGrowthPeriod] = useState<string>("6months");

  // Fetch platform overview
  const { data: overview, isLoading: overviewLoading, isError: overviewError } = useQuery<PlatformOverview>({
    queryKey: ["/api/system/analytics/overview", period],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/analytics/overview?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch overview");
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch user analytics
  const { data: userAnalytics, isLoading: userLoading, isError: userError } = useQuery<UserAnalytics>({
    queryKey: ["/api/system/analytics/users", period],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/analytics/users?period=${period}&breakdown=role`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch user analytics");
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch school analytics
  const { data: schoolAnalytics, isLoading: schoolLoading, isError: schoolError } = useQuery<SchoolAnalytics>({
    queryKey: ["/api/system/analytics/schools", period],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/analytics/schools?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch school analytics");
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch revenue analytics
  const { data: revenueAnalytics, isLoading: revenueLoading, isError: revenueError } = useQuery<RevenueAnalytics>({
    queryKey: ["/api/system/analytics/revenue"],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/analytics/revenue?period=year`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch revenue analytics");
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch content analytics
  const { data: contentAnalytics, isLoading: contentLoading, isError: contentError } = useQuery<ContentAnalytics>({
    queryKey: ["/api/system/analytics/content", period],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/analytics/content?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch content analytics");
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch engagement analytics
  const { data: engagementAnalytics, isLoading: engagementLoading, isError: engagementError } = useQuery<EngagementAnalytics>({
    queryKey: ["/api/system/analytics/engagement", period],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/analytics/engagement?period=${period}&granularity=day`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch engagement analytics");
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch growth trends
  const { data: growthTrends, isLoading: growthLoading, isError: growthError } = useQuery<GrowthTrends>({
    queryKey: ["/api/system/analytics/growth", growthMetric, growthPeriod],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/analytics/growth?metric=${growthMetric}&period=${growthPeriod}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch growth trends");
      return response.json();
    },
    enabled: !!user,
  });

  const isLoading = [overviewLoading, userLoading, schoolLoading, revenueLoading, contentLoading, engagementLoading, growthLoading].every(Boolean);
  const hasError = overviewError || userError || schoolError || revenueError || contentError || engagementError || growthError;

  // Format growth data for chart
  const formatGrowthData = () => {
    if (!growthTrends?.data) return [];
    return growthTrends.data.map((item: any) => {
      const date = new Date(item.date);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return {
        month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
        value: item.value,
        change: item.change
      };
    });
  };

  const formatRevenueData = () => {
    if (!revenueAnalytics?.trends) return [];
    return revenueAnalytics.trends.map(item => ({
      month: item.month.substring(5), // Get month only
      mrr: item.mrr,
      arr: item.arr
    }));
  };

  const formatContentTrends = () => {
    if (!contentAnalytics?.trends) return [];
    return contentAnalytics.trends.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      posts: item.count
    }));
  };

  // Calculate percentage change helper
  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    const color = value >= 0 ? 'text-green-600' : 'text-red-600';
    const icon = value >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
    return { text: `${sign}${value.toFixed(1)}%`, color, icon };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-0 flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      </div>
    );
  }

  // If some requests failed, still render the page with whatever data is available

  const userGrowth = formatPercentage(overview?.trends.userGrowth || 0);
  const engagementGrowth = formatPercentage(overview?.trends.engagementGrowth || 0);
  const revenueGrowth = formatPercentage(overview?.trends.revenueGrowth || 0);
  
  const pieData = schoolAnalytics?.byFrequency ? [
    { name: 'Monthly', value: schoolAnalytics.byFrequency.monthly || 0 },
    { name: 'Annual', value: schoolAnalytics.byFrequency.annual || 0 },
  ] : [
    { name: 'Premium Schools', value: schoolAnalytics?.byPlan?.premium || 0 },
    { name: 'Standard Schools', value: schoolAnalytics?.byPlan?.standard || 0 },
  ];
  
  const formatEngagementTrends = () => {
    if (!engagementAnalytics?.trends) return [];
    return engagementAnalytics.trends.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      likes: item.likes || 0,
      comments: item.comments || 0,
      views: item.views || 0,
      saves: item.saves || 0
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        {/* Header */}
        <div className="bg-card border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-accent/20 rounded-lg">
                  <Activity className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
                  <p className="text-sm text-muted-foreground mt-1">Comprehensive platform insights and performance metrics</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex items-center space-x-2 bg-muted px-4 py-2.5 rounded-lg border border-border/50">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-foreground">Live Data</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold">Total Users</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-1">{overview?.totals.users.toLocaleString() || 0}</div>
                <div className="flex items-center gap-1 text-xs">
                  <span className={userGrowth.color}>{userGrowth.icon}</span>
                  <span className={userGrowth.color}>{userGrowth.text}</span>
                  <span className="text-muted-foreground">vs last {period}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold">Active Users</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-1">{overview?.activeUsers.monthly.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">MAU (30 days)</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold">Total Schools</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-1">{overview?.totals.schools.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">{overview?.periodComparison.schools || 0} new this {period}</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold">Monthly Revenue</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-green-600/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-1">${revenueAnalytics?.mrr.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">MRR</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold">Total Posts</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-1">{overview?.totals.posts.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">{overview?.periodComparison.posts || 0} new this {period}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for different analytics views */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="schools">Schools</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Growth Trends Chart */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Platform Growth Trends</CardTitle>
                      <CardDescription>Growth over the last {growthPeriod.replace('months', ' months')}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Select value={growthMetric} onValueChange={setGrowthMetric}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="users">Users</SelectItem>
                          <SelectItem value="schools">Schools</SelectItem>
                          <SelectItem value="posts">Posts</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={growthPeriod} onValueChange={setGrowthPeriod}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3months">3 Months</SelectItem>
                          <SelectItem value="6months">6 Months</SelectItem>
                          <SelectItem value="12months">12 Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={formatGrowthData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} name="Total" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* School Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>School Subscription Distribution</CardTitle>
                    <CardDescription>Breakdown by payment frequency</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Revenue Trends */}
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Trends</CardTitle>
                    <CardDescription>Monthly recurring revenue over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={formatRevenueData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                        <Legend />
                        <Area type="monotone" dataKey="mrr" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="MRR" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Content Trends */}
                <Card>
                  <CardHeader>
                    <CardTitle>Content Creation Trends</CardTitle>
                    <CardDescription>Posts created over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={formatContentTrends()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="posts" fill="#3b82f6" name="Posts" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* User Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>User Distribution by Role</CardTitle>
                    <CardDescription>Platform users breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {userAnalytics?.byRole && Object.entries(userAnalytics.byRole).map(([role, count]) => (
                        <div key={role} className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">{role.replace('_', ' ')}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-32 bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full" 
                                style={{ 
                                  width: `${userAnalytics.total > 0 ? (Number(count) / userAnalytics.total) * 100 : 0}%` 
                                }}
                              />
                            </div>
                            <span className="text-sm font-bold w-16 text-right">{Number(count).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>User Growth</CardTitle>
                    <CardDescription>New users over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-4xl font-bold">{userAnalytics?.growth.period || 0}</div>
                        <div className={`text-sm ${userAnalytics?.growth.percentage && userAnalytics.growth.percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercentage(userAnalytics?.growth.percentage || 0).text} vs previous period
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold">{userAnalytics?.retention.daily || 0}</div>
                          <div className="text-xs text-muted-foreground">DAU</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{userAnalytics?.retention.weekly || 0}</div>
                          <div className="text-xs text-muted-foreground">WAU</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{userAnalytics?.retention.monthly || 0}</div>
                          <div className="text-xs text-muted-foreground">MAU</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>User Activity Overview</CardTitle>
                    <CardDescription>Platform-wide user metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Total Users</span>
                        <span className="text-lg font-bold">{userAnalytics?.total.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">New This Period</span>
                        <span className="text-lg font-bold">{userAnalytics?.growth.period.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Monthly Active</span>
                        <span className="text-lg font-bold">{overview?.activeUsers.monthly.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Weekly Active</span>
                        <span className="text-lg font-bold">{overview?.activeUsers.weekly.toLocaleString() || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="schools" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Performing Schools</CardTitle>
                    <CardDescription>Schools ranked by engagement</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {schoolAnalytics?.topSchools.slice(0, 10).map((school, index) => (
                        <div key={school.schoolId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium">{school.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {school.studentCount} students • {school.postCount} posts
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary">{school.engagement} engagement</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>School Statistics</CardTitle>
                    <CardDescription>Platform-wide school metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Total Schools</span>
                        <span className="text-lg font-bold">{schoolAnalytics?.total.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Active Schools</span>
                        <span className="text-lg font-bold">{(schoolAnalytics?.active ?? schoolAnalytics?.byPlan?.standard ?? 0).toLocaleString()}</span>
                      </div>
                      {schoolAnalytics?.byFrequency && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Monthly Subscriptions</span>
                            <span className="text-lg font-bold">{(schoolAnalytics.byFrequency.monthly || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Annual Subscriptions</span>
                            <span className="text-lg font-bold">{(schoolAnalytics.byFrequency.annual || 0).toLocaleString()}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm">New This Period</span>
                        <span className="text-lg font-bold">{schoolAnalytics?.newSchools.reduce((sum, s) => sum + s.count, 0) || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="revenue" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>MRR</CardTitle>
                    <CardDescription>Monthly Recurring Revenue</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-green-600">
                      ${revenueAnalytics?.mrr.toLocaleString() || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>ARR</CardTitle>
                    <CardDescription>Annual Recurring Revenue</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-blue-600">
                      ${revenueAnalytics?.arr.toLocaleString() || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Breakdown</CardTitle>
                    <CardDescription>By subscription plan</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {revenueAnalytics?.byFrequency ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm">Monthly ({revenueAnalytics.byFrequency.monthly.count || 0})</span>
                            <span className="font-bold">${(revenueAnalytics.byFrequency.monthly.revenue || 0).toLocaleString()}/mo</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Annual ({revenueAnalytics.byFrequency.annual.count || 0})</span>
                            <span className="font-bold">${((revenueAnalytics.byFrequency.annual.revenue || 0) / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo</span>
                          </div>
                          <div className="pt-2 border-t">
                            <div className="flex justify-between font-semibold">
                              <span className="text-sm">Total Active</span>
                              <span className="text-sm">{(revenueAnalytics.byFrequency.monthly.count + revenueAnalytics.byFrequency.annual.count)} schools</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm">Premium ({revenueAnalytics?.byPlan.premium.count || 0})</span>
                            <span className="font-bold">${(revenueAnalytics?.byPlan.premium.revenue || 0).toLocaleString()}/mo</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Standard ({revenueAnalytics?.byPlan.standard.count || 0})</span>
                            <span className="font-bold">${(revenueAnalytics?.byPlan.standard.revenue || 0).toLocaleString()}/mo</span>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trends (12 Months)</CardTitle>
                  <CardDescription>MRR and ARR over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={formatRevenueData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                      <Legend />
                      <Area type="monotone" dataKey="mrr" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="MRR" />
                      <Area type="monotone" dataKey="arr" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="ARR" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="engagement" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      Likes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{engagementAnalytics?.total.likes.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-blue-500" />
                      Comments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{engagementAnalytics?.total.comments.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="w-4 h-4 text-purple-500" />
                      Views
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{engagementAnalytics?.total.views.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-yellow-500" />
                      Saves
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{engagementAnalytics?.total.saves.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Schools by Engagement</CardTitle>
                    <CardDescription>Most engaged schools on the platform</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {engagementAnalytics?.bySchool.slice(0, 10).map((school, index) => (
                        <div key={school.schoolId} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">#{index + 1}</span>
                            <span className="text-sm">{school.name}</span>
                          </div>
                          <Badge>{school.engagement.toLocaleString()}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Content Engagement Stats</CardTitle>
                    <CardDescription>Overall engagement metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Total Engagement</span>
                        <span className="text-lg font-bold">{overview?.totals.engagement.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Avg per Post</span>
                        <span className="text-lg font-bold">
                          {contentAnalytics?.engagement.averagePerPost.toFixed(1) || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Likes</span>
                        <span className="text-lg font-bold">{engagementAnalytics?.total.likes.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Comments</span>
                        <span className="text-lg font-bold">{engagementAnalytics?.total.comments.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Views</span>
                        <span className="text-lg font-bold">{engagementAnalytics?.total.views.toLocaleString() || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Engagement Trends Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Engagement Trends</CardTitle>
                  <CardDescription>Likes, comments, views, and saves over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {engagementAnalytics?.trends && engagementAnalytics.trends.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart data={formatEngagementTrends()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="likes" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Likes" />
                        <Area type="monotone" dataKey="comments" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Comments" />
                        <Area type="monotone" dataKey="views" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Views" />
                        <Area type="monotone" dataKey="saves" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Saves" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">No engagement data available for this period</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
