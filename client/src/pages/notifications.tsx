import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import { Button } from "@/components/ui/button";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  Bell, 
  Check, 
  CheckCheck,
  Heart,
  MessageCircle,
  UserPlus,
  Megaphone,
  Award,
  FileText,
  AlertCircle,
  TrendingUp,
  Users,
  Eye,
  Star,
  BarChart3,
  Settings,
  Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/timeAgo";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  relatedUserId: string | null;
  metadata: string | null;
  isRead: boolean;
  createdAt: string;
  relatedUser?: {
    id: string;
    name: string;
    profilePicUrl?: string | null;
  };
}

const getNotificationIcon = (type: string) => {
  const iconMap: Record<string, typeof Heart> = {
    post_like: Heart,
    post_comment: MessageCircle,
    new_follower: UserPlus,
    announcement: Megaphone,
    scout_feedback: Award,
    submission_pending: FileText,
    submission_finalized: CheckCheck,
    rating_result: Star,
    student_signup: UserPlus,
    system_alert: AlertCircle,
    platform_usage: TrendingUp,
    new_submission: FileText,
    scout_profile_created: Users,
    submission_progress: BarChart3,
    platform_news: Megaphone,
    following_posted: Eye,
  };
  return iconMap[type] || Bell;
};

const getNotificationColor = (type: string) => {
  const colorMap: Record<string, string> = {
    post_like: "text-red-500",
    post_comment: "text-blue-500",
    new_follower: "text-green-500",
    announcement: "text-yellow-500",
    scout_feedback: "text-purple-500",
    submission_pending: "text-orange-500",
    submission_finalized: "text-green-500",
    rating_result: "text-amber-500",
    student_signup: "text-blue-500",
    system_alert: "text-red-500",
    platform_usage: "text-indigo-500",
    new_submission: "text-orange-500",
    scout_profile_created: "text-cyan-500",
    submission_progress: "text-blue-500",
    platform_news: "text-yellow-500",
    following_posted: "text-blue-500",
  };
  return colorMap[type] || "text-gray-500";
};

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  
  const { data: notifications, isLoading, error } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", user?.id, filter],
    queryFn: async () => {
      if (!user) return [];
      const params = new URLSearchParams();
      if (filter === "unread") {
        params.append("unreadOnly", "true");
      }
      params.append("limit", "50");
      const response = await apiRequest("GET", `/api/notifications?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to fetch notifications" }));
        const error = new Error(errorData.message || errorData.error?.message || "Failed to fetch notifications");
        console.error('❌ Notifications page fetch error:', errorData);
        throw error;
      }
      const data = await response.json();
      console.log('✅ Notifications page loaded:', Array.isArray(data) ? data.length : 0, 'notifications');
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 2,
    staleTime: 0, // Always refetch to get latest data
    refetchOnWindowFocus: true,
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count", user?.id],
    queryFn: async () => {
      if (!user) return { count: 0 };
      const response = await apiRequest("GET", "/api/notifications/unread-count");
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest("PUT", `/api/notifications/${notificationId}/read`);
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/notifications/read-all");
      if (!response.ok) throw new Error("Failed to mark all as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({
        title: "All notifications marked as read",
        description: "All notifications have been marked as read.",
      });
    },
  });

  const handleMarkAsRead = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    handleMarkAsRead(notification);
    
    // Navigate based on notification type
    if (notification.entityType === "post" && notification.entityId) {
      window.location.href = `/post/${notification.entityId}`;
    } else if (notification.entityType === "user" && notification.relatedUserId) {
      window.location.href = `/profile/${notification.relatedUserId}`;
    } else if (notification.entityType === "submission" && notification.entityId) {
      window.location.href = `/xen-watch`;
    } else if (notification.type === "announcement" && notification.entityId) {
      window.location.href = `/feed`;
    }
  };

  const filteredNotifications = notifications || [];

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1 pb-24 lg:pb-0">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                  <Bell className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
                  {unreadCount && unreadCount.count > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {unreadCount.count} unread notification{unreadCount.count !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
              {filteredNotifications.length > 0 && unreadCount && unreadCount.count > 0 && (
                <Button
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  {markAllAsReadMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCheck className="w-4 h-4 mr-2" />
                  )}
                  Mark all as read
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex space-x-4">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === "all"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors relative ${
                filter === "unread"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Unread
              {unreadCount && unreadCount.count > 0 && (
                <Badge className="ml-2 bg-red-500 text-white">{unreadCount.count}</Badge>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="max-w-md w-full bg-card border border-border rounded-2xl p-12 text-center shadow-lg">
                  <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Bell className="w-8 h-8 text-destructive" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">Unable to Load Notifications</h3>
                  <p className="text-muted-foreground mb-6">
                    {(error as any)?.message || "Something went wrong. Please try again."}
                  </p>
                  <Button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] })}
                    variant="outline"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : filteredNotifications.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredNotifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  const iconColor = getNotificationColor(notification.type);
                  
                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`bg-card border border-border rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:border-accent/50 ${
                        !notification.isRead ? "bg-accent/5 border-accent/30 ring-2 ring-accent/20" : ""
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center ${iconColor}`}>
                          {notification.relatedUser?.profilePicUrl ? (
                            <AvatarWithFallback
                              src={notification.relatedUser.profilePicUrl}
                              alt={notification.relatedUser.name}
                              size="sm"
                            />
                          ) : (
                            <Icon className="w-5 h-5" />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {notification.title}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {notification.message}
                              </p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {timeAgo(notification.createdAt)}
                                </span>
                              </div>
                            </div>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0 mt-2" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="max-w-md w-full bg-card border border-border rounded-2xl p-12 text-center shadow-lg">
                  <div className="w-20 h-20 bg-gradient-to-br from-accent/20 to-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Bell className="w-10 h-10 text-accent" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">
                    {filter === "unread" ? "All Caught Up!" : "No Notifications Yet"}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {filter === "unread"
                      ? "You're all caught up! Check back later for new notifications."
                      : "Notifications about likes, comments, follows, and more will appear here when they occur."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}

