import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { timeAgo } from "@/lib/timeAgo";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import LazyMedia from "@/components/ui/lazy-media";
import { Heart, Eye, MessageCircle, Bookmark, Share, Copy, ExternalLink, User, Send, Play, X, Trash2, MoreHorizontal, UserPlus, MessageSquare } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { StudentWithStats, PostWithDetails, PostCommentWithUser } from "@shared/schema";
import { ProfileByIdSkeleton } from "@/components/ui/profile-skeleton";

// Type for following list (matches FollowingStudent from following.tsx)
interface FollowingStudent {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  sport: string;
  roleNumber: string;
  position: string;
  profilePicUrl?: string;
  profilePic?: string;
  school?: {
    id: string;
    name: string;
  };
  followersCount: number;
}

export default function ProfileById() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Post modal state
  const [selectedPost, setSelectedPost] = useState<PostWithDetails | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Progressive loading constants - TikTok/Instagram style
  const INITIAL_POST_LIMIT = 3; // Load only 3 posts initially for fast first render
  const POST_LIMIT = 12; // Load 12 posts on subsequent pages

  // Query for student profile by ID
  const { data: studentProfile, isLoading: profileLoading, error: profileError } = useQuery<StudentWithStats & { isFollowing: boolean }>({
    queryKey: ["/api/students", id],
    queryFn: async () => {
      try {
        console.log("🔍 Loading student profile for ID:", id);
        const response = await apiRequest("GET", `/api/students/${id}`);
        
        // Check if response is ok
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
          (error as any).status = response.status;
          throw error;
        }
        
        const data = await response.json();
        console.log("✅ Profile loaded successfully:", data);
        return data;
      } catch (error: any) {
        console.log("❌ Profile load error:", {
          message: error.message,
          status: error.status,
          code: error.code
        });
        throw error;
      }
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (profile not found)
      if (error?.status === 404) {
        console.log("🚫 Profile not found (404), not retrying");
        return false;
      }
      
      // Don't retry on 401 (unauthorized) - user needs to log in again
      if (error?.status === 401) {
        console.log("🔒 Unauthorized (401), not retrying - user needs to log in");
        return false;
      }
      
      // Retry on server errors (500+) or network issues
      if (failureCount < 3) {
        console.log(`🔄 Retrying profile load (attempt ${failureCount + 1}) - server error`);
        return true;
      }
      
      console.log("🚫 Max retries reached, giving up");
      return false;
    }
  });

  // Infinite query for user posts - only runs when profile exists
  // Progressive loading: 3 posts initially, then 12 per page (TikTok/Instagram style)
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
    error: postsError
  } = useInfiniteQuery({
    queryKey: ["/api/posts/student", studentProfile?.id],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        // First page: 3 posts, subsequent pages: 12 posts
        const limit = pageParam === 0 ? INITIAL_POST_LIMIT : POST_LIMIT;
        const offset = pageParam === 0 ? 0 : INITIAL_POST_LIMIT + (pageParam - 1) * POST_LIMIT;
        
        const response = await apiRequest("GET", `/api/posts/student/${studentProfile?.id}?limit=${limit}&offset=${offset}`);
        
        // Check if response is ok
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
          (error as any).status = response.status;
          throw error;
        }
        
        const data = await response.json();
        return {
          posts: data,
          hasMore: data.length === limit,
          nextOffset: pageParam + 1
        };
      } catch (error: any) {
        console.log("❌ Posts load error:", {
          message: error.message,
          status: error.status,
          code: error.code
        });
        
        // If it's a server error, return empty array instead of crashing
        if (error?.status === 500) {
          console.log("🔧 Server error detected, returning empty posts array");
          return { posts: [], hasMore: false, nextOffset: 0 };
        }
        
        throw error;
      }
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.nextOffset;
    },
    initialPageParam: 0,
    enabled: !!studentProfile?.id,
    staleTime: 30_000, // 30 seconds cache
    gcTime: 60_000, // Keep cache for 1 minute
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (no posts found)
      if (error?.status === 404) return false;
      // Don't retry on 500 (server error) - we handle it gracefully
      if (error?.status === 500) return false;
      return failureCount < 3;
    }
  });

  // Flatten all posts from all pages
  const allPosts = postsData?.pages.flatMap(page => page.posts) || [];

  // Check if profile is missing (404 error)
  const isProfileMissing = (profileError as any)?.status === 404;

  // Post interaction mutations
  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      const post = allPosts.find(p => p.id === postId);
      if (!post) throw new Error("Post not found");
      
      if (post.isLiked) {
        const response = await apiRequest("DELETE", `/api/posts/${postId}/like`);
        return response.json();
      } else {
        const response = await apiRequest("POST", `/api/posts/${postId}/like`);
        return response.json();
      }
    },
    onSuccess: (data, postId) => {
      // Update the post in the query cache
      queryClient.setQueryData(
        ["/api/posts/student", studentProfile?.id],
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              posts: page.posts.map((p: PostWithDetails) =>
                p.id === postId
                  ? { ...p, likesCount: data.likesCount, isLiked: data.isLiked }
                  : p
              )
            }))
          };
        }
      );
      
      // Update selected post if it's the same
      if (selectedPost?.id === postId) {
        setSelectedPost(prev => prev ? { ...prev, likesCount: data.likesCount, isLiked: data.isLiked } : null);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (postId: string) => {
      const post = allPosts.find(p => p.id === postId);
      if (!post) throw new Error("Post not found");
      
      if (post.isSaved) {
        const response = await apiRequest("DELETE", `/api/posts/${postId}/save`);
        return response.json();
      } else {
        const response = await apiRequest("POST", `/api/posts/${postId}/save`);
        return response.json();
      }
    },
    onSuccess: (data, postId) => {
      // Update the post in the query cache
      queryClient.setQueryData(
        ["/api/posts/student", studentProfile?.id],
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              posts: page.posts.map((p: PostWithDetails) =>
                p.id === postId
                  ? { ...p, savesCount: data.savesCount, isSaved: data.isSaved }
                  : p
              )
            }))
          };
        }
      );
      
      // Update selected post if it's the same
      if (selectedPost?.id === postId) {
        setSelectedPost(prev => prev ? { ...prev, savesCount: data.savesCount, isSaved: data.isSaved } : null);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update save. Please try again.",
        variant: "destructive",
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const response = await apiRequest("POST", `/api/posts/${postId}/comments`, { content });
      return response.json();
    },
    onSuccess: (data, { postId }) => {
      // Update the post in the query cache
      queryClient.setQueryData(
        ["/api/posts/student", studentProfile?.id],
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              posts: page.posts.map((p: PostWithDetails) =>
                p.id === postId
                  ? { ...p, commentsCount: data.commentsCount }
                  : p
              )
            }))
          };
        }
      );
      
      // Update selected post if it's the same
      if (selectedPost?.id === postId) {
        setSelectedPost(prev => prev ? { ...prev, commentsCount: data.commentsCount } : null);
      }
      
      setNewComment("");
      toast({
        title: "Comment added",
        description: "Your comment has been posted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to post comment. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Follow/Unfollow mutation with optimistic updates for instant UI feedback
  const followMutation = useMutation({
    mutationFn: async () => {
      // Get the latest profile data from the cache to avoid stale closures
      const currentProfile = queryClient.getQueryData<StudentWithStats & { isFollowing: boolean }>(["/api/students", id]);
      
      if (!currentProfile?.id) throw new Error("Student profile not found");
      
      const method = currentProfile.isFollowing ? "DELETE" : "POST";
      const response = await apiRequest(method, `/api/students/${currentProfile.id}/follow`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to update follow status");
      }
      
      return response.json();
    },
    onMutate: async () => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/students", id] });
      await queryClient.cancelQueries({ queryKey: ["/api/users", user?.id, "following"] });
      
      // Snapshot the previous value for rollback
      const previousProfile = queryClient.getQueryData<StudentWithStats & { isFollowing: boolean }>(["/api/students", id]);
      const previousFollowingList = queryClient.getQueryData<FollowingStudent[]>(["/api/users", user?.id, "following"]);
      
      // Optimistically update the profile button immediately
      if (previousProfile) {
        const newFollowingStatus = !previousProfile.isFollowing;
        queryClient.setQueryData(["/api/students", id], {
          ...previousProfile,
          isFollowing: newFollowingStatus,
          followersCount: newFollowingStatus 
            ? (previousProfile.followersCount || 0) + 1 
            : Math.max(0, (previousProfile.followersCount || 1) - 1)
        });
        
        // Optimistically update following list
        if (previousProfile && user) {
          const followingList = previousFollowingList || [];
          
          if (newFollowingStatus) {
            // Following: add to list if not already there
            const isAlreadyInList = followingList.some(s => s.id === previousProfile.id);
            if (!isAlreadyInList) {
              queryClient.setQueryData<FollowingStudent[]>(["/api/users", user.id, "following"], [
                ...followingList,
                {
                  id: previousProfile.id,
                  userId: previousProfile.userId,
                  user: {
                    id: previousProfile.userId,
                    name: previousProfile.name,
                    email: '',
                  },
                  sport: previousProfile.sport || '',
                  roleNumber: previousProfile.roleNumber || '',
                  position: previousProfile.position || '',
                  profilePicUrl: previousProfile.profilePicUrl,
                  profilePic: previousProfile.profilePic,
                  school: previousProfile.school,
                  followersCount: previousProfile.followersCount || 0,
                }
              ]);
            }
          } else {
            // Unfollowing: remove from list
            queryClient.setQueryData<FollowingStudent[]>(["/api/users", user.id, "following"], 
              followingList.filter(s => s.id !== previousProfile.id)
            );
          }
        }
      }
      
      // Return context for rollback
      return { previousProfile, previousFollowingList };
    },
    onSuccess: (data) => {
      // Update with server response (more accurate than optimistic update)
      queryClient.setQueryData(["/api/students", id], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          isFollowing: data.isFollowing,
          followersCount: data.followersCount !== undefined ? data.followersCount : oldData.followersCount
        };
      });
      
      // Invalidate and refetch related queries to ensure consistency across the app
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "following"] });
      // Trigger a refetch to immediately update the following page if it's currently viewed
      queryClient.refetchQueries({ queryKey: ["/api/users", user?.id, "following"] });
      
      // Get updated profile name for toast
      const updatedProfile = queryClient.getQueryData<StudentWithStats & { isFollowing: boolean }>(["/api/students", id]);
      const profileName = updatedProfile?.name || studentProfile?.name || "this student";
      
      toast({
        title: data.isFollowing ? "Following" : "Unfollowed",
        description: `You are ${data.isFollowing ? 'now following' : 'no longer following'} ${profileName}`,
      });
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic updates on error
      if (context?.previousProfile) {
        queryClient.setQueryData(["/api/students", id], context.previousProfile);
      }
      if (context?.previousFollowingList !== undefined) {
        queryClient.setQueryData(["/api/users", user?.id, "following"], context.previousFollowingList);
      }
      
      // If the error is "already following", refetch the profile to update the UI
      if (error?.message?.includes("already following") || error?.message?.includes("Already following")) {
        queryClient.invalidateQueries({ queryKey: ["/api/students", id] });
      }
      
      toast({
        title: "Error",
        description: error?.message || "Failed to update follow status. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handler functions
  const handlePostClick = (post: PostWithDetails) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const handleLike = (postId: string) => {
    if (!user) return;
    likeMutation.mutate(postId);
  };

  const handleSave = (postId: string) => {
    if (!user) return;
    saveMutation.mutate(postId);
  };

  const handleComment = () => {
    if (!user || !selectedPost) return;
    if (!newComment.trim()) return;
    
    // Prevent viewers from commenting
    if (user.role === "viewer") {
      toast({
        title: "Access Denied",
        description: "Only students can comment on posts.",
        variant: "destructive",
      });
      return;
    }
    
    commentMutation.mutate({ postId: selectedPost.id, content: newComment.trim() });
  };

  const handleFollow = () => {
    if (!user || !studentProfile) return;
    if (followMutation.isPending) return; // Prevent multiple clicks
    
    followMutation.mutate();
  };

  // Infinite scroll with intersection observer - TikTok/Instagram style aggressive preloading
  const observerRef = useRef<HTMLDivElement | null>(null);
  const [canRequestNextPage, setCanRequestNextPage] = useState(true);

  useEffect(() => {
    if (!hasNextPage || !observerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry.isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage &&
          canRequestNextPage
        ) {
          setCanRequestNextPage(false);
          fetchNextPage().finally(() => {
            // Re-enable after a short delay to prevent rapid-fire requests
            setTimeout(() => setCanRequestNextPage(true), 200);
          });
        }
      },
      {
        // Load when trigger element is 50% visible
        threshold: 0.5,
        // Preload aggressively - start loading when user is still 800px away from bottom
        // This ensures next posts are ready before user reaches them (TikTok/Instagram style)
        rootMargin: "0px 0px 800px 0px"
      }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, canRequestNextPage]);

  const handleShareProfile = () => {
    setShowShareDialog(true);
  };

  const copyProfileLink = () => {
    const profileUrl = `${window.location.origin}/profile/${studentProfile?.id}`;
    navigator.clipboard.writeText(profileUrl);
    toast({
      title: "Link Copied",
      description: "Profile link copied to clipboard!",
    });
  };

  const shareProfileNative = async () => {
    if (navigator.share && studentProfile) {
      try {
        await navigator.share({
          title: `${studentProfile.name}'s Profile`,
          text: `Check out ${studentProfile.name}'s sports profile on LockerRoom!`,
          url: `${window.location.origin}/profile/${studentProfile.id}`,
        });
      } catch (error) {
        // If native sharing fails, fall back to copy link
        copyProfileLink();
      }
    } else {
      copyProfileLink();
    }
  };

  // Check if this is the current user's profile
  const isOwnProfile = user?.id === studentProfile?.userId;

  // Error state
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Access denied. Please log in.</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Profile not found - show 404
  if (isProfileMissing || (!studentProfile && !profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold text-foreground mb-4">Profile Not Found</h1>
          <p className="text-lg text-muted-foreground mb-8">
            The profile you're looking for doesn't exist or has been removed.
          </p>
          
          <Button 
            onClick={() => window.history.back()}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            size="lg"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <div className="lg:pl-64 pb-24 lg:pb-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-8">
          {/* Cover Photo */}
          <div
            className="h-48 bg-gradient-to-r from-primary via-secondary to-primary relative"
            style={{
              backgroundImage: studentProfile?.coverPhoto ? `url('${studentProfile.coverPhoto}')` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="absolute inset-0 bg-black/20"></div>
          </div>

          {/* Profile Info - Clean Layout */}
          <div className="px-6 pb-6">
            {/* Profile Picture - Centered */}
            <div className="flex justify-center -mt-16 mb-4">
              <div className="relative mx-auto w-32 h-32">
                <img
                  className="w-32 h-32 rounded-full border-4 border-card shadow-lg object-cover"
                  src={studentProfile?.profilePicUrl || "/default-avatar.png"}
                  alt={`${studentProfile?.name} profile`}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== "/default-avatar.png") {
                      target.src = "/default-avatar.png";
                    }
                  }}
                />
              </div>
            </div>
            
            {/* Student Name - Below Cover Photo */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-2">{studentProfile?.name}</h1>
              <p className="text-lg text-muted-foreground mb-1">
                {studentProfile?.sport && studentProfile?.roleNumber && studentProfile?.position 
                  ? `${studentProfile.sport} • #${studentProfile.roleNumber} • ${studentProfile.position}`
                  : studentProfile?.sport || studentProfile?.position || 'Student Athlete'
                }
              </p>
              <p className="text-muted-foreground">
                {studentProfile?.school?.name} • {studentProfile?.grade || 'Class of 2025'}
              </p>
            </div>
            

            {/* Action Buttons */}
            <div className="flex justify-center gap-3 mb-6">
              {!isOwnProfile && (
                <>
                  <Button 
                    onClick={handleFollow}
                    disabled={followMutation.isPending}
                    variant={studentProfile?.isFollowing ? "secondary" : "default"}
                    className={studentProfile?.isFollowing 
                      ? "bg-secondary hover:bg-secondary/80 text-secondary-foreground" 
                      : "bg-accent hover:bg-accent/90 text-accent-foreground"
                    }
                  >
                    {followMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {studentProfile?.isFollowing ? "Unfollowing..." : "Following..."}
                      </>
                    ) : (
                      <>
                        {studentProfile?.isFollowing ? (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Unfollow
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Follow
                          </>
                        )}
                      </>
                    )}
                  </Button>
                  
                  {/* Message button temporarily hidden until feature is developed */}
                  {/* {user?.role !== "viewer" && (
                    <Button 
                      variant="secondary"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Message
                    </Button>
                  )} */}
                </>
              )}
              
              <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleShareProfile}
                    variant="secondary"
                    data-testid="button-share-profile"
                  >
                    <Share className="w-4 h-4 mr-2" />
                    Share Profile
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
            
            {/* Bio */}
            {studentProfile?.bio && (
              <div className="text-center">
                <p className="text-foreground leading-relaxed whitespace-pre-line max-w-2xl mx-auto">
                  {studentProfile.bio}
                </p>
              </div>
            )}
          </div>
        </div>


        {/* Posts Grid - Instagram Style */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Posts</h2>
          </div>
          
          {postsLoading && (!postsData || postsData.pages.length === 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : allPosts && allPosts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {allPosts.map((post) => (
                <div 
                  key={post.id} 
                  className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg bg-muted"
                  onClick={() => handlePostClick(post)}
                >
                  {post.effectiveMediaType === "video" ? (
                    <div className="relative w-full h-full">
                      <LazyMedia
                        src={post.effectiveMediaUrl}
                        alt="Post video"
                        type="video"
                        className="w-full h-full object-cover"
                        style={{ maxHeight: '100%' }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300">
                        <div className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center transition-opacity duration-300">
                          <Play className="w-12 h-12 text-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    post.effectiveMediaUrl && !post.effectiveMediaUrl.includes('/api/placeholder/') ? (
                      <img
                        src={post.effectiveMediaUrl}
                        alt="Post"
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        style={{ objectPosition: 'center' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.nextElementSibling as HTMLElement;
                          if (placeholder) placeholder.style.display = 'flex';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-4xl mb-2">🖼️</div>
                          <p className="text-xs text-muted-foreground">
                            {post.effectiveStatus === 'processing' ? 'Processing...' : 
                             post.effectiveStatus === 'failed' ? 'Failed' : 
                             'Unavailable'}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                  
                  {/* Hover overlay with stats */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300">
                    <div className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center space-x-8 text-white transition-opacity duration-300">
                      <div className="flex items-center space-x-2">
                        <Heart className="w-6 h-6 fill-current" />
                        <span className="font-semibold">{post.likesCount || 0}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MessageCircle className="w-6 h-6 fill-current" />
                        <span className="font-semibold">{post.commentsCount || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Infinite scroll trigger - positioned to preload before user reaches it */}
              {hasNextPage && (
                <div ref={observerRef} className="col-span-full h-4 w-full" aria-hidden="true" />
              )}
              
              {/* Loading indicator for next page */}
              {isFetchingNextPage && (
                <div className="col-span-full flex justify-center py-8">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-muted-foreground">Loading more posts...</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground">No posts yet</h3>
                  <p className="text-muted-foreground">
                    {isOwnProfile 
                      ? "Share your first post to get started!" 
                      : `${studentProfile?.name} hasn't shared any posts yet.`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share Profile Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Profile</DialogTitle>
            <DialogDescription>
              Share {studentProfile?.name}'s profile with others
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-muted rounded-lg">
              <img
                className="w-12 h-12 rounded-full"
                src={studentProfile?.profilePicUrl || "/default-avatar.png"}
                alt={studentProfile?.name}
              />
              <div>
                <h4 className="font-medium">{studentProfile?.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {studentProfile?.sport} • #{studentProfile?.roleNumber}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={shareProfileNative}
                className="w-full justify-start"
                variant="outline"
              >
                <Share className="w-4 h-4 mr-3" />
                Share via Device
              </Button>

              <Button
                onClick={copyProfileLink}
                className="w-full justify-start"
                variant="outline"
              >
                <Copy className="w-4 h-4 mr-3" />
                Copy Profile Link
              </Button>

              <Button
                onClick={() => {
                  window.open(`https://twitter.com/intent/tweet?text=Check out ${studentProfile?.name}'s sports profile on LockerRoom!&url=${window.location.origin}/profile/${studentProfile?.id}`, '_blank');
                }}
                className="w-full justify-start"
                variant="outline"
              >
                <ExternalLink className="w-4 h-4 mr-3" />
                Share on Twitter
              </Button>

              <Button
                onClick={() => {
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${window.location.origin}/profile/${studentProfile?.id}`, '_blank');
                }}
                className="w-full justify-start"
                variant="outline"
              >
                <ExternalLink className="w-4 h-4 mr-3" />
                Share on Facebook
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Detail Modal */}
      <Dialog open={showPostModal} onOpenChange={setShowPostModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          {selectedPost && (
            <div className="flex flex-col lg:flex-row h-full">
              {/* Media Section */}
              <div className="flex-1 bg-black flex items-center justify-center">
                {selectedPost.mediaType === "video" ? (
                  <LazyMedia
                    src={selectedPost.mediaUrl}
                    alt="Post video"
                    type="video"
                    className="w-full h-full object-contain"
                    style={{ maxHeight: '70vh' }}
                  />
                ) : (
                  <img
                    src={selectedPost.mediaUrl}
                    alt="Post content"
                    className="w-full h-full object-contain"
                    style={{ maxHeight: '70vh' }}
                  />
                )}
              </div>
              
              {/* Content Section */}
              <div className="w-full lg:w-96 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <AvatarWithFallback 
                        src={studentProfile?.profilePicUrl}
                        alt={studentProfile?.name || "Student"}
                        size="md"
                      />
                      <div>
                        <h3 className="font-semibold text-foreground">{studentProfile?.name}</h3>
                        <p className="text-sm text-muted-foreground">{timeAgo(selectedPost.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Caption */}
                {selectedPost.caption && (
                  <div className="p-4 border-b border-border">
                    <p className="text-foreground">{selectedPost.caption}</p>
                  </div>
                )}
                
                {/* Comments Section */}
                <div className="flex-1 overflow-hidden">
                  <PostComments postId={selectedPost.id} />
                </div>
                
                {/* Actions */}
                <div className="p-4 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-6">
                      <button
                        onClick={() => handleLike(selectedPost.id)}
                        className={`flex items-center space-x-2 transition-colors duration-200 ${
                          selectedPost.isLiked ? "text-red-500" : "text-muted-foreground hover:text-accent"
                        }`}
                        disabled={likeMutation.isPending}
                      >
                        <Heart className={`w-6 h-6 ${selectedPost.isLiked ? "fill-current" : ""}`} />
                        <span>{selectedPost.likesCount}</span>
                      </button>
                      
                      <button
                        onClick={() => handleSave(selectedPost.id)}
                        className={`flex items-center space-x-2 transition-colors duration-200 ${
                          selectedPost.isSaved ? "text-accent" : "text-muted-foreground hover:text-accent"
                        }`}
                        disabled={saveMutation.isPending}
                      >
                        <Bookmark className={`w-6 h-6 ${selectedPost.isSaved ? "fill-current" : ""}`} />
                        <span>{selectedPost.savesCount}</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Comment Input */}
                  <div className="flex items-center space-x-3">
                    <AvatarWithFallback 
                      src={user?.profilePicUrl}
                      alt={user?.name || "You"}
                      size="sm"
                    />
                    <div className="flex-1 flex items-center space-x-2">
                      {user?.role === "viewer" ? (
                        <div className="flex-1 p-3 bg-muted rounded-lg text-center">
                          <p className="text-sm text-muted-foreground">
                            Only students can comment on posts.
                          </p>
                        </div>
                      ) : (
                        <>
                          <Input
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleComment();
                              }
                            }}
                            placeholder="Add a comment..."
                            className="flex-1"
                          />
                          <Button
                            onClick={handleComment}
                            disabled={!newComment.trim() || commentMutation.isPending}
                            size="sm"
                            className="bg-accent hover:bg-accent/90"
                          >
                            {commentMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

// Helper function to format role names
function formatRoleName(role: string | null | undefined): string | null {
  if (!role) return null;
  
  const roleMap: Record<string, string> = {
    'school_admin': 'School Admin',
    'system_admin': 'System Admin',
    'scout_admin': 'Scout Admin',
    'xen_scout': 'Scout',
  };
  
  return roleMap[role] || null;
}

// Post Comments Component
function PostComments({ postId }: { postId: string }) {
  const { data: comments, isLoading } = useQuery<PostCommentWithUser[]>({
    queryKey: ["/api/posts", postId, "comments"],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${postId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {comments && comments.length > 0 ? (
          comments.map((comment) => {
            const userRole = comment.user?.role;
            const formattedRole = formatRoleName(userRole);
            const shouldShowRole = formattedRole !== null; // Only show for admins and scouts
            
            return (
              <div key={comment.id} className="flex items-start space-x-3">
                <Link href={`/profile/${comment.user?.id}`}>
                  <AvatarWithFallback 
                    src={comment.user?.profilePicUrl}
                    alt={comment.user?.name || "User"}
                    size="sm"
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  />
                </Link>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Link href={`/profile/${comment.user?.id}`}>
                      <span className="font-medium text-sm text-foreground hover:text-accent cursor-pointer transition-colors">
                        {comment.user?.name || 'Anonymous'}
                      </span>
                      {shouldShowRole && (
                        <span className="text-xs text-muted-foreground ml-2 font-medium">
                          • {formattedRole}
                        </span>
                      )}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{comment.content}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No comments yet. Be the first to comment!
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
