import { Link, useLocation } from "wouter";
import { Home, Search, Plus, BarChart3, User, LogOut, Settings, Bookmark, Users, Eye, Bot, Menu, X, LayoutDashboard, TrendingUp, UserPlus, Building2, Shield, Megaphone, Bell, Layers, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { logout } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MobileNav() {
  const [location, setLocation] = useLocation();
  const { user, updateUser } = useAuth();
  const { platformName, logoUrl } = useBranding();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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

  const getDrawerItems = () => {
    if (user?.role === "student") {
      return [
        { name: "Saved", href: "/saved", icon: Bookmark },
        { name: "Following", href: "/following", icon: Users },
        { name: "Notifications", href: "/notifications", icon: Bell },
        { name: "Stats", href: "/stats", icon: BarChart3 },
        { name: "XEN Watch", href: "/xen-watch", icon: Eye },
        { name: "ScoutAI", href: "/scoutai", icon: Bot },
        { name: "Settings", href: "/settings", icon: Settings },
      ];
    } else if (user?.role === "viewer") {
      return [
        { name: "Saved", href: "/saved", icon: Bookmark },
        { name: "Following", href: "/following", icon: Users },
        { name: "Notifications", href: "/notifications", icon: Bell },
        { name: "XEN Watch", href: "/xen-watch", icon: Eye },
        { name: "ScoutAI", href: "/scoutai", icon: Bot },
        { name: "Settings", href: "/settings", icon: Settings },
      ];
    } else if (user?.role === "school_admin") {
      const studentContentItems = getStudentContentItems();
      const feedHref = "/school-admin/feed";
      const isActive = isStudentContentActive(feedHref);
      return [
        { name: "Student Content", href: "#", icon: Layers, active: isActive, isDropdown: true, dropdownItems: studentContentItems },
        { name: "Dashboard", href: "/school-admin", icon: LayoutDashboard },
        { name: "Notifications", href: "/notifications", icon: Bell },
        { name: "Announcements", href: "/school-admin/announcements", icon: Megaphone },
        { name: "Add Student", href: "/school-admin/add-student", icon: UserPlus },
        { name: "Live Reports", href: "/school-admin/live-reports", icon: BarChart3 },
        { name: "Student Search", href: "/school-admin/student-search", icon: Search },
        { name: "Settings", href: "/settings", icon: Settings },
      ];
    } else if (user?.role === "system_admin") {
      const studentContentItems = getStudentContentItems();
      const feedHref = "/system-admin/feed";
      const isActive = isStudentContentActive(feedHref);
      return [
        { name: "Student Content", href: "#", icon: Layers, active: isActive, isDropdown: true, dropdownItems: studentContentItems },
        { name: "Dashboard", href: "/system-admin", icon: LayoutDashboard },
        { name: "Notifications", href: "/notifications", icon: Bell },
        { name: "Announcements", href: "/system-admin/announcements", icon: Megaphone },
        { name: "Create School", href: "/system-admin/create-school", icon: Building2 },
        { name: "Create Admin", href: "/system-admin/create-school-admin", icon: UserPlus },
        { name: "Manage Schools", href: "/system-admin/manage-schools", icon: Building2 },
        { name: "Platform Analytics", href: "/admin/platform-analytics", icon: TrendingUp },
        { name: "System Config", href: "/admin/system-config", icon: Settings },
        { name: "Manage Admins", href: "/admin/admin-management", icon: Shield },
        { name: "Settings", href: "/settings", icon: Settings },
      ];
    } else if (user?.role === "scout_admin" || user?.role === "xen_scout") {
      const studentContentItems = getStudentContentItems();
      const feedHref = "/feed";
      const isActive = isStudentContentActive(feedHref);
      const scoutNav = [
        { name: "Student Content", href: "#", icon: Layers, active: isActive, isDropdown: true, dropdownItems: studentContentItems },
        { name: "Notifications", href: "/notifications", icon: Bell },
        { name: "Scout Queue", href: "/xen-watch/scout-queue", icon: Eye },
      ];
      
      // Add Scout Admin Dashboard for scout_admin role
      if (user?.role === "scout_admin") {
        scoutNav.push(
          { name: "Admin Dashboard", href: "/scouts/admin", icon: LayoutDashboard },
          { name: "Manage Scouts", href: "/scouts/admin/manage-scouts", icon: Users },
          { name: "XEN Watch Analytics", href: "/scouts/admin/xen-watch-analytics", icon: TrendingUp }
        );
      }
      
      return [
        ...scoutNav,
        { name: "Settings", href: "/settings", icon: Settings },
      ];
    } else {
      return [
        { name: "Stats", href: "/stats", icon: BarChart3 },
        { name: "Settings", href: "/settings", icon: Settings },
      ];
    }
  };

  const drawerItems = getDrawerItems();

  // Helper function to get the correct profile/dashboard link based on user role
  const getProfileLink = () => {
    if (user?.role === "school_admin") {
      return "/school-admin";
    } else if (user?.role === "system_admin") {
      return "/system-admin";
    } else if (user?.role === "scout_admin") {
      return "/scouts/admin";
    } else if (user?.role === "xen_scout") {
      return "/xen-watch/scout-queue";
    } else {
      return "/profile";
    }
  };

  // Helper function to get the correct profile/dashboard label
  const getProfileLabel = () => {
    if (user?.role === "school_admin" || user?.role === "system_admin" || user?.role === "scout_admin") {
      return "Dashboard";
    } else if (user?.role === "xen_scout") {
      return "Queue";
    } else {
      return "Profile";
    }
  };

  // Helper function to get the correct profile/dashboard icon
  const getProfileIcon = () => {
    if (user?.role === "school_admin" || user?.role === "system_admin" || user?.role === "scout_admin") {
      return LayoutDashboard;
    } else if (user?.role === "xen_scout") {
      return Eye;
    } else {
      return User;
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 w-full bg-card border-t border-border shadow-lg z-50">
        <div className="flex justify-around items-center h-16">
          {/* Feed */}
          <Link href="/feed">
            <div
              className={`flex flex-col items-center py-2 px-3 transition-all duration-200 cursor-pointer ${
                location === "/feed" ? "text-accent font-bold" : "text-muted-foreground hover:text-accent"
              }`}
              data-testid="mobile-nav-feed"
            >
              <Home className="w-6 h-6" />
              <span className="text-xs mt-1">Feed</span>
            </div>
          </Link>

          {/* Search */}
          <Link href="/search">
            <div
              className={`flex flex-col items-center py-2 px-3 transition-all duration-200 cursor-pointer ${
                location === "/search" ? "text-accent font-bold" : "text-muted-foreground hover:text-accent"
              }`}
              data-testid="mobile-nav-search"
            >
              <Search className="w-6 h-6" />
              <span className="text-xs mt-1">Search</span>
            </div>
          </Link>

          {/* Create - Floating Button (Only for Students) */}
          {user?.role === "student" && (
            <Link href="/create">
              <div
                className={`flex flex-col items-center py-2 px-3 transition-all duration-200 cursor-pointer ${
                  location === "/create" ? "text-accent font-bold" : "text-muted-foreground hover:text-accent"
                }`}
                data-testid="mobile-nav-create"
              >
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center fab">
                  <Plus className="w-6 h-6 text-accent-foreground" />
                </div>
                <span className="text-xs mt-1">Create</span>
              </div>
            </Link>
          )}

          {/* Profile/Dashboard */}
          <Link href={getProfileLink()}>
            <div
              className={`flex flex-col items-center py-2 px-3 transition-all duration-200 cursor-pointer ${
                (user?.role === "school_admin" && location.startsWith("/school-admin")) ||
                (user?.role === "system_admin" && location.startsWith("/system-admin")) ||
                (user?.role === "scout_admin" && location.startsWith("/scouts/admin")) ||
                (user?.role === "xen_scout" && location.startsWith("/xen-watch/scout-queue")) ||
                (user?.role !== "school_admin" && user?.role !== "system_admin" && user?.role !== "scout_admin" && user?.role !== "xen_scout" && location.startsWith("/profile"))
                  ? "text-accent font-bold" 
                  : "text-muted-foreground hover:text-accent"
              }`}
              data-testid="mobile-nav-profile"
            >
              {user?.role === "school_admin" || user?.role === "system_admin" || user?.role === "scout_admin" ? (
                <LayoutDashboard className="w-6 h-6" />
              ) : user?.role === "xen_scout" ? (
                <Eye className="w-6 h-6" />
              ) : (
                <AvatarWithFallback 
                  src={displayProfilePic}
                  alt={displayUser?.name || "Profile"}
                  fallbackText={displayUser?.name?.slice(0, 2).toUpperCase() || "??"}
                  size="sm"
                  className="w-6 h-6"
                />
              )}
              <span className="text-xs mt-1">{getProfileLabel()}</span>
            </div>
          </Link>

          {/* Hamburger Menu */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex flex-col items-center py-2 px-3 transition-all duration-200 text-muted-foreground hover:text-accent"
            data-testid="mobile-nav-menu"
          >
            <Menu className="w-6 h-6" />
            <span className="text-xs mt-1">Menu</span>
          </button>
        </div>
      </nav>

      {/* Drawer Overlay */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 lg:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-card border-r border-border z-50 lg:hidden transform drawer-slide ${
        isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center space-x-3">
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
              <span className="text-xl font-bold text-foreground">{platformName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDrawerOpen(false)}
              className="p-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* User Profile Section */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center space-x-3">
              <AvatarWithFallback 
                src={displayProfilePic}
                alt={displayUser?.name || "User"}
                fallbackText={displayUser?.name?.slice(0, 2).toUpperCase() || "??"}
                size="lg"
              />
              <div>
                <p className="font-medium text-foreground">{displayUser?.name || "User"}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {displayUser?.role?.replace("_", " ") || ""}
                </p>
              </div>
            </div>
          </div>

          {/* Drawer Navigation */}
          <div className="flex-1 overflow-y-auto">
            <nav className="p-4 space-y-2">
              {drawerItems.map((item) => {
                const showBadge = item.name === "Notifications" && unreadCount && unreadCount.count > 0;
                
                // Render dropdown for Student Content
                if ((item as any).isDropdown && (item as any).dropdownItems) {
                  return (
                    <div key={item.name}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                              item.active
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                            data-testid={`drawer-nav-${item.name.toLowerCase()}`}
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
                                  onClick={() => setIsDrawerOpen(false)}
                                >
                                  <dropdownItem.icon className="w-4 h-4 mr-2" />
                                  {dropdownItem.name}
                                </DropdownMenuItem>
                              </Link>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                }
                
                // Render regular navigation item
                return (
                  <Link key={item.name} href={item.href}>
                    <div
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer ${
                        item.active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      onClick={() => setIsDrawerOpen(false)}
                      data-testid={`drawer-nav-${item.name.toLowerCase()}`}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      <span className="flex-1">{item.name}</span>
                      {showBadge && (
                        <Badge className="ml-2 bg-red-500 text-white text-xs min-w-[1.25rem] h-5 flex items-center justify-center px-1.5">
                          {unreadCount.count > 99 ? "99+" : unreadCount.count}
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-border space-y-3">
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
      </div>
    </>
  );
}
