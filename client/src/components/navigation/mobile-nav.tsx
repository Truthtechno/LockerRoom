import { Link, useLocation } from "wouter";
import { Home, Search, Plus, BarChart3, User, LogOut, Settings, Bookmark, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/lib/auth";

export default function MobileNav() {
  const [location, setLocation] = useLocation();
  const { user, updateUser } = useAuth();

  const handleLogout = () => {
    logout();
    updateUser(null);
    setLocation("/login");
  };

  const getNavigation = () => {
    if (user?.role === "student") {
      return [
        { name: "Feed", href: "/feed", icon: Home, active: location === "/feed" },
        { name: "Search", href: "/search", icon: Search, active: location === "/search" },
        { name: "Create", href: "/create", icon: Plus, active: location === "/create" },
        { name: "Stats", href: "/stats", icon: BarChart3, active: location === "/stats" },
        { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
      ];
    } else if (user?.role === "viewer") {
      return [
        { name: "Feed", href: "/feed", icon: Home, active: location === "/feed" },
        { name: "Search", href: "/search", icon: Search, active: location === "/search" },
        { name: "Saved", href: "/saved", icon: Bookmark, active: location === "/saved" },
        { name: "Following", href: "/following", icon: Users, active: location === "/following" },
      ];
    } else {
      return [
        { name: "Feed", href: "/feed", icon: Home, active: location === "/feed" },
        { name: "Search", href: "/search", icon: Search, active: location === "/search" },
        { name: "Stats", href: "/stats", icon: BarChart3, active: location === "/stats" },
        { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
      ];
    }
  };

  const navigation = getNavigation();

  return (
    <div className="mobile-nav lg:hidden bg-card border-t border-border">
      <div className={`grid py-2 ${navigation.length === 4 ? 'grid-cols-4' : 'grid-cols-5'}`}>
        {navigation.map((item) => (
          <Link key={item.name} href={item.href}>
            <div
              className={`flex flex-col items-center py-2 px-1 transition-colors cursor-pointer ${
                item.active ? "text-accent" : "text-muted-foreground"
              }`}
              data-testid={`mobile-nav-${item.name.toLowerCase()}`}
            >
              {item.name === "Profile" ? (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <img
                    className="w-5 h-5 rounded-full"
                    src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400"
                    alt="Profile"
                  />
                </div>
              ) : (
                <item.icon className="w-6 h-6" />
              )}
              <span className="text-xs mt-1">{item.name}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
