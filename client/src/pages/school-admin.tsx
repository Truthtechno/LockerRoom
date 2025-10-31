import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import StatsCard from "@/components/stats/stats-card";
import { Users, FileText, Heart, Trophy, UserPlus, BarChart3, Settings, LogOut, Search, Clock, Image, Video, RefreshCw, ChevronRight, Megaphone } from "lucide-react";
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
import { AdminFeed } from "@/components/admin/admin-feed";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

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
}

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

  const handleLogout = () => {
    logout(); // logout() now handles clearing data and redirecting
  };

  const handleAddStudent = () => {
    setLocation("/school-admin/add-student");
  };

  const handleViewReports = () => {
    setLocation("/school-admin/live-reports");
  };

  const handleManageSettings = () => {
    setLocation("/school-admin/manage-settings");
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

  // Fetch school stats with caching
  const { data: schoolStats, isLoading: statsLoading } = useQuery<SchoolStats>({
    queryKey: ["/api/schools", user?.schoolId, "stats"],
    queryFn: async () => {
      if (!user?.schoolId) throw new Error("No school ID available");
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${user.schoolId}/stats`, {
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
    staleTime: 10000, // Cache for 10 seconds (reduced for better responsiveness)
  });

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
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">School Dashboard</h1>
              <p className="text-muted-foreground text-sm lg:text-base">
                {schoolLoading ? "Loading..." : schoolInfo?.name || "School Not Found"}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                onClick={handleRefreshData}
                variant="outline"
                size="sm"
                data-testid="button-refresh-data"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
              <Button 
                onClick={handleAddStudent}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                data-testid="button-add-student"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="feed">Feed</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-8">
            {/* Overview Stats */}
            {statsLoading ? (
              <StatsSkeleton />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-8">
            <StatsCard
              title="Total Students"
              value={schoolStats?.totalStudents || 0}
              trend="+12 this semester"
              icon={Users}
              iconColor="text-accent"
            />
            <StatsCard
              title="Total Posts"
              value={schoolStats?.totalPosts || 0}
              trend="+45 this week"
              icon={FileText}
              iconColor="text-primary"
            />
            <StatsCard
              title="Total Engagement"
              value={`${(schoolStats?.totalEngagement || 0).toLocaleString()}`}
              trend="+18% this month"
              icon={Heart}
              iconColor="text-secondary"
            />
            <StatsCard
              title="Active Sports"
              value={schoolStats?.activeSports || 0}
              description="Fall season"
              icon={Trophy}
              iconColor="text-accent"
            />
          </div>
        )}
        
        {/* Debug logging for rendered data */}
        {schoolStats && (() => {
          console.log("🎯 Rendering stats with data:", {
            totalStudents: schoolStats.totalStudents,
            totalPosts: schoolStats.totalPosts,
            totalEngagement: schoolStats.totalEngagement,
            activeSports: schoolStats.activeSports
          });
          return null;
        })()}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Recent Student Activity</h2>
              </div>
              <div className="divide-y divide-border">
                {/* Debug logging for activity data */}
                {recentActivity && (() => {
                  console.log("📈 Rendering activity with data:", recentActivity);
                  return null;
                })()}
                
                {activityLoading ? (
                  <ActivitySkeleton />
                ) : recentActivity && recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="p-3 sm:p-6 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        <Avatar className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10">
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
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          {activity.engagement} engagement
                        </div>
                      </div>
                    </div>
                  ))
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

          {/* School Management */}
          <div className="space-y-4 sm:space-y-6">
            {/* Top Performing Students */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Top Performers</h2>
                <p className="text-sm text-muted-foreground">Most engaged students this month</p>
              </div>
              {/* Debug logging for performers data */}
              {topPerformers && (() => {
                console.log("🏆 Rendering performers with data:", topPerformers);
                return null;
              })()}
              
              {performersLoading ? (
                <TopPerformersSkeleton />
              ) : topPerformers && topPerformers.length > 0 ? (
                <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
                  {topPerformers.map((performer, index) => (
                    <div key={performer.studentId} className="flex items-center space-x-3">
                      <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
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
                      <Avatar className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10">
                        <AvatarImage 
                          src={performer.studentProfilePic || performer.mediaUrl || ""} 
                          alt={performer.studentName} 
                        />
                        <AvatarFallback>{performer.studentName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm sm:text-base truncate">{performer.studentName}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {performer.totalEngagement.toLocaleString()} engagement • {performer.sport}
                        </p>
                      </div>
                    </div>
                  ))}
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
              <Disclosure>
                {({ open }: { open: boolean }) => (
                  <>
                    <DisclosureButton className="w-full px-4 sm:px-6 py-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors">
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
                  onClick={handleManageSettings}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-manage-settings"
                >
                  <Settings className="w-5 h-5 mr-3" />
                  Manage Settings
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
                  </>
                )}
              </Disclosure>
            </div>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="announcements" className="space-y-8">
            <AnnouncementManagement userRole="school_admin" schoolId={user?.schoolId || undefined} />
          </TabsContent>

          <TabsContent value="feed" className="space-y-8">
            <div className="bg-card border border-border rounded-xl p-2 sm:p-4 lg:p-6 shadow-sm">
              <AdminFeed userRole="school_admin" schoolId={user?.schoolId || undefined} />
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}