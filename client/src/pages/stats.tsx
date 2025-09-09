import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Heart, Eye, MessageCircle, Bookmark, Award, Target, Calendar, Trophy } from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import type { StudentWithStats } from "@shared/schema";

const CHART_COLORS = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

export default function StudentStats() {
  const { user } = useAuth();

  const { data: studentProfile, isLoading } = useQuery<StudentWithStats>({
    queryKey: ["/api/students/profile", user?.id],
    enabled: !!user?.id,
  });

  // Fetch real analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/students/analytics", studentProfile?.id],
    enabled: !!studentProfile?.id,
  });

  // Fetch real performance data
  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ["/api/students/performance", studentProfile?.id],
    enabled: !!studentProfile?.id,
  });

  // Use real data or fallback to defaults
  const monthlyEngagementData = analyticsData?.monthlyEngagement || [];
  
  const engagementData = [
    { name: 'Likes', value: studentProfile?.totalLikes || 0, color: '#FFD700' },
    { name: 'Comments', value: studentProfile?.totalComments || 0, color: '#FFA500' },
    { name: 'Saves', value: studentProfile?.totalSaves || 0, color: '#FF6B6B' },
    { name: 'Views', value: studentProfile?.totalViews || 0, color: '#4ECDC4' },
  ];

  // Use real sports performance data
  const sportsSkillsData = performanceData?.sportsPerformance || [];
  const monthlyGoalsData = performanceData?.monthlyGoals || [];

  const isLoadingData = isLoading || analyticsLoading || performanceLoading;

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your stats...</p>
        </div>
      </div>
    );
  }

  if (!studentProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Performance Analytics</h1>
              <p className="text-muted-foreground mt-1">
                Track your sports performance and social engagement
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="flex items-center">
                <Trophy className="w-4 h-4 mr-2" />
                #{studentProfile.roleNumber}
              </Badge>
              <Badge variant="secondary">{studentProfile.position}</Badge>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="p-4 lg:p-8 space-y-8 pb-20 lg:pb-8">
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Eye className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{studentProfile.totalViews || '1.2K'}</p>
                    <p className="text-sm text-muted-foreground">Total Views</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                    <Heart className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{studentProfile.totalLikes || '245'}</p>
                    <p className="text-sm text-muted-foreground">Total Likes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{studentProfile.totalComments || '78'}</p>
                    <p className="text-sm text-muted-foreground">Comments</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{studentProfile.postsCount || '14'}</p>
                    <p className="text-sm text-muted-foreground">Posts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Engagement Trend
                </CardTitle>
                <CardDescription>
                  Your post engagement over the last 6 months
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyEngagementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="likes" stroke="#FFD700" strokeWidth={2} />
                    <Line type="monotone" dataKey="comments" stroke="#FFA500" strokeWidth={2} />
                    <Line type="monotone" dataKey="saves" stroke="#FF6B6B" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Engagement Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Engagement Distribution
                </CardTitle>
                <CardDescription>
                  Breakdown of your social media engagement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={engagementData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {engagementData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Sports Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Skills Radar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Award className="w-5 h-5 mr-2" />
                  Sports Performance
                </CardTitle>
                <CardDescription>
                  Your current skills vs target performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sportsSkillsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="skill" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="score" fill="#FFD700" name="Current Score" />
                    <Bar dataKey="target" fill="#FFA500" name="Target Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Goals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Goal Achievement
                </CardTitle>
                <CardDescription>
                  Monthly training and performance goals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyGoalsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" stackId="a" fill="#4ECDC4" name="Completed" />
                    <Bar dataKey="total" fill="#E8E8E8" name="Remaining" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="w-5 h-5 mr-2" />
                Recent Achievements
              </CardTitle>
              <CardDescription>
                Your latest accomplishments and milestones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="p-2 bg-yellow-500 rounded-full mr-4">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Regional Champion 2024</h4>
                    <p className="text-sm text-muted-foreground">Scored winning goal in championship match</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto">
                    Latest
                  </Badge>
                </div>

                <div className="flex items-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="p-2 bg-blue-500 rounded-full mr-4">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Team Captain</h4>
                    <p className="text-sm text-muted-foreground">Elected as team captain for 2024 season</p>
                  </div>
                  <Badge variant="outline" className="ml-auto">
                    Dec 2024
                  </Badge>
                </div>

                <div className="flex items-center p-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="p-2 bg-green-500 rounded-full mr-4">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Most Assists</h4>
                    <p className="text-sm text-muted-foreground">Leading in assists for the academy</p>
                  </div>
                  <Badge variant="outline" className="ml-auto">
                    Nov 2024
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <MobileNav />
    </div>
  );
}