import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import StatsCard from "@/components/stats/stats-card";
import { Users, FileText, Heart, Trophy, UserPlus, BarChart3, Settings } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function SchoolAdmin() {
  const { user } = useAuth();
  
  const { data: schoolStats, isLoading } = useQuery({
    queryKey: ["/api/schools", user?.schoolId, "stats"],
    enabled: !!user?.schoolId,
  });

  const { data: students } = useQuery({
    queryKey: ["/api/schools", user?.schoolId, "students"],
    enabled: !!user?.schoolId,
  });

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
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">LR</span>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-semibold text-foreground">School Dashboard</h1>
                <p className="text-sm text-muted-foreground">Washington High School</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button 
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                data-testid="button-add-student"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
              <div className="flex items-center space-x-3">
                <img
                  className="h-8 w-8 rounded-full"
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&h=400"
                  alt="Admin profile"
                />
                <span className="text-sm font-medium text-foreground">{user?.name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Students"
            value={schoolStats?.totalStudents || 0}
            trend="+12 this semester"
            icon={Users}
            iconColor="text-accent"
          />
          <StatsCard
            title="Total Posts"
            value={schoolStats?.totalPosts || 0}
            trend="+45 this week"
            icon={FileText}
            iconColor="text-primary"
          />
          <StatsCard
            title="Total Engagement"
            value={`${(schoolStats?.totalEngagement || 0).toLocaleString()}`}
            trend="+18% this month"
            icon={Heart}
            iconColor="text-secondary"
          />
          <StatsCard
            title="Active Sports"
            value={schoolStats?.activeSports || 0}
            description="Fall season"
            icon={Trophy}
            iconColor="text-accent"
          />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Recent Student Activity</h2>
              </div>
              <div className="divide-y divide-border">
                {/* Mock recent activity */}
                <div className="p-6 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <img
                      className="h-12 w-12 rounded-full"
                      src="https://images.unsplash.com/photo-1546525848-3ce03ca516f6?auto=format&fit=crop&w=400&h=400"
                      alt="Student"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">Marcus Rodriguez</span> posted a new highlight video
                      </p>
                      <p className="text-sm text-muted-foreground">Basketball • 2 hours ago</p>
                    </div>
                    <div className="text-sm text-muted-foreground">247 likes</div>
                  </div>
                </div>
                
                <div className="p-6 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <img
                      className="h-12 w-12 rounded-full"
                      src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400"
                      alt="Student"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">Emma Thompson</span> shared her first goal of the season
                      </p>
                      <p className="text-sm text-muted-foreground">Soccer • 4 hours ago</p>
                    </div>
                    <div className="text-sm text-muted-foreground">189 likes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* School Management */}
          <div className="space-y-6">
            {/* Top Performing Students */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Top Performers</h2>
                <p className="text-sm text-muted-foreground">Most engaged students this month</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-accent-foreground">1</span>
                  </div>
                  <img
                    className="h-10 w-10 rounded-full"
                    src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400"
                    alt="Student"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Alex Johnson</p>
                    <p className="text-sm text-muted-foreground">2.1K likes • Basketball</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-secondary/80 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-secondary-foreground">2</span>
                  </div>
                  <img
                    className="h-10 w-10 rounded-full"
                    src="https://images.unsplash.com/photo-1546525848-3ce03ca516f6?auto=format&fit=crop&w=400&h=400"
                    alt="Student"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Marcus Rodriguez</p>
                    <p className="text-sm text-muted-foreground">1.8K likes • Basketball</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Button
                  className="w-full justify-start bg-accent hover:bg-accent/90 text-accent-foreground"
                  data-testid="button-add-new-student"
                >
                  <UserPlus className="w-5 h-5 mr-3" />
                  Add New Student
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-view-reports"
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  View Reports
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-manage-settings"
                >
                  <Settings className="w-5 h-5 mr-3" />
                  Manage Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
