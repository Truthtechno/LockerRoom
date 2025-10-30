import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Upload, User, Lock, X } from "lucide-react";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";

interface EditProfileModalProps {
  children: React.ReactNode;
}

export function EditProfileModal({ children }: EditProfileModalProps) {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    profilePic: null as File | null,
  });
  
  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; profilePic?: File }) => {
      const formData = new FormData();
      
      if (data.name !== undefined) {
        formData.append('name', data.name);
      }
      
      if (data.profilePic) {
        formData.append('profilePic', data.profilePic);
      }

      const response = await fetch(`/api/system-admin/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      
      // Update user context with new data
      updateUser({
        ...user,
        name: data.profile?.name || user?.name,
        profilePicUrl: data.profile?.profilePicUrl || user?.profilePicUrl,
      });
      
      // Invalidate user queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      
      setOpen(false);
      setProfileData({ name: user?.name || '', profilePic: null });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await fetch(`/api/users/${user?.id}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to change password');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setActiveTab('profile');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const handleProfileSubmit = () => {
    if (!profileData.name.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    updateProfileMutation.mutate({
      name: profileData.name.trim(),
      profilePic: profileData.profilePic || undefined,
    });
  };

  const handlePasswordSubmit = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileData(prev => ({ ...prev, profilePic: file }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-muted p-1 rounded-lg">
            <Button
              variant={activeTab === 'profile' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('profile')}
              className="flex-1"
            >
              <User className="w-4 h-4 mr-2" />
              Profile
            </Button>
            <Button
              variant={activeTab === 'password' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('password')}
              className="flex-1"
            >
              <Lock className="w-4 h-4 mr-2" />
              Password
            </Button>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <AvatarWithFallback
                    src={profileData.profilePic ? URL.createObjectURL(profileData.profilePic) : user?.profilePicUrl}
                    alt={user?.name || 'System Admin'}
                    fallbackText={user?.name?.slice(0, 2).toUpperCase() || 'SA'}
                    className="w-20 h-20"
                  />
                  <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 cursor-pointer hover:bg-primary/90">
                    <Upload className="w-3 h-3" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePicChange}
                      className="hidden"
                    />
                  </label>
                </div>
                
                {profileData.profilePic && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProfileData(prev => ({ ...prev, profilePic: null }))}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={profileData.name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your name"
                />
              </div>

              <Button
                onClick={handleProfileSubmit}
                disabled={updateProfileMutation.isPending}
                className="w-full"
              >
                {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
              </Button>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Enter current password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                />
              </div>

              <Button
                onClick={handlePasswordSubmit}
                disabled={changePasswordMutation.isPending}
                className="w-full"
              >
                {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
