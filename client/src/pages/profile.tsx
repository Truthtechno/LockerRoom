import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import StatsCard from "@/components/stats/stats-card";
import { Heart, Eye, MessageCircle, Bookmark, Edit3, Share } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { StudentWithStats, PostWithDetails } from "@shared/schema";

export default function Profile() {
  const { user } = useAuth();
  
  const { data: studentProfile, isLoading: profileLoading } = useQuery<StudentWithStats>({
    queryKey: ["/api/students/profile", user?.id],
    enabled: !!user?.id,
  });

  const { data: userPosts, isLoading: postsLoading } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/posts/student", studentProfile?.id],
    enabled: !!studentProfile?.id,
  });

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!studentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-destructive">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-8">
          {/* Cover Photo */}
          <div
            className="h-48 bg-gradient-to-r from-primary via-secondary to-primary relative"
            style={{
              backgroundImage: `url('${studentProfile.coverPhoto}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="absolute inset-0 bg-black/30"></div>
          </div>

          {/* Profile Info */}
          <div className="relative px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:space-x-6 -mt-16">
              {/* Profile Picture */}
              <img
                className="w-32 h-32 rounded-full border-4 border-card shadow-lg mx-auto sm:mx-0"
                src={studentProfile.profilePic}
                alt={`${studentProfile.user.name} profile`}
              />
              
              <div className="flex-1 text-center sm:text-left mt-4 sm:mt-0">
                <h1 className="text-3xl font-bold text-foreground">{studentProfile.user.name}</h1>
                <p className="text-lg text-muted-foreground">
                  {studentProfile.sport} • #{studentProfile.roleNumber} • {studentProfile.position}
                </p>
                <p className="text-muted-foreground mt-2">
                  {studentProfile.school?.name} • Class of 2025
                </p>
                
                <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{studentProfile.postsCount}</div>
                    <div className="text-sm text-muted-foreground">Posts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{studentProfile.totalLikes}</div>
                    <div className="text-sm text-muted-foreground">Likes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{studentProfile.totalViews}</div>
                    <div className="text-sm text-muted-foreground">Views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{studentProfile.totalSaves}</div>
                    <div className="text-sm text-muted-foreground">Saves</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:items-end space-y-3 mt-4 sm:mt-0">
                <Button 
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  data-testid="button-edit-profile"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
                <Button 
                  variant="secondary"
                  data-testid="button-share-profile"
                >
                  <Share className="w-4 h-4 mr-2" />
                  Share Profile
                </Button>
              </div>
            </div>
            
            {/* Bio */}
            <div className="mt-6">
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {studentProfile.bio}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Likes"
            value={studentProfile.totalLikes.toLocaleString()}
            trend="+12% this month"
            icon={Heart}
            iconColor="text-accent"
          />
          <StatsCard
            title="Total Views"
            value={studentProfile.totalViews.toLocaleString()}
            trend="+8% this month"
            icon={Eye}
            iconColor="text-primary"
          />
          <StatsCard
            title="Comments"
            value={studentProfile.totalComments}
            trend="+15% this month"
            icon={MessageCircle}
            iconColor="text-secondary"
          />
          <StatsCard
            title="Saves"
            value={studentProfile.totalSaves}
            trend="+5% this month"
            icon={Bookmark}
            iconColor="text-accent"
          />
        </div>

        {/* Posts Grid */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Posts</h2>
          </div>
          
          {postsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : userPosts && userPosts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {userPosts.map((post) => (
                <div key={post.id} className="aspect-square relative group cursor-pointer">
                  <img
                    src={post.mediaUrl}
                    alt="Post"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200">
                    <div className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center space-x-6 text-white transition-opacity duration-200">
                      <div className="flex items-center space-x-1">
                        <Heart className="w-5 h-5 fill-current" />
                        <span>{post.likesCount}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="w-5 h-5 fill-current" />
                        <span>{post.commentsCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No posts yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
