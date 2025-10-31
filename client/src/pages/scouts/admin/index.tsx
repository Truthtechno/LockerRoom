import React, { memo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  Users, 
  DollarSign, 
  Star, 
  TrendingUp, 
  Eye, 
  Clock,
  CheckCircle,
  MessageCircle
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { timeAgo } from "@/lib/timeAgo";
import { AdminDashboardSkeleton } from "@/components/ui/admin-skeleton";

interface AnalyticsData {
  totals: {
    total_submissions: number;
    paid: number;
    reviewed: number;
    feedback_sent: number;
    avg_rating: number;
    total_scouts: number;
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
  

  // Fetch analytics data
  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["/api/xen-watch/analytics/overview"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/xen-watch/analytics/overview");
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      return data;
    },
    enabled: !!user && !authLoading, // Only fetch when user is authenticated
    retry: 3,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    staleTime: 0, // Always refetch to get fresh data
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Scout count is now included in analytics data

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



  const statsCards = [
    {
      title: "Total Scouts",
      value: analytics?.totals?.total_scouts || 0,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30"
    },
    {
      title: "Total Submissions",
      value: analytics?.totals?.total_submissions || 0,
      icon: Eye,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30"
    },
    {
      title: "In Review",
      value: analytics?.totals?.reviewed || 0,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30"
    },
    {
      title: "Finalized",
      value: analytics?.totals?.feedback_sent || 0,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30"
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
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">Scout Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              Monitor XEN Watch submissions and scout performance
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statsCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                        <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      </div>
                      <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                        <Icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts Row */}
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
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.topSchools || []}>
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
                      <Bar dataKey="avg_rating" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
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
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics?.topStudents?.slice(0, 10) || []}>
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
                      <Line 
                        type="monotone" 
                        dataKey="avg_rating" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={{ fill: '#10b981' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Students Table */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Students</CardTitle>
                <CardDescription>
                  Students with the highest ratings and most submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <div className="space-y-3">
                    {analytics?.topStudents?.slice(0, 10).map((student, index) => (
                      <div key={student.student_id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {student.total_submissions} submission{student.total_submissions !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="font-semibold">{student.avg_rating.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Top Schools Table */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Schools</CardTitle>
                <CardDescription>
                  Schools with the highest average ratings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <div className="space-y-3">
                    {analytics?.topSchools?.slice(0, 10).map((school, index) => (
                      <div key={school.school_id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{school.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {school.total_submissions} submission{school.total_submissions !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="font-semibold">{school.avg_rating.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Access specialized management dashboards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Button 
                  onClick={() => window.location.href = '/xen-watch/scout-queue'}
                  className="h-24 flex flex-col items-center justify-center space-y-3 p-6"
                  variant="outline"
                >
                  <Eye className="w-8 h-8 text-blue-600" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Review Submissions</div>
                    <div className="text-xs text-muted-foreground mt-1">View and manage all submissions</div>
                  </div>
                </Button>
                <Button 
                  onClick={() => window.location.href = '/scouts/admin/manage-scouts'}
                  className="h-24 flex flex-col items-center justify-center space-y-3 p-6"
                  variant="outline"
                >
                  <Users className="w-8 h-8 text-purple-600" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Manage Scouts</div>
                    <div className="text-xs text-muted-foreground mt-1">Create and manage scout accounts</div>
                  </div>
                </Button>
                <Button 
                  onClick={() => window.location.href = '/scouts/admin/xen-watch-analytics'}
                  className="h-24 flex flex-col items-center justify-center space-y-3 p-6"
                  variant="outline"
                >
                  <TrendingUp className="w-8 h-8 text-emerald-600" />
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
