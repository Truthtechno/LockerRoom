import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useProfileMedia } from "@/hooks/useProfileMedia";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { ImageCropper } from "@/components/ui/image-cropper";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { User, Lock, Bell, Eye, EyeOff, LogOut, Settings as SettingsIcon, Info } from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { logout } from "@/lib/auth";
import { useLocation } from "wouter";

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Profile media handling hook
  const {
    profilePicPreview,
    coverPhotoPreview,
    handleProfilePicChange,
    handleCoverPhotoChange,
    updateProfile,
    clearPreviews,
    isUploading,
    isUpdating,
    showCropper,
    selectedImage,
    handleCropComplete,
    setShowCropper
  } = useProfileMedia();

  // Form states - only account-level settings
  const [accountData, setAccountData] = useState({
    name: "",
    email: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState({
    postLikes: true,
    postComments: true,
    newFollowers: true,
    teamUpdates: true,
    emailNotifications: false,
    pushNotifications: true,
  });

  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: "public",
    showStats: true,
    showContacts: false,
    allowDirectMessages: true,
  });

  // Modal states
  const [emailPermissionModalOpen, setEmailPermissionModalOpen] = useState(false);
  const [privacyConfirmationModalOpen, setPrivacyConfirmationModalOpen] = useState(false);
  const [pendingEmailToggle, setPendingEmailToggle] = useState(false);
  const [pendingStatsToggle, setPendingStatsToggle] = useState(false);

  // Load user data
  // CRITICAL: Include user?.id in query key to prevent stale data when switching users
  const { data: userData, isLoading } = useQuery({
    queryKey: ["/api/users/me", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users/me");
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 30_000, // 30 seconds
    refetchOnMount: true, // Always refetch on mount to ensure fresh data
  });

  // Load student profile data for students
  // IMPORTANT: Include user.id in query key to prevent stale data when switching between students
  const { data: studentProfile } = useQuery({
    queryKey: ["/api/students/me", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/students/me");
      return response.json();
    },
    enabled: !!user?.id && user?.role === "student",
    staleTime: 30_000,
  });

  // Update form data when user data loads
  useEffect(() => {
    if (userData) {
      setAccountData({
        name: userData.name || "",
        email: userData.email || "",
      });
    }
  }, [userData]);

  const updateAccountMutation = useMutation({
    mutationFn: async (updates: { name?: string; email?: string }) => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update account');
      }
      
      // Handle 204 No Content or empty responses
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    },
    onSuccess: (data) => {
      toast({
        title: "Account updated",
        description: "Your account information has been updated successfully!",
      });
      
      // Invalidate user queries
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      
      // Update user context with the updated data
      if (data.user && user) {
        const updatedUser = {
          ...user,
          name: data.user.name || user.name,
          email: data.user.email || user.email
        };
        updateUser(updatedUser);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update account.",
        variant: "destructive",
      });
    },
  });

  // Password validation function
  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    return {
      isValid: minLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar,
      errors: {
        minLength: !minLength,
        hasUpperCase: !hasUpperCase,
        hasLowerCase: !hasLowerCase,
        hasNumber: !hasNumber,
        hasSpecialChar: !hasSpecialChar,
      }
    };
  };

  const changePasswordMutation = useMutation({
    mutationFn: async (passwordData: { currentPassword: string; newPassword: string }) => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const response = await fetch(`/api/users/${user?.id}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(passwordData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle token expiration/unauthorized
        if (response.status === 401 || response.status === 403) {
          // Clear auth data and redirect to login
          localStorage.removeItem('token');
          sessionStorage.clear();
          // Clear any cookies
          document.cookie.split(";").forEach((c) => {
            const eqPos = c.indexOf("=");
            const name = eqPos > -1 ? c.substr(0, eqPos) : c;
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          });
          
          toast({
            title: "Session expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          });
          
          setTimeout(() => {
            setLocation("/login");
          }, 2000);
          
          throw new Error('Session expired');
        }
        
        throw new Error(errorData.error?.message || 'Failed to change password');
      }
      
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully!",
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: any) => {
      if (error.message !== 'Session expired') {
        toast({
          title: "Error",
          description: error?.message || "Failed to change password.",
          variant: "destructive",
        });
      }
    },
  });

  const saveNotificationSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest(`/api/users/${user?.id}/notification-settings`, "PUT", settings);
    },
    onSuccess: () => {
      toast({
        title: "Notification settings saved",
        description: "Your notification preferences have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to save notification settings.",
        variant: "destructive",
      });
    },
  });

  const savePrivacySettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest(`/api/users/${user?.id}/privacy-settings`, "PUT", settings);
    },
    onSuccess: () => {
      toast({
        title: "Privacy settings saved",
        description: "Your privacy preferences have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to save privacy settings.",
        variant: "destructive",
      });
    },
  });

  const handleSaveAccount = () => {
    updateAccountMutation.mutate(accountData);
  };


  const handleChangePassword = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    const validation = validatePassword(passwordData.newPassword);
    if (!validation.isValid) {
      const errors = [];
      if (validation.errors.minLength) errors.push("at least 8 characters");
      if (validation.errors.hasUpperCase) errors.push("one uppercase letter");
      if (validation.errors.hasLowerCase) errors.push("one lowercase letter");
      if (validation.errors.hasNumber) errors.push("one number");
      if (validation.errors.hasSpecialChar) errors.push("one special character");
      
      toast({
        title: "Password requirements not met",
        description: `Password must contain ${errors.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  // Handle push notification permission request
  const handlePushNotificationToggle = async (checked: boolean) => {
    if (checked && "Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          setNotificationSettings({ ...notificationSettings, pushNotifications: checked });
        } else {
          toast({
            title: "Permission denied",
            description: "Push notifications were not enabled. Please enable them in your browser settings.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to request notification permission.",
          variant: "destructive",
        });
      }
    } else {
      setNotificationSettings({ ...notificationSettings, pushNotifications: checked });
    }
  };

  // Handle email notification toggle with confirmation
  const handleEmailNotificationToggle = (checked: boolean) => {
    setPendingEmailToggle(checked);
    setEmailPermissionModalOpen(true);
  };

  const confirmEmailPermission = () => {
    setNotificationSettings({ ...notificationSettings, emailNotifications: pendingEmailToggle });
    setEmailPermissionModalOpen(false);
    saveNotificationSettings();
  };

  // Handle privacy settings toggle with confirmation
  const handleShowStatsToggle = (checked: boolean) => {
    setPendingStatsToggle(checked);
    setPrivacyConfirmationModalOpen(true);
  };

  const confirmStatsToggle = () => {
    setPrivacySettings({ ...privacySettings, showStats: pendingStatsToggle });
    setPrivacyConfirmationModalOpen(false);
    savePrivacySettings();
  };

  const saveNotificationSettings = () => {
    saveNotificationSettingsMutation.mutate(notificationSettings);
  };

  const savePrivacySettings = () => {
    savePrivacySettingsMutation.mutate(privacySettings);
  };

  const handleLogout = () => {
    logout(); // logout() now handles clearing data and redirecting
  };

  // Error state
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Please log in to access settings.</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground flex items-center">
              <SettingsIcon className="w-8 h-8 mr-3 text-accent" />
              Account Settings
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your account preferences and security settings
            </p>
          </div>

          <div className="space-y-8">
            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2 text-accent" />
                  Account Information
                </CardTitle>
                <CardDescription>
                  Update your basic account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile Avatar */}
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Avatar className="w-20 h-20">
                      <AvatarImage
                        src={
                          profilePicPreview ||
                          userData?.profilePicUrl || // unified from API
                          undefined // never pass ""
                        }
                        alt={user?.name || "Profile"}
                        onError={(e) => {
                          // hide broken img so <AvatarFallback> shows without flicker
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <AvatarFallback>
                        {/* initials if name exists, else an icon */}
                        {user?.name
                          ? user.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase()
                          : <User className="w-8 h-8 text-muted-foreground" />
                        }
                      </AvatarFallback>
                    </Avatar>
                    <input
                      id="settings-profile-pic-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleProfilePicChange(f);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0"
                      onClick={() => document.getElementById("settings-profile-pic-upload")?.click()}
                      disabled={isUploading || isUpdating}
                    >
                      <User className="w-4 h-4" />
                    </Button>
                  </div>
                  <div>
                    <h3 className="font-medium">{user?.name}</h3>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
                    {(isUploading || isUpdating) && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {isUploading ? "Uploading..." : "Updating profile..."}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Account Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="name">Full Name</Label>
                      {user?.role === "student" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Managed by your school/organization</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Input
                      id="name"
                      value={accountData.name}
                      onChange={(e) => setAccountData({ ...accountData, name: e.target.value })}
                      placeholder="Your full name"
                      disabled={user?.role === "student"}
                      className={user?.role === "student" ? "bg-muted" : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="email">Email Address</Label>
                      {user?.role === "student" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Managed by your school/organization</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Input
                      id="email"
                      type="email"
                      value={accountData.email}
                      onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                      placeholder="your@email.com"
                      disabled={user?.role === "student"}
                      className={user?.role === "student" ? "bg-muted" : ""}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveAccount}
                    disabled={updateAccountMutation.isPending || user?.role === "student"}
                    className="bg-accent hover:bg-accent/90"
                  >
                    {updateAccountMutation.isPending ? "Saving..." : "Save Account"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lock className="w-5 h-5 mr-2 text-accent" />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password for better security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        placeholder="Enter current password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
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
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
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
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
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

                {/* Password Requirements */}
                {passwordData.newPassword && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-medium">Password Requirements:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className={`flex items-center gap-2 ${passwordData.newPassword.length >= 8 ? 'text-green-600' : 'text-muted-foreground'}`}>
                        <div className={`w-2 h-2 rounded-full ${passwordData.newPassword.length >= 8 ? 'bg-green-600' : 'bg-muted-foreground'}`} />
                        At least 8 characters
                      </div>
                      <div className={`flex items-center gap-2 ${/[A-Z]/.test(passwordData.newPassword) ? 'text-green-600' : 'text-muted-foreground'}`}>
                        <div className={`w-2 h-2 rounded-full ${/[A-Z]/.test(passwordData.newPassword) ? 'bg-green-600' : 'bg-muted-foreground'}`} />
                        One uppercase letter
                      </div>
                      <div className={`flex items-center gap-2 ${/[a-z]/.test(passwordData.newPassword) ? 'text-green-600' : 'text-muted-foreground'}`}>
                        <div className={`w-2 h-2 rounded-full ${/[a-z]/.test(passwordData.newPassword) ? 'bg-green-600' : 'bg-muted-foreground'}`} />
                        One lowercase letter
                      </div>
                      <div className={`flex items-center gap-2 ${/\d/.test(passwordData.newPassword) ? 'text-green-600' : 'text-muted-foreground'}`}>
                        <div className={`w-2 h-2 rounded-full ${/\d/.test(passwordData.newPassword) ? 'bg-green-600' : 'bg-muted-foreground'}`} />
                        One number
                      </div>
                      <div className={`flex items-center gap-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordData.newPassword) ? 'text-green-600' : 'text-muted-foreground'}`}>
                        <div className={`w-2 h-2 rounded-full ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordData.newPassword) ? 'bg-green-600' : 'bg-muted-foreground'}`} />
                        One special character
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={handleChangePassword}
                    disabled={changePasswordMutation.isPending}
                    variant="outline"
                  >
                    {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Profile Media - HIDDEN for now (cover is managed on Profile page) */}
            {false && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2 text-accent" />
                  Profile Media
                </CardTitle>
                <CardDescription>
                  Update your profile picture and cover photo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Cover Photo */}
                <div className="space-y-4">
                  <Label>Cover Photo</Label>
                  <div className="flex items-center space-x-4">
                    <div className="w-32 h-20 rounded-lg border-2 border-dashed border-border overflow-hidden">
                      <img
                        className="w-full h-full object-cover"
                        src={coverPhotoPreview || ""}
                        alt="Cover preview"
                      />
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleCoverPhotoChange(f);
                        }}
                        className="hidden"
                        id="cover-photo-upload"
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById('cover-photo-upload')?.click()}
                        className="mb-2"
                        disabled={isUploading || isUpdating}
                      >
                        <User className="w-4 h-4 mr-2" />
                        {isUploading ? "Uploading..." : "Select Cover Photo"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Recommended: 1200x400px
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Logout */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <LogOut className="w-5 h-5 mr-2 text-accent" />
                  Logout
                </CardTitle>
                <CardDescription>
                  Sign out of your account on this device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      You can always log back in with your credentials after logging out.
                    </p>
                  </div>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    Logout
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Image Cropper Modal */}
      {showCropper && selectedImage && (
        <ImageCropper
          isOpen={showCropper}
          onClose={() => setShowCropper(false)}
          onCropComplete={handleCropComplete}
          imageSrc={selectedImage}
        />
      )}

      {/* Email Permission Modal */}
      <Dialog open={emailPermissionModalOpen} onOpenChange={setEmailPermissionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Notifications</DialogTitle>
            <DialogDescription>
              Allow LockerRoom to send you email updates?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailPermissionModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmEmailPermission}>
              {pendingEmailToggle ? "Enable" : "Disable"} Email Notifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Privacy Confirmation Modal */}
      <AlertDialog open={privacyConfirmationModalOpen} onOpenChange={setPrivacyConfirmationModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Privacy Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to make your stats {pendingStatsToggle ? "public" : "private"}?
              {pendingStatsToggle ? " This will make your performance statistics visible to other users." : " This will hide your performance statistics from other users."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatsToggle}>
              {pendingStatsToggle ? "Make Public" : "Make Private"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}