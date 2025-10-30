import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Upload, X, Image, Video, FileImage, FileVideo } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface AnnouncementModalProps {
  children: React.ReactNode;
  userRole: 'system_admin' | 'school_admin';
  schoolId?: string;
}

export function AnnouncementModal({ children, userRole, schoolId }: AnnouncementModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    imageUrl: '',
    videoUrl: '',
    scope: userRole === 'system_admin' ? 'all' : 'school'
  });
  const [uploadedFiles, setUploadedFiles] = useState<{
    image?: { url: string; publicId: string; name: string };
    video?: { url: string; publicId: string; name: string; thumbnailUrl?: string };
  }>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mov', 'video/avi', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Only images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, AVI) are allowed.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast({
        title: "File Too Large",
        description: "File size must be less than 50MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/announcement', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to upload file');
        } else {
          const text = await response.text();
          throw new Error(`Upload failed: ${response.status} ${text.slice(0, 200)}`);
        }
      }

      const ct = response.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Unexpected response: ${response.status} ${text.slice(0, 200)}`);
      }
      const result = await response.json();
      const fileType = file.type.startsWith('video/') ? 'video' : 'image';
      
      setUploadedFiles(prev => ({
        ...prev,
        [fileType]: {
          url: result.file.url,
          publicId: result.file.publicId,
          name: result.file.originalName,
          thumbnailUrl: result.file.thumbnailUrl
        }
      }));

      toast({
        title: "File Uploaded",
        description: `${fileType === 'video' ? 'Video' : 'Image'} uploaded successfully!`,
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input value
    e.target.value = '';
  };

  const removeUploadedFile = (type: 'image' | 'video') => {
    setUploadedFiles(prev => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both title and content for the announcement.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const endpoint = userRole === 'system_admin' 
        ? '/api/system/announcements' 
        : `/api/schools/${schoolId}/announcements`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          imageUrl: uploadedFiles.image ? uploadedFiles.image.url : formData.imageUrl || '',
          videoUrl: uploadedFiles.video ? uploadedFiles.video.url : formData.videoUrl || '',
          scope: formData.scope,
          schoolId: userRole === 'school_admin' ? schoolId : undefined
        })
      });

      if (!response.ok) {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to create announcement');
        } else {
          const text = await response.text();
          throw new Error(`Failed to create announcement: ${response.status} ${text.slice(0, 200)}`);
        }
      }

      const ct = response.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Unexpected response: ${response.status} ${text.slice(0, 200)}`);
      }
      const result = await response.json();
      
      toast({
        title: "Announcement Created",
        description: "Your announcement has been posted successfully!",
      });

      // Invalidate posts queries to refresh feeds
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/admin-feed"] });
      
      // CRITICAL: Invalidate announcements queries to refresh the management page
      queryClient.invalidateQueries({ queryKey: ["/api/school-admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system_admin/announcements"] });
      
      // Invalidate school-specific queries if school admin
      if (userRole === 'school_admin' && schoolId) {
        queryClient.invalidateQueries({ queryKey: ["/api/schools", schoolId, "stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/schools", schoolId, "recent-activity"] });
      }

      // Reset form and close modal
      setFormData({
        title: '',
        content: '',
        imageUrl: '',
        videoUrl: '',
        scope: userRole === 'system_admin' ? 'all' : 'school'
      });
      setUploadedFiles({});
      setOpen(false);
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create announcement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center">
            <Megaphone className="w-5 h-5 mr-2 text-accent" />
            Create Announcement
          </DialogTitle>
          <DialogDescription>
            {userRole === 'system_admin' 
              ? 'Create an announcement that can be sent to all schools, a specific school, or XEN staff only.'
              : 'Create an announcement for students in your school.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          <form onSubmit={handleSubmit} id="create-announcement-form" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter announcement title..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="Enter announcement content..."
              rows={4}
              required
            />
          </div>

          {userRole === 'system_admin' && (
            <div className="space-y-2">
              <Label htmlFor="scope">Announcement Scope</Label>
              <Select value={formData.scope} onValueChange={(value) => handleInputChange('scope', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  <SelectItem value="school">Specific School</SelectItem>
                  <SelectItem value="staff">XEN Staff Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* File Upload Section */}
          <div className="space-y-4">
            <Label>Media Upload (Optional)</Label>
            
            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="imageUpload" className="text-sm font-medium">
                Image Upload
              </Label>
              {uploadedFiles.image ? (
                <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                  <FileImage className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {uploadedFiles.image.name}
                    </p>
                    <p className="text-xs text-muted-foreground">Image uploaded</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUploadedFile('image')}
                    className="w-6 h-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="imageUpload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload Image
                  </Button>
                </div>
              )}
            </div>

            {/* Video Upload */}
            <div className="space-y-2">
              <Label htmlFor="videoUpload" className="text-sm font-medium">
                Video Upload
              </Label>
              {uploadedFiles.video ? (
                <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                  <FileVideo className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {uploadedFiles.video.name}
                    </p>
                    <p className="text-xs text-muted-foreground">Video uploaded</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUploadedFile('video')}
                    className="w-6 h-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="videoUpload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload Video
                  </Button>
                </div>
              )}
            </div>

            {/* Fallback URL inputs for manual entry */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">
                Or paste URLs manually:
              </p>
              <div className="space-y-2">
                <Input
                  value={formData.imageUrl}
                  onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                  placeholder="Image URL (optional)"
                  type="url"
                />
                <Input
                  value={formData.videoUrl}
                  onChange={(e) => handleInputChange('videoUrl', e.target.value)}
                  placeholder="Video URL (optional)"
                  type="url"
                />
              </div>
            </div>
          </div>
          </form>
        </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" form="create-announcement-form" disabled={loading || uploading} className="bg-accent hover:bg-accent/90">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Megaphone className="w-4 h-4 mr-2" />
                  Create Announcement
                </>
              )}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
