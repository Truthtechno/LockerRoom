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

export default function StudentSettings() {
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

  const { data: studentProfile, isLoading } = useQuery<StudentWithStats>({
    queryKey: ["/api/students/profile", user?.id],
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (studentProfile) {
      setProfileData({
        name: studentProfile.name || "",
        bio: studentProfile.bio || "",
        phone: studentProfile.phone || "",
        position: studentProfile.position || "",
        roleNumber: studentProfile.roleNumber || "",
      });
    }
  }, [studentProfile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest(`/api/students/profile/${user?.id}`, "PUT", updates);
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/students/profile"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleProfileSave = () => {
    updateProfileMutation.mutate(profileData);
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

  if (!studentProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">Profile not found</p>
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
              Student
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
                Update your personal information and sports details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture */}
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={studentProfile?.profilePic || ""} alt={studentProfile?.name || "Profile"} />
                  <AvatarFallback>{studentProfile?.name?.slice(0, 2).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{studentProfile?.name}</h3>
                  <p className="text-sm text-muted-foreground">{studentProfile?.email}</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    <Camera className="w-4 h-4 mr-2" />
                    Change Photo
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Profile Form */}
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

              <div className="flex justify-end">
                <Button 
                  onClick={handleProfileSave}
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
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
                    <p className="text-sm text-muted-foreground">Let other students message you</p>
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