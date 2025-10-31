import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Upload, Play, X } from "lucide-react";
import type { PostWithDetails } from "@shared/schema";

interface XenWatchSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
}


export default function XenWatchSubmitModal({ isOpen, onClose }: XenWatchSubmitModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [selectedPost, setSelectedPost] = useState<PostWithDetails | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [promoCode, setPromoCode] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch user's video posts
  const { data: videoPosts, isLoading: postsLoading } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/posts/student", "videos"],
    queryFn: async () => {
      // This would need to be implemented in the backend to filter by mediaType=video
      const response = await apiRequest("GET", "/api/posts/student/me");
      if (!response.ok) throw new Error('Failed to fetch posts');
      const posts = await response.json();
      return posts.filter((post: PostWithDetails) => post.effectiveMediaType === 'video');
    },
    enabled: isOpen
  });

  // Video upload helper function
  const uploadVideo = async (file: File): Promise<{ videoUrl: string; thumbUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiRequest("POST", "/api/upload/video", formData);
    if (!response.ok) throw new Error('Failed to upload video');
    const data = await response.json();
    return { videoUrl: data.videoUrl, thumbUrl: data.thumbUrl };
  };

  // Create submission mutation
  const createSubmissionMutation = useMutation({
    mutationFn: async () => {
      let videoUrl: string;
      let thumbUrl: string | undefined;

      if (selectedPost) {
        // Use existing post
        videoUrl = selectedPost.effectiveMediaUrl;
        thumbUrl = selectedPost.thumbnailUrl;
      } else if (selectedFile) {
        // Upload new file
        const uploadResult = await uploadVideo(selectedFile);
        videoUrl = uploadResult.videoUrl;
        thumbUrl = uploadResult.thumbUrl;
      } else {
        throw new Error('No video selected');
      }

      const submissionData = {
        videoUrl,
        thumbUrl,
        notes: notes.trim() || undefined,
        promoCode: promoCode.trim() || undefined
      };

      const response = await apiRequest("POST", "/api/xen-watch/submissions", submissionData);
      if (!response.ok) throw new Error('Failed to create submission');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Submission Successful",
        description: "Your video has been submitted for review. You'll receive feedback once our scouts have reviewed it.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/submissions/me"] });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to create submission. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
        setSelectedPost(null); // Clear selected post when uploading new file
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select a video file.",
          variant: "destructive",
        });
      }
    }
  };

  const handlePostSelect = (post: PostWithDetails) => {
    setSelectedPost(post);
    setSelectedFile(null); // Clear uploaded file when selecting existing post
  };

  const handleSubmit = () => {
    if (!selectedPost && !selectedFile) {
      toast({
        title: "No Video Selected",
        description: "Please select an existing post or upload a new video.",
        variant: "destructive",
      });
      return;
    }

    createSubmissionMutation.mutate();
  };

  const handleClose = () => {
    setSelectedPost(null);
    setSelectedFile(null);
    setPromoCode('');
    setNotes('');
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Submit for XEN Watch Review</DialogTitle>
          <DialogDescription>
            Get your performance video reviewed by professional scouts for detailed feedback and development insights.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="space-y-6 p-1">
            {/* Video Selection */}
            <div className="space-y-4">
              <Label>Select Video</Label>
              
              {/* Existing Posts */}
              {videoPosts && videoPosts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Choose from your existing posts:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {videoPosts.map((post) => (
                      <div
                        key={post.id}
                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
                          selectedPost?.id === post.id 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' 
                            : 'border-border hover:border-blue-300'
                        }`}
                        onClick={() => handlePostSelect(post)}
                      >
                        <div className="aspect-video bg-muted flex items-center justify-center">
                          {post.effectiveMediaUrl ? (
                            <video
                              src={post.effectiveMediaUrl}
                              className="w-full h-full object-cover"
                              muted
                            />
                          ) : (
                            <Play className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-sm font-medium truncate">{post.caption || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">{post.effectiveMediaType}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload New Video */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Or upload a new video:</p>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {selectedFile ? selectedFile.name : 'Choose Video File'}
                  </Button>
                  {selectedFile && (
                    <div className="mt-3 flex items-center justify-center space-x-2">
                      <video
                        src={URL.createObjectURL(selectedFile)}
                        className="w-32 h-20 object-cover rounded"
                        muted
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Promo Code */}
            <div className="space-y-2">
              <Label>Promo Code (Optional)</Label>
              <Input
                name="promoCode"
                placeholder="Enter a promo code if you have one"
                maxLength={32}
                value={promoCode}
                onChange={e => setPromoCode(e.target.value.trimStart())}
              />
              <p className="text-xs text-muted-foreground">
                If you have a promo code, enter it here for special pricing or attribution.
              </p>
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label>Additional Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any specific areas you'd like the scouts to focus on..."
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createSubmissionMutation.isPending || (!selectedPost && !selectedFile)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {createSubmissionMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit for Review'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
