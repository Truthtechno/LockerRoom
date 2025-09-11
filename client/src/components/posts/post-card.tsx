import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Send, UserPlus, UserCheck, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { PostWithDetails, Comment } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface PostCardProps {
  post: PostWithDetails;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  // Check if following the student
  const { data: followStatus } = useQuery({
    queryKey: ["/api/students/follow-status", post.student?.id, user?.id],
    queryFn: async () => {
      if (!user || !post.student?.id) return false;
      const response = await fetch(`/api/students/${post.student.id}/is-following?userId=${user.id}`);
      return response.json();
    },
    enabled: !!user && !!post.student?.id,
  });

  useEffect(() => {
    if (followStatus !== undefined) {
      setIsFollowing(followStatus);
    }
  }, [followStatus]);

  // Fetch all comments for the modal
  const { data: allComments, isLoading: loadingComments } = useQuery<Comment[]>({
    queryKey: ["/api/posts", post.id, "comments"],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${post.id}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: showCommentsModal,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        await apiRequest("DELETE", `/api/posts/${post.id}/like`, { userId: user?.id });
      } else {
        await apiRequest("POST", `/api/posts/${post.id}/like`, { userId: user?.id });
      }
    },
    onSuccess: () => {
      setIsLiked(!isLiked);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
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
      if (isSaved) {
        await apiRequest("DELETE", `/api/posts/${post.id}/save`, { userId: user?.id });
      } else {
        await apiRequest("POST", `/api/posts/${post.id}/save`, { userId: user?.id });
      }
    },
    onSuccess: () => {
      setIsSaved(!isSaved);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
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
      await apiRequest("POST", `/api/posts/${post.id}/comment`, { 
        userId: user?.id, 
        content 
      });
    },
    onSuccess: () => {
      setNewComment("");
      setShowCommentInput(false);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts", post.id, "comments"] });
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

  const followMutation = useMutation({
    mutationFn: async () => {
      const method = isFollowing ? "DELETE" : "POST";
      await fetch(`/api/students/${post.student?.id}/follow`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
    },
    onSuccess: () => {
      setIsFollowing(!isFollowing);
      queryClient.invalidateQueries({ queryKey: ["/api/students/follow-status"] });
      toast({
        title: isFollowing ? "Unfollowed" : "Following",
        description: `You are ${isFollowing ? 'no longer following' : 'now following'} ${post.student?.user?.name}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update follow status",
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
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to comment on posts.",
        variant: "destructive",
      });
      return;
    }
    setShowCommentInput(!showCommentInput);
  };

  const handleSubmitComment = () => {
    if (!newComment.trim() || !user) return;
    commentMutation.mutate(newComment.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  const handleFollow = () => {
    if (!user || !post.student?.id) {
      toast({
        title: "Login required",
        description: "Please log in to follow student athletes.",
        variant: "destructive",
      });
      return;
    }
    followMutation.mutate();
  };

  return (
    <div className="bg-card border border-border rounded-xl mb-6 shadow-sm post-card transition-all duration-200">
      {/* Post Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              className="h-12 w-12 rounded-full"
              src={post.student?.user?.name === "Marcus Rodriguez" 
                ? "https://images.unsplash.com/photo-1546525848-3ce03ca516f6?auto=format&fit=crop&w=400&h=400"
                : "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400"
              }
              alt="Student athlete"
            />
            <div>
              <h3 className="font-semibold text-foreground">{post.student?.user?.name || 'Unknown Student'}</h3>
              <p className="text-sm text-muted-foreground">
                {post.student?.sport || 'Sports'} • #{post.student?.roleNumber || 'N/A'} • 2 hours ago
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {user && user.role === 'viewer' && (
              <Button
                onClick={handleFollow}
                disabled={followMutation.isPending}
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                className={isFollowing ? "bg-background hover:bg-muted" : "bg-accent hover:bg-accent/90"}
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
            <button className="p-2 text-muted-foreground hover:bg-muted rounded-lg">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Post Media */}
      <div className="relative">
        <img
          src={post.mediaUrl}
          alt="Post content"
          className="w-full aspect-video object-cover"
        />
        {post.mediaType === "video" && (
          <div className="absolute top-4 right-4">
            <span className="bg-black/80 text-white px-2 py-1 rounded text-sm">2:34</span>
          </div>
        )}
      </div>

      {/* Post Content */}
      <div className="p-6">
        {post.caption && (
          <p className="text-foreground mb-4">{post.caption}</p>
        )}

        {/* Interaction Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button
              onClick={handleLike}
              className={`flex items-center space-x-2 transition-colors ${
                isLiked ? "text-red-500" : "text-muted-foreground hover:text-accent"
              }`}
              data-testid={`button-like-${post.id}`}
              disabled={likeMutation.isPending}
            >
              <Heart className={`w-6 h-6 ${isLiked ? "fill-current" : ""}`} />
              <span>{post.likesCount + (isLiked ? 1 : 0)}</span>
            </button>
            
            <button
              onClick={handleComment}
              className="flex items-center space-x-2 text-muted-foreground hover:text-accent transition-colors"
              data-testid={`button-comment-${post.id}`}
            >
              <MessageCircle className="w-6 h-6" />
              <span>{post.commentsCount}</span>
            </button>
            
            <button
              onClick={handleSave}
              className={`flex items-center space-x-2 transition-colors ${
                isSaved ? "text-accent" : "text-muted-foreground hover:text-accent"
              }`}
              data-testid={`button-save-${post.id}`}
              disabled={saveMutation.isPending}
            >
              <Bookmark className={`w-6 h-6 ${isSaved ? "fill-current" : ""}`} />
              <span>{post.savesCount + (isSaved ? 1 : 0)}</span>
            </button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {post.viewsCount.toLocaleString()} views
          </div>
        </div>

        {/* Comments Preview */}
        {post.comments.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-start space-x-2">
              <img
                className="h-8 w-8 rounded-full"
                src="https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?auto=format&fit=crop&w=400&h=400"
                alt="Commenter"
              />
              <div className="flex-1">
                <span className="font-medium text-foreground">{post.comments[0]?.user?.name || 'Anonymous'}</span>
                <span className="text-muted-foreground ml-2">{post.comments[0]?.content || ''}</span>
              </div>
            </div>
            {post.commentsCount > 1 && (
              <Dialog open={showCommentsModal} onOpenChange={setShowCommentsModal}>
                <DialogTrigger asChild>
                  <button 
                    className="text-sm text-muted-foreground hover:text-foreground ml-10"
                    data-testid={`button-view-comments-${post.id}`}
                  >
                    View all {post.commentsCount} comments
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Comments</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[60vh] pr-4">
                    {loadingComments ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {allComments && allComments.length > 0 ? (
                          allComments.map((comment) => (
                            <div key={comment.id} className="flex items-start space-x-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage 
                                  src={comment.user?.profilePicUrl || comment.user?.profilePic || ""} 
                                  alt={comment.user?.name || "User"} 
                                />
                                <AvatarFallback className="bg-accent/20 text-accent font-semibold text-xs">
                                  {comment.user?.name?.slice(0, 2).toUpperCase() || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="font-medium text-sm text-foreground">
                                    {comment.user?.name || 'Anonymous'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
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
                    )}
                  </ScrollArea>
                  <div className="border-t pt-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage 
                          src={user?.profilePicUrl || ""} 
                          alt={user?.name || "You"} 
                        />
                        <AvatarFallback className="bg-accent/20 text-accent font-semibold text-xs">
                          {user?.name?.slice(0, 2).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex items-center space-x-2">
                        <Input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (handleSubmitComment) {
                                handleSubmitComment();
                                setShowCommentsModal(false);
                              }
                            }
                          }}
                          placeholder="Add a comment..."
                          className="flex-1"
                          data-testid={`input-modal-comment-${post.id}`}
                        />
                        <Button
                          onClick={() => {
                            if (handleSubmitComment) {
                              handleSubmitComment();
                              setShowCommentsModal(false);
                            }
                          }}
                          disabled={!newComment.trim() || commentMutation.isPending}
                          size="sm"
                          className="bg-accent hover:bg-accent/90"
                          data-testid={`button-submit-modal-comment-${post.id}`}
                        >
                          {commentMutation.isPending ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {/* Comment Input */}
        {showCommentInput && user && (
          <div className="mt-4 flex items-center space-x-3">
            <img
              className="h-8 w-8 rounded-full"
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&h=400"
              alt="Your profile"
            />
            <div className="flex-1 flex items-center space-x-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add a comment..."
                className="flex-1"
                data-testid={`input-comment-${post.id}`}
              />
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || commentMutation.isPending}
                size="sm"
                className="bg-accent hover:bg-accent/90"
                data-testid={`button-submit-comment-${post.id}`}
              >
                {commentMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
