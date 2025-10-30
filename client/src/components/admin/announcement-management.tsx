import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { timeAgo } from "@/lib/timeAgo";
import { Loader2, Megaphone, Edit, Trash2, MoreHorizontal, Eye, Calendar, Users, Globe, Building, Upload, X, Image, Video, FileImage, FileVideo } from "lucide-react";
import type { PostWithDetails } from "@shared/schema";

interface AnnouncementManagementProps {
  userRole: 'system_admin' | 'school_admin';
  schoolId?: string;
}

export function AnnouncementManagement({ userRole, schoolId }: AnnouncementManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingAnnouncement, setEditingAnnouncement] = useState<PostWithDetails | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [editUploadedFiles, setEditUploadedFiles] = useState<{
    image?: { url: string; publicId: string; name: string };
    video?: { url: string; publicId: string; name: string; thumbnailUrl?: string };
  }>({});
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const editVideoInputRef = useRef<HTMLInputElement>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    content: '',
    imageUrl: '',
    videoUrl: '',
    scope: userRole === 'system_admin' ? 'global' : 'school'
  });

  // Fetch announcements
  const { data: announcementsData, isLoading, error } = useQuery({
    queryKey: [
      userRole === 'school_admin' 
        ? "/api/school-admin/announcements" 
        : "/api/system-admin/announcements"
    ],
    queryFn: async () => {
      try {
        // Use the correct endpoint path (dash, not underscore)
        const endpoint = userRole === 'school_admin' 
          ? "/api/school-admin/announcements" 
          : "/api/system-admin/announcements";
        
        console.log(`🔍 Fetching announcements for role: ${userRole} from ${endpoint}`);
        // apiRequest already checks if response is ok, so if we get here, it's successful
        const response = await apiRequest("GET", endpoint);
        const data = await response.json();
        console.log('✅ Announcements API response:', data);
        console.log(`✅ Found ${data?.announcements?.length || 0} announcements`);
        
        // Ensure we return the expected structure
        if (data && typeof data === 'object' && 'announcements' in data) {
          return data;
        } else if (Array.isArray(data)) {
          // Handle case where response is directly an array
          return { announcements: data, success: true };
        } else {
          console.warn('⚠️ Unexpected response format:', data);
          return { announcements: [], success: true };
        }
      } catch (err: any) {
        console.error('❌ Error fetching announcements:', err);
        console.error('Error details:', {
          message: err?.message,
          status: err?.status,
          stack: err?.stack
        });
        // apiRequest already throws an error with the message, so just rethrow
        throw err;
      }
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    retry: 2,
  });

  // Update announcement mutation
  const updateAnnouncementMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/announcements/${editingAnnouncement?.id}`, data);
      if (!response.ok) throw new Error('Failed to update announcement');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Announcement Updated",
        description: "Your announcement has been updated successfully.",
      });
      const announcementsKey = userRole === 'school_admin' 
        ? "/api/school-admin/announcements" 
        : "/api/system-admin/announcements";
      queryClient.invalidateQueries({ queryKey: [announcementsKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/admin-feed"] });
      setIsEditModalOpen(false);
      setEditingAnnouncement(null);
      setEditUploadedFiles({});
      // Reset form data
      setEditFormData({
        title: '',
        content: '',
        imageUrl: '',
        videoUrl: '',
        scope: userRole === 'system_admin' ? 'global' : 'school'
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update announcement. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete announcement mutation
  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      const response = await apiRequest("DELETE", `/api/announcements/${announcementId}`);
      if (!response.ok) throw new Error('Failed to delete announcement');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Announcement Deleted",
        description: "The announcement has been deleted successfully.",
      });
      const announcementsKey = userRole === 'school_admin' 
        ? "/api/school-admin/announcements" 
        : "/api/system-admin/announcements";
      queryClient.invalidateQueries({ queryKey: [announcementsKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/admin-feed"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete announcement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (announcement: PostWithDetails) => {
    setEditingAnnouncement(announcement);
    const hasImage = announcement.mediaType === 'image' && announcement.mediaUrl;
    const hasVideo = announcement.mediaType === 'video' && announcement.mediaUrl;
    
    setEditFormData({
      title: announcement.title || '',
      content: announcement.caption || '',
      imageUrl: hasImage ? announcement.mediaUrl : '',
      videoUrl: hasVideo ? announcement.mediaUrl : '',
      scope: announcement.scope || 'global'
    });
    
    // Set uploaded files state for preview
    setEditUploadedFiles({
      ...(hasImage && { image: { url: announcement.mediaUrl, publicId: '', name: 'Current image' } }),
      ...(hasVideo && { video: { url: announcement.mediaUrl, publicId: '', name: 'Current video', thumbnailUrl: announcement.thumbnailUrl } })
    });
    
    setIsEditModalOpen(true);
  };
  
  const handleEditFileUpload = async (file: File) => {
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

    setEditUploading(true);
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
      
      setEditUploadedFiles(prev => ({
        ...prev,
        [fileType]: {
          url: result.file.url,
          publicId: result.file.publicId,
          name: result.file.originalName,
          thumbnailUrl: result.file.thumbnailUrl
        }
      }));
      
      // Update form data with new URL and clear the other media type
      if (fileType === 'image') {
        setEditFormData(prev => ({ ...prev, imageUrl: result.file.url, videoUrl: '' }));
        setEditUploadedFiles(prev => {
          const updated = { ...prev };
          delete updated.video;
          return updated;
        });
      } else {
        setEditFormData(prev => ({ ...prev, videoUrl: result.file.url, imageUrl: '' }));
        setEditUploadedFiles(prev => {
          const updated = { ...prev };
          delete updated.image;
          return updated;
        });
      }

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
      setEditUploading(false);
    }
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      handleEditFileUpload(file);
    }
    // Reset input value
    e.target.value = '';
  };

  const removeEditUploadedFile = (type: 'image' | 'video') => {
    setEditUploadedFiles(prev => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });
    
    // Clear form data for this type
    if (type === 'image') {
      setEditFormData(prev => ({ ...prev, imageUrl: '' }));
    } else {
      setEditFormData(prev => ({ ...prev, videoUrl: '' }));
    }
  };

  const handleDelete = (announcement: PostWithDetails) => {
    if (window.confirm(`Are you sure you want to delete "${announcement.title}"? This action cannot be undone.`)) {
      deleteAnnouncementMutation.mutate(announcement.id);
    }
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.title.trim() || !editFormData.content.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both title and content for the announcement.",
        variant: "destructive",
      });
      return;
    }

    // Use uploaded files if available, otherwise use URL inputs
    const imageUrl = editUploadedFiles.image?.url || editFormData.imageUrl || '';
    const videoUrl = editUploadedFiles.video?.url || editFormData.videoUrl || '';
    
    updateAnnouncementMutation.mutate({
      title: editFormData.title,
      content: editFormData.content,
      imageUrl: imageUrl,
      videoUrl: videoUrl,
      scope: editFormData.scope
    });
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'global': return <Globe className="w-4 h-4" />;
      case 'school': return <Building className="w-4 h-4" />;
      case 'staff': return <Users className="w-4 h-4" />;
      default: return <Megaphone className="w-4 h-4" />;
    }
  };

  const getScopeLabel = (scope: string) => {
    switch (scope) {
      case 'global': return 'Global';
      case 'school': return 'School';
      case 'staff': return 'Staff Only';
      default: return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading announcements...</span>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load announcements';
    return (
      <div className="text-center p-8">
        <p className="text-destructive mb-4">Failed to load announcements. Please try again.</p>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="mt-4"
        >
          Reload Page
        </Button>
      </div>
    );
  }

  const announcements = announcementsData?.announcements || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Manage Announcements</h2>
          <p className="text-muted-foreground">
            View, edit, and delete your announcements
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="text-center p-8">
            <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Announcements Yet</h3>
            <p className="text-muted-foreground">
              You haven't created any announcements yet. Create your first announcement to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {announcements.map((announcement: PostWithDetails) => (
            <Card key={announcement.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Megaphone className="w-5 h-5 text-accent" />
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getScopeIcon(announcement.scope || 'global')}
                        {getScopeLabel(announcement.scope || 'global')}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{announcement.title}</CardTitle>
                    <CardDescription className="mt-2">
                      {announcement.caption}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(announcement)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(announcement)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {timeAgo(announcement.createdAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {announcement.viewCount} views
                    </div>
                  </div>
                  {announcement.mediaUrl && (
                    <Badge variant="secondary">
                      {announcement.mediaType === 'video' ? 'Video' : 'Image'}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Announcement Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center">
              <Edit className="w-5 h-5 mr-2 text-accent" />
              Edit Announcement
            </DialogTitle>
            <DialogDescription>
              Update your announcement details below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 pr-2">
            <form onSubmit={handleUpdateSubmit} id="edit-announcement-form" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={editFormData.title}
                onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter announcement title..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-content">Content *</Label>
              <Textarea
                id="edit-content"
                value={editFormData.content}
                onChange={(e) => setEditFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter announcement content..."
                rows={4}
                required
              />
            </div>

            {userRole === 'system_admin' && (
              <div className="space-y-2">
                <Label htmlFor="edit-scope">Announcement Scope</Label>
                <Select 
                  value={editFormData.scope} 
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, scope: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">All Schools</SelectItem>
                    <SelectItem value="school">Specific School</SelectItem>
                    <SelectItem value="staff">XEN Staff Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Media Upload Section */}
            <div className="space-y-4">
              {/* Image Preview/Upload */}
              <div className="space-y-2">
                <Label>Image (Optional)</Label>
                {editUploadedFiles.image || editFormData.imageUrl ? (
                  <div className="relative border border-border rounded-lg overflow-hidden">
                    <img
                      src={editUploadedFiles.image?.url || editFormData.imageUrl}
                      alt="Announcement"
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <input
                        ref={editImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleEditFileChange(e, 'image')}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => editImageInputRef.current?.click()}
                        disabled={editUploading}
                        title="Replace image"
                      >
                        {editUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeEditUploadedFile('image')}
                        title="Delete image"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="p-2 bg-background/80">
                      <p className="text-xs text-muted-foreground truncate">
                        {editUploadedFiles.image?.name || 'Current image'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <Image className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                    <input
                      ref={editImageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleEditFileChange(e, 'image')}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => editImageInputRef.current?.click()}
                      disabled={editUploading}
                    >
                      {editUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
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

              {/* Video Preview/Upload */}
              <div className="space-y-2">
                <Label>Video (Optional)</Label>
                {editUploadedFiles.video || editFormData.videoUrl ? (
                  <div className="relative border border-border rounded-lg overflow-hidden">
                    {editUploadedFiles.video?.thumbnailUrl || editUploadedFiles.video?.url ? (
                      <div className="relative">
                        <img
                          src={editUploadedFiles.video?.thumbnailUrl || editFormData.videoUrl}
                          alt="Video thumbnail"
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Video className="w-16 h-16 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center">
                        <Video className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-2">
                      <input
                        ref={editVideoInputRef}
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleEditFileChange(e, 'video')}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => editVideoInputRef.current?.click()}
                        disabled={editUploading}
                        title="Replace video"
                      >
                        {editUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeEditUploadedFile('video')}
                        title="Delete video"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="p-2 bg-background/80">
                      <p className="text-xs text-muted-foreground truncate">
                        {editUploadedFiles.video?.name || 'Current video'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <Video className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                    <input
                      ref={editVideoInputRef}
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleEditFileChange(e, 'video')}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => editVideoInputRef.current?.click()}
                      disabled={editUploading}
                    >
                      {editUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
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
            </div>
            </form>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={updateAnnouncementMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="edit-announcement-form"
              disabled={updateAnnouncementMutation.isPending}
              className="bg-accent hover:bg-accent/90"
            >
              {updateAnnouncementMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Update Announcement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
