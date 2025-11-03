import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { Home, User, BarChart3, Settings, LogOut, Bookmark, Users, Eye, Bot, LayoutDashboard, TrendingUp, UserPlus, Building2, Search, Shield, Megaphone, Bell, Layers, ChevronDown } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, updateUser } = useAuth();
  const { platformName, logoUrl } = useBranding();
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<string | undefined>(user?.id);

  // Fetch current user data for all roles to ensure consistent profile display
  // This ensures profilePicUrl is always fresh and available
  // CRITICAL: Include user?.id in query key to prevent stale data when switching users
  const { data: currentUserData } = useQuery({
    queryKey: ["/api/users/me", user?.id],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/users/me");
      if (!r.ok) throw new Error("failed to fetch user");
      const data = await r.json();
      // Update auth context with fresh data
      if (data && updateUser) {
        updateUser(data);
      }
      return data;
    },
    enabled: !!user?.id,
    staleTime: 0, // Always consider data stale to force fresh fetches after login
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount to ensure fresh data
    // When user.id changes, this query will automatically refetch due to query key change
  });

  // Watch for user changes and invalidate queries when user.id changes
  // This ensures the nav bar updates immediately when logging in with a different user
  useEffect(() => {
    const currentUserId = user?.id;
    const previousUserId = previousUserIdRef.current;

    // If user ID has changed (e.g., after login/logout), invalidate all user queries
    if (currentUserId !== previousUserId && currentUserId) {
      // Invalidate user queries to force fresh fetch
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students/me"] });
      // Update the ref to track the new user ID
      previousUserIdRef.current = currentUserId;
    } else if (!currentUserId && previousUserId) {
      // User logged out - clear queries
      queryClient.removeQueries({ queryKey: ["/api/users/me"] });
      queryClient.removeQueries({ queryKey: ["/api/students/me"] });
      previousUserIdRef.current = undefined;
    } else if (currentUserId && !previousUserId) {
      // User logged in - ensure queries are fresh
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students/me"] });
      previousUserIdRef.current = currentUserId;
    }

    // Listen for auth-change events to immediately refresh data
    const handleAuthChange = () => {
      // Always invalidate queries regardless of current user state
      // This ensures fresh data after login/logout
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students/me"] });
    };

    window.addEventListener('auth-change', handleAuthChange);

    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, [user?.id, queryClient]);

  // Fetch student profile for students to get additional student-specific data
  // IMPORTANT: Include user.id in query key to prevent stale data when switching between students
  const { data: studentProfile } = useQuery({
    queryKey: ["/api/students/me", user?.id],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/students/me");
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    enabled: !!user?.id && user?.role === "student",
    staleTime: 30_000,
  });

  // Fetch unread notifications count for badge display
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count", user?.id],
    queryFn: async () => {
      if (!user) return { count: 0 };
      const response = await apiRequest("GET", "/api/notifications/unread-count");
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds to keep count fresh
    staleTime: 0, // Always consider stale to ensure fresh data
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Use currentUserData if available and matches current user, otherwise fall back to user from auth hook
  // This prevents showing stale data from a previous user session
  // For students, prefer studentProfile profilePicUrl as it may be more up-to-date
  const displayUser = (currentUserData && currentUserData.id === user?.id) ? currentUserData : user;
  const displayProfilePic = studentProfile?.profilePicUrl || displayUser?.profilePicUrl;

  const handleLogout = () => {
    logout(); // logout() now handles clearing data and redirecting
  };

  // Helper to check if any student content route is active
  const isStudentContentActive = (feedHref: string) => {
    return location === feedHref || location === "/saved" || location === "/following";
  };

  // Helper to get student content dropdown items based on role
  const getStudentContentItems = () => {
    if (user?.role === "system_admin") {
      return [
        { name: "Feed", href: "/system-admin/feed", icon: Home },
        { name: "Saved", href: "/saved", icon: Bookmark },
        { name: "Following", href: "/following", icon: Users },
      ];
    } else if (user?.role === "school_admin") {
      return [
        { name: "Feed", href: "/school-admin/feed", icon: Home },
        { name: "Saved", href: "/saved", icon: Bookmark },
        { name: "Following", href: "/following", icon: Users },
      ];
    } else if (user?.role === "scout_admin" || user?.role === "xen_scout") {
      return [
        { name: "Feed", href: "/feed", icon: Home },
        { name: "Saved", href: "/saved", icon: Bookmark },
        { name: "Following", href: "/following", icon: Users },
      ];
    }
    return [];
  };

  const getNavigation = () => {
    const baseNav = [
      { name: "Feed", href: "/feed", icon: Home, active: location === "/feed" },
    ];
    
    if (user?.role === "student") {
      return [
        ...baseNav,
        { name: "Profile", href: "/profile", icon: User, active: location.startsWith("/profile") },
        { name: "Saved", href: "/saved", icon: Bookmark, active: location === "/saved" },
        { name: "Following", href: "/following", icon: Users, active: location === "/following" },
        { name: "Notifications", href: "/notifications", icon: Bell, active: location === "/notifications" },
        { name: "Stats", href: "/stats", icon: BarChart3, active: location === "/stats" },
        { name: "XEN Watch", href: "/xen-watch", icon: Eye, active: location === "/xen-watch" },
        { name: "ScoutAI", href: "/scoutai", icon: Bot, active: location === "/scoutai" },
        { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
      ];
    } else if (user?.role === "viewer") {
      return [
        ...baseNav,
        { name: "Profile", href: "/profile", icon: User, active: location.startsWith("/profile") },
        { name: "Saved", href: "/saved", icon: Bookmark, active: location === "/saved" },
        { name: "Following", href: "/following", icon: Users, active: location === "/following" },
        { name: "Notifications", href: "/notifications", icon: Bell, active: location === "/notifications" },
        { name: "XEN Watch", href: "/xen-watch", icon: Eye, active: location === "/xen-watch" },
        { name: "ScoutAI", href: "/scoutai", icon: Bot, active: location === "/scoutai" },
        { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
      ];
    } else if (user?.role === "school_admin") {
      const studentContentItems = getStudentContentItems();
      const feedHref = "/school-admin/feed";
      const isActive = isStudentContentActive(feedHref);
      return [
        { name: "Student Content", href: "#", icon: Layers, active: isActive, isDropdown: true, dropdownItems: studentContentItems },
        { name: "Dashboard", href: "/school-admin", icon: LayoutDashboard, active: location === "/school-admin" },
        { name: "Notifications", href: "/notifications", icon: Bell, active: location === "/notifications" },
        { name: "Announcements", href: "/school-admin/announcements", icon: Megaphone, active: location.startsWith("/school-admin/announcements") },
        { name: "Add Student", href: "/school-admin/add-student", icon: UserPlus, active: location.startsWith("/school-admin/add-student") },
        { name: "Live Reports", href: "/school-admin/live-reports", icon: BarChart3, active: location.startsWith("/school-admin/live-reports") },
        { name: "Student Search", href: "/school-admin/student-search", icon: Search, active: location.startsWith("/school-admin/student-search") },
        { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
      ];
    } else if (user?.role === "system_admin") {
      const studentContentItems = getStudentContentItems();
      const feedHref = "/system-admin/feed";
      const isActive = isStudentContentActive(feedHref);
      return [
        { name: "Student Content", href: "#", icon: Layers, active: isActive, isDropdown: true, dropdownItems: studentContentItems },
        { name: "Dashboard", href: "/system-admin", icon: LayoutDashboard, active: location === "/system-admin" },
        { name: "Notifications", href: "/notifications", icon: Bell, active: location === "/notifications" },
        { name: "Announcements", href: "/system-admin/announcements", icon: Megaphone, active: location.startsWith("/system-admin/announcements") },
        { name: "Create School", href: "/system-admin/create-school", icon: Building2, active: location.startsWith("/system-admin/create-school") },
        { name: "Create Admin", href: "/system-admin/create-school-admin", icon: UserPlus, active: location.startsWith("/system-admin/create-school-admin") },
        { name: "Manage Schools", href: "/system-admin/manage-schools", icon: Building2, active: location.startsWith("/system-admin/manage-schools") },
        { name: "Platform Analytics", href: "/admin/platform-analytics", icon: TrendingUp, active: location.startsWith("/admin/platform-analytics") },
        { name: "System Config", href: "/admin/system-config", icon: Settings, active: location.startsWith("/admin/system-config") },
        { name: "Manage Admins", href: "/admin/admin-management", icon: Shield, active: location.startsWith("/admin/admin-management") },
        { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
      ];
    } else if (user?.role === "scout_admin" || user?.role === "xen_scout") {
      const studentContentItems = getStudentContentItems();
      const feedHref = "/feed";
      const isActive = isStudentContentActive(feedHref);
      const scoutNav = [
        { name: "Student Content", href: "#", icon: Layers, active: isActive, isDropdown: true, dropdownItems: studentContentItems },
        { name: "Notifications", href: "/notifications", icon: Bell, active: location === "/notifications" },
        { name: "Scout Queue", href: "/xen-watch/scout-queue", icon: Eye, active: location.startsWith("/xen-watch/scout-queue") },
      ];
      
      // Add Scout Admin Dashboard for scout_admin role
      if (user?.role === "scout_admin") {
        scoutNav.push(
          { name: "Admin Dashboard", href: "/scouts/admin", icon: LayoutDashboard, active: location.startsWith("/scouts/admin") },
          { name: "Manage Scouts", href: "/scouts/admin/manage-scouts", icon: Users, active: location.startsWith("/scouts/admin/manage-scouts") },
          { name: "XEN Watch Analytics", href: "/scouts/admin/xen-watch-analytics", icon: TrendingUp, active: location.startsWith("/scouts/admin/xen-watch-analytics") }
        );
      }
      
      return [
        ...scoutNav,
        { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
      ];
    } else {
      return [
        ...baseNav,
        { name: "Stats", href: "/stats", icon: BarChart3, active: location === "/stats" },
        { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
      ];
    }
  };

  const navigation = getNavigation();

  if (!user) return null;

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex min-h-0 flex-1 flex-col bg-card border-r border-border">
        <div className="flex flex-1 flex-col pt-5 pb-4 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-4">
            {logoUrl ? (
              <img
                src={`${logoUrl}${logoUrl.includes('?') ? '&' : '?'}_=${Date.now()}`}
                alt={`${platformName} logo`}
                className="h-10 w-auto max-w-[120px] object-contain"
                onError={(e) => {
                  // Fallback to default if image fails to load or is removed
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            {!logoUrl && (
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">LR</span>
              </div>
            )}
            <span className="ml-3 text-xl font-bold text-foreground">
              {platformName}
            </span>
          </div>

          {/* Navigation */}
          <nav className="mt-8 flex-1 px-4 space-y-2">
            {navigation.map((item) => {
              const showBadge = item.name === "Notifications" && unreadCount && unreadCount.count > 0;
              
              // Render dropdown for Student Content
              if ((item as any).isDropdown && (item as any).dropdownItems) {
                return (
                  <DropdownMenu key={item.name}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`group flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                          item.active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        data-testid={`nav-${item.name.toLowerCase()}`}
                      >
                        <item.icon className="w-5 h-5 mr-3" />
                        <span className="flex-1 text-left">{item.name}</span>
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {(item as any).dropdownItems.map((dropdownItem: any) => {
                        const isItemActive = location === dropdownItem.href;
                        return (
                          <Link key={dropdownItem.name} href={dropdownItem.href}>
                            <DropdownMenuItem
                              className={`cursor-pointer ${
                                isItemActive ? "bg-accent text-accent-foreground" : ""
                              }`}
                            >
                              <dropdownItem.icon className="w-4 h-4 mr-2" />
                              {dropdownItem.name}
                            </DropdownMenuItem>
                          </Link>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }
              
              // Render regular navigation item
              return (
                <Link key={item.name} href={item.href}>
                  <a
                    className={`group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                      item.active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    data-testid={`nav-${item.name.toLowerCase()}`}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    <span className="flex-1">{item.name}</span>
                    {showBadge && (
                      <Badge className="ml-2 bg-red-500 text-white text-xs min-w-[1.25rem] h-5 flex items-center justify-center px-1.5">
                        {unreadCount.count > 99 ? "99+" : unreadCount.count}
                      </Badge>
                    )}
                  </a>
                </Link>
              );
            })}
          </nav>

          {/* Theme Toggle and Logout */}
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Theme</span>
              <ThemeToggle />
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full justify-start"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* User Profile */}
        <div className="flex-shrink-0 flex bg-muted p-4">
          <Link href="/profile" className="flex items-center w-full cursor-pointer hover:bg-muted/80 rounded-lg p-2 -m-2 transition-colors">
            <AvatarWithFallback 
              src={displayProfilePic}
              alt={displayUser?.name || "Me"}
              fallbackText={displayUser?.name?.slice(0, 2).toUpperCase() || "??"}
              size="sm"
            />
            <div className="ml-3 min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {displayUser?.name || "User"}
              </p>
              <p className="text-xs font-medium text-muted-foreground capitalize">
                {displayUser?.role?.replace("_", " ") || ""}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
