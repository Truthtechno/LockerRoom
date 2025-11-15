import { useState, useEffect, memo, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, UserPlus, UserCheck, X, User, Flag, Trash2, Megaphone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { PostWithDetails } from "@shared/schema";
import { Link } from "wouter";
import { timeAgo } from "@/lib/timeAgo";
import LazyMedia from "@/components/ui/lazy-media";
import ResponsiveMedia from "@/components/ui/responsive-media";

interface PostCardProps {
  post: PostWithDetails;
  priority?: boolean; // For prioritizing first 2 posts for instant loading
  skipCacheQuery?: boolean; // Skip cache query for feed posts to prevent flicker
}

function PostCardInner({ post: initialPost, priority = false, skipCacheQuery = false }: PostCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Query to get the latest post data from cache (skip for feed to prevent flicker)
  const { data: cachedPost } = useQuery({
    queryKey: ["/api/posts", initialPost.id],
    queryFn: async () => {
      // First check the feed cache
      const feedData = queryClient.getQueryData(["/api/posts/feed"]) as any;
      if (feedData?.pages) {
        for (const page of feedData.pages) {
          const foundPost = page.posts?.find((p: any) => p.id === initialPost.id);
          if (foundPost) return foundPost;
        }
      }
      // Fallback to initial post if not found in cache
      return initialPost;
    },
    initialData: initialPost,
    enabled: !skipCacheQuery, // Skip query if skipCacheQuery is true (for feed posts)
    staleTime: skipCacheQuery ? Infinity : 1000, // Don't refetch if skipping cache query
    refetchInterval: skipCacheQuery ? false : (query) => {
      // Only refetch if post is still processing
      const currentPost = query.state.data as PostWithDetails;
      return currentPost?.status === 'processing' ? 1000 : false;
    },
  });
  
  // Use initialPost directly when skipCacheQuery is enabled, otherwise use cached post
  const post = skipCacheQuery ? initialPost : (cachedPost ?? initialPost);
  
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [isSaved, setIsSaved] = useState(post.isSaved);
  const [isFollowing, setIsFollowing] = useState(post.student?.isFollowing || false);
  const [videoError, setVideoError] = useState(false);
  
  // Check if this is an announcement
  const isAnnouncement = post.isAnnouncement || post.type === 'announcement';
  const announcementScope = post.announcementScope;
  const announcementSchool = post.announcementSchool;
  const isSystemAnnouncement = announcementScope === 'global';
  
  // Check if user is a viewer (can't comment)
  const canComment = user?.role !== 'viewer';

  // Record view when post card is rendered (debounced to avoid excessive calls)
  useEffect(() => {
    if (!user?.id) return;
    
    const timeoutId = setTimeout(async () => {
      try {
        await apiRequest("POST", `/api/posts/${post.id}/view`);
      } catch (error) {
        // Silently fail - view tracking is not critical
        console.log('Failed to record view:', error);
      }
    }, 1000); // Debounce view recording by 1 second

    return () => clearTimeout(timeoutId);
  }, [post.id, user?.id]);


  // Use the follow status from the post data instead of making additional API calls
  useEffect(() => {
    if (post.student?.isFollowing !== undefined) {
      setIsFollowing(post.student.isFollowing);
    }
  }, [post.student?.isFollowing]);


  const likeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        const response = await apiRequest("DELETE", `/api/posts/${post.id}/like`);
        return response.json();
      } else {
        const response = await apiRequest("POST", `/api/posts/${post.id}/like`);
        return response.json();
      }
    },
    onSuccess: (data) => {
      setIsLiked(data.isLiked);
      // Update the post in the cache with new counts
      queryClient.setQueryData(["/api/posts"], (old: any) => 
        old?.map((p: any) => 
          p.id === post.id 
            ? { ...p, likesCount: data.likesCount, isLiked: data.isLiked }
            : p
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students/me/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to update like",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        const response = await apiRequest("DELETE", `/api/posts/${post.id}/save`);
        return response.json();
      } else {
        const response = await apiRequest("POST", `/api/posts/${post.id}/save`);
        return response.json();
      }
    },
    onSuccess: (data) => {
      setIsSaved(data.isSaved);
      // Update the post in the cache with new counts
      queryClient.setQueryData(["/api/posts"], (old: any) => 
        old?.map((p: any) => 
          p.id === post.id 
            ? { ...p, savesCount: data.savesCount, isSaved: data.isSaved }
            : p
        )
      );
      // Invalidate saved posts query to update the Saved page
      queryClient.invalidateQueries({ queryKey: ["/api/posts/saved", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "saved-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students/me/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to save post",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });


  const followMutation = useMutation({
    mutationFn: async () => {
      const method = isFollowing ? "DELETE" : "POST";
      const response = await apiRequest(method, `/api/students/${post.student?.id}/follow`);
      return response.json();
    },
    onSuccess: (data) => {
      setIsFollowing(data.isFollowing);
      // Invalidate following queries to update UI
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/follow-status", post.student?.userId, user?.id] });
      toast({
        title: data.isFollowing ? "Following" : "Unfollowed",
        description: `You are ${data.isFollowing ? 'now following' : 'no longer following'} ${post.student?.name}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to update follow status",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLike = useCallback(() => {
    if (!user) return;
    likeMutation.mutate();
  }, [user, likeMutation]);

  const handleSave = useCallback(() => {
    if (!user) return;
    saveMutation.mutate();
  }, [user, saveMutation]);

  const handleComment = useCallback(() => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to comment on posts.",
        variant: "destructive",
      });
      return;
    }
    try {
      sessionStorage.setItem('feedReturnPostId', post.id);
      sessionStorage.setItem('feedScrollY', String(window.scrollY || window.pageYOffset || 0));
    } catch {}
    window.location.href = `/post/${post.id}`;
  }, [user, post.id, toast]);

  const handleFollow = useCallback(() => {
    if (!user || !post.student?.id) {
      toast({
        title: "Login required",
        description: "Please log in to follow players.",
        variant: "destructive",
      });
      return;
    }
    followMutation.mutate();
  }, [user, post.student?.id, followMutation, toast]);

  const handleViewProfile = () => {
    if (post.student?.id) {
      window.location.href = `/profile/${post.student.id}`;
    }
  };

  const reportMutation = useMutation({
    mutationFn: async (reason?: string) => {
      await apiRequest("POST", `/api/posts/${post.id}/report`, { reason });
    },
    onSuccess: () => {
      toast({
        title: "Post reported",
        description: "Thank you for reporting this post. We'll review it shortly.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to report post. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/posts/${post.id}`);
    },
    onSuccess: () => {
      // Remove the post from the feed cache immediately
      queryClient.setQueryData(["/api/posts/feed", 12], (old: any) => {
        if (!old?.pages?.length) return old;
        
        const updatedPages = old.pages.map((page: any) => ({
          ...page,
          posts: page.posts?.filter((p: any) => p.id !== post.id) || []
        }));
        
        return { ...old, pages: updatedPages };
      });
      
      // Remove from student posts cache
      queryClient.setQueryData(["/api/posts/student"], (old: any) => 
        old?.filter((p: any) => p.id !== post.id)
      );
      
      // Invalidate other queries for consistency
      queryClient.invalidateQueries({ queryKey: ["/api/posts/student"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students/me/stats"] });
      
      toast({
        title: "Post deleted",
        description: "Your post has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReportPost = () => {
    reportMutation.mutate();
  };

  const handleDeletePost = () => {
    if (window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  const handleVideoError = () => {
    setVideoError(true);
  };

  return (
    <div id={`post-${post.id}`} className={`bg-card border border-border rounded-xl mb-6 shadow-sm post-card transition-all duration-200 max-w-full ${
      isAnnouncement ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 dark:from-yellow-900/20 dark:to-orange-900/20 dark:border-yellow-700' : ''
    }`}>
      {/* Announcement Header */}
      {isAnnouncement && (
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-300">
            <Megaphone className="w-5 h-5" />
            <span className="font-semibold text-sm">
              {announcementScope === 'global' ? 'SYSTEM ANNOUNCEMENT' : 
               announcementScope === 'school' ? 'SCHOOL ANNOUNCEMENT' : 
               'ANNOUNCEMENT'}
            </span>
            {announcementScope === 'school' && announcementSchool && post.student?.name !== 'XEN SPORTS ARMOURY' && (
              <span className="text-xs text-muted-foreground">
                • {announcementSchool.name}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Post Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isAnnouncement ? (
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            ) : (
              <Link href={`/profile/${post.student?.id}`}>
                <AvatarWithFallback 
                  src={post.student?.profilePicUrl}
                  alt={post.student?.name || "Student athlete"}
                  size="lg"
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                />
              </Link>
            )}
            <div>
              {isAnnouncement ? (
                <h3 className="font-semibold text-foreground">
                  {post.student?.name || 'XEN SPORTS ARMOURY'}
                </h3>
              ) : (
                <Link href={`/profile/${post.student?.id}`}>
                  <h3 className="font-semibold text-foreground hover:text-accent cursor-pointer transition-colors">
                    {post.student?.name || 'Unknown Student'}
                  </h3>
                </Link>
              )}
              <p className="text-sm text-muted-foreground">
                {isAnnouncement ? (
                  `Official Announcement • ${timeAgo(post.createdAt)}`
                ) : (
                  `${post.student?.position || 'Player'} ${post.student?.roleNumber ? `• #${post.student.roleNumber}` : ''} • ${timeAgo(post.createdAt)}`
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {user && user.role === 'viewer' && !isAnnouncement && (
              <Button
                onClick={handleFollow}
                disabled={followMutation.isPending}
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                // Hide on small screens to prevent squeeze; visible from sm+
                className={(isFollowing ? "bg-background hover:bg-muted" : "bg-accent hover:bg-accent/90") + " hidden sm:inline-flex"}
                data-testid={`follow-button-post-${post.id}`}
              >
                {followMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4 mr-1" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Follow
                  </>
                )}
              </Button>
            )}
            {!isAnnouncement && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* Mobile follow/unfollow action */}
                  {user && user.role === 'viewer' && (
                    <DropdownMenuItem onClick={handleFollow} disabled={followMutation.isPending}>
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-4 h-4 mr-2" />
                          Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Follow
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleViewProfile}>
                    <User className="w-4 h-4 mr-2" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSave}>
                    <Bookmark className="w-4 h-4 mr-2" />
                    {isSaved ? 'Unsave Post' : 'Save Post'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleReportPost} disabled={reportMutation.isPending}>
                    <Flag className="w-4 h-4 mr-2" />
                    Report Post
                  </DropdownMenuItem>
                  {user?.id === post.student?.userId && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleDeletePost} className="text-destructive" disabled={deleteMutation.isPending}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Post
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Post Media */}
      <div className="relative">
        {post.effectiveMediaType === "video" ? (
          post.effectiveStatus === "processing" ? (
            <div className="w-full flex justify-center bg-black rounded-lg overflow-hidden">
              <div className="w-full max-h-[600px] flex items-center justify-center relative">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-white">Processing video...</p>
                  <div className="mt-2 px-3 py-1 bg-accent/20 text-accent text-xs rounded-full">
                    Processing
                  </div>
                </div>
              </div>
            </div>
          ) : post.effectiveStatus === "failed" ? (
            <div className="w-full flex justify-center bg-black rounded-lg overflow-hidden">
              <div className="w-full max-h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 text-destructive mb-2 flex items-center justify-center">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                  <p className="text-sm text-white">Upload failed</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        if (!token) {
                          toast({ title: "Error", description: "Please log in to retry upload", variant: "destructive" });
                          return;
                        }
                        
                        const response = await fetch(`/api/upload/retry/${post.id}`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                          }
                        });
                        
                        if (response.ok) {
                          toast({ title: "Retry initiated", description: "Upload is being retried..." });
                          // Refresh the post data
                          queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
                        } else {
                          const error = await response.json();
                          toast({ title: "Retry failed", description: error.error || "Please try again", variant: "destructive" });
                        }
                      } catch (error) {
                        toast({ title: "Retry failed", description: "Please try again", variant: "destructive" });
                      }
                    }}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          ) : !post.effectiveMediaUrl ? (
            <div className="w-full flex justify-center bg-black rounded-lg overflow-hidden">
              <div className="w-full max-h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-white mb-2">🎥</div>
                  <p className="text-sm text-white">Video unavailable</p>
                </div>
              </div>
            </div>
          ) : post.status === 'processing' || post.effectiveMediaUrl?.includes('/api/placeholder/') ? (
            <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Processing video...</p>
              </div>
            </div>
          ) : videoError ? (
            <div className="w-full flex justify-center bg-black rounded-lg overflow-hidden">
              <div className="w-full max-h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-muted-foreground mb-2">
                    <X className="w-8 h-8 mx-auto" />
                  </div>
                  <p className="text-sm text-white">Video unavailable</p>
                </div>
              </div>
            </div>
          ) : (
            <ResponsiveMedia
              src={post.effectiveMediaUrl}
              type="video"
              poster={post.thumbnailUrl}
              autoplay={true}
              controls={true}
              onError={handleVideoError}
              priority={priority}
            />
          )
        ) : post.effectiveMediaType === "image" ? (
          post.status === 'processing' || post.effectiveMediaUrl?.includes('/api/placeholder/') ? (
            <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Processing image...</p>
              </div>
            </div>
          ) : post.effectiveMediaUrl ? (
            <ResponsiveMedia
              src={post.effectiveMediaUrl}
              type="image"
              alt="Post content"
              onError={() => {
                // Fallback handled by ResponsiveMedia component
              }}
              priority={priority}
            />
          ) : (
            <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center p-8">
                <div className="text-muted-foreground mb-2">🖼️</div>
                <p className="text-sm text-muted-foreground">Image unavailable</p>
              </div>
            </div>
          )
        ) : null}
      </div>

      {/* Post Content */}
      <div className="p-6">
        {/* Announcement Title */}
        {isAnnouncement && post.title && (
          <h2 className="text-xl font-bold text-foreground mb-3">{post.title}</h2>
        )}
        
        {/* Post Caption/Content */}
        {post.caption && (
          <p className="text-foreground mb-4">{post.caption}</p>
        )}

        {/* Interaction Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button
              onClick={handleLike}
              className={`flex items-center space-x-2 transition-colors duration-200 ${
                isLiked ? "text-red-500" : "text-muted-foreground hover:text-accent"
              }`}
              data-testid={`button-like-${post.id}`}
              disabled={likeMutation.isPending}
            >
              <Heart className={`w-6 h-6 ${isLiked ? "fill-current" : ""}`} />
              <span>{post.likesCount}</span>
            </button>
            
            <button
              onClick={handleComment}
              className={`flex items-center space-x-2 text-muted-foreground hover:text-accent transition-colors duration-200 ${!canComment ? 'opacity-50 cursor-not-allowed' : ''}`}
              data-testid={`button-comment-${post.id}`}
              disabled={!canComment}
            >
              <MessageCircle className="w-6 h-6" />
              <span>{post.commentsCount}</span>
            </button>
            
            <button
              onClick={handleSave}
              className={`flex items-center space-x-2 transition-colors duration-200 ${
                isSaved ? "text-accent" : "text-muted-foreground hover:text-accent"
              }`}
              data-testid={`button-save-${post.id}`}
              disabled={saveMutation.isPending}
            >
              <Bookmark className={`w-6 h-6 ${isSaved ? "fill-current" : ""}`} />
              <span>{post.savesCount}</span>
            </button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {post.viewCount} views
          </div>
        </div>

        {/* Comments Preview */}
        {post.commentsCount > 0 && canComment && (
          <div className="mt-4">
            <button 
              className="text-sm text-muted-foreground hover:text-foreground"
              data-testid={`button-view-comments-${post.id}`}
              onClick={() => { try { sessionStorage.setItem('feedReturnPostId', post.id); sessionStorage.setItem('feedScrollY', String(window.scrollY || window.pageYOffset || 0)); } catch {} window.location.href = `/post/${post.id}`; }}
            >
              View all {post.commentsCount} comments
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function arePostsVisuallyEqual(prev: PostWithDetails, next: PostWithDetails): boolean {
  if (prev.id !== next.id) return false;
  if (prev.effectiveMediaUrl !== next.effectiveMediaUrl) return false;
  if (prev.effectiveMediaType !== next.effectiveMediaType) return false;
  if (prev.thumbnailUrl !== next.thumbnailUrl) return false;
  if (prev.status !== next.status || (prev as any).effectiveStatus !== (next as any).effectiveStatus) return false;
  if (prev.caption !== next.caption) return false;
  if (prev.likesCount !== next.likesCount) return false;
  if (prev.commentsCount !== next.commentsCount) return false;
  if (prev.savesCount !== next.savesCount) return false;
  if (prev.isLiked !== next.isLiked) return false;
  if (prev.isSaved !== next.isSaved) return false;
  // Student display fields that affect header
  const pStu = prev.student || {} as any;
  const nStu = next.student || {} as any;
  if (pStu.name !== nStu.name) return false;
  if (pStu.profilePicUrl !== nStu.profilePicUrl) return false;
  if (pStu.position !== nStu.position) return false;
  if (pStu.roleNumber !== nStu.roleNumber) return false;
  return true;
}

const PostCard = memo(PostCardInner, (prevProps, nextProps) => {
  if (prevProps.priority !== nextProps.priority) return false;
  if (prevProps.skipCacheQuery !== nextProps.skipCacheQuery) return false;
  return arePostsVisuallyEqual(prevProps.post, nextProps.post);
});

export default PostCard;
