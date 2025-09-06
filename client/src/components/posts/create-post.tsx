import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Image, Video } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function CreatePost() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState("");

  const createPostMutation = useMutation({
    mutationFn: async (postData: { studentId: string; mediaUrl: string; mediaType: string; caption: string }) => {
      const response = await apiRequest("POST", "/api/posts", postData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post created",
        description: "Your post has been shared successfully!",
      });
      setCaption("");
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async () => {
    if (!user || !caption.trim()) return;

    // For demo purposes, use a placeholder image
    const mockPostData = {
      studentId: user.id, // In real app, this would be the student ID
      mediaUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&h=600",
      mediaType: "image",
      caption: caption.trim(),
    };

    createPostMutation.mutate(mockPostData);
  };

  if (user?.role !== "student") return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-6 shadow-sm">
      <div className="flex items-center space-x-3 mb-4">
        <img
          className="h-12 w-12 rounded-full"
          src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400"
          alt="Your profile"
        />
        <div className="flex-1">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Share your game highlights..."
            className="border-0 resize-none bg-transparent text-foreground placeholder-muted-foreground focus:ring-0"
            rows={3}
            data-testid="textarea-post-caption"
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center space-x-4">
          <button
            className="flex items-center space-x-2 text-muted-foreground hover:text-accent transition-colors"
            data-testid="button-add-photo"
          >
            <Image className="w-5 h-5" />
            <span className="text-sm">Photo</span>
          </button>
          <button
            className="flex items-center space-x-2 text-muted-foreground hover:text-accent transition-colors"
            data-testid="button-add-video"
          >
            <Video className="w-5 h-5" />
            <span className="text-sm">Video</span>
          </button>
        </div>
        
        <Button
          onClick={handleSubmit}
          disabled={!caption.trim() || createPostMutation.isPending}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          data-testid="button-share-post"
        >
          {createPostMutation.isPending ? "Sharing..." : "Share"}
        </Button>
      </div>
    </div>
  );
}
