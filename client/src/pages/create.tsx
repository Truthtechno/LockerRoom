import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Image, Video, X, Upload, Loader2, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { createPostWithMedia } from "@/lib/cloudinary";
import ResponsiveMedia from "@/components/ui/responsive-media";
import ProgressBar from "@/components/ui/progress-bar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";

export default function CreatePostPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [caption, setCaption] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<{file: File; url: string; type: string} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const createPostMutation = useMutation({
    mutationFn: async (postData: { caption: string; mediaFile?: File }) => {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      if (!user) {
        throw new Error('User not found. Please log in again.');
      }

      console.log("🚀 Creating post with data:", { caption: postData.caption, hasMedia: !!postData.mediaFile });

      // Get student profile to ensure we have a valid studentId
      try {
        const studentResponse = await apiRequest("GET", `/api/students/me`);
        const studentProfile = await studentResponse.json();
        
        console.log("👤 Student profile:", studentProfile);
        
        if (!studentProfile || !studentProfile.id) {
          throw new Error('Student profile not found. Please create your profile first.');
        }

        if (postData.mediaFile) {
          // Use the new async upload function with progress tracking
          console.log("📤 Creating post with media...");
          const uploadResult = await createPostWithMedia(
            postData.mediaFile, 
            postData.caption, 
            studentProfile.id,
            (progress) => setUploadProgress(progress)
          );
          console.log("✅ Upload response:", uploadResult);
          
          // The upload endpoint returns { post: {...}, isProcessing: true }
          // Extract the post and fetch full details
          const postId = (uploadResult as any).post?.id || (uploadResult as any).id;
          
          if (!postId) {
            throw new Error('No post ID returned from upload');
          }
          
          // Wait for the post to be ready (with timeout)
          console.log("⏳ Waiting for post to be ready...");
          let fullPost;
          let attempts = 0;
          const maxAttempts = 40; // 20 seconds max
          
          while (attempts < maxAttempts) {
            const postResponse = await apiRequest("GET", `/api/posts/${postId}`);
            fullPost = await postResponse.json();
            
            // Check if post is ready
            if (fullPost.status === 'ready' && fullPost.mediaUrl && !fullPost.mediaUrl.includes('/api/placeholder/')) {
              console.log("✅ Post is ready:", fullPost);
              return fullPost;
            }
            
            // Wait 500ms before next check
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }
          
          // If timeout, return the post anyway (it will show processing state)
          console.log("⚠️ Timeout waiting for post, returning current state");
          return fullPost || { id: postId };
        } else {
          // Text-only post - create directly
          const formData = new FormData();
          formData.append('caption', postData.caption);
          formData.append('studentId', studentProfile.id);

          console.log("📤 Sending text-only post creation request...");
          
          const response = await fetch('/api/posts', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              caption: postData.caption,
              studentId: studentProfile.id
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            console.log("❌ Post creation failed:", error);
            throw new Error(error.message || 'Failed to create post');
          }
          
          const result = await response.json();
          console.log("✅ Text post created successfully:", result);
          return result;
        }
      } catch (error: any) {
        console.log("💥 Post creation error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Update the feed cache with the new post
      queryClient.setQueryData(["/api/posts/feed", 12], (old: any) => {
        if (!old?.pages?.length) return old;
        const firstPage = old.pages[0];
        const updatedFirstPage = { 
          ...firstPage, 
          posts: [data, ...(firstPage.posts || [])] 
        };
        return { ...old, pages: [updatedFirstPage, ...old.pages.slice(1)] };
      });
      
      // Invalidate other queries for consistency (but NOT the feed to preserve our update)
      queryClient.invalidateQueries({ queryKey: ["/api/posts/student"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students/me/stats"] });
      
      // Also invalidate school admin dashboard queries when students create posts
      const schoolId = user?.schoolId;
      if (schoolId) {
        queryClient.invalidateQueries({ queryKey: ["/api/schools", schoolId, "stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/schools", schoolId, "recent-activity"] });
        queryClient.invalidateQueries({ queryKey: ["/api/schools", schoolId, "top-performers"] });
      }
      
      toast({
        title: "Post created successfully!",
        description: "Your post has been shared and will appear in the feed.",
      });
      
      // Redirect to feed
      setLocation("/feed");
    },
    onError: (error: any) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      let userFriendlyMessage = "Failed to create post. Please try again.";
      
      if (errorMessage.includes("Student profile not found")) {
        userFriendlyMessage = "Please create your student profile first before posting.";
      } else if (errorMessage.includes("Media file required")) {
        userFriendlyMessage = "Please select an image or video to share.";
      } else if (errorMessage.includes("Upload failed") || errorMessage.includes("Network error")) {
        userFriendlyMessage = "Failed to upload media. Please check your connection and try again.";
      } else if (errorMessage.includes("File too large")) {
        userFriendlyMessage = "File is too large. Please select a smaller file.";
      }
      
      toast({
        title: "Post creation failed",
        description: userFriendlyMessage,
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
    setUploadError(null);
    setRetryCount(0);
  };

  const handleSubmit = async () => {
    if (!caption.trim() && !selectedMedia) {
      toast({
        title: "Missing content",
        description: "Please add a caption or select media to share.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    
    try {
      const postData = {
        caption: caption.trim(),
        mediaFile: selectedMedia?.file,
      };

      await createPostMutation.mutateAsync(postData);
      
      // Clear form on success
      setCaption("");
      setSelectedMedia(null);
      setUploadProgress(0);
      setUploadError(null);
      setRetryCount(0);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCancel = () => {
    setLocation("/feed");
  };

  // Only allow students to create posts
  if (user?.role !== "student") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-lg mx-auto p-4 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Access Restricted</h3>
          <p className="text-muted-foreground mb-4">
            Only student athletes can create posts.
          </p>
          <Button onClick={() => setLocation("/feed")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Feed
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button
            onClick={handleCancel}
            variant="ghost"
            size="sm"
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Create Post</h1>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto p-4 pb-20">
        {/* User Info */}
        <div className="flex items-center space-x-3 mb-6">
          <AvatarWithFallback 
            src={user?.profilePicUrl}
            alt={user?.name || "Your profile"}
            size="lg"
          />
          <div>
            <h3 className="font-medium text-foreground">{user?.name}</h3>
            <p className="text-sm text-muted-foreground">Student Athlete</p>
          </div>
        </div>

        {/* Caption Input */}
        <div className="mb-6">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Share your game highlights, achievements, or thoughts..."
            className="min-h-[120px] resize-none border-0 bg-transparent text-foreground placeholder-muted-foreground focus:ring-0 text-lg"
            data-testid="textarea-post-caption"
          />
        </div>

        {/* Media Preview */}
        {selectedMedia && (
          <div className="relative mb-6">
            <ResponsiveMedia
              src={selectedMedia.url}
              type={selectedMedia.type as 'image' | 'video'}
              alt="Selected media"
              controls={selectedMedia.type === 'video'}
              className="rounded-lg"
            />
            <button
              onClick={removeMedia}
              className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              data-testid="button-remove-media"
            >
              <X className="w-4 h-4" />
            </button>
            
            {/* Upload Progress */}
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <div className="bg-card p-4 rounded-lg w-64">
                  <div className="text-center mb-3">
                    <Upload className="w-6 h-6 mx-auto mb-2 text-accent" />
                    <p className="text-sm text-foreground">Uploading {selectedMedia.type}...</p>
                  </div>
                  <ProgressBar progress={uploadProgress} />
                </div>
              </div>
            )}
            
            {/* Upload Error */}
            {uploadError && !isUploading && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <div className="bg-card p-4 rounded-lg w-64">
                  <div className="text-center mb-3">
                    <X className="w-6 h-6 mx-auto mb-2 text-destructive" />
                    <p className="text-sm text-foreground mb-2">Upload failed</p>
                    <p className="text-xs text-muted-foreground mb-3">{uploadError}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => {
                        setUploadError(null);
                        handleSubmit();
                      }}
                      size="sm"
                      className="flex-1 bg-accent hover:bg-accent/90"
                      disabled={retryCount >= 3}
                    >
                      {retryCount >= 3 ? "Max retries" : `Retry (${retryCount}/3)`}
                    </Button>
                    <Button
                      onClick={removeMedia}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Media Selection Buttons */}
        <div className="flex items-center space-x-4 mb-6">
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

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="flex-1"
            disabled={isUploading || createPostMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={(!caption.trim() && !selectedMedia) || createPostMutation.isPending || isUploading || !!uploadError}
            className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
            data-testid="button-share-post"
          >
            {isUploading ? (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Uploading {uploadProgress}%...
              </>
            ) : createPostMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : uploadError ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Upload Failed
              </>
            ) : (
              "Share"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
