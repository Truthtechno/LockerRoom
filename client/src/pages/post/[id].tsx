import React, { useState, useEffect, memo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { timeAgo } from "@/lib/timeAgo";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import LazyMedia from "@/components/ui/lazy-media";
import ResponsiveMedia from "@/components/ui/responsive-media";
import { Heart, MessageCircle, Bookmark, Send, ArrowLeft, Trash2, MoreHorizontal, Megaphone } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { PostWithDetails, PostCommentWithUser } from "@shared/schema";
import { Link } from "wouter";

export default function PostDetail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, params] = useRoute("/post/:id");
  const postId = params?.id;
  
  const [newComment, setNewComment] = useState("");

  // Query for post details
  const { data: post, isLoading: postLoading, error: postError } = useQuery<PostWithDetails>({
    queryKey: ["/api/posts", postId],
    queryFn: async () => {
      if (!postId) throw new Error('Post ID is required');
      
      const response = await apiRequest("GET", `/api/posts/${postId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }
      
      return response.json();
    },
    enabled: !!postId,
    staleTime: 30_000, // Cache post data for 30 seconds
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (post not found) or 400 (bad request)
      if (error?.status === 404 || error?.status === 400) return false;
      // Retry on server errors (500+) or network issues
      return failureCount < 3;
    }
  });

  // Handle scroll to comments when coming from notification
  useEffect(() => {
    if (!post) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const scrollToComments = urlParams.get('scrollToComments') === 'true';
    
    if (scrollToComments) {
      // Small delay to ensure the post content is rendered
      setTimeout(() => {
        const commentsSection = document.querySelector('[data-comments-section]');
        if (commentsSection) {
          commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Focus the comment input if available
          setTimeout(() => {
            const commentInput = document.querySelector('[data-comment-input]') as HTMLInputElement | HTMLTextAreaElement;
            if (commentInput) {
              commentInput.focus();
            }
          }, 500);
          
          // Clean up URL parameter
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      }, 300);
    }
  }, [post]);

  // Post interaction mutations
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!post) throw new Error("Post not found");
      
      if (post.isLiked) {
        const response = await apiRequest("DELETE", `/api/posts/${postId}/like`);
        return response.json();
      } else {
        const response = await apiRequest("POST", `/api/posts/${postId}/like`);
        return response.json();
      }
    },
    onSuccess: (data) => {
      // Update the post in the cache
      queryClient.setQueryData(["/api/posts", postId], (old: any) => 
        old ? { ...old, likesCount: data.likesCount, isLiked: data.isLiked } : old
      );
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/posts/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/student"] });
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
    mutationFn: async () => {
      if (!post) throw new Error("Post not found");
      
      if (post.isSaved) {
        const response = await apiRequest("DELETE", `/api/posts/${postId}/save`);
        return response.json();
      } else {
        const response = await apiRequest("POST", `/api/posts/${postId}/save`);
        return response.json();
      }
    },
    onSuccess: (data) => {
      // Update the post in the cache
      queryClient.setQueryData(["/api/posts", postId], (old: any) => 
        old ? { ...old, savesCount: data.savesCount, isSaved: data.isSaved } : old
      );
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/posts/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/saved"] });
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
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", `/api/posts/${postId}/comments`, { content });
      return response.json();
    },
    onSuccess: (data) => {
      // Update the post in the cache
      queryClient.setQueryData(["/api/posts", postId], (old: any) => 
        old ? { ...old, commentsCount: data.commentsCount } : old
      );
      
      // Invalidate comments query
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId, "comments"] });
      
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/posts/${postId}`);
    },
    onSuccess: () => {
      // Invalidate all post queries
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      
      toast({
        title: "Post deleted",
        description: "Your post has been deleted successfully.",
      });
      
      // Redirect to feed
      window.history.back();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLike = () => {
    if (!user) return;
    likeMutation.mutate();
  };

  const handleSave = () => {
    if (!user) return;
    saveMutation.mutate();
  };

  const handleComment = () => {
    if (!user || !newComment.trim()) return;
    
    // Prevent viewers from commenting
    if (user.role === "viewer") {
      toast({
        title: "Access Denied",
        description: "Only students can comment on posts.",
        variant: "destructive",
      });
      return;
    }
    
    commentMutation.mutate(newComment.trim());
  };

  const handleDeletePost = () => {
    if (window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleComment();
    }
  };

  // Loading state
  if (postLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-8">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-4" />
              <p className="text-muted-foreground">Loading post...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (postError || !post) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-8">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center max-w-md mx-auto px-4">
              <div className="w-20 h-20 bg-gradient-to-br from-destructive/20 to-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-10 h-10 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Post Not Found</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                This post has been removed or no longer exists. It may have been deleted by the author or is temporarily unavailable.
              </p>
              <div className="space-y-3">
                <Button onClick={() => window.history.back()} variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
                <Button onClick={() => window.location.href = '/feed'} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Back to Feed
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <div className="lg:pl-64 pb-24 lg:pb-8 post-detail-container">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <div className="mb-6">
            <Button 
              onClick={() => window.history.back()} 
              variant="ghost" 
              className="flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>

          {/* Post Content */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {/* Post Header */}
            <div className="p-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {post.isAnnouncement || post.type === 'announcement' ? (
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
                    {post.isAnnouncement || post.type === 'announcement' ? (
                      <>
                        <h3 className="font-semibold text-foreground">
                          {post.announcementScope === 'global' 
                            ? 'XEN Sports Platform' 
                            : (post.announcementSchool?.name || post.student?.name || 'School Administration')}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Official Announcement • {timeAgo(post.createdAt)}
                        </p>
                      </>
                    ) : (
                      <>
                        <Link href={`/profile/${post.student?.id}`}>
                          <h3 className="font-semibold text-foreground hover:text-accent cursor-pointer transition-colors">
                            {post.student?.name || 'Unknown Student'}
                          </h3>
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {post.student?.position || 'Player'} {post.student?.roleNumber ? `• #${post.student.roleNumber}` : ''} • {timeAgo(post.createdAt)}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {user?.id === post.student?.userId && (
                  <Button
                    onClick={handleDeletePost}
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
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
                      </div>
                    </div>
                  </div>
                ) : post.effectiveStatus === "failed" ? (
                  <div className="w-full flex justify-center bg-black rounded-lg overflow-hidden">
                    <div className="w-full max-h-[600px] flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-white mb-2">🎥</div>
                        <p className="text-sm text-white">Upload failed</p>
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
                ) : (
                  <ResponsiveMedia
                    src={post.effectiveMediaUrl}
                    type="video"
                    poster={post.thumbnailUrl}
                    autoplay={false}
                    controls={true}
                    priority={true}
                  />
                )
              ) : post.effectiveMediaType === "image" ? (
                post.effectiveMediaUrl ? (
                  <ResponsiveMedia
                    src={post.effectiveMediaUrl}
                    type="image"
                    alt="Post content"
                    priority={true}
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
              {post.caption && (
                <p className="text-foreground mb-4">{post.caption}</p>
              )}

              {/* Interaction Buttons */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-6">
                  <button
                    onClick={handleLike}
                    className={`flex items-center space-x-2 transition-colors duration-200 ${
                      post.isLiked ? "text-red-500" : "text-muted-foreground hover:text-accent"
                    }`}
                    disabled={likeMutation.isPending}
                  >
                    <Heart className={`w-6 h-6 ${post.isLiked ? "fill-current" : ""}`} />
                    <span>{post.likesCount}</span>
                  </button>
                  
                  <button
                    onClick={handleSave}
                    className={`flex items-center space-x-2 transition-colors duration-200 ${
                      post.isSaved ? "text-accent" : "text-muted-foreground hover:text-accent"
                    }`}
                    disabled={saveMutation.isPending}
                  >
                    <Bookmark className={`w-6 h-6 ${post.isSaved ? "fill-current" : ""}`} />
                    <span>{post.savesCount}</span>
                  </button>
                </div>
              </div>

              {/* Comments Section */}
              <div className="border-t border-border pt-4" data-comments-section>
                <h4 className="font-medium text-foreground mb-4">Comments ({post.commentsCount})</h4>
                
                {/* Comments List */}
                <ScrollArea className="max-h-96 mb-4 scrollbar-thin">
                  <PostComments postId={postId!} post={post} />
                </ScrollArea>
                
                {/* Comment Input */}
                {user && (
                  <div className="flex items-start space-x-3">
                    <AvatarWithFallback 
                      src={user?.profilePicUrl}
                      alt={user?.name || "You"}
                      size="sm"
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      {user.role === "viewer" ? (
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-sm text-muted-foreground">
                            Only students can comment on posts.
                          </p>
                        </div>
                      ) : (
                        <>
                          <Input
                            data-comment-input
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Add a comment..."
                            className="flex-1"
                          />
                          <div className="flex justify-end">
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
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Post Comments Component
function PostComments({ postId, post }: { postId: string; post: PostWithDetails }) {
  const { data: comments, isLoading } = useQuery<PostCommentWithUser[]>({
    queryKey: ["/api/posts", postId, "comments"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/posts/${postId}/comments`);
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
    <div className="space-y-4">
      {comments && comments.length > 0 ? (
        comments.map((comment) => (
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
                    {(() => {
                      // If this is an announcement post and the commenter is the admin who created it, show school:name
                      const isAnnouncement = post?.isAnnouncement || post?.type === 'announcement';
                      const isCreatorComment = post?.createdByAdminId === comment.user?.id;
                      
                      if (isAnnouncement && isCreatorComment && post?.announcementSchool) {
                        return post.announcementSchool.name;
                      }
                      return comment.user?.name || 'Anonymous';
                    })()}
                  </span>
                  {(() => {
                    // Show "Official Announcement" instead of position for announcement creator comments
                    const isAnnouncement = post?.isAnnouncement || post?.type === 'announcement';
                    const isCreatorComment = post?.createdByAdminId === comment.user?.id;
                    
                    if (isAnnouncement && isCreatorComment) {
                      return <span className="text-xs text-muted-foreground ml-2">• Official Announcement</span>;
                    }
                    return null;
                  })()}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {timeAgo(comment.createdAt)}
                </span>
              </div>
              <p className="text-sm text-foreground">{comment.content}</p>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No comments yet. Be the first to comment!
        </div>
      )}
    </div>
  );
}
