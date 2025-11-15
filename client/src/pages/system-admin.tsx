import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, FileText, DollarSign, BarChart3, Settings, UserPlus, Shield, MapPin, Calendar, Megaphone, Activity, ExternalLink, ChevronRight } from "lucide-react";
import { Loader2 } from "lucide-react";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { SchoolAvatar } from "@/components/ui/school-avatar";
import { EditProfileModal } from "@/components/ui/edit-profile-modal";
import { useRef, useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend } from "recharts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnouncementModal } from "@/components/ui/announcement-modal";
import { AnnouncementManagement } from "@/components/admin/announcement-management";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

export default function SystemAdmin() {
  const { user, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [period, setPeriod] = useState<string>("month");
  const [topSchoolsPage, setTopSchoolsPage] = useState(1);
  const topSchoolsPerPage = 10;

  const { data: systemStats, isLoading } = useQuery<{
    totalSchools: number;
    activeStudents: number;
    contentUploads: number;
    monthlyRevenue: number;
    activeSchools: number;
  }>({
    queryKey: ["/api/system/stats"],
  });

  // Platform overview
  const { data: overview } = useQuery<{
    totals: { users: number; schools: number; posts: number; engagement: number; revenue: number };
    trends: { userGrowth: number; revenueGrowth: number; engagementGrowth: number };
    periodComparison: { users: number; schools: number; posts: number; engagement: number };
    activeUsers: { daily: number; weekly: number; monthly: number };
  }>({
    queryKey: ["/api/system/analytics/overview", period],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/system/analytics/overview?period=${period}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load overview");
      return res.json();
    }
  });

  // School analytics (for top schools and at-risk)
  const { data: schoolAnalytics } = useQuery<{ 
    total: number;
    byPlan: { [k: string]: number };
    newSchools: Array<{ date: string; count: number }>;
    topSchools: Array<{ schoolId: string; name: string; studentCount: number; postCount: number; engagement: number }>;
    atRisk: Array<{ schoolId: string; name: string; reason: string; expiresAt?: string }>
  }>({
    queryKey: ["/api/system/analytics/schools", period],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/system/analytics/schools?period=${period}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load school analytics");
      return res.json();
    }
  });

  // Revenue analytics (for quick summary)
  const { data: revenueAnalytics } = useQuery<{ mrr: number; arr: number; trends: Array<{ month: string; mrr: number; arr: number }> }>({
    queryKey: ["/api/system/analytics/revenue"],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/system/analytics/revenue?period=year`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load revenue analytics");
      return res.json();
    }
  });

  const { data: schoolsData } = useQuery({
    queryKey: ["/api/system-admin/schools"],
    queryFn: async () => {
      const response = await fetch('/api/system-admin/schools', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch schools');
      const data = await response.json();
      
      // Normalize and sort by createdAt descending, take only the 3 most recent
      const recentSchools = (data.schools || [])
        .map((school: any) => ({
          ...school,
          createdAt: school.createdAt || school.created_at,
          paymentFrequency: school.paymentFrequency || school.payment_frequency,
          subscriptionExpiresAt: school.subscriptionExpiresAt || school.subscription_expires_at,
          isActive: school.isActive ?? school.is_active ?? true,
        }))
        .sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 3);
      return { ...data, schools: recentSchools };
    },
  });

  // Health and Alerts
  const { data: systemHealth } = useQuery<{ uptimeSeconds: number; dbConnected: boolean; cloudinaryConfigured: boolean; apiRequests30d: number; timestamp: string }>({
    queryKey: ["/api/system/health", period],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/system/health`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch system health');
      return res.json();
    }
  });

  const { data: alertsData } = useQuery<{ alerts: Array<{ id: string; type: string; title: string; message: string; severity: string; createdAt: string }>}>({
    queryKey: ["/api/system/alerts", period],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/system/alerts?period=${period}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch system alerts');
      return res.json();
    }
  });

  const uploadSchoolProfilePic = async (schoolId: string, file: File) => {
    const formData = new FormData();
    formData.append('profilePic', file);

    const response = await fetch(`/api/system-admin/schools/${schoolId}/profile-pic`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload profile picture');
    }

    return response.json();
  };

  const handleSchoolAvatarClick = (schoolId: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('data-school-id', schoolId);
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const schoolId = event.target.getAttribute('data-school-id');
    
    if (!file || !schoolId) return;

    try {
      await uploadSchoolProfilePic(schoolId, file);
      
      toast({
        title: "Success",
        description: "Academy profile picture updated successfully",
      });
      
      // Refetch schools data to update the UI
      await queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools"] });
      await queryClient.refetchQueries({ queryKey: ["/api/system-admin/schools"] });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    }

    // Reset the input
    event.target.value = '';
  };

  const handleLogout = () => {
    logout(); // logout() now handles clearing data and redirecting
  };

  const handlePlatformAnalytics = () => {
    setLocation("/admin/platform-analytics");
  };

  const handleSystemConfig = () => {
    setLocation("/admin/system-config");
  };

  const handleManageAdmins = () => {
    setLocation("/admin/admin-management");
  };

  const handleCreateSchool = () => {
    setLocation("/system-admin/create-school");
  };

  const handleCreateSchoolAdmin = () => {
    setLocation("/system-admin/create-school-admin");
  };


  // Format revenue trends for sparkline
  const revenueSparklineData = useMemo(() => {
    if (!revenueAnalytics?.trends || revenueAnalytics.trends.length === 0) return [];
    // Get last 12 months or all available
    const data = revenueAnalytics.trends.slice(-12).map(item => ({
      month: item.month.substring(5), // Get MM format
      mrr: item.mrr || 0
    }));
    return data;
  }, [revenueAnalytics]);

  // Paginated top schools
  const paginatedTopSchools = useMemo(() => {
    if (!schoolAnalytics?.topSchools) return [];
    const start = (topSchoolsPage - 1) * topSchoolsPerPage;
    const end = start + topSchoolsPerPage;
    return schoolAnalytics.topSchools.slice(start, end);
  }, [schoolAnalytics?.topSchools, topSchoolsPage]);

  const totalTopSchoolsPages = Math.ceil((schoolAnalytics?.topSchools?.length || 0) / topSchoolsPerPage);

  // Handle alert resolve navigation
  const handleResolveAlert = (alert: { type: string; id?: string }) => {
    const alertTypeMap: Record<string, string> = {
      'subscription_expiring': '/system-admin/manage-schools',
      'subscription_expired': '/system-admin/manage-schools',
      'school_at_risk': '/system-admin/manage-schools',
      'system_issue': '/admin/system-config',
      'database_issue': '/admin/system-config',
      'cloudinary_missing': '/admin/system-config',
      'high_api_usage': '/admin/platform-analytics',
      'low_engagement': '/admin/platform-analytics',
      'new_school_registered': '/system-admin/manage-schools',
    };
    
    const route = alertTypeMap[alert.type] || '/system-admin';
    setLocation(route);
  };

  if (isLoading) {
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
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">System Administration</h1>
              <p className="text-muted-foreground text-sm lg:text-base">XEN Sports Armoury Platform</p>
            </div>
            <div className="flex items-center space-x-3">
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
              <div className="flex items-center space-x-2 bg-muted px-3 py-2 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-foreground">Live Data</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-8">
            {/* Global Stats - Matching School Admin Style */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Academies</CardTitle>
                    <Building2 className="h-4 w-4 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview?.totals.schools || systemStats?.totalSchools || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overview?.periodComparison.schools || 0} new {period}
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
                  <div className="text-2xl font-bold">{(systemStats?.activeStudents || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across all academies
                    <span className="block mt-1">{period === "week" ? "Last 7 days" : period === "month" ? "Last 30 days" : "All time"}</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Content Uploads</CardTitle>
                    <FileText className="h-4 w-4 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(overview?.totals.posts || systemStats?.contentUploads || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overview?.periodComparison.posts || 0} new {period}
                    <span className="block mt-1">{period === "week" ? "Last 7 days" : period === "month" ? "Last 30 days" : "All time"}</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-amber-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${(overview?.totals.revenue || systemStats?.monthlyRevenue || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {revenueAnalytics ? `ARR $${(revenueAnalytics.arr || 0).toLocaleString()}` : "Calculating..."}
                  </p>
                  {/* Mini Revenue Sparkline */}
                  {revenueSparklineData.length > 0 && (
                    <div className="mt-2 h-12 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueSparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                          <Line 
                            type="monotone" 
                            dataKey="mrr" 
                            stroke="#f59e0b" 
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Platform Analytics */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Trends */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="mb-4 sm:mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Quick Trends</h2>
                  <p className="text-sm text-muted-foreground">High-level platform trajectory</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Monthly Active Users</p>
                  <div className="text-2xl font-bold">{overview?.activeUsers.monthly?.toLocaleString() || 0}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">User Growth</p>
                  <div className="text-2xl font-bold">{(overview?.trends.userGrowth ?? 0).toFixed(1)}%</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Engagement This {period}</p>
                  <div className="text-2xl font-bold">{(overview?.periodComparison.engagement ?? 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
            {/* Top Academies Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Top Academies</h2>
                <p className="text-sm text-muted-foreground">Academies ranked by engagement and activity</p>
              </div>
              {schoolAnalytics?.topSchools && schoolAnalytics.topSchools.length > 0 ? (
                <>
                  {/* Mobile Card Layout */}
                  <div className="lg:hidden divide-y divide-border">
                    {paginatedTopSchools.map((school, index) => {
                      const rank = (topSchoolsPage - 1) * topSchoolsPerPage + index + 1;
                      const isTopThree = rank <= 3;
                      return (
                        <div 
                          key={school.schoolId} 
                          className={`p-4 ${isTopThree ? 'bg-muted/30' : ''} hover:bg-muted/50 transition-colors`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                rank === 1 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                rank === 2 ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' :
                                rank === 3 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                #{rank}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-foreground text-sm truncate mb-1">
                                  {school.name}
                                </h3>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground block">Players</span>
                                    <span className="font-medium text-foreground">{school.studentCount}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">Posts</span>
                                    <span className="font-medium text-foreground">{school.postCount}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">Engagement</span>
                                    <span className="font-medium text-foreground">{school.engagement.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table Layout */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Academy Name</TableHead>
                          <TableHead>Players</TableHead>
                          <TableHead>Posts</TableHead>
                          <TableHead>Engagement</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTopSchools.map((school, index) => (
                          <TableRow key={school.schoolId}>
                            <TableCell className="font-medium">
                              #{(topSchoolsPage - 1) * topSchoolsPerPage + index + 1}
                            </TableCell>
                            <TableCell className="font-medium">{school.name}</TableCell>
                            <TableCell>{school.studentCount}</TableCell>
                            <TableCell>{school.postCount}</TableCell>
                            <TableCell>{school.engagement.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {totalTopSchoolsPages > 1 && (
                    <div className="px-4 sm:px-6 py-4 border-t border-border">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (topSchoolsPage > 1) setTopSchoolsPage(p => p - 1);
                              }}
                              className={topSchoolsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {Array.from({ length: totalTopSchoolsPages }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                              <PaginationLink
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setTopSchoolsPage(page);
                                }}
                                isActive={topSchoolsPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (topSchoolsPage < totalTopSchoolsPages) setTopSchoolsPage(p => p + 1);
                              }}
                              className={topSchoolsPage === totalTopSchoolsPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No academy data available</p>
                </div>
              )}
            </div>

            {/* Recent Academy Registrations */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Recent Academy Registrations</h2>
                    <p className="text-sm text-muted-foreground">Newest academies joining the platform</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation("/system-admin/manage-schools")}
                    className="text-primary hover:text-primary self-start sm:self-auto"
                  >
                    <span className="hidden sm:inline">Manage All Academies</span>
                    <span className="sm:hidden">Manage All</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {schoolsData?.schools?.length > 0 ? (
                  schoolsData.schools.map((school: any) => {
                    // Normalize school data (handle both camelCase and snake_case)
                    const normalizedSchool = {
                      ...school,
                      createdAt: school.createdAt || school.created_at,
                      paymentFrequency: school.paymentFrequency || school.payment_frequency || 'monthly',
                      subscriptionExpiresAt: school.subscriptionExpiresAt || school.subscription_expires_at,
                      isActive: school.isActive ?? school.is_active ?? true,
                    };

                    // Calculate registration date
                    const registrationDate = normalizedSchool.createdAt ? new Date(normalizedSchool.createdAt) : null;
                    let daysAgo: number | null = null;
                    if (registrationDate && !isNaN(registrationDate.getTime())) {
                      const diffInMs = Date.now() - registrationDate.getTime();
                      daysAgo = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
                    }

                    // Determine subscription frequency badge (Annual/Monthly instead of Premium/Standard)
                    const paymentFrequency = normalizedSchool.paymentFrequency?.toLowerCase() || 'monthly';
                    const planType = paymentFrequency === 'annual' ? 'Annual' : 'Monthly';
                    const planColor = planType === 'Annual' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';

                    // Determine subscription status (same logic as Manage Schools page)
                    const expiresAt = normalizedSchool.subscriptionExpiresAt ? new Date(normalizedSchool.subscriptionExpiresAt) : null;
                    const isActive = normalizedSchool.isActive ?? true;
                    let status = 'Active';
                    let statusColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
                    
                    if (expiresAt) {
                      const now = new Date();
                      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      
                      if (!isActive || expiresAt <= now) {
                        status = 'Expired';
                        statusColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
                      } else {
                        const warningThreshold = paymentFrequency === 'monthly' ? 7 : 30;
                        if (daysUntilExpiry <= warningThreshold) {
                          status = `Expiring in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`;
                          statusColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
                        }
                      }
                    } else if (!isActive) {
                      status = 'Inactive';
                      statusColor = 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
                    }
                    
                    return (
                      <div key={school.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start gap-3 sm:gap-4">
                          <SchoolAvatar
                            key={`${school.id}-${school.profilePicUrl || 'no-image'}`}
                            src={school.profilePicUrl}
                            name={school.name}
                            className="h-10 w-10 sm:h-14 sm:w-14 flex-shrink-0"
                            clickable={true}
                            onClick={() => handleSchoolAvatarClick(school.id)}
                          />
                          <div className="min-w-0 flex-1">
                            {/* Mobile Layout */}
                            <div className="sm:hidden space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-foreground text-sm truncate flex-1">
                                  {school.name}
                                </h3>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${planColor}`}>
                                  {planType}
                                </span>
                              </div>
                              {school.address && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{school.address}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                  {status}
                                </span>
                                <div className="flex items-center text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3 mr-1 flex-shrink-0" />
                                  <span>
                                    {daysAgo !== null ? (
                                      daysAgo === 0 ? 'Today' : 
                                      daysAgo === 1 ? 'Yesterday' : 
                                      `${daysAgo}d ago`
                                    ) : (
                                      registrationDate ? new Date(registrationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Date unavailable'
                                    )}
                                  </span>
                                </div>
                                {school.paymentAmount && (
                                  <span className="text-xs text-muted-foreground">
                                    ${parseFloat(school.paymentAmount || school.payment_amount || 0).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Desktop Layout */}
                            <div className="hidden sm:block">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground text-base sm:text-lg truncate">{school.name}</h3>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${planColor}`}>
                                  {planType}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-2">
                                {school.address && (
                                  <div className="flex items-center space-x-1">
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate max-w-[200px]">{school.address}</span>
                                  </div>
                                )}
                                {normalizedSchool.paymentFrequency && (
                                  <div className="flex items-center space-x-1">
                                    <span className="capitalize font-medium">{normalizedSchool.paymentFrequency}</span>
                                    {school.paymentAmount && (
                                      <span>• ${parseFloat(school.paymentAmount || school.payment_amount || 0).toFixed(2)}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                  {status}
                                </span>
                                <div className="flex items-center text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3 mr-1 flex-shrink-0" />
                                  <span>
                                    {daysAgo !== null ? (
                                      daysAgo === 0 ? 'Registered today' : 
                                      daysAgo === 1 ? 'Registered yesterday' : 
                                      `Registered ${daysAgo} days ago`
                                    ) : (
                                      registrationDate ? new Date(registrationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Registration date unavailable'
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No academies registered yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Platform Health Metrics */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg font-semibold text-foreground">Platform Health</h2>
                <p className="text-sm text-muted-foreground">System performance and usage metrics</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-2">
                    <div className="text-2xl font-bold text-green-600">{systemHealth ? `${Math.min(99.9, 100).toFixed(1)}%` : '--'}</div>
                  </div>
                  <p className="text-sm font-medium text-foreground">Uptime</p>
                  <p className="text-xs text-muted-foreground">Since start: {systemHealth ? `${Math.floor((systemHealth.uptimeSeconds || 0)/3600)}h` : '--'}</p>
                </div>
                
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <div className="text-2xl font-bold text-blue-600">{systemHealth?.dbConnected ? 'OK' : 'Down'}</div>
                  </div>
                  <p className="text-sm font-medium text-foreground">Database</p>
                  <p className="text-xs text-muted-foreground">Cloudinary: {systemHealth?.cloudinaryConfigured ? 'Configured' : 'Missing'}</p>
                </div>
                
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-2">
                    <div className="text-2xl font-bold text-purple-600">{systemHealth?.apiRequests30d?.toLocaleString() || 0}</div>
                  </div>
                  <p className="text-sm font-medium text-foreground">API Requests</p>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </div>
              </div>
            </div>
          </div>

          {/* System Management */}
          <div className="space-y-4 sm:space-y-6">
            {/* At-Risk Academies */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">At-Risk Academies</h2>
              {schoolAnalytics?.atRisk && schoolAnalytics.atRisk.length > 0 ? (
                <div className="space-y-3">
                  {schoolAnalytics.atRisk.slice(0, 5).map((s) => (
                    <div key={s.schoolId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{s.reason.replace('_',' ')}</p>
                      </div>
                      {s.expiresAt && (
                        <span className="text-xs">Renews {new Date(s.expiresAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No academies at risk right now.</p>
              )}
            </div>
            {/* System Actions - Accordion on mobile */}
            <div className="bg-card border border-border rounded-xl shadow-sm">
              <Disclosure>
                {({ open }: { open: boolean }) => (
                  <>
                    <DisclosureButton className="w-full px-4 sm:px-6 py-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors">
                      <h2 className="text-lg font-semibold text-foreground">System Management</h2>
                      <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
                    </DisclosureButton>
                    <DisclosurePanel className="px-4 sm:px-6 pb-4 sm:pb-6">
                      <div className="space-y-3">
                <Button
                  onClick={handleCreateSchool}
                  className="w-full justify-start bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <div className="flex items-center">
                    <Building2 className="w-5 h-5 mr-3" />
                    Create New Academy
                  </div>
                </Button>

                <Button
                  onClick={handleCreateSchoolAdmin}
                  className="w-full justify-start bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <div className="flex items-center">
                    <UserPlus className="w-5 h-5 mr-3" />
                    Create Academy Admin
                  </div>
                </Button>

                <Button
                  onClick={() => setLocation("/system-admin/manage-schools")}
                  className="w-full justify-start bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <div className="flex items-center">
                    <Building2 className="w-5 h-5 mr-3" />
                    Manage Academies
                  </div>
                </Button>
                
                <Button
                  onClick={handlePlatformAnalytics}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-platform-analytics"
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  Platform Analytics
                </Button>
                
                <Button
                  onClick={handleSystemConfig}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-system-config"
                >
                  <Settings className="w-5 h-5 mr-3" />
                  System Configuration
                </Button>
                
                <Button
                  onClick={handleManageAdmins}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-manage-admins"
                >
                  <Shield className="w-5 h-5 mr-3" />
                  Manage Administrators
                </Button>
                
                <AnnouncementModal userRole="system_admin">
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
                  </>
                )}
              </Disclosure>
            </div>

            {/* Subscription Overview */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">Academy Subscriptions</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Active Academies</p>
                    <p className="text-sm text-muted-foreground">Currently active subscriptions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{systemStats?.activeSchools || 0}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Total Academies</p>
                    <p className="text-sm text-muted-foreground">All registered academies</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{systemStats?.totalSchools || 0}</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">Total Monthly Revenue</p>
                    <p className="text-xl font-bold text-accent dark:text-accent">${(systemStats?.monthlyRevenue || 0).toLocaleString()}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on active subscriptions
                  </p>
                </div>
              </div>
            </div>

            {/* System Alerts */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">System Alerts</h2>
              <div className="space-y-3">
                {alertsData?.alerts?.length ? (
                  alertsData.alerts.slice(0,6).map((a) => (
                    <div key={a.id} className={`flex items-start justify-between p-3 border rounded-lg ${a.severity === 'success' ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : a.severity === 'warning' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800' : a.severity === 'error' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'}`}>
                      <div className="flex items-start space-x-3 flex-1">
                        <div className={`w-2 h-2 rounded-full mt-2 ${a.severity === 'success' ? 'bg-green-500' : a.severity === 'warning' ? 'bg-yellow-500' : a.severity === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.message}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResolveAlert(a)}
                        className="ml-2 h-8 text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Resolve
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No alerts at the moment.</p>
                )}
              </div>
            </div>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="announcements" className="space-y-8">
            <AnnouncementManagement userRole="system_admin" />
          </TabsContent>
          </Tabs>
        </div>
        
        {/* Hidden file input for school profile picture uploads */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
