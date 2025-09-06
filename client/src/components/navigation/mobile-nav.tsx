import { Link, useLocation } from "wouter";
import { Home, Search, Plus, BarChart3, User } from "lucide-react";

export default function MobileNav() {
  const [location] = useLocation();

  const navigation = [
    { name: "Feed", href: "/feed", icon: Home, active: location === "/feed" },
    { name: "Search", href: "/search", icon: Search, active: location === "/search" },
    { name: "Create", href: "/create", icon: Plus, active: location === "/create" },
    { name: "Stats", href: "/stats", icon: BarChart3, active: location === "/stats" },
    { name: "Profile", href: "/profile", icon: User, active: location === "/profile" },
  ];

  return (
    <div className="mobile-nav lg:hidden bg-card border-t border-border">
      <div className="grid grid-cols-5 py-2">
        {navigation.map((item) => (
          <Link key={item.name} href={item.href}>
            <a
              className={`flex flex-col items-center py-2 px-1 transition-colors ${
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
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
