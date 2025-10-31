import { useState, useRef } from "react";
import { useMutation, useQueryClient, QueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import ProgressBar from "@/components/ui/progress-bar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Image, Video, X, Upload, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { createPostWithMedia } from "@/lib/cloudinary";
import ResponsiveMedia from "@/components/ui/responsive-media";
import type { PostWithDetails } from "@shared/schema";

// Background polling function to update post when processing completes
async function pollForPostReady(postId: string, queryClient: QueryClient) {
  console.log("🔄 Starting background polling for post:", postId);
  let attempts = 0;
  const maxAttempts = 60; // 30 seconds
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
    
    try {
      const postResponse = await apiRequest("GET", `/api/posts/${postId}`);
      const updatedPost = await postResponse.json();
      
      console.log(`🔍 Poll attempt ${attempts}: status=${updatedPost.status}, mediaUrl=${updatedPost.mediaUrl?.substring(0, 50)}...`);
      
      // Check if post is ready
      if (updatedPost.status === 'ready' && updatedPost.mediaUrl && !updatedPost.mediaUrl.includes('/api/placeholder/')) {
        console.log("✅ Post processing complete, updating cache:", updatedPost);
        
        // Update the post in the feed cache
        queryClient.setQueryData(["/api/posts/feed", 12], (old: any) => {
          if (!old?.pages?.length) {
            console.log("⚠️ No feed cache found");
            return old;
          }
          
          const updatedPages = old.pages.map((page: any) => ({
            ...page,
            posts: page.posts?.map((p: any) => p.id === postId ? updatedPost : p) || []
          }));
          
          console.log("✅ Feed cache updated successfully");
          return { ...old, pages: updatedPages };
        });
        
        // Also invalidate to trigger refetch
        queryClient.invalidateQueries({ queryKey: ["/api/posts", postId] });
        
        break;
      }
      
      if (updatedPost.status === 'failed') {
        console.log("❌ Post processing failed");
        break;
      }
    } catch (error) {
      console.error("❌ Error polling for post:", error);
      break;
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log("⏱️ Polling timeout reached");
  }
}

interface CreatePostProps {
  onPostCreated?: (newPost?: PostWithDetails) => void;
}

export default function CreatePost({ onPostCreated }: CreatePostProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
          // Create optimistic post with local preview URL (like profile pictures)
          const localPreviewUrl = URL.createObjectURL(postData.mediaFile);
          const isVideo = postData.mediaFile.type.startsWith('video/');
          
          // Create optimistic post that will be shown immediately
          const optimisticPost = {
            id: `temp-${Date.now()}`,
            studentId: studentProfile.id,
            mediaUrl: localPreviewUrl, // Use local preview URL
            mediaType: isVideo ? 'video' : 'image',
            caption: postData.caption,
            status: 'ready', // Mark as ready so it shows immediately
            cloudinaryPublicId: null,
            thumbnailUrl: null,
            type: 'post',
            title: null,
            broadcast: false,
            scope: 'school',
            schoolId: studentProfile.schoolId,
            createdByAdminId: null,
            createdAt: new Date(),
            student: {
              id: studentProfile.id,
              userId: user?.id || '',
              name: studentProfile.name,
              sport: studentProfile.sport || '',
              position: studentProfile.position || '',
              roleNumber: studentProfile.roleNumber || '',
              profilePicUrl: studentProfile.profilePicUrl || user?.profilePicUrl || null,
            },
            likesCount: 0,
            commentsCount: 0,
            savesCount: 0,
            viewCount: 0,
            isLiked: false,
            isSaved: false,
            effectiveMediaUrl: localPreviewUrl,
            effectiveMediaType: isVideo ? 'video' : 'image',
            effectiveStatus: 'ready',
          };
          
          // Return optimistic post immediately
          // Upload will happen in background and update the post when done
          console.log("✅ Returning optimistic post with local preview");
          
          // Start background upload (don't await)
          createPostWithMedia(
            postData.mediaFile, 
            postData.caption, 
            studentProfile.id,
            (progress) => setUploadProgress(progress)
          ).then(async (uploadResult) => {
            const postId = (uploadResult as any).post?.id || (uploadResult as any).id;
            if (postId) {
              // Poll for the real post and update cache when ready
              pollForPostReady(postId, queryClient);
            }
          }).catch(error => {
            console.error("Background upload failed:", error);
          });
          
          return optimisticPost;
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
    onSuccess: (created) => {
      console.log("✅ Post created, updating cache:", created);
      
      // Add the new post to the beginning of the feed or replace optimistic post
      queryClient.setQueryData(["/api/posts/feed", 12], (old: any) => {
        if (!old?.pages?.length) {
          console.log("⚠️ No pages in cache, creating new structure");
          return {
            pages: [{ posts: [created], hasMore: false, nextOffset: 0 }],
            pageParams: [0]
          };
        }
        
        const firstPage = old.pages[0];
        console.log("📝 Current first page posts:", firstPage.posts?.length || 0);
        
        // Check if this is replacing an optimistic post (temp ID)
        const hasOptimisticPost = firstPage.posts?.some((p: any) => p.id.toString().startsWith('temp-'));
        
        if (hasOptimisticPost) {
          // Replace the optimistic post with the real one
          console.log("🔄 Replacing optimistic post with real post");
          const updatedPosts = firstPage.posts?.map((p: any) => 
            p.id.toString().startsWith('temp-') ? created : p
          ) || [];
          const updatedFirstPage = { ...firstPage, posts: updatedPosts };
          return { ...old, pages: [updatedFirstPage, ...old.pages.slice(1)] };
        }
        
        // Check if post already exists (avoid duplicates)
        const postExists = firstPage.posts?.some((p: any) => p.id === created.id);
        if (postExists) {
          console.log("ℹ️ Post already exists in cache");
          return old;
        }
        
        const updatedFirstPage = { 
          ...firstPage, 
          posts: [created, ...(firstPage.posts || [])] 
        };
        
        console.log("✅ Updated first page with new post, total:", updatedFirstPage.posts.length);
        return { ...old, pages: [updatedFirstPage, ...old.pages.slice(1)] };
      });
      
      // Update student posts cache
      queryClient.setQueryData(["/api/posts/student"], (old: any) => {
        if (!old) return [created];
        const postExists = old.some((p: any) => p.id === created.id);
        if (postExists) return old;
        return [created, ...old];
      });
      
      // Invalidate other queries for consistency
      queryClient.invalidateQueries({ queryKey: ["/api/posts/student"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students/me/stats"] });
      
      // Also invalidate school admin dashboard queries when students create posts
      const schoolId = user?.schoolId;
      if (schoolId) {
        queryClient.invalidateQueries({ queryKey: ["/api/schools", schoolId, "stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/schools", schoolId, "recent-activity"] });
        queryClient.invalidateQueries({ queryKey: ["/api/schools", schoolId, "top-performers"] });
      }
      
      // ensure 'created' is the full post object from the server
      onPostCreated?.(created);
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

  const retryUpload = async () => {
    if (!selectedMedia || !caption.trim()) return;
    
    setUploadError(null);
    setRetryCount(prev => prev + 1);
    
    try {
      const postData = {
        caption: caption.trim(),
        mediaFile: selectedMedia.file,
      };

      await createPostMutation.mutateAsync(postData);
      
      toast({
        title: "Upload successful",
        description: "Your post has been shared successfully!",
      });
      
      setCaption("");
      setSelectedMedia(null);
      setUploadProgress(0);
      setUploadError(null);
      setRetryCount(0);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setUploadError(errorMessage);
      
      toast({
        title: "Upload failed",
        description: `Retry ${retryCount + 1} failed. ${errorMessage}`,
        variant: "destructive",
      });
    }
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

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    
    try {
      toast({
        title: "Creating post...",
        description: selectedMedia ? `Uploading ${selectedMedia.type} and creating post...` : "Creating post...",
      });

      const postData = {
        caption: caption.trim(),
        mediaFile: selectedMedia?.file,
      };

      const result = await createPostMutation.mutateAsync(postData);
      
      // Reset form state
      setCaption("");
      setSelectedMedia(null);
      setUploadProgress(0);
      setUploadError(null);
      setRetryCount(0);
      
      // Call the callback if provided (this will show the success toast)
      if (onPostCreated) {
        onPostCreated(result);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setUploadError(errorMessage);
      
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
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (user?.role !== "student") return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-6 shadow-sm">
      <div className="flex items-center space-x-3 mb-4">
        <AvatarWithFallback 
          src={user?.profilePicUrl}
          alt={user?.name || "Your profile"}
          size="lg"
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
          <ResponsiveMedia
            src={selectedMedia.url}
            type={selectedMedia.type as 'image' | 'video'}
            alt="Selected media"
            controls={selectedMedia.type === 'video'}
          />
          <button
            onClick={removeMedia}
            className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
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
                    onClick={retryUpload}
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
          disabled={!caption.trim() || createPostMutation.isPending || isUploading || !!uploadError}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
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
  );
}
