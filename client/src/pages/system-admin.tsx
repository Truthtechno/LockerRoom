import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import StatsCard from "@/components/stats/stats-card";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, FileText, DollarSign, BarChart3, Settings, UserPlus, Shield, LogOut } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function SystemAdmin() {
  const { user, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: systemStats, isLoading } = useQuery<{
    totalSchools: number;
    activeStudents: number;
    contentUploads: number;
    monthlyRevenue: number;
    premiumSchools: number;
    standardSchools: number;
  }>({
    queryKey: ["/api/system/stats"],
  });

  const { data: schools } = useQuery<any[]>({
    queryKey: ["/api/schools"],
  });

  const handleLogout = () => {
    logout();
    updateUser(null);
    setLocation("/login");
  };

  const handleReviewApplications = () => {
    toast({
      title: "School Applications",
      description: "School review system coming soon!",
    });
  };

  const handlePlatformAnalytics = () => {
    toast({
      title: "Analytics",
      description: "Advanced platform analytics coming soon!",
    });
  };

  const handleSystemConfig = () => {
    toast({
      title: "Configuration",
      description: "System configuration panel coming soon!",
    });
  };

  const handleManageAdmins = () => {
    toast({
      title: "Admin Management",
      description: "Administrator management system coming soon!",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="w-10 h-10 gold-gradient rounded-lg flex items-center justify-center">
                <span className="text-accent-foreground font-bold text-lg">XEN</span>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-semibold text-foreground">System Administration</h1>
                <p className="text-sm text-muted-foreground">XEN Sports Armoury Platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-muted px-3 py-2 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-foreground">System Online</span>
              </div>
              <div className="flex items-center space-x-3">
                <ThemeToggle />
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="icon"
                  data-testid="system-admin-logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
                <div className="flex items-center space-x-3">
                  <img
                    className="h-8 w-8 rounded-full"
                    src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&h=400"
                    alt="System admin"
                  />
                  <span className="text-sm font-medium text-foreground">{user?.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Schools"
            value={systemStats?.totalSchools || 0}
            trend="+28 this month"
            icon={Building2}
            iconColor="text-accent"
          />
          <StatsCard
            title="Active Students"
            value={`${(systemStats?.activeStudents || 0).toLocaleString()}`}
            trend="+1.2K this month"
            icon={Users}
            iconColor="text-primary"
          />
          <StatsCard
            title="Content Uploads"
            value={`${(systemStats?.contentUploads || 0).toLocaleString()}`}
            trend="+5.2K this week"
            icon={FileText}
            iconColor="text-secondary"
          />
          <StatsCard
            title="Monthly Revenue"
            value={`$${(systemStats?.monthlyRevenue || 0).toLocaleString()}`}
            trend="+23% this month"
            icon={DollarSign}
            iconColor="text-accent"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Platform Analytics */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent School Registrations */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Recent School Registrations</h2>
                <p className="text-sm text-muted-foreground">New schools joining the platform</p>
              </div>
              <div className="divide-y divide-border">
                {/* Mock recent schools */}
                <div className="p-6 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <img
                        className="h-12 w-12 rounded-lg object-cover"
                        src="https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=400&h=400"
                        alt="School"
                      />
                      <div>
                        <h3 className="font-medium text-foreground">Lincoln High School</h3>
                        <p className="text-sm text-muted-foreground">Springfield, IL • Premium Plan • 450 students</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                      <p className="text-sm text-muted-foreground mt-1">Registered 2 days ago</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <img
                        className="h-12 w-12 rounded-lg object-cover"
                        src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=400&h=400"
                        alt="School"
                      />
                      <div>
                        <h3 className="font-medium text-foreground">Roosevelt Academy</h3>
                        <p className="text-sm text-muted-foreground">Portland, OR • Standard Plan • 320 students</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                      <p className="text-sm text-muted-foreground mt-1">Registered 4 days ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Health Metrics */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground">Platform Health</h2>
                <p className="text-sm text-muted-foreground">System performance and usage metrics</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-2">
                    <div className="text-2xl font-bold text-green-600">99.8%</div>
                  </div>
                  <p className="text-sm font-medium text-foreground">Uptime</p>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </div>
                
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <div className="text-2xl font-bold text-blue-600">1.2s</div>
                  </div>
                  <p className="text-sm font-medium text-foreground">Avg Response</p>
                  <p className="text-xs text-muted-foreground">Page load time</p>
                </div>
                
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-2">
                    <div className="text-2xl font-bold text-purple-600">2.4M</div>
                  </div>
                  <p className="text-sm font-medium text-foreground">API Requests</p>
                  <p className="text-xs text-muted-foreground">This month</p>
                </div>
              </div>
            </div>
          </div>

          {/* System Management */}
          <div className="space-y-6">
            {/* System Actions */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">System Management</h2>
              <div className="space-y-3">
                <Button
                  onClick={handleReviewApplications}
                  className="w-full justify-between bg-accent hover:bg-accent/90 text-accent-foreground"
                  data-testid="button-review-applications"
                >
                  <div className="flex items-center">
                    <Building2 className="w-5 h-5 mr-3" />
                    Review School Applications
                  </div>
                  <span className="bg-accent-foreground/20 text-accent-foreground px-2 py-1 rounded text-sm">3</span>
                </Button>
                
                <Button
                  onClick={handlePlatformAnalytics}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-platform-analytics"
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  Platform Analytics
                </Button>
                
                <Button
                  onClick={handleSystemConfig}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-system-config"
                >
                  <Settings className="w-5 h-5 mr-3" />
                  System Configuration
                </Button>
                
                <Button
                  onClick={handleManageAdmins}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-manage-admins"
                >
                  <Shield className="w-5 h-5 mr-3" />
                  Manage Administrators
                </Button>
              </div>
            </div>

            {/* Subscription Overview */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">Subscription Plans</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Premium Schools</p>
                    <p className="text-sm text-muted-foreground">Advanced features</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{systemStats?.premiumSchools || 0}</p>
                    <p className="text-sm text-accent">$150/month each</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Standard Schools</p>
                    <p className="text-sm text-muted-foreground">Basic features</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{systemStats?.standardSchools || 0}</p>
                    <p className="text-sm text-accent">$75/month each</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">Total MRR</p>
                    <p className="text-xl font-bold text-accent">${(systemStats?.monthlyRevenue || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* System Alerts */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">System Alerts</h2>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-green-800">System Update Completed</p>
                    <p className="text-xs text-green-600">Version 2.1.4 deployed successfully</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Database Backup Complete</p>
                    <p className="text-xs text-blue-600">Scheduled backup finished at 2:00 AM</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Storage Usage: 78%</p>
                    <p className="text-xs text-yellow-600">Consider upgrading storage capacity</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
