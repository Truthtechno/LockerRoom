import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Heart, MessageCircle, Bookmark, MoreHorizontal } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { PostWithDetails } from "@shared/schema";

interface PostCardProps {
  post: PostWithDetails;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

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

  const handleLike = () => {
    if (!user) return;
    likeMutation.mutate();
  };

  const handleSave = () => {
    if (!user) return;
    saveMutation.mutate();
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
          <button className="p-2 text-muted-foreground hover:bg-muted rounded-lg">
            <MoreHorizontal className="w-5 h-5" />
          </button>
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
              <button className="text-sm text-muted-foreground hover:text-foreground ml-10">
                View all {post.commentsCount} comments
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
