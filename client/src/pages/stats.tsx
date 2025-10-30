import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Heart, Eye, MessageCircle, Bookmark, Award, Target, Calendar, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import { apiRequest } from "@/lib/queryClient";
import type { StudentWithStats } from "@shared/schema";

const CHART_COLORS = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

export default function StudentStats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAllMilestones, setShowAllMilestones] = React.useState(false);

  // Auto-create student profile mutation
  const createStudentProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not found");
      
      const profileData = {
        userId: user.id,
        schoolId: user.schoolId || "",
        name: user.name,
        email: user.email,
        phone: "",
        sport: "Soccer",
        position: "Player",
        roleNumber: "0",
        bio: `Hello! I'm ${user.name}, a student athlete at XEN Sports Academy.`
      };

      const response = await apiRequest("POST", "/api/students", profileData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students/me", user?.id] });
    },
    onError: (error: any) => {
      console.error('Profile creation failed:', error);
    }
  });

  // Query for student profile - always runs
  // IMPORTANT: Include user.id in query key to prevent stale data when switching between students
  const { data: studentProfile, isLoading, error: profileError } = useQuery<StudentWithStats>({
    queryKey: ["/api/students/me", user?.id],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/students/me`);
        const data = await response.json();
        console.log("✅ Stats profile loaded successfully:", data);
        return data;
      } catch (error: any) {
        console.log("❌ Stats profile load error:", error);
        throw error;
      }
    },
    enabled: !!user?.id && user?.role === "student",
    staleTime: 30 * 1000, // 30 seconds
    retry: (failureCount, error: any) => {
      if (error?.status === 404) {
        console.log("🚫 Stats profile not found (404), not retrying");
        return false;
      }
      return failureCount < 3;
    }
  });

  // Query for stats data - only runs when profile exists
  // IMPORTANT: Include user.id in query key to prevent stale data when switching between students
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/students/me/stats", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/students/me/stats`);
      const data = await response.json();
      console.log("📊 Stats data loaded:", data);
      return data;
    },
    enabled: !!studentProfile?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Check if profile is missing (404 error)
  const isProfileMissing = (profileError as any)?.status === 404;

  // Use real data from statsData, fallback to studentProfile if needed
  const monthlyEngagementData = statsData?.monthlyEngagement || [];
  
  const engagementData = [
    { name: 'Likes', value: statsData?.totalLikes || 0, color: '#FFD700' },
    { name: 'Comments', value: statsData?.totalComments || 0, color: '#FFA500' },
    { name: 'Saves', value: statsData?.totalSaves || 0, color: '#FF6B6B' },
    { name: 'Views', value: statsData?.totalViews || 0, color: '#4ECDC4' },
  ];

  // Use real weekly activity data from statsData
  const weeklyActivityData = React.useMemo(() => {
    if (statsData?.weeklyActivity && Array.isArray(statsData.weeklyActivity) && statsData.weeklyActivity.length > 0) {
      // Ensure we have all 7 days with proper structure
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return days.map(day => {
        const dayData = statsData.weeklyActivity.find((item: any) => 
          item.day === day || 
          item.dayName === day || 
          item.dayOfWeek === day ||
          item.weekday === day
        );
        return {
          day,
          likes: Number(dayData?.likes || dayData?.likeCount || 0),
          comments: Number(dayData?.comments || dayData?.commentCount || 0),
          posts: Number(dayData?.posts || dayData?.postCount || 0)
        };
      });
    }
    
    // Only use fallback if statsData.weeklyActivity is truly empty/null
    return [
      { day: 'Mon', likes: 0, comments: 0, posts: 0 },
      { day: 'Tue', likes: 0, comments: 0, posts: 0 },
      { day: 'Wed', likes: 0, comments: 0, posts: 0 },
      { day: 'Thu', likes: 0, comments: 0, posts: 0 },
      { day: 'Fri', likes: 0, comments: 0, posts: 0 },
      { day: 'Sat', likes: 0, comments: 0, posts: 0 },
      { day: 'Sun', likes: 0, comments: 0, posts: 0 }
    ];
  }, [statsData?.weeklyActivity]);

  // Helper function to get responsive post title/caption
  const getPostDisplayText = (post: any, fallbackIndex: number) => {
    if (post?.caption) {
      return post.caption.length > 50 ? `${post.caption.substring(0, 50)}...` : post.caption;
    }
    if (post?.title) {
      return post.title.length > 50 ? `${post.title.substring(0, 50)}...` : post.title;
    }
    return `Post #${fallbackIndex + 1}`;
  };

  // Helper function to get full post text for tooltips
  const getPostFullText = (post: any, fallbackIndex: number) => {
    if (post?.caption) {
      return post.caption;
    }
    if (post?.title) {
      return post.title;
    }
    return `Post #${fallbackIndex + 1}`;
  };

  const isLoadingData = isLoading || statsLoading;

  // Error state
  if (!user || user.role !== "student") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Access denied. Student profile required.</p>
        </div>
      </div>
    );
  }

  // Loading state
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

  // Profile not found - show create profile screen
  if (isProfileMissing || (!studentProfile && !isLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold text-foreground mb-4">Performance Analytics</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Create your student profile to start tracking your social media engagement and content performance.
          </p>
          
          <div className="space-y-4">
            <Button 
              onClick={() => createStudentProfile.mutate()}
              disabled={createStudentProfile.isPending}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground py-3 text-lg"
              size="lg"
            >
              {createStudentProfile.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating Your Profile...
                </>
              ) : (
                <>
                  <Trophy className="w-5 h-5 mr-2" />
                  Create Profile & View Stats
                </>
              )}
            </Button>
            
            {createStudentProfile.isError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-sm mb-3">
                  Profile creation failed. Please try again.
                </p>
                <Button 
                  onClick={() => createStudentProfile.mutate()}
                  disabled={createStudentProfile.isPending}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
          
          <div className="mt-8 text-sm text-muted-foreground">
            <p>Your analytics will include:</p>
            <ul className="mt-2 space-y-1 text-left max-w-xs mx-auto">
              <li>• Post engagement metrics</li>
              <li>• Top performing content</li>
              <li>• Monthly growth trends</li>
              <li>• Auto-generated milestones</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1 pb-24 lg:pb-0">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Performance Analytics</h1>
              <p className="text-muted-foreground mt-1">
                Track your social media engagement and content performance
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="flex items-center">
                <Trophy className="w-4 h-4 mr-2" />
                #{studentProfile?.roleNumber || '0'}
              </Badge>
              <Badge variant="secondary">{studentProfile?.position || 'Player'}</Badge>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Eye className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{statsData?.totalViews || 0}</p>
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
                    <p className="text-2xl font-bold">{statsData?.totalLikes || 0}</p>
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
                    <p className="text-2xl font-bold">{statsData?.totalComments || 0}</p>
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
                    <p className="text-2xl font-bold">{statsData?.postsCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Posts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Performance Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Engagement Trend
                </CardTitle>
                <CardDescription>
                  Your activity over the last 7 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyActivityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="likes" stroke="#FFD700" strokeWidth={2} />
                    <Line type="monotone" dataKey="comments" stroke="#FFA500" strokeWidth={2} />
                    <Line type="monotone" dataKey="posts" stroke="#4ECDC4" strokeWidth={2} />
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
                      label={({ name, percent }) => {
                        const total = engagementData.reduce((sum, item) => sum + item.value, 0);
                        if (total === 0) return `${name} 0%`;
                        return `${name} ${(percent * 100).toFixed(0)}%`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {engagementData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [value, name]}
                      labelFormatter={(label) => `Total: ${engagementData.reduce((sum, item) => sum + item.value, 0)}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Performing Posts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Top Performing Posts
              </CardTitle>
              <CardDescription>
                Your most engaging posts ranked by total engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsData?.topPosts && statsData.topPosts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {statsData.topPosts.slice(0, 3).map((post: any, index: number) => (
                    <div 
                      key={post.id} 
                      className="bg-muted/50 rounded-lg overflow-hidden hover:bg-muted/70 transition-colors cursor-pointer group"
                      onClick={() => window.location.href = `/post/${post.id}`}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center relative overflow-hidden">
                        {post.mediaUrl ? (
                          <>
                            <img 
                              src={post.mediaUrl} 
                              alt={post.caption || post.title || 'Post thumbnail'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const nextElement = target.nextElementSibling as HTMLElement;
                                if (nextElement) nextElement.style.display = 'flex';
                              }}
                            />
                            {/* Video play icon overlay */}
                            {post.mediaType === 'video' && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                                  <div className="w-0 h-0 border-l-[8px] border-l-primary border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent ml-1"></div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : null}
                        {/* Fallback placeholder */}
                        <div className="absolute inset-0 flex items-center justify-center" style={{ display: post.mediaUrl ? 'none' : 'flex' }}>
                          <div className="text-center">
                            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-2">
                              <span className="text-2xl font-bold text-primary">#{index + 1}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">No Media</p>
                          </div>
                        </div>
                        {/* Ranking badge */}
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary" className="text-xs font-bold">#{index + 1}</Badge>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-4">
                        <h4 
                          className="font-medium text-sm mb-2 line-clamp-2 cursor-help" 
                          title={getPostFullText(post, index)}
                        >
                          {getPostDisplayText(post, index)}
                        </h4>
                        
                        {/* Engagement Summary */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-1">
                              <Eye className="w-3 h-3" />
                              <span>{post.views || 0}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Heart className="w-3 h-3" />
                              <span>{post.likes || 0}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MessageCircle className="w-3 h-3" />
                              <span>{post.comments || 0}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Bookmark className="w-3 h-3" />
                              <span>{post.saves || 0}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {post.engagement || 0} total
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No posts yet</p>
                  <p className="text-sm">Start posting to see your top performers here</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Growth */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Long-term Engagement Insights */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Long-term Engagement Insights
                </CardTitle>
                <CardDescription>
                  Your engagement metrics over the past months
                </CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyEngagementData.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart 
                        data={monthlyEngagementData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 12 }}
                          angle={monthlyEngagementData.length > 6 ? -45 : 0}
                          textAnchor={monthlyEngagementData.length > 6 ? "end" : "middle"}
                          height={monthlyEngagementData.length > 6 ? 80 : 30}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip 
                          formatter={(value: number, name: string) => [value, name]}
                          labelFormatter={(label) => `Month: ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="views" fill="#4ECDC4" name="Views" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="likes" fill="#FFD700" name="Likes" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="comments" fill="#FFA500" name="Comments" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No monthly data available</p>
                    <p className="text-sm">Data will appear as you post and engage</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Auto-Generated Milestones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="w-5 h-5 mr-2" />
                Auto-Generated Milestones
              </CardTitle>
              <CardDescription>
                Achievements unlocked based on your engagement data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsData?.milestones && statsData.milestones.length > 0 ? (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {statsData.milestones.slice(0, showAllMilestones ? statsData.milestones.length : 3).map((milestone: any, index: number) => {
                      const getIcon = (iconName: string) => {
                        switch (iconName) {
                          case 'eye': return <Eye className="w-5 h-5 text-white" />;
                          case 'heart': return <Heart className="w-5 h-5 text-white" />;
                          case 'calendar': return <Calendar className="w-5 h-5 text-white" />;
                          case 'message': return <MessageCircle className="w-5 h-5 text-white" />;
                          case 'trending': return <TrendingUp className="w-5 h-5 text-white" />;
                          default: return <Trophy className="w-5 h-5 text-white" />;
                        }
                      };

                      const getGradient = (index: number) => {
                        const gradients = [
                          'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-800',
                          'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800',
                          'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800',
                          'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800',
                          'from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 border-pink-200 dark:border-pink-800',
                          'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-800'
                        ];
                        return gradients[index % gradients.length];
                      };

                      const getBgColor = (index: number) => {
                        const colors = ['bg-yellow-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
                        return colors[index % colors.length];
                      };


                      // Helper function to get engagement metric
                      const getEngagementMetric = (milestone: any) => {
                        if (!milestone.post) return null;
                        
                        const post = milestone.post;
                        const engagementType = milestone.title.toLowerCase();
                        
                        if (engagementType.includes('like')) {
                          return `${post.likes || 0} likes`;
                        } else if (engagementType.includes('comment')) {
                          return `${post.comments || 0} comments`;
                        } else if (engagementType.includes('save') || engagementType.includes('bookmark')) {
                          return `${post.saves || 0} saves`;
                        } else if (engagementType.includes('view')) {
                          return `${post.views || 0} views`;
                        } else if (engagementType.includes('share')) {
                          return `${post.shares || 0} shares`;
                        }
                        
                        // Fallback to total engagement if available
                        if (post.engagement) {
                          return `${post.engagement} total engagement`;
                        }
                        
                        return null;
                      };

                      const engagementMetric = getEngagementMetric(milestone);
                      const postDisplayText = milestone.post ? getPostDisplayText(milestone.post, index) : null;
                      const postFullText = milestone.post ? getPostFullText(milestone.post, index) : null;

                      return (
                        <div key={milestone.id} className={`p-4 bg-gradient-to-r ${getGradient(index)} rounded-lg border hover:shadow-md transition-shadow`}>
                          <div className="flex items-start space-x-3">
                            <div className={`p-2 ${getBgColor(index)} rounded-full flex-shrink-0`}>
                              {getIcon(milestone.icon)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 
                                className="font-semibold text-sm mb-1 line-clamp-2 cursor-help" 
                                title={postFullText ? `${milestone.title} — "${postFullText}"` : milestone.title}
                              >
                                {milestone.title}
                                {postDisplayText && (
                                  <span className="font-normal text-muted-foreground">
                                    {" — "}
                                    <span className="italic">"{postDisplayText}"</span>
                                  </span>
                                )}
                              </h4>
                              {engagementMetric && (
                                <div className="text-xs text-muted-foreground mb-1">
                                  <Badge variant="outline" className="text-xs mr-2">
                                    {engagementMetric}
                                  </Badge>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-3">{milestone.description}</p>
                              <div className="flex items-center justify-between">
                                <Badge variant={index === 0 ? "secondary" : "outline"} className="text-xs">
                                  {new Date(milestone.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {statsData.milestones.length > 3 && (
                    <div className="mt-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllMilestones(!showAllMilestones)}
                        className="flex items-center space-x-2"
                      >
                        {showAllMilestones ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            <span>Show Less</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span>View All ({statsData.milestones.length})</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No milestones yet</p>
                  <p className="text-sm">Keep engaging to unlock achievements</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <MobileNav />
    </div>
  );
}