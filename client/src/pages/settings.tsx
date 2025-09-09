import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { User, Lock, Bell, Eye, Smartphone, Palette, Camera, Save, Shield, LogOut } from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import { logout } from "@/lib/auth";
import { useLocation } from "wouter";
import type { StudentWithStats } from "@shared/schema";

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Form states
  const [profileData, setProfileData] = useState({
    name: "",
    bio: "",
    phone: "",
    position: "",
    roleNumber: "",
  });

  const [viewerProfileData, setViewerProfileData] = useState({
    name: "",
    bio: "",
    phone: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

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

  const { data: studentProfile, isLoading: studentLoading } = useQuery<StudentWithStats>({
    queryKey: ["/api/students/profile", user?.id],
    enabled: !!user?.id && user?.role === "student",
  });

  const { data: userProfile, isLoading: userLoading } = useQuery({
    queryKey: ["/api/users/me", user?.id],
    enabled: !!user?.id && user?.role === "viewer",
  });

  const isLoading = user?.role === "student" ? studentLoading : userLoading;

  useEffect(() => {
    if (user?.role === "student" && studentProfile) {
      setProfileData({
        name: studentProfile.name || "",
        bio: studentProfile.bio || "",
        phone: studentProfile.phone || "",
        position: studentProfile.position || "",
        roleNumber: studentProfile.roleNumber || "",
      });
    } else if (user?.role === "viewer" && userProfile) {
      setViewerProfileData({
        name: user.name || "",
        bio: "",
        phone: "",
      });
    }
  }, [studentProfile, userProfile, user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (user?.role === "student") {
        return apiRequest(`/api/students/profile/${user?.id}`, "PUT", updates);
      } else if (user?.role === "viewer") {
        return apiRequest(`/api/users/${user?.id}`, "PUT", updates);
      }
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully!",
      });
      if (user?.role === "student") {
        queryClient.invalidateQueries({ queryKey: ["/api/students/profile"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (passwordData: { currentPassword: string; newPassword: string }) => {
      return apiRequest(`/api/users/${user?.id}/change-password`, "POST", passwordData);
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
      toast({
        title: "Error",
        description: error?.message || "Failed to change password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleProfileSave = () => {
    const dataToUpdate = user?.role === "student" ? profileData : viewerProfileData;
    updateProfileMutation.mutate(dataToUpdate);
  };

  const handlePasswordChange = () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "New password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  const handleLogout = () => {
    logout();
    updateUser(null);
    setLocation("/login");
  };

  const saveNotificationSettings = () => {
    // In a real app, this would save to the backend
    toast({
      title: "Notification settings saved",
      description: "Your notification preferences have been updated.",
    });
  };

  const updateViewerNotificationSettings = (key: string, value: boolean) => {
    const updatedSettings = { ...notificationSettings, [key]: value };
    
    // For viewers, simplify notification types
    if (user?.role === "viewer") {
      setNotificationSettings({
        ...updatedSettings,
        postLikes: false, // Viewers don't post content
        teamUpdates: false, // Viewers aren't on teams
      });
    } else {
      setNotificationSettings(updatedSettings);
    }
  };

  const savePrivacySettings = () => {
    // In a real app, this would save to the backend
    toast({
      title: "Privacy settings saved",
      description: "Your privacy preferences have been updated.",
    });
  };

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

  if (user?.role === "student" && !studentProfile && !studentLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">Student profile not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-1">
                Manage your profile, privacy, and notification preferences
              </p>
            </div>
            <Badge variant="outline" className="flex items-center">
              <User className="w-4 h-4 mr-2" />
              {user?.role === "student" ? "Student" : 
               user?.role === "school_admin" ? "School Admin" : "Viewer"}
            </Badge>
          </div>
        </div>

        <div className="p-4 lg:p-8 space-y-8 pb-20 lg:pb-8">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Profile Information
              </CardTitle>
              <CardDescription>
                {user?.role === "student" 
                  ? "Update your personal information and sports details"
                  : user?.role === "school_admin"
                  ? "School admin profile information (read-only)"
                  : "Update your personal information and preferences"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture */}
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage 
                    src={user?.role === "student" ? studentProfile?.profilePic || "" : ""} 
                    alt={user?.name || "Profile"} 
                  />
                  <AvatarFallback>{user?.name?.slice(0, 2).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{user?.name}</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    <Camera className="w-4 h-4 mr-2" />
                    Change Photo
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Profile Form */}
              {user?.role === "student" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                        data-testid="input-settings-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                        data-testid="input-settings-phone"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="position">Position</Label>
                      <Select value={profileData.position} onValueChange={(value) => setProfileData({ ...profileData, position: value })}>
                        <SelectTrigger data-testid="select-settings-position">
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="goalkeeper">Goalkeeper</SelectItem>
                          <SelectItem value="defender">Defender</SelectItem>
                          <SelectItem value="midfielder">Midfielder</SelectItem>
                          <SelectItem value="attacking-midfielder">Attacking Midfielder</SelectItem>
                          <SelectItem value="forward">Forward</SelectItem>
                          <SelectItem value="striker">Striker</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="roleNumber">Jersey Number</Label>
                      <Input
                        id="roleNumber"
                        value={profileData.roleNumber}
                        onChange={(e) => setProfileData({ ...profileData, roleNumber: e.target.value })}
                        placeholder="10"
                        data-testid="input-settings-jersey"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profileData.bio}
                      onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                      placeholder="Tell everyone about yourself, your achievements, and goals..."
                      rows={4}
                      data-testid="textarea-settings-bio"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="viewer-name">Full Name</Label>
                      <Input
                        id="viewer-name"
                        value={viewerProfileData.name}
                        onChange={(e) => setViewerProfileData({ ...viewerProfileData, name: e.target.value })}
                        readOnly={user?.role === "school_admin"}
                        className={user?.role === "school_admin" ? "bg-muted cursor-not-allowed" : ""}
                        data-testid="input-settings-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="viewer-phone">Phone Number</Label>
                      <Input
                        id="viewer-phone"
                        value={viewerProfileData.phone}
                        onChange={(e) => setViewerProfileData({ ...viewerProfileData, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                        readOnly={user?.role === "school_admin"}
                        className={user?.role === "school_admin" ? "bg-muted cursor-not-allowed" : ""}
                        data-testid="input-settings-phone"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="viewer-bio">Bio</Label>
                    <Textarea
                      id="viewer-bio"
                      value={viewerProfileData.bio}
                      onChange={(e) => setViewerProfileData({ ...viewerProfileData, bio: e.target.value })}
                      placeholder="Tell everyone about yourself and your interests..."
                      rows={4}
                      readOnly={user?.role === "school_admin"}
                      className={user?.role === "school_admin" ? "bg-muted cursor-not-allowed" : ""}
                      data-testid="textarea-settings-bio"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={handleProfileSave}
                  disabled={updateProfileMutation.isPending || user?.role === "school_admin"}
                  className={user?.role === "school_admin" ? "cursor-not-allowed" : ""}
                  data-testid="button-save-profile"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {user?.role === "school_admin" ? "Read Only" : 
                   updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Password Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="w-5 h-5 mr-2" />
                Password & Security
              </CardTitle>
              <CardDescription>
                {user?.role === "school_admin" 
                  ? "Password management restricted for school administrators"
                  : "Change your password to keep your account secure"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    placeholder="Enter current password"
                    readOnly={user?.role === "school_admin"}
                    className={user?.role === "school_admin" ? "bg-muted cursor-not-allowed" : ""}
                    data-testid="input-current-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="Enter new password"
                    readOnly={user?.role === "school_admin"}
                    className={user?.role === "school_admin" ? "bg-muted cursor-not-allowed" : ""}
                    data-testid="input-new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 6 characters long
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                    readOnly={user?.role === "school_admin"}
                    className={user?.role === "school_admin" ? "bg-muted cursor-not-allowed" : ""}
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium flex items-center">
                    <Shield className="w-4 h-4 mr-2" />
                    Account Security
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Last password change: Never (Demo Account)
                  </p>
                </div>
                <Button 
                  onClick={handlePasswordChange} 
                  disabled={changePasswordMutation.isPending || user?.role === "school_admin"}
                  className={user?.role === "school_admin" ? "cursor-not-allowed" : "bg-accent hover:bg-accent/90"}
                  data-testid="button-change-password"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {user?.role === "school_admin" ? "Restricted" : 
                   changePasswordMutation.isPending ? "Updating..." : "Change Password"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Privacy & Visibility
              </CardTitle>
              <CardDescription>
                Control who can see your profile and content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Profile Visibility</Label>
                    <p className="text-sm text-muted-foreground">Who can see your profile</p>
                  </div>
                  <Select value={privacySettings.profileVisibility} onValueChange={(value) => setPrivacySettings({ ...privacySettings, profileVisibility: value })}>
                    <SelectTrigger className="w-32" data-testid="select-profile-visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="school">School Only</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {user?.role === "student" && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Performance Stats</Label>
                      <p className="text-sm text-muted-foreground">Display your stats on your profile</p>
                    </div>
                    <Switch
                      checked={privacySettings.showStats}
                      onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, showStats: checked })}
                      data-testid="switch-show-stats"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Contact Information</Label>
                    <p className="text-sm text-muted-foreground">Show email and phone on profile</p>
                  </div>
                  <Switch
                    checked={privacySettings.showContacts}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, showContacts: checked })}
                    data-testid="switch-show-contacts"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Direct Messages</Label>
                    <p className="text-sm text-muted-foreground">
                      {user?.role === "student" ? "Let other students message you" : "Let students message you"}
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.allowDirectMessages}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, allowDirectMessages: checked })}
                    data-testid="switch-allow-messages"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={savePrivacySettings} variant="outline" data-testid="button-save-privacy">
                  <Save className="w-4 h-4 mr-2" />
                  Save Privacy Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Notifications
              </CardTitle>
              <CardDescription>
                Choose what notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium flex items-center">
                  <Smartphone className="w-4 h-4 mr-2" />
                  Push Notifications
                </h4>

                <div className="space-y-3 pl-6">
                  {user?.role === "student" && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Post Likes</Label>
                          <p className="text-sm text-muted-foreground">When someone likes your posts</p>
                        </div>
                        <Switch
                          checked={notificationSettings.postLikes}
                          onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, postLikes: checked })}
                          data-testid="switch-post-likes"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Comments</Label>
                          <p className="text-sm text-muted-foreground">When someone comments on your posts</p>
                        </div>
                        <Switch
                          checked={notificationSettings.postComments}
                          onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, postComments: checked })}
                          data-testid="switch-post-comments"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>New Followers</Label>
                          <p className="text-sm text-muted-foreground">When someone follows you</p>
                        </div>
                        <Switch
                          checked={notificationSettings.newFollowers}
                          onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, newFollowers: checked })}
                          data-testid="switch-new-followers"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Team Updates</Label>
                          <p className="text-sm text-muted-foreground">Academy and team announcements</p>
                        </div>
                        <Switch
                          checked={notificationSettings.teamUpdates}
                          onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, teamUpdates: checked })}
                          data-testid="switch-team-updates"
                        />
                      </div>
                    </>
                  )}
                  
                  {user?.role === "viewer" && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Student Activity</Label>
                          <p className="text-sm text-muted-foreground">When students you follow post new content</p>
                        </div>
                        <Switch
                          checked={notificationSettings.newFollowers}
                          onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, newFollowers: checked })}
                          data-testid="switch-student-activity"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Comment Replies</Label>
                          <p className="text-sm text-muted-foreground">When someone replies to your comments</p>
                        </div>
                        <Switch
                          checked={notificationSettings.postComments}
                          onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, postComments: checked })}
                          data-testid="switch-comment-replies"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Academy Updates</Label>
                          <p className="text-sm text-muted-foreground">General announcements from XEN Sports Armoury</p>
                        </div>
                        <Switch
                          checked={notificationSettings.teamUpdates}
                          onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, teamUpdates: checked })}
                          data-testid="switch-academy-updates"
                        />
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, emailNotifications: checked })}
                    data-testid="switch-email-notifications"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveNotificationSettings} variant="outline" data-testid="button-save-notifications">
                  <Save className="w-4 h-4 mr-2" />
                  Save Notification Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="w-5 h-5 mr-2" />
                Account Security
              </CardTitle>
              <CardDescription>
                Manage your account security and data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <h4 className="font-medium">Password</h4>
                    <p className="text-sm text-muted-foreground">Change your account password</p>
                  </div>
                  <Button variant="outline" data-testid="button-change-password">
                    Change Password
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <h4 className="font-medium">Export Data</h4>
                    <p className="text-sm text-muted-foreground">Download your posts and profile data</p>
                  </div>
                  <Button variant="outline" data-testid="button-export-data">
                    Export Data
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                  <div>
                    <h4 className="font-medium text-destructive">Sign Out</h4>
                    <p className="text-sm text-muted-foreground">Sign out of your account</p>
                  </div>
                  <Button variant="destructive" onClick={handleLogout} data-testid="button-sign-out">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <MobileNav />
    </div>
  );
}