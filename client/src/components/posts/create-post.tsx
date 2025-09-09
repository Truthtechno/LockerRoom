import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Image, Video, X, Upload, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function CreatePost() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<{file: File; url: string; type: string} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const uploadMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
  });

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
      setSelectedMedia(null);
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (type === 'image' && !isImage) {
      toast({
        title: "Invalid file",
        description: "Please select an image file (JPG, PNG, GIF, etc.).",
        variant: "destructive",
      });
      return;
    }
    
    if (type === 'video' && !isVideo) {
      toast({
        title: "Invalid file",
        description: "Please select a video file (MP4, MOV, AVI, etc.).",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB for images, 50MB for videos)
    const maxSize = type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    const sizeLimit = type === 'image' ? '10MB' : '50MB';
    
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `Please select a ${type} smaller than ${sizeLimit}. Current file: ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
        variant: "destructive",
      });
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setSelectedMedia({ 
      file, 
      url, 
      type: isImage ? 'image' : 'video' 
    });
    
    // Show success message
    toast({
      title: "Media selected",
      description: `${type === 'image' ? 'Image' : 'Video'} ready for upload (${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
    });
  };

  const removeMedia = () => {
    if (selectedMedia) {
      URL.revokeObjectURL(selectedMedia.url);
    }
    setSelectedMedia(null);
  };

  const handleSubmit = async () => {
    if (!user || !caption.trim()) {
      toast({
        title: "Missing information",
        description: "Please add a caption to your post.",
        variant: "destructive",
      });
      return;
    }

    let mediaUrl = "";
    let mediaType = "text";

    // Upload media if selected
    if (selectedMedia) {
      setIsUploading(true);
      try {
        toast({
          title: "Uploading media...",
          description: `Uploading ${selectedMedia.type}. Please wait...`,
        });
        
        const uploadResult = await uploadMediaMutation.mutateAsync(selectedMedia.file);
        mediaUrl = uploadResult.url;
        mediaType = selectedMedia.type;
        
        toast({
          title: "Upload complete",
          description: "Media uploaded successfully!",
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        toast({
          title: "Upload failed",
          description: `Failed to upload media: ${errorMessage}. Please try again.`,
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const postData = {
      studentId: user.id,
      mediaUrl,
      mediaType,
      caption: caption.trim(),
    };

    createPostMutation.mutate(postData);
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
      
      {/* Media Preview */}
      {selectedMedia && (
        <div className="relative mb-4">
          {selectedMedia.type === 'image' ? (
            <img
              src={selectedMedia.url}
              alt="Selected media"
              className="w-full max-h-96 object-cover rounded-lg"
            />
          ) : (
            <video
              src={selectedMedia.url}
              className="w-full max-h-96 object-cover rounded-lg"
              controls
            />
          )}
          <button
            onClick={removeMedia}
            className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
            data-testid="button-remove-media"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center space-x-4">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e, 'image')}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => handleFileSelect(e, 'video')}
            className="hidden"
          />
          
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={isUploading || createPostMutation.isPending}
            className="flex items-center space-x-2 text-muted-foreground hover:text-accent transition-colors disabled:opacity-50"
            data-testid="button-add-photo"
          >
            <Image className="w-5 h-5" />
            <span className="text-sm">Photo</span>
          </button>
          <button
            onClick={() => videoInputRef.current?.click()}
            disabled={isUploading || createPostMutation.isPending}
            className="flex items-center space-x-2 text-muted-foreground hover:text-accent transition-colors disabled:opacity-50"
            data-testid="button-add-video"
          >
            <Video className="w-5 h-5" />
            <span className="text-sm">Video</span>
          </button>
        </div>
        
        <Button
          onClick={handleSubmit}
          disabled={!caption.trim() || createPostMutation.isPending || isUploading}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          data-testid="button-share-post"
        >
          {isUploading ? (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Uploading...
            </>
          ) : createPostMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sharing...
            </>
          ) : (
            "Share"
          )}
        </Button>
      </div>
    </div>
  );
}
