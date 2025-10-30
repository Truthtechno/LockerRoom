import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCropper } from "@/components/ui/image-cropper";
import { ArrowLeft, Camera, Save, Eye, EyeOff, Loader2 } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

export default function EditProfile() {
  const { user, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: user?.name || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Fetch school admin profile
  const { data: adminProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/school-admin/profile"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/school-admin/profile");
      return response.json();
    },
    enabled: !!user?.id && user?.role === "school_admin",
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; profilePicUrl?: string }) => {
      const response = await apiRequest("PUT", "/api/school-admin/profile", data);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Profile update failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Update user context with new data
      if (user) {
        updateUser({ 
          ...user, 
          name: data.name || user.name, 
          profilePicUrl: data.profilePicUrl || user.profilePicUrl 
        });
      }
      
      // Invalidate all relevant queries to refresh data across the app
      queryClient.invalidateQueries({ queryKey: ["/api/school-admin/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "top-performers"] });
      
      // Only show toast for non-profile-picture updates (profile picture updates show their own toast)
      if (!data.profilePicUrl) {
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update profile.",
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("PUT", "/api/school-admin/change-password", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully.",
      });
      setFormData(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to change password.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    try {
      setIsUploading(true);
      
      // Convert Blob to File for uploadToCloudinary
      const file = new File([croppedImageBlob], 'profile-pic.jpg', { type: 'image/jpeg' });
      
      // Upload to Cloudinary
      const { secure_url } = await uploadToCloudinary(file, "profilePic");
      
      // Update profile with new image
      await updateProfileMutation.mutateAsync({ profilePicUrl: secure_url });
      
      // Show success toast
      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been updated successfully.",
      });
      
    } catch (error: any) {
      console.error('Profile picture upload failed:', error);
      toast({
        title: "Upload failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setShowCropper(false);
      setSelectedImage(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation error",
        description: "Name is required.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      await updateProfileMutation.mutateAsync({ name: formData.name.trim() });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      toast({
        title: "Validation error",
        description: "All password fields are required.",
        variant: "destructive",
      });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Validation error",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (formData.newPassword.length < 8) {
      toast({
        title: "Validation error",
        description: "New password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    await changePasswordMutation.mutateAsync({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword,
    });
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        {/* Header */}
        <div className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLocation("/school-admin")}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Edit Profile</h1>
                  <p className="text-sm text-muted-foreground">Manage your school admin profile</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Picture */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>Update your profile picture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage 
                    src={user?.profilePicUrl || undefined} 
                    alt={user?.name || "Admin"} 
                  />
                  <AvatarFallback className="text-2xl">
                    {user?.name?.charAt(0) || "A"}
                  </AvatarFallback>
                </Avatar>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isUploading || updateProfileMutation.isPending}
                  className="hidden"
                />
                
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  disabled={isUploading || updateProfileMutation.isPending}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 mr-2" />
                  )}
                  {isUploading ? "Uploading..." : "Change Picture"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Profile Information */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your display name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-sm text-muted-foreground">
                  Email cannot be changed. Contact system admin if needed.
                </p>
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={isUpdating || !formData.name.trim()}
                className="w-full"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPassword ? "text" : "password"}
                      value={formData.currentPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={formData.newPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Enter new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={changePasswordMutation.isPending || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
                variant="outline"
                className="w-full"
              >
                {changePasswordMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Image Cropper Modal */}
      {showCropper && selectedImage && (
        <ImageCropper
          isOpen={showCropper}
          onClose={() => {
            setShowCropper(false);
            setSelectedImage(null);
          }}
          onCropComplete={handleCropComplete}
          imageSrc={selectedImage}
        />
      )}
      </div>
    </div>
  );
}
