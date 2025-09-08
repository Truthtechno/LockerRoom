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
import { ArrowLeft, Settings, School, Users, Plus, Trash2, Save } from "lucide-react";
import { useLocation } from "wouter";

type SchoolSetting = {
  id: string;
  schoolId: string;
  key: string;
  value: string;
  category: string;
  updatedBy: string;
  updatedAt: string;
};

type School = {
  id: string;
  name: string;
  subscriptionPlan: string;
  maxStudents: number;
  createdAt: string;
};

const addSettingFormSchema = z.object({
  key: z.string().min(1, "Key is required").regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Key must be valid identifier"),
  value: z.string().min(1, "Value is required"),
  category: z.enum(["general", "grades", "staff"]),
});

type AddSettingFormData = z.infer<typeof addSettingFormSchema>;

const predefinedSettings = {
  general: [
    { key: "school_logo_url", value: "", description: "URL to school logo image" },
    { key: "school_address", value: "", description: "Physical address of the school" },
    { key: "school_phone", value: "", description: "Main school contact number" },
    { key: "school_email", value: "", description: "Official school email address" },
    { key: "academic_year", value: "2024-2025", description: "Current academic year" },
  ],
  grades: [
    { key: "grade_levels", value: "9,10,11,12", description: "Available grade levels (comma-separated)" },
    { key: "class_size_limit", value: "30", description: "Maximum students per class" },
    { key: "grading_scale", value: "A,B,C,D,F", description: "Grading system used" },
    { key: "semester_system", value: "true", description: "Use semester-based system" },
  ],
  staff: [
    { key: "max_teachers", value: "50", description: "Maximum number of teachers" },
    { key: "teacher_student_ratio", value: "1:20", description: "Preferred teacher-to-student ratio" },
    { key: "admin_approval_required", value: "true", description: "Require admin approval for new staff" },
  ],
};

export default function ManageSettings() {
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

  const { data: school, isLoading: schoolLoading } = useQuery<School>({
    queryKey: ["/api/schools", user?.schoolId],
    enabled: !!user?.schoolId,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<SchoolSetting[]>({
    queryKey: ["/api/schools", user?.schoolId, "settings"],
    enabled: !!user?.schoolId,
  });

  const updateSchoolMutation = useMutation({
    mutationFn: async (updates: Partial<School>) => {
      return apiRequest(`/api/schools/${user?.schoolId}`, {
        method: "PUT",
        body: updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId] });
      toast({
        title: "School Updated",
        description: "School information has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update school information.",
        variant: "destructive",
      });
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest(`/api/schools/${user?.schoolId}/settings`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "settings"] });
      toast({
        title: "Setting Updated",
        description: "School setting has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update school setting.",
        variant: "destructive",
      });
    },
  });

  const addSettingMutation = useMutation({
    mutationFn: async (data: AddSettingFormData) => {
      return apiRequest(`/api/schools/${user?.schoolId}/settings`, {
        method: "POST",
        body: {
          ...data,
          updatedBy: user?.id,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "settings"] });
      addSettingForm.reset();
      setShowAddSetting(false);
      toast({
        title: "Setting Added",
        description: "New school setting has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create school setting.",
        variant: "destructive",
      });
    },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: async (key: string) => {
      return apiRequest(`/api/schools/${user?.schoolId}/settings/${key}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "settings"] });
      toast({
        title: "Setting Deleted",
        description: "School setting has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete school setting.",
        variant: "destructive",
      });
    },
  });

  const initializeDefaultSettings = async () => {
    const allSettings = Object.values(predefinedSettings).flat();
    for (const setting of allSettings) {
      try {
        await apiRequest(`/api/schools/${user?.schoolId}/settings`, {
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
    queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "settings"] });
    toast({
      title: "Default Settings Initialized",
      description: "School has been configured with default settings.",
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

  const updateSchoolInfo = (field: string, value: string | number) => {
    updateSchoolMutation.mutate({ [field]: value });
  };

  const filteredSettings = settings?.filter(s => s.category === activeCategory) || [];
  const categories = ["general", "grades", "staff"];

  const isLoading = schoolLoading || settingsLoading;

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
                onClick={() => setLocation("/school-admin")}
                className="mr-4"
                data-testid="back-to-admin"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Manage Settings</h1>
                <p className="text-sm text-muted-foreground">Configure your school's information and preferences</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {(!settings || settings.length === 0) && (
                <Button
                  disabled
                  variant="outline"
                  className="cursor-not-allowed"
                  data-testid="button-initialize-defaults"
                >
                  Initialize Defaults
                </Button>
              )}
              <Dialog open={showAddSetting} onOpenChange={setShowAddSetting}>
                <DialogTrigger asChild>
                  <Button disabled className="cursor-not-allowed" data-testid="button-add-setting">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Setting
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add School Setting</DialogTitle>
                    <DialogDescription>
                      Create a new configuration setting for your school.
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
                                <SelectItem value="grades">Grades</SelectItem>
                                <SelectItem value="staff">Staff</SelectItem>
                              </SelectContent>
                            </Select>
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
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Settings Categories</CardTitle>
                <CardDescription>Select a category to configure</CardDescription>
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
                      {category === "general" && <School className="w-5 h-5" />}
                      {category === "grades" && <Settings className="w-5 h-5" />}
                      {category === "staff" && <Users className="w-5 h-5" />}
                      <span className="font-medium capitalize">{category}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* School Information Card */}
            {activeCategory === "general" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <School className="w-5 h-5 mr-2 text-accent" />
                    School Information
                  </CardTitle>
                  <CardDescription>View your school's basic information (read-only)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>School Name</Label>
                        <Input
                          value={school?.name || ""}
                          readOnly
                          className="bg-muted cursor-not-allowed"
                          placeholder="Elite Soccer Academy"
                          data-testid="input-school-name"
                        />
                      </div>
                      
                      <div>
                        <Label>Subscription Plan</Label>
                        <Input
                          value={school?.subscriptionPlan === "premium" ? "Premium ($150/month)" : "Standard ($75/month)"}
                          readOnly
                          className="bg-muted cursor-not-allowed"
                          data-testid="select-subscription-plan"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Maximum Students</Label>
                      <Input
                        type="number"
                        value={school?.maxStudents || 100}
                        readOnly
                        className="bg-muted cursor-not-allowed"
                        placeholder="100"
                        data-testid="input-max-students"
                      />
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            School information can only be modified by system administrators. Contact support if changes are needed.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Settings Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="capitalize">{activeCategory} Settings</CardTitle>
                <CardDescription>
                  View {activeCategory} settings for your school (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredSettings.length > 0 ? (
                  <div className="space-y-6">
                    {filteredSettings.map((setting) => (
                      <div key={setting.id} className="border border-border rounded-lg p-4 bg-muted/50" data-testid={`setting-${setting.key}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 mr-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <Label className="font-medium">{setting.key.replace(/_/g, ' ')}</Label>
                              <code className="px-2 py-1 bg-muted text-xs rounded">{setting.key}</code>
                            </div>
                            
                            {/* Dynamic input based on value type and key */}
                            {setting.value === "true" || setting.value === "false" ? (
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={setting.value === "true"}
                                  disabled
                                  data-testid={`switch-${setting.key}`}
                                />
                                <span className="text-sm">{setting.value === "true" ? "Enabled" : "Disabled"}</span>
                              </div>
                            ) : setting.key.includes("url") ? (
                              <Input
                                type="url"
                                value={setting.value}
                                readOnly
                                className="bg-muted cursor-not-allowed"
                                placeholder="https://example.com/image.jpg"
                                data-testid={`input-${setting.key}`}
                              />
                            ) : setting.key.includes("email") ? (
                              <Input
                                type="email"
                                value={setting.value}
                                readOnly
                                className="bg-muted cursor-not-allowed"
                                placeholder="admin@school.edu"
                                data-testid={`input-${setting.key}`}
                              />
                            ) : setting.key.includes("phone") ? (
                              <Input
                                type="tel"
                                value={setting.value}
                                readOnly
                                className="bg-muted cursor-not-allowed"
                                placeholder="(555) 123-4567"
                                data-testid={`input-${setting.key}`}
                              />
                            ) : setting.key.includes("address") ? (
                              <Textarea
                                value={setting.value}
                                readOnly
                                className="bg-muted cursor-not-allowed"
                                placeholder="123 School St, City, State 12345"
                                rows={2}
                                data-testid={`textarea-${setting.key}`}
                              />
                            ) : (
                              <Input
                                value={setting.value}
                                readOnly
                                className="bg-muted cursor-not-allowed"
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
                            disabled
                            className="cursor-not-allowed"
                            data-testid={`button-delete-${setting.key}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            School settings can only be modified by system administrators. Contact support if changes are needed.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No {activeCategory} Settings</h3>
                    <p className="text-muted-foreground mb-6">
                      No settings found in the {activeCategory} category. Contact system administrators to add settings.
                    </p>
                    <Button 
                      disabled
                      className="cursor-not-allowed"
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