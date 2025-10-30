import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { Home, User, BarChart3, Settings, LogOut, Bookmark, Users, Eye, Bot, LayoutDashboard, TrendingUp, UserPlus, Building2, Search, Shield, Megaphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, updateUser } = useAuth();

  // Fetch current user data for all roles to ensure consistent profile display
  // This ensures profilePicUrl is always fresh and available
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
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount to ensure fresh data
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

  const getNavigation = () => {
    const baseNav = [
      { name: "Feed", href: "/feed", icon: Home, active: location === "/feed" },
    ];
    
    if (user?.role === "student") {
      return [
        ...baseNav,
        { name: "Profile", href: "/profile", icon: User, active: location.startsWith("/profile") },
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
        { name: "XEN Watch", href: "/xen-watch", icon: Eye, active: location === "/xen-watch" },
        { name: "ScoutAI", href: "/scoutai", icon: Bot, active: location === "/scoutai" },
        { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
      ];
    } else if (user?.role === "school_admin") {
      return [
        { name: "Feed", href: "/school-admin/feed", icon: Home, active: location === "/school-admin/feed" },
        { name: "Dashboard", href: "/school-admin", icon: LayoutDashboard, active: location === "/school-admin" },
        { name: "Announcements", href: "/school-admin/announcements", icon: Megaphone, active: location.startsWith("/school-admin/announcements") },
        { name: "Add Student", href: "/school-admin/add-student", icon: UserPlus, active: location.startsWith("/school-admin/add-student") },
        { name: "Live Reports", href: "/school-admin/live-reports", icon: BarChart3, active: location.startsWith("/school-admin/live-reports") },
        { name: "Student Search", href: "/school-admin/student-search", icon: Search, active: location.startsWith("/school-admin/student-search") },
        { name: "Manage Settings", href: "/school-admin/manage-settings", icon: Settings, active: location.startsWith("/school-admin/manage-settings") },
        { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
      ];
    } else if (user?.role === "system_admin") {
      return [
        { name: "Feed", href: "/system-admin/feed", icon: Home, active: location === "/system-admin/feed" },
        { name: "Dashboard", href: "/system-admin", icon: LayoutDashboard, active: location === "/system-admin" },
        { name: "Announcements", href: "/system-admin/announcements", icon: Megaphone, active: location.startsWith("/system-admin/announcements") },
        { name: "Create School", href: "/system-admin/create-school", icon: Building2, active: location.startsWith("/system-admin/create-school") },
        { name: "Create Admin", href: "/system-admin/create-school-admin", icon: UserPlus, active: location.startsWith("/system-admin/create-school-admin") },
        { name: "Platform Analytics", href: "/admin/platform-analytics", icon: TrendingUp, active: location.startsWith("/admin/platform-analytics") },
        { name: "System Config", href: "/admin/system-config", icon: Settings, active: location.startsWith("/admin/system-config") },
        { name: "Manage Admins", href: "/admin/admin-management", icon: Shield, active: location.startsWith("/admin/admin-management") },
        { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
      ];
    } else if (user?.role === "scout_admin" || user?.role === "xen_scout") {
      const scoutNav = [
        ...baseNav,
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
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">LR</span>
            </div>
            <span className="ml-3 text-xl font-bold text-foreground">LockerRoom</span>
          </div>

          {/* Navigation */}
          <nav className="mt-8 flex-1 px-4 space-y-2">
            {navigation.map((item) => (
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
                  {item.name}
                </a>
              </Link>
            ))}
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
