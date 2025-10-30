import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Building2, FileText, Calendar, Activity } from "lucide-react";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type AnalyticsStats = {
  userSignups: number;
  postCreated: number;
  schoolOnboarded: number;
  totalEvents: number;
};

type SystemStats = {
  totalSchools: number;
  activeStudents: number;
  contentUploads: number;
  monthlyRevenue: number;
  premiumSchools: number;
  standardSchools: number;
};

type AnalyticsLog = {
  id: string;
  eventType: string;
  entityId?: string;
  entityType?: string;
  metadata?: string;
  timestamp: string;
};

// Mock data for charts (in a real app, this would come from analytics)
const growthData = [
  { month: 'Jan', users: 120, schools: 5, posts: 450 },
  { month: 'Feb', users: 180, schools: 8, posts: 680 },
  { month: 'Mar', users: 250, schools: 12, posts: 920 },
  { month: 'Apr', users: 320, schools: 15, posts: 1200 },
  { month: 'May', users: 420, schools: 18, posts: 1580 },
  { month: 'Jun', users: 520, schools: 22, posts: 2100 },
];

const engagementData = [
  { day: 'Mon', likes: 320, comments: 180, saves: 90 },
  { day: 'Tue', likes: 280, comments: 150, saves: 75 },
  { day: 'Wed', likes: 450, comments: 220, saves: 110 },
  { day: 'Thu', likes: 380, comments: 190, saves: 95 },
  { day: 'Fri', likes: 520, comments: 280, saves: 140 },
  { day: 'Sat', likes: 680, comments: 350, saves: 175 },
  { day: 'Sun', likes: 590, comments: 300, saves: 150 },
];

const COLORS = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1'];

export default function PlatformAnalytics() {
  const [, setLocation] = useLocation();

  const { data: systemStats, isLoading: statsLoading } = useQuery<SystemStats>({
    queryKey: ["/api/system/stats"],
  });

  const { data: analyticsStats, isLoading: analyticsLoading } = useQuery<AnalyticsStats>({
    queryKey: ["/api/analytics/stats"],
  });

  const { data: recentLogs, isLoading: logsLoading } = useQuery<AnalyticsLog[]>({
    queryKey: ["/api/analytics/logs"],
    select: (data) => data?.slice(0, 10) || [],
  });

  const isLoading = statsLoading || analyticsLoading || logsLoading;

  const pieData = [
    { name: 'Premium Schools', value: systemStats?.premiumSchools || 0 },
    { name: 'Standard Schools', value: systemStats?.standardSchools || 0 },
  ];

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'user_signup':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'post_created':
        return <FileText className="w-4 h-4 text-green-500" />;
      case 'school_onboarded':
        return <Building2 className="w-4 h-4 text-purple-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getEventDescription = (log: AnalyticsLog) => {
    switch (log.eventType) {
      case 'user_signup':
        return 'New user registered';
      case 'post_created':
        return 'New post uploaded';
      case 'school_onboarded':
        return 'School approved and onboarded';
      default:
        return log.eventType.replace('_', ' ');
    }
  };

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
                  <p className="text-sm text-muted-foreground mt-1">Real-time insights and performance metrics</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 bg-muted px-4 py-2.5 rounded-lg border border-border/50">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-foreground">Live Data</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card data-testid="stat-total-events" className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold">Total Events</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center">
                <Activity className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{analyticsStats?.totalEvents || 0}</div>
              <p className="text-xs text-muted-foreground">All tracked activities</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-user-signups" className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold">User Signups</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{analyticsStats?.userSignups || 0}</div>
              <p className="text-xs text-muted-foreground">New registrations</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-posts-created" className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold">Posts Created</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{analyticsStats?.postCreated || 0}</div>
              <p className="text-xs text-muted-foreground">Content uploads</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-schools-onboarded" className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold">Schools Onboarded</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{analyticsStats?.schoolOnboarded || 0}</div>
              <p className="text-xs text-muted-foreground">Approved schools</p>
            </CardContent>
          </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
          {/* Growth Trends */}
          <Card data-testid="chart-growth-trends" className="shadow-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center text-lg">
                <div className="p-2 bg-primary/10 rounded-lg mr-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Growth Trends</div>
                  <CardDescription className="text-xs mt-1">Platform growth over the last 6 months</CardDescription>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="users" stroke="#FFD700" strokeWidth={2} />
                  <Line type="monotone" dataKey="schools" stroke="#FFA500" strokeWidth={2} />
                  <Line type="monotone" dataKey="posts" stroke="#FF6B6B" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* School Distribution */}
          <Card data-testid="chart-school-distribution" className="shadow-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center text-lg">
                <div className="p-2 bg-primary/10 rounded-lg mr-3">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">School Plan Distribution</div>
                  <CardDescription className="text-xs mt-1">Breakdown of subscription plans</CardDescription>
                </div>
              </CardTitle>
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

          {/* Engagement Analytics */}
          <Card data-testid="chart-engagement" className="shadow-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center text-lg">
                <div className="p-2 bg-primary/10 rounded-lg mr-3">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Weekly Engagement</div>
                  <CardDescription className="text-xs mt-1">User interactions across the week</CardDescription>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="likes" stackId="1" stroke="#FFD700" fill="#FFD700" />
                  <Area type="monotone" dataKey="comments" stackId="1" stroke="#FFA500" fill="#FFA500" />
                  <Area type="monotone" dataKey="saves" stackId="1" stroke="#FF6B6B" fill="#FF6B6B" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue Analytics */}
          <Card data-testid="chart-revenue" className="shadow-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center text-lg">
                <div className="p-2 bg-primary/10 rounded-lg mr-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Revenue Insights</div>
                  <CardDescription className="text-xs mt-1">Monthly recurring revenue breakdown</CardDescription>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Monthly Revenue</span>
                  <span className="text-2xl font-bold text-accent">${systemStats?.monthlyRevenue?.toLocaleString() || 0}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Premium Schools ({systemStats?.premiumSchools || 0})</span>
                    <span className="font-medium">${((systemStats?.premiumSchools || 0) * 150).toLocaleString()}/mo</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Standard Schools ({systemStats?.standardSchools || 0})</span>
                    <span className="font-medium">${((systemStats?.standardSchools || 0) * 75).toLocaleString()}/mo</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-green-600">
                        ${((systemStats?.monthlyRevenue || 0) * 12).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">Annual Revenue</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        ${Math.round((systemStats?.monthlyRevenue || 0) / (systemStats?.totalSchools || 1))}
                      </div>
                      <div className="text-xs text-muted-foreground">ARPU</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Recent Activity */}
          <Card data-testid="recent-activity" className="shadow-sm">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="flex items-center text-lg">
              <div className="p-2 bg-primary/10 rounded-lg mr-3">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Recent Activity</div>
                <CardDescription className="text-xs mt-1">Latest platform events and activities</CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs && recentLogs.length > 0 ? (
              <div className="space-y-4">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex items-center space-x-3">
                      {getEventIcon(log.eventType)}
                      <div>
                        <p className="text-sm font-medium">{getEventDescription(log)}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.entityType && log.entityId && `${log.entityType}: ${log.entityId.substring(0, 8)}...`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {log.eventType.replace('_', ' ')}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {new Date(log.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Recent Activity</h3>
                <p className="text-muted-foreground">Analytics events will appear here as they occur.</p>
              </div>
            )}
          </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}