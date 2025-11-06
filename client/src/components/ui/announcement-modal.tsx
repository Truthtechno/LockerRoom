import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2, Megaphone, Upload, X, Image, Video, FileImage, FileVideo } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

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
    scope: userRole === 'system_admin' ? 'all' : 'school',
    selectedSchoolIds: [] as string[]
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

  // Fetch schools list for system admin
  const { data: schoolsData } = useQuery({
    queryKey: ["/api/system-admin/schools"],
    queryFn: async () => {
      if (userRole !== 'system_admin') return null;
      const response = await apiRequest("GET", "/api/system-admin/schools");
      const data = await response.json();
      return data;
    },
    enabled: userRole === 'system_admin' && open,
  });

  const schools = schoolsData?.schools || [];

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

    // Validate school selection if scope is 'school'
    if (userRole === 'system_admin' && formData.scope === 'school' && formData.selectedSchoolIds.length === 0) {
      toast({
        title: "Missing Academy Selection",
        description: "Please select at least one academy for the announcement.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const endpoint = userRole === 'system_admin' 
        ? '/api/system/announcements' 
        : `/api/schools/${schoolId}/announcements`;
      
      // Map 'all' to 'global' for backend compatibility
      const scopeValue = formData.scope === 'all' ? 'global' : formData.scope;
      
      const payload: any = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        imageUrl: uploadedFiles.image ? uploadedFiles.image.url : formData.imageUrl || '',
        videoUrl: uploadedFiles.video ? uploadedFiles.video.url : formData.videoUrl || '',
        scope: scopeValue,
      };

      // For system admin with specific school scope, send selected school IDs
      if (userRole === 'system_admin' && formData.scope === 'school') {
        if (formData.selectedSchoolIds.length === 0) {
          toast({
            title: "Missing School Selection",
            description: "Please select at least one school for the announcement.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        payload.targetSchoolIds = formData.selectedSchoolIds;
      } else if (userRole === 'school_admin') {
        payload.schoolId = schoolId;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const ct = response.headers.get('content-type') || '';
        let errorMessage = 'Failed to create announcement';
        if (ct.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error?.message || error.message || errorMessage;
        } else {
          const text = await response.text();
          errorMessage = text.slice(0, 200) || errorMessage;
        }
        throw new Error(errorMessage);
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
        scope: userRole === 'system_admin' ? 'all' : 'school',
        selectedSchoolIds: []
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
    // Clear school selection if scope changes away from 'school'
    if (field === 'scope' && value !== 'school') {
      setFormData(prev => ({ ...prev, selectedSchoolIds: [] }));
    }
  };

  const handleSchoolToggle = (schoolId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSchoolIds: prev.selectedSchoolIds.includes(schoolId)
        ? prev.selectedSchoolIds.filter(id => id !== schoolId)
        : [...prev.selectedSchoolIds, schoolId]
    }));
  };

  const handleSelectAllSchools = () => {
    if (formData.selectedSchoolIds.length === schools.length) {
      setFormData(prev => ({ ...prev, selectedSchoolIds: [] }));
    } else {
      setFormData(prev => ({ ...prev, selectedSchoolIds: schools.map((s: any) => s.id) }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center">
            <Megaphone className="w-5 h-5 mr-2 text-accent" />
            Create Announcement
          </DialogTitle>
          <DialogDescription>
            {userRole === 'system_admin' 
              ? 'Create an announcement that can be sent to all academies or specific academies.'
              : 'Create an announcement for players in your academy.'
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
              className="w-full"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              {formData.title.length}/200 characters
            </p>
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
              className="w-full resize-y min-h-[100px]"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">
              {formData.content.length}/2000 characters
            </p>
          </div>

          {userRole === 'system_admin' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="scope">Announcement Scope *</Label>
                <Select value={formData.scope} onValueChange={(value) => handleInputChange('scope', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Academies</SelectItem>
                    <SelectItem value="school">Specific Academies</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.scope === 'school' && (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Label className="text-sm font-medium">Select Academies *</Label>
                    {schools.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllSchools}
                        className="h-auto py-1 text-xs self-start sm:self-auto"
                      >
                        {formData.selectedSchoolIds.length === schools.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>
                  <div className="border rounded-lg p-3 sm:p-4 max-h-48 sm:max-h-64 overflow-y-auto space-y-2 bg-background">
                    {schools.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                        <p>Loading academies...</p>
                      </div>
                    ) : (
                      schools.map((school: any) => (
                        <div key={school.id} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`school-${school.id}`}
                            checked={formData.selectedSchoolIds.includes(school.id)}
                            onCheckedChange={() => handleSchoolToggle(school.id)}
                            className="flex-shrink-0"
                          />
                          <Label
                            htmlFor={`school-${school.id}`}
                            className="flex-1 font-normal cursor-pointer text-sm break-words"
                          >
                            {school.name}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  {formData.selectedSchoolIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formData.selectedSchoolIds.length} academ{formData.selectedSchoolIds.length !== 1 ? 'ies' : 'y'} selected
                    </p>
                  )}
                  {formData.selectedSchoolIds.length === 0 && formData.scope === 'school' && (
                    <p className="text-xs text-destructive">
                      Please select at least one academy
                    </p>
                  )}
                </div>
              )}
            </>
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
                    className="w-full sm:w-auto"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <span className="hidden sm:inline">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Image
                      </>
                    )}
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
                    className="w-full sm:w-auto"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <span className="hidden sm:inline">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Video
                      </>
                    )}
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
                  className="w-full"
                />
                <Input
                  value={formData.videoUrl}
                  onChange={(e) => handleInputChange('videoUrl', e.target.value)}
                  placeholder="Video URL (optional)"
                  type="url"
                  className="w-full"
                />
              </div>
            </div>
          </div>
          </form>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4 flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="create-announcement-form" 
            disabled={loading || uploading} 
            className="bg-accent hover:bg-accent/90 w-full sm:w-auto order-1 sm:order-2"
          >
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
