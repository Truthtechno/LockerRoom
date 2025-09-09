import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import StatsCard from "@/components/stats/stats-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Heart, Eye, MessageCircle, Bookmark, Edit3, Share, Camera, Save, Copy, ExternalLink } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { StudentWithStats, PostWithDetails } from "@shared/schema";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit profile state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    bio: "",
    phone: "",
    position: "",
    roleNumber: "",
    sport: ""
  });
  const [selectedProfilePic, setSelectedProfilePic] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);

  // Auto-create student profile if not found
  const createStudentProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not found");
      
      const profileData = {
        userId: user.id,
        schoolId: user.schoolId || "",
        name: user.name,
        email: user.email,
        phone: "",
        sport: "Soccer",
        position: "Player",
        roleNumber: "0",
        bio: `Hello! I'm ${user.name}, a student athlete at XEN Sports Academy.`
      };

      const response = await apiRequest("/api/students", "POST", profileData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students/profile"] });
      toast({
        title: "Profile Created",
        description: "Your student profile has been created successfully!",
      });
    }
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/students/profile/${user?.id}`, {
        method: "PUT",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to update profile");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students/profile"] });
      setShowEditDialog(false);
      setSelectedProfilePic(null);
      setProfilePicPreview(null);
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleEditProfile = () => {
    if (studentProfile) {
      setEditFormData({
        name: studentProfile.name || "",
        bio: studentProfile.bio || "",
        phone: studentProfile.phone || "",
        position: studentProfile.position || "",
        roleNumber: studentProfile.roleNumber || "",
        sport: studentProfile.sport || ""
      });
      setShowEditDialog(true);
    }
  };

  const handleShareProfile = () => {
    setShowShareDialog(true);
  };

  const handleProfilePicChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }

      setSelectedProfilePic(file);
      const reader = new FileReader();
      reader.onload = () => setProfilePicPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    const formData = new FormData();
    
    // Add profile data
    Object.entries(editFormData).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    // Add profile picture if selected
    if (selectedProfilePic) {
      formData.append("profilePic", selectedProfilePic);
    }

    updateProfileMutation.mutate(formData);
  };

  const copyProfileLink = () => {
    const profileUrl = `${window.location.origin}/profile/${studentProfile?.id}`;
    navigator.clipboard.writeText(profileUrl);
    toast({
      title: "Link Copied",
      description: "Profile link copied to clipboard!",
    });
  };

  const shareProfileNative = async () => {
    if (navigator.share && studentProfile) {
      try {
        await navigator.share({
          title: `${studentProfile.name}'s Profile`,
          text: `Check out ${studentProfile.name}'s sports profile on LockerRoom!`,
          url: `${window.location.origin}/profile/${studentProfile.id}`,
        });
      } catch (error) {
        // If native sharing fails, fall back to copy link
        copyProfileLink();
      }
    } else {
      copyProfileLink();
    }
  };
  
  const { data: studentProfile, isLoading: profileLoading } = useQuery<StudentWithStats>({
    queryKey: ["/api/students/profile", user?.id],
    enabled: !!user?.id,
  });

  const { data: userPosts, isLoading: postsLoading } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/posts/student", studentProfile?.id],
    enabled: !!studentProfile?.id,
  });

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Auto-create student profile if not found
  if (!studentProfile && !profileLoading && user?.role === "student") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Welcome to LockerRoom!</h2>
          <p className="text-muted-foreground mb-6">
            Let's create your student athlete profile to get started.
          </p>
          <Button 
            onClick={() => createStudentProfile.mutate()}
            disabled={createStudentProfile.isPending}
            className="bg-accent hover:bg-accent/90"
          >
            {createStudentProfile.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Profile...
              </>
            ) : (
              "Create My Profile"
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (!studentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-destructive">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-8">
          {/* Cover Photo */}
          <div
            className="h-48 bg-gradient-to-r from-primary via-secondary to-primary relative"
            style={{
              backgroundImage: `url('${studentProfile.coverPhoto}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="absolute inset-0 bg-black/30"></div>
          </div>

          {/* Profile Info */}
          <div className="relative px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:space-x-6 -mt-16">
              {/* Profile Picture */}
              <img
                className="w-32 h-32 rounded-full border-4 border-card shadow-lg mx-auto sm:mx-0"
                src={studentProfile.profilePicUrl || studentProfile.profilePic || "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400"}
                alt={`${studentProfile.user.name} profile`}
              />
              
              <div className="flex-1 text-center sm:text-left mt-4 sm:mt-0">
                <h1 className="text-3xl font-bold text-foreground">{studentProfile.user.name}</h1>
                <p className="text-lg text-muted-foreground">
                  {studentProfile.sport} • #{studentProfile.roleNumber} • {studentProfile.position}
                </p>
                <p className="text-muted-foreground mt-2">
                  {studentProfile.school?.name} • Class of 2025
                </p>
                
                <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{studentProfile.postsCount}</div>
                    <div className="text-sm text-muted-foreground">Posts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{studentProfile.totalLikes}</div>
                    <div className="text-sm text-muted-foreground">Likes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{studentProfile.totalViews}</div>
                    <div className="text-sm text-muted-foreground">Views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{studentProfile.totalSaves}</div>
                    <div className="text-sm text-muted-foreground">Saves</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:items-end space-y-3 mt-4 sm:mt-0">
                <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={handleEditProfile}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                      data-testid="button-edit-profile"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </DialogTrigger>
                </Dialog>
                
                <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={handleShareProfile}
                      variant="secondary"
                      data-testid="button-share-profile"
                    >
                      <Share className="w-4 h-4 mr-2" />
                      Share Profile
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            </div>
            
            {/* Bio */}
            <div className="mt-6">
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {studentProfile.bio}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Likes"
            value={studentProfile.totalLikes.toLocaleString()}
            trend="+12% this month"
            icon={Heart}
            iconColor="text-accent"
          />
          <StatsCard
            title="Total Views"
            value={studentProfile.totalViews.toLocaleString()}
            trend="+8% this month"
            icon={Eye}
            iconColor="text-primary"
          />
          <StatsCard
            title="Comments"
            value={studentProfile.totalComments}
            trend="+15% this month"
            icon={MessageCircle}
            iconColor="text-secondary"
          />
          <StatsCard
            title="Saves"
            value={studentProfile.totalSaves}
            trend="+5% this month"
            icon={Bookmark}
            iconColor="text-accent"
          />
        </div>

        {/* Posts Grid */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Posts</h2>
          </div>
          
          {postsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : userPosts && userPosts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {userPosts.map((post) => (
                <div key={post.id} className="aspect-square relative group cursor-pointer">
                  <img
                    src={post.mediaUrl}
                    alt="Post"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200">
                    <div className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center space-x-6 text-white transition-opacity duration-200">
                      <div className="flex items-center space-x-1">
                        <Heart className="w-5 h-5 fill-current" />
                        <span>{post.likesCount}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="w-5 h-5 fill-current" />
                        <span>{post.commentsCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No posts yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information and photo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Profile Picture Section */}
            <div className="flex items-center space-x-4">
              <img
                className="w-20 h-20 rounded-full border-4 border-border"
                src={profilePicPreview || studentProfile.profilePicUrl || studentProfile.profilePic || "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400"}
                alt="Profile preview"
              />
              <div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="mb-2"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Change Photo
                </Button>
                <p className="text-sm text-muted-foreground">
                  JPG, PNG or GIF (max 5MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePicChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-sport">Sport</Label>
                <Select 
                  value={editFormData.sport} 
                  onValueChange={(value) => setEditFormData({ ...editFormData, sport: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Soccer">Soccer</SelectItem>
                    <SelectItem value="Basketball">Basketball</SelectItem>
                    <SelectItem value="Tennis">Tennis</SelectItem>
                    <SelectItem value="Swimming">Swimming</SelectItem>
                    <SelectItem value="Track & Field">Track & Field</SelectItem>
                    <SelectItem value="Baseball">Baseball</SelectItem>
                    <SelectItem value="Volleyball">Volleyball</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-position">Position</Label>
                <Select 
                  value={editFormData.position} 
                  onValueChange={(value) => setEditFormData({ ...editFormData, position: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Goalkeeper">Goalkeeper</SelectItem>
                    <SelectItem value="Defender">Defender</SelectItem>
                    <SelectItem value="Midfielder">Midfielder</SelectItem>
                    <SelectItem value="Attacking Midfielder">Attacking Midfielder</SelectItem>
                    <SelectItem value="Forward">Forward</SelectItem>
                    <SelectItem value="Striker">Striker</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="edit-jersey">Jersey Number</Label>
                <Input
                  id="edit-jersey"
                  value={editFormData.roleNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, roleNumber: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea
                id="edit-bio"
                value={editFormData.bio}
                onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
                placeholder="Tell everyone about yourself, your achievements, and goals..."
                rows={4}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={updateProfileMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                className="bg-accent hover:bg-accent/90"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Profile Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Profile</DialogTitle>
            <DialogDescription>
              Share {studentProfile.name}'s profile with others
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-muted rounded-lg">
              <img
                className="w-12 h-12 rounded-full"
                src={studentProfile.profilePicUrl || studentProfile.profilePic || "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400"}
                alt={studentProfile.name}
              />
              <div>
                <h4 className="font-medium">{studentProfile.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {studentProfile.sport} • #{studentProfile.roleNumber}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={shareProfileNative}
                className="w-full justify-start"
                variant="outline"
              >
                <Share className="w-4 h-4 mr-3" />
                Share via Device
              </Button>

              <Button
                onClick={copyProfileLink}
                className="w-full justify-start"
                variant="outline"
              >
                <Copy className="w-4 h-4 mr-3" />
                Copy Profile Link
              </Button>

              <Button
                onClick={() => {
                  window.open(`https://twitter.com/intent/tweet?text=Check out ${studentProfile.name}'s sports profile on LockerRoom!&url=${window.location.origin}/profile/${studentProfile.id}`, '_blank');
                }}
                className="w-full justify-start"
                variant="outline"
              >
                <ExternalLink className="w-4 h-4 mr-3" />
                Share on Twitter
              </Button>

              <Button
                onClick={() => {
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${window.location.origin}/profile/${studentProfile.id}`, '_blank');
                }}
                className="w-full justify-start"
                variant="outline"
              >
                <ExternalLink className="w-4 h-4 mr-3" />
                Share on Facebook
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
