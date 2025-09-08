import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Settings, Palette, ToggleLeft, ToggleRight, Plus, Trash2, Save, Mail } from "lucide-react";
import { useLocation } from "wouter";

type SystemSetting = {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  updatedBy: string;
  updatedAt: string;
};

const addSettingFormSchema = z.object({
  key: z.string().min(1, "Key is required").regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Key must be valid identifier"),
  value: z.string().min(1, "Value is required"),
  category: z.enum(["general", "theme", "features", "email"]),
  description: z.string().optional(),
});

type AddSettingFormData = z.infer<typeof addSettingFormSchema>;

const predefinedSettings = {
  theme: [
    { key: "primary_color", value: "#FFD700", description: "Primary brand color (XEN Gold)" },
    { key: "secondary_color", value: "#000000", description: "Secondary color (Black)" },
    { key: "accent_color", value: "#FFFFFF", description: "Accent color (White)" },
    { key: "dark_mode_enabled", value: "true", description: "Enable dark mode support" },
  ],
  features: [
    { key: "public_signup_enabled", value: "true", description: "Allow public user registration" },
    { key: "media_upload_enabled", value: "true", description: "Enable media uploads" },
    { key: "comments_enabled", value: "true", description: "Enable post comments" },
    { key: "follow_system_enabled", value: "true", description: "Enable follow/unfollow system" },
    { key: "search_enabled", value: "true", description: "Enable student search" },
  ],
  email: [
    { key: "welcome_email_enabled", value: "true", description: "Send welcome emails to new users" },
    { key: "notification_email_enabled", value: "true", description: "Send notification emails" },
    { key: "admin_email", value: "admin@lockerroom.com", description: "Administrator contact email" },
  ],
  general: [
    { key: "platform_name", value: "LockerRoom", description: "Platform display name" },
    { key: "max_file_size_mb", value: "50", description: "Maximum file upload size in MB" },
    { key: "session_timeout_hours", value: "24", description: "User session timeout in hours" },
  ],
};

export default function SystemConfig() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddSetting, setShowAddSetting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("general");

  const addSettingForm = useForm<AddSettingFormData>({
    resolver: zodResolver(addSettingFormSchema),
    defaultValues: {
      category: "general",
    },
  });

  const { data: settings, isLoading } = useQuery<SystemSetting[]>({
    queryKey: ["/api/admin/system-settings"],
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest("/api/admin/system-settings", {
        method: "POST",
        body: {
          key,
          value,
          category: settings?.find(s => s.key === key)?.category || "general",
          updatedBy: user?.id,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      toast({
        title: "Setting Updated",
        description: "System setting has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update system setting.",
        variant: "destructive",
      });
    },
  });

  const addSettingMutation = useMutation({
    mutationFn: async (data: AddSettingFormData) => {
      return apiRequest("/api/admin/system-settings", {
        method: "POST",
        body: {
          ...data,
          updatedBy: user?.id,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      addSettingForm.reset();
      setShowAddSetting(false);
      toast({
        title: "Setting Added",
        description: "New system setting has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create system setting.",
        variant: "destructive",
      });
    },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: async (key: string) => {
      return apiRequest(`/api/admin/system-settings/${key}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      toast({
        title: "Setting Deleted",
        description: "System setting has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete system setting.",
        variant: "destructive",
      });
    },
  });

  const initializeDefaultSettings = async () => {
    const allSettings = Object.values(predefinedSettings).flat();
    for (const setting of allSettings) {
      try {
        await apiRequest("/api/admin/system-settings", {
          method: "POST",
          body: {
            ...setting,
            category: Object.entries(predefinedSettings).find(([_, settings]) => 
              settings.some(s => s.key === setting.key)
            )?.[0] || "general",
            updatedBy: user?.id,
          },
        });
      } catch (error) {
        console.log(`Setting ${setting.key} might already exist`);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
    toast({
      title: "Default Settings Initialized",
      description: "Platform has been configured with default settings.",
    });
  };

  const onAddSetting = (data: AddSettingFormData) => {
    addSettingMutation.mutate(data);
  };

  const getSetting = (key: string) => {
    return settings?.find(s => s.key === key);
  };

  const getSettingValue = (key: string, defaultValue = "") => {
    return getSetting(key)?.value || defaultValue;
  };

  const updateSetting = (key: string, value: string) => {
    updateSettingMutation.mutate({ key, value });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "theme":
        return <Palette className="w-5 h-5" />;
      case "features":
        return <ToggleLeft className="w-5 h-5" />;
      case "email":
        return <Mail className="w-5 h-5" />;
      default:
        return <Settings className="w-5 h-5" />;
    }
  };

  const filteredSettings = settings?.filter(s => s.category === activeCategory) || [];
  const categories = ["general", "theme", "features", "email"];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/system-admin")}
                className="mr-4"
                data-testid="back-to-admin"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">System Configuration</h1>
                <p className="text-sm text-muted-foreground">Manage platform-wide settings and preferences</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {(!settings || settings.length === 0) && (
                <Button
                  onClick={initializeDefaultSettings}
                  variant="outline"
                  data-testid="button-initialize-defaults"
                >
                  Initialize Defaults
                </Button>
              )}
              <Dialog open={showAddSetting} onOpenChange={setShowAddSetting}>
                <DialogTrigger asChild>
                  <Button className="gold-gradient text-accent-foreground" data-testid="button-add-setting">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Setting
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add System Setting</DialogTitle>
                    <DialogDescription>
                      Create a new platform-wide configuration setting.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...addSettingForm}>
                    <form onSubmit={addSettingForm.handleSubmit(onAddSetting)} className="space-y-4">
                      <FormField
                        control={addSettingForm.control}
                        name="key"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Setting Key</FormLabel>
                            <FormControl>
                              <Input placeholder="setting_name" {...field} data-testid="input-setting-key" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={addSettingForm.control}
                        name="value"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Value</FormLabel>
                            <FormControl>
                              <Input placeholder="Setting value" {...field} data-testid="input-setting-value" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={addSettingForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-setting-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="theme">Theme</SelectItem>
                                <SelectItem value="features">Features</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={addSettingForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Describe what this setting controls..." 
                                {...field} 
                                data-testid="textarea-setting-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button 
                          type="submit" 
                          disabled={addSettingMutation.isPending}
                          data-testid="button-submit-setting"
                        >
                          {addSettingMutation.isPending ? "Adding..." : "Add Setting"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Category Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Categories</CardTitle>
                <CardDescription>Select a settings category</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors hover:bg-muted ${
                        activeCategory === category ? "bg-muted border-r-2 border-accent" : ""
                      }`}
                      data-testid={`category-${category}`}
                    >
                      {getCategoryIcon(category)}
                      <span className="font-medium capitalize">{category}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  {getCategoryIcon(activeCategory)}
                  <div>
                    <CardTitle className="capitalize">{activeCategory} Settings</CardTitle>
                    <CardDescription>
                      Configure {activeCategory} settings for the platform
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredSettings.length > 0 ? (
                  <div className="space-y-6">
                    {filteredSettings.map((setting) => (
                      <div key={setting.id} className="border border-border rounded-lg p-4" data-testid={`setting-${setting.key}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 mr-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <Label className="font-medium">{setting.key.replace(/_/g, ' ')}</Label>
                              <code className="px-2 py-1 bg-muted text-xs rounded">{setting.key}</code>
                            </div>
                            {setting.description && (
                              <p className="text-sm text-muted-foreground mb-3">{setting.description}</p>
                            )}
                            
                            {/* Dynamic input based on value type */}
                            {setting.value === "true" || setting.value === "false" ? (
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={setting.value === "true"}
                                  onCheckedChange={(checked) => updateSetting(setting.key, checked.toString())}
                                  data-testid={`switch-${setting.key}`}
                                />
                                <span className="text-sm">{setting.value === "true" ? "Enabled" : "Disabled"}</span>
                              </div>
                            ) : setting.key.includes("color") ? (
                              <div className="flex items-center space-x-2">
                                <Input
                                  type="color"
                                  value={setting.value}
                                  onChange={(e) => updateSetting(setting.key, e.target.value)}
                                  className="w-16 h-10"
                                  data-testid={`color-${setting.key}`}
                                />
                                <Input
                                  value={setting.value}
                                  onChange={(e) => updateSetting(setting.key, e.target.value)}
                                  placeholder="Color value"
                                  className="flex-1"
                                  data-testid={`input-${setting.key}`}
                                />
                              </div>
                            ) : (
                              <Input
                                value={setting.value}
                                onChange={(e) => updateSetting(setting.key, e.target.value)}
                                placeholder="Setting value"
                                data-testid={`input-${setting.key}`}
                              />
                            )}

                            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                              <span>Last updated: {new Date(setting.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteSettingMutation.mutate(setting.key)}
                            disabled={deleteSettingMutation.isPending}
                            data-testid={`button-delete-${setting.key}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No {activeCategory} Settings</h3>
                    <p className="text-muted-foreground mb-6">
                      No settings found in the {activeCategory} category.
                    </p>
                    <Button 
                      onClick={() => setShowAddSetting(true)}
                      className="gold-gradient text-accent-foreground"
                      data-testid="button-add-first-setting"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Setting
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}