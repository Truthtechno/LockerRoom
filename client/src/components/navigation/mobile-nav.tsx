import { Link, useLocation } from "wouter";
import { Home, Search, Plus, BarChart3, User, LogOut, Settings, Bookmark, Users, Eye, Bot, Menu, X, LayoutDashboard, TrendingUp, UserPlus, Building2, Shield, Megaphone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function MobileNav() {
  const [location, setLocation] = useLocation();
  const { user, updateUser } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

  // Use currentUserData if available, otherwise fall back to user from auth hook
  // For students, prefer studentProfile profilePicUrl as it may be more up-to-date
  const displayUser = currentUserData || user;
  const displayProfilePic = studentProfile?.profilePicUrl || displayUser?.profilePicUrl;

  const handleLogout = () => {
    logout(); // logout() now handles clearing data and redirecting
  };

  const getDrawerItems = () => {
    if (user?.role === "student") {
      return [
        { name: "Stats", href: "/stats", icon: BarChart3 },
        { name: "XEN Watch", href: "/xen-watch", icon: Eye },
        { name: "ScoutAI", href: "/scoutai", icon: Bot },
        { name: "Settings", href: "/settings", icon: Settings },
      ];
    } else if (user?.role === "viewer") {
      return [
        { name: "Saved", href: "/saved", icon: Bookmark },
        { name: "Following", href: "/following", icon: Users },
        { name: "XEN Watch", href: "/xen-watch", icon: Eye },
        { name: "ScoutAI", href: "/scoutai", icon: Bot },
        { name: "Settings", href: "/settings", icon: Settings },
      ];
    } else if (user?.role === "school_admin") {
      return [
        { name: "Feed", href: "/school-admin/feed", icon: Home },
        { name: "Dashboard", href: "/school-admin", icon: LayoutDashboard },
        { name: "Announcements", href: "/school-admin/announcements", icon: Megaphone },
        { name: "Add Student", href: "/school-admin/add-student", icon: UserPlus },
        { name: "Live Reports", href: "/school-admin/live-reports", icon: BarChart3 },
        { name: "Student Search", href: "/school-admin/student-search", icon: Search },
        { name: "Manage Settings", href: "/school-admin/manage-settings", icon: Settings },
        { name: "Settings", href: "/settings", icon: Settings },
      ];
    } else if (user?.role === "system_admin") {
      return [
        { name: "Feed", href: "/system-admin/feed", icon: Home },
        { name: "Announcements", href: "/system-admin/announcements", icon: Megaphone },
        { name: "Create School", href: "/system-admin/create-school", icon: Building2 },
        { name: "Create Admin", href: "/system-admin/create-school-admin", icon: UserPlus },
        { name: "Platform Analytics", href: "/admin/platform-analytics", icon: TrendingUp },
        { name: "System Config", href: "/admin/system-config", icon: Settings },
        { name: "Manage Admins", href: "/admin/admin-management", icon: Shield },
        { name: "Settings", href: "/settings", icon: Settings },
      ];
    } else if (user?.role === "scout_admin" || user?.role === "xen_scout") {
      const scoutNav = [
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
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">LR</span>
              </div>
              <span className="text-xl font-bold text-foreground">LockerRoom</span>
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
              {drawerItems.map((item) => (
                <Link key={item.name} href={item.href}>
                  <div
                    className="flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => setIsDrawerOpen(false)}
                    data-testid={`drawer-nav-${item.name.toLowerCase()}`}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </div>
                </Link>
              ))}
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
