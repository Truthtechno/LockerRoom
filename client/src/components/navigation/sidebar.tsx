import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Home, User, BarChart3, Settings, LogOut } from "lucide-react";

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, updateUser } = useAuth();

  const handleLogout = () => {
    logout();
    updateUser(null);
    setLocation("/login");
  };

  const navigation = [
    { name: "Feed", href: "/feed", icon: Home, active: location === "/feed" },
    { name: "Profile", href: "/profile", icon: User, active: location === "/profile", studentOnly: true },
    { name: "Stats", href: "/stats", icon: BarChart3, active: location === "/stats" },
    { name: "Settings", href: "/settings", icon: Settings, active: location === "/settings" },
  ];

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
            {navigation.map((item) => {
              if (item.studentOnly && user.role !== "student") return null;
              
              return (
                <Link key={item.name} href={item.href}>
                  <a
                    className={`group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      item.active
                        ? "bg-accent/20 text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    data-testid={`nav-${item.name.toLowerCase()}`}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </a>
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="px-4 py-4">
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
          <div className="flex items-center w-full">
            <img
              className="inline-block h-10 w-10 rounded-full"
              src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400"
              alt="Profile"
            />
            <div className="ml-3 min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-xs font-medium text-muted-foreground capitalize">
                {user.role.replace("_", " ")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
