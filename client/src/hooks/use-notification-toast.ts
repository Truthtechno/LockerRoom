import React, { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Heart,
  MessageCircle,
  UserPlus,
  Megaphone,
  Award,
  FileText,
  CheckCheck,
  Users,
  Star,
  AlertCircle,
  TrendingUp,
  Eye,
  BarChart3,
  Settings,
  DollarSign,
  Building2,
  Shield,
  Bell,
} from "lucide-react";

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
    submission_created: FileText,
    review_submitted: MessageCircle,
    scout_created: Users,
    submission_received: FileText,
    submission_feedback_ready: CheckCheck,
    rating_result: Star,
    student_signup: UserPlus,
    system_alert: AlertCircle,
    platform_usage: TrendingUp,
    new_submission: FileText,
    scout_profile_created: Users,
    submission_progress: BarChart3,
    platform_news: Megaphone,
    following_posted: Eye,
    xen_watch_payment: DollarSign,
    subscription_expiring: AlertCircle,
    school_created: Building2,
    school_admin_created: Shield,
    xen_scout_created: Users,
    scout_admin_created: Shield,
    school_payment_recorded: DollarSign,
    school_renewal: CheckCheck,
    school_limit_increase: TrendingUp,
    school_limit_decrease: TrendingUp,
    school_frequency_change: Settings,
    form_created: FileText, // System/Scout admin/XEN Scout: evaluation form created
    form_submitted: FileText, // System/Scout admin: evaluation form submitted by scout
  };
  return iconMap[type] || Bell;
};

const getNotificationVariant = (type: string): "default" | "destructive" | "success" | "info" | "warning" | "social" => {
  if (type.includes("payment") || type.includes("renewal") || type.includes("success") || type.includes("submitted") || type.includes("confirmed")) {
    return "success";
  }
  if (type.includes("alert") || type.includes("expiring") || type.includes("error")) {
    return "warning";
  }
  if (type.includes("like") || type.includes("follower") || type.includes("comment") || type.includes("posted")) {
    return "social";
  }
  if (type.includes("announcement") || type.includes("news") || type.includes("form_created")) {
    return "info";
  }
  return "default";
};

const getNotificationRoute = (notification: Notification): string | null => {
  if (notification.entityType === "post" && notification.entityId) {
    return `/post/${notification.entityId}`;
  }
  if (notification.entityType === "user" && notification.entityId) {
    return `/profile/${notification.entityId}`;
  }
  if (notification.entityType === "submission" && notification.entityId) {
    return `/xen-watch`;
  }
  if (notification.entityType === "evaluation_form_submission" && notification.entityId) {
    return `/admin/evaluation-submissions`;
  }
  if (notification.relatedUserId) {
    return `/profile/${notification.relatedUserId}`;
  }
  return null;
};

/**
 * Hook to automatically show toast notifications for new unread notifications
 * Polls for notifications and shows pop-up toasts for new ones
 */
export function useNotificationToast() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const shownNotificationIds = useRef<Set<string>>(new Set());
  const lastCheckTime = useRef<number>(0); // Start at 0, will be set on first check
  const isFirstCheck = useRef<boolean>(true);

  // Poll for new notifications
  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", user?.id, "toast"],
    queryFn: async () => {
      if (!user) return [];
      const response = await apiRequest("GET", "/api/notifications?limit=10&unreadOnly=true");
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 15000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!notifications || notifications.length === 0) {
      // On first check with no notifications, mark as checked but don't set time yet
      if (isFirstCheck.current) {
        isFirstCheck.current = false;
      }
      return;
    }

    // On first check, show notifications from the last 5 minutes
    // On subsequent checks, only show notifications created after the last check
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const cutoffTime = isFirstCheck.current ? fiveMinutesAgo : (lastCheckTime.current || fiveMinutesAgo);
    
    const newNotifications = notifications.filter((notification) => {
      const notificationTime = new Date(notification.createdAt).getTime();
      const isNew = notificationTime > cutoffTime;
      const notShown = !shownNotificationIds.current.has(notification.id);
      return isNew && notShown && !notification.isRead;
    });

    // Update last check time
    lastCheckTime.current = Date.now();
    isFirstCheck.current = false;

    // Show toast for each new notification
    newNotifications.forEach((notification) => {
      // Mark as shown to prevent duplicates
      shownNotificationIds.current.add(notification.id);

      const Icon = getNotificationIcon(notification.type);
      const variant = getNotificationVariant(notification.type);
      const route = getNotificationRoute(notification);

      // Show toast notification
      // Debug: Log notification data
      console.log('🔔 Showing toast notification:', {
        id: notification.id,
        type: notification.type,
        relatedUser: notification.relatedUser ? {
          id: notification.relatedUser.id,
          name: notification.relatedUser.name,
          profilePicUrl: notification.relatedUser.profilePicUrl,
          role: notification.relatedUser.role,
        } : null,
      });
      
      toast({
        title: notification.title,
        description: notification.message,
        variant,
        avatar: notification.relatedUser
          ? {
              src: notification.relatedUser.profilePicUrl || undefined, // Let AvatarWithFallback handle null/undefined
              alt: notification.relatedUser.name || 'User',
              fallbackText: notification.relatedUser.name || 'User',
            }
          : undefined,
        icon: !notification.relatedUser ? (
          React.createElement(Icon, { className: "h-5 w-5" })
        ) : undefined,
        onClick: route
          ? () => {
              setLocation(route);
            }
          : undefined,
      });
    });
  }, [notifications, toast, setLocation]);

  // Cleanup: Remove old notification IDs from the set to prevent memory leaks
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      // Keep only IDs from the last hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      shownNotificationIds.current.forEach((id) => {
        // In a real implementation, you'd track timestamps per ID
        // For simplicity, we'll just clear if the set gets too large
        if (shownNotificationIds.current.size > 100) {
          shownNotificationIds.current.clear();
        }
      });
    }, 5 * 60 * 1000); // Run cleanup every 5 minutes

    return () => clearInterval(cleanupInterval);
  }, []);
}

