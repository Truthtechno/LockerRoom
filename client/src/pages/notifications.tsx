import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
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
  Clock,
  DollarSign,
  Building2,
  Shield
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
    role?: string | null;
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
    submission_created: FileText, // Scout: new student submission
    review_submitted: MessageCircle, // Scout: review submitted
    scout_created: Users, // Scout admin: scout profile created
    submission_received: FileText, // Student: submission received
    submission_feedback_ready: CheckCheck, // Student: feedback ready
    rating_result: Star,
    student_signup: UserPlus,
    system_alert: AlertCircle,
    platform_usage: TrendingUp,
    new_submission: FileText,
    scout_profile_created: Users,
    submission_progress: BarChart3,
    platform_news: Megaphone,
    following_posted: Eye,
    xen_watch_payment: DollarSign, // System admin: XEN Watch payment received
    subscription_expiring: AlertCircle,
    school_created: Building2, // System admin: new school created
    school_admin_created: Shield, // System admin: new school admin created
    xen_scout_created: Users, // System admin: new xen scout created
    scout_admin_created: Shield, // System admin: new scout admin created
    school_payment_recorded: DollarSign, // System/School admin: school payment recorded
    school_renewal: CheckCheck, // System/School admin: school subscription renewed
    school_limit_increase: TrendingUp, // System/School admin: student limit increased
    school_limit_decrease: TrendingUp, // System/School admin: student limit decreased
    school_frequency_change: Settings, // System/School admin: payment frequency changed
    form_created: FileText, // System/Scout admin/XEN Scout: evaluation form created
    form_submitted: FileText, // System/Scout admin: evaluation form submitted by scout
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
    submission_created: "text-orange-500", // Scout: new student submission
    review_submitted: "text-blue-500", // Scout: review submitted
    scout_created: "text-cyan-500", // Scout admin: scout profile created
    submission_received: "text-blue-500", // Student: submission received
    submission_feedback_ready: "text-green-500", // Student: feedback ready
    rating_result: "text-amber-500",
    student_signup: "text-blue-500",
    system_alert: "text-red-500",
    platform_usage: "text-indigo-500",
    new_submission: "text-orange-500",
    scout_profile_created: "text-cyan-500",
    submission_progress: "text-blue-500",
    platform_news: "text-yellow-500",
    following_posted: "text-blue-500",
    xen_watch_payment: "text-green-600", // System admin: XEN Watch payment received
    subscription_expiring: "text-orange-500",
    school_created: "text-blue-600", // System admin: new school created
    school_admin_created: "text-purple-600", // System admin: new school admin created
    xen_scout_created: "text-cyan-500", // System admin: new xen scout created
    scout_admin_created: "text-indigo-600", // System admin: new scout admin created
    school_payment_recorded: "text-green-600", // System/School admin: school payment recorded
    school_renewal: "text-green-500", // System/School admin: school subscription renewed
    school_limit_increase: "text-blue-500", // System/School admin: student limit increased
    school_limit_decrease: "text-orange-500", // System/School admin: student limit decreased
    school_frequency_change: "text-purple-500", // System/School admin: payment frequency changed
    form_created: "text-blue-500", // System/Scout admin/XEN Scout: evaluation form created
    form_submitted: "text-green-500", // System/Scout admin: evaluation form submitted by scout
  };
  return colorMap[type] || "text-gray-500";
};

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  
  const { data: notifications, isLoading, error, isFetching } = useQuery<Notification[]>({
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
    refetchInterval: 60000, // Refetch every 60 seconds (reduced frequency)
    retry: 2,
    staleTime: 30000, // Consider data fresh for 30 seconds to reduce unnecessary refetches
    refetchOnWindowFocus: true,
    refetchOnMount: true,
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
    refetchInterval: 60000, // Refetch every 60 seconds
    staleTime: 30000, // Consider data fresh for 30 seconds
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
    onMutate: async () => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/notifications", user?.id] });
      await queryClient.cancelQueries({ queryKey: ["/api/notifications/unread-count", user?.id] });

      // Snapshot the previous values for rollback
      const previousNotifications = queryClient.getQueryData<Notification[]>(["/api/notifications", user?.id, filter]);
      const previousUnreadCount = queryClient.getQueryData<{ count: number }>(["/api/notifications/unread-count", user?.id]);

      // Optimistically update the unread count to 0 immediately
      queryClient.setQueryData<{ count: number }>(["/api/notifications/unread-count", user?.id], { count: 0 });

      // Optimistically update all notification queries to mark all as read
      // This ensures instant UI update regardless of which filter is active
      queryClient.setQueriesData<Notification[]>(
        { queryKey: ["/api/notifications", user?.id] },
        (old) => {
          if (!old) return old;
          // Mark all notifications as read
          return old.map(notif => ({ ...notif, isRead: true }));
        }
      );

      // For "unread" filter specifically, set to empty array since all will be read
      queryClient.setQueryData<Notification[]>(["/api/notifications", user?.id, "unread"], []);

      return { previousNotifications, previousUnreadCount };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(["/api/notifications", user?.id, filter], context.previousNotifications);
      }
      if (context?.previousUnreadCount) {
        queryClient.setQueryData(["/api/notifications/unread-count", user?.id], context.previousUnreadCount);
      }
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Instead of invalidating (which triggers slow refetch), directly update cache
      // This ensures the UI stays updated instantly without showing stale data
      queryClient.setQueryData<{ count: number }>(["/api/notifications/unread-count", user?.id], { count: 0 });
      
      // Update all notification queries to ensure they're marked as read
      queryClient.setQueriesData<Notification[]>(
        { queryKey: ["/api/notifications", user?.id] },
        (old) => {
          if (!old) return old;
          return old.map(notif => ({ ...notif, isRead: true }));
        }
      );
      
      // Set unread filter to empty
      queryClient.setQueryData<Notification[]>(["/api/notifications", user?.id, "unread"], []);

      // Show success toast
      toast({
        title: "All notifications marked as read",
        description: "All notifications have been marked as read.",
      });

      // Note: We don't invalidate queries here to avoid triggering slow refetches
      // The cache is already updated correctly, and the background polling will sync eventually
    },
  });

  const handleMarkAsRead = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Don't navigate for scout_created notifications (no destination)
    if (notification.type === "scout_created") {
      handleMarkAsRead(notification);
      return;
    }

    handleMarkAsRead(notification);
    
    // Navigate based on notification type
    if (notification.entityType === "post" && notification.entityId) {
      // For post-related notifications, navigate to the post
      if (notification.type === "post_comment") {
        // For comment notifications, navigate to post and scroll to comments section
        window.location.href = `/post/${notification.entityId}?scrollToComments=true`;
      } else if (notification.type === "following_posted") {
        // For new post notifications from followed students, navigate to the post
        window.location.href = `/post/${notification.entityId}`;
      } else {
        // For other post-related notifications (like, etc.), navigate to the post
        window.location.href = `/post/${notification.entityId}`;
      }
    } else if (notification.type === "new_follower" && notification.relatedUserId) {
      // For new_follower notifications, only navigate if the follower is a student
      // (unclickable for viewers, scouts, scout admins, school admins, system admins)
      if (notification.relatedUser?.role === 'student') {
        window.location.href = `/profile/${notification.relatedUserId}`;
      }
      // If not a student, do nothing (non-clickable)
    } else if (notification.entityType === "user" && notification.relatedUserId && notification.type !== "new_follower") {
      // For other user-related notifications (not new_follower), navigate to profile
      window.location.href = `/profile/${notification.relatedUserId}`;
    } else if (notification.entityType === "submission" && notification.entityId) {
      // For submission notifications, navigate based on notification type
      if (notification.type === "review_submitted") {
        // For review notifications, navigate to scout queue with the review
        const reviewScoutId = notification.relatedUserId ? `&reviewScoutId=${notification.relatedUserId}` : '';
        window.location.href = `/xen-watch/scout-queue?submissionId=${notification.entityId}&showReview=true${reviewScoutId}`;
      } else if (notification.type === "submission_received") {
        // For submission received notifications, navigate to XEN Watch page with submission ID to open the modal
        window.location.href = `/xen-watch?submissionId=${notification.entityId}`;
      } else if (notification.type === "submission_feedback_ready") {
        // For feedback ready notifications, navigate to XEN Watch page with submission ID and show feedback flag
        window.location.href = `/xen-watch?submissionId=${notification.entityId}&showFeedback=true`;
      } else {
        // For submission_created and submission_finalized (scout notifications), navigate to scout queue
        window.location.href = `/xen-watch/scout-queue?submissionId=${notification.entityId}`;
      }
    } else if (notification.type === "announcement" && notification.entityId) {
      window.location.href = `/feed`;
    }
  };

  // Memoize filtered notifications to prevent unnecessary re-renders
  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];
    // The filter is already applied server-side via the query, so just return notifications
    return notifications;
  }, [notifications]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        {/* Header */}
        <div className="bg-card border-b border-border px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                  className="self-start sm:self-auto"
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
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                filter === "all"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors relative disabled:opacity-50 disabled:cursor-not-allowed ${
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
            ) : isFetching && !notifications ? (
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
              <>
                {isFetching && notifications && (
                  <div className="mb-4 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Updating...</span>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredNotifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  const iconColor = getNotificationColor(notification.type);
                  
                  // Determine if notification is clickable
                  let isClickable = true;
                  if (notification.type === "scout_created") {
                    isClickable = false; // No destination
                  } else if (notification.type === "new_follower") {
                    // Only clickable if the follower is a student
                    isClickable = notification.relatedUser?.role === 'student';
                  }

                  return (
                    <div
                      key={notification.id}
                      onClick={() => isClickable && handleNotificationClick(notification)}
                      className={`bg-card border border-border rounded-xl p-5 transition-all ${
                        isClickable 
                          ? "cursor-pointer hover:shadow-lg hover:border-accent/50" 
                          : "cursor-default opacity-80"
                      } ${
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
              </>
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

