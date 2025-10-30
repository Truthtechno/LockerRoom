import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Shield, UserPlus, Crown, Settings, Trash2, Edit, Users, Lock, Upload, User, Check, Copy, AlertTriangle, Mail, Phone } from "lucide-react";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

type ScoutAdmin = {
  id: string;
  name: string;
  email: string;
  role: string;
  xenId: string;
  profilePicUrl?: string;
  createdAt: string;
};

const adminFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().email("Valid email is required").max(255, "Email must be less than 255 characters"),
  role: z.enum(["system_admin", "moderator", "scout_admin", "xen_scout", "finance", "support", "coach", "analyst"]).default("moderator"),
});

type AdminFormData = z.infer<typeof adminFormSchema>;

// Generate XEN ID with prefix
const generateXenId = () => {
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `XSA-25${randomNum}`;
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export default function AdminManagement() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddScout, setShowAddScout] = useState(false);
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [otpDisplay, setOtpDisplay] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCopied, setOtpCopied] = useState(false);
  const [scoutData, setScoutData] = useState<any>(null);

  const adminForm = useForm<AdminFormData>({
    resolver: zodResolver(adminFormSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "moderator",
    },
  });

  const { data: scoutAdmins, isLoading: scoutsLoading } = useQuery<ScoutAdmin[]>({
    queryKey: ["/api/scout-admins"],
  });

  const createAdminMutation = useMutation({
    mutationFn: async (data: AdminFormData) => {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('email', data.email);
      formData.append('role', data.role);
      // Only add xenId and otp for scout roles
      if (data.role === 'scout_admin' || data.role === 'xen_scout') {
        formData.append('xenId', generateXenId());
        formData.append('otp', generateOTP());
      }
      
      if (profilePicFile) {
        formData.append('profilePic', profilePicFile);
      }

      const response = await fetch('/api/admin/create-admin', {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || "Failed to create admin");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scout-admins"] });
      adminForm.reset();
      setShowAddScout(false);
      setProfilePicFile(null);
      setProfilePicPreview(null);
      
      // Show OTP modal if OTP was generated (for scout roles)
      if (data?.otp) {
        setOtpDisplay(data.otp);
        setScoutData(data.scout || data.admin);
        setShowOtpModal(true);
      }
      
      // For non-scout roles, show a message about coming soon
      const createdRole = data?.admin?.role;
      if (createdRole && !['scout_admin', 'xen_scout'].includes(createdRole)) {
        toast({
          title: "Admin Created Successfully! 🎉",
          description: `${createdRole} portal is coming soon. The admin can log in but will see a placeholder page until their portal is implemented.`,
        });
      } else {
        toast({
          title: "Admin Created Successfully! 🎉",
          description: data.message || "Admin has been successfully registered. Please share the OTP securely if applicable.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create admin.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AdminFormData) => {
    createAdminMutation.mutate(data);
  };

  const copyOTP = async () => {
    if (otpDisplay) {
      try {
        await navigator.clipboard.writeText(otpDisplay);
        setOtpCopied(true);
        toast({
          title: "OTP Copied",
          description: "One-time password copied to clipboard",
        });
        setTimeout(() => setOtpCopied(false), 2000);
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Could not copy OTP to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  const closeOTPModal = () => {
    setShowOtpModal(false);
    setOtpDisplay(null);
    setScoutData(null);
    setOtpCopied(false);
    adminForm.reset();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
          title: "File too large",
          description: `Please select an image smaller than 5MB. Current file: ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Profile image selected",
        description: `Image ready for upload (${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
      });

      setProfilePicFile(file);
      
      const reader = new FileReader();
      reader.onload = () => {
        setProfilePicPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfilePic = () => {
    setProfilePicFile(null);
    setProfilePicPreview(null);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "system_admin":
        return <Badge variant="default" className="bg-red-600 text-xs"><Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />System Admin</Badge>;
      case "scout_admin":
        return <Badge variant="default" className="bg-blue-600 text-xs"><Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />Scout Admin</Badge>;
      case "xen_scout":
        return <Badge variant="secondary" className="bg-green-600 text-white text-xs"><User className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />XEN Scout</Badge>;
      case "moderator":
        return <Badge variant="outline" className="bg-purple-600 text-white text-xs"><Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />Moderator</Badge>;
      case "finance":
        return <Badge variant="outline" className="bg-green-600 text-white text-xs"><User className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />Finance</Badge>;
      case "support":
        return <Badge variant="outline" className="bg-blue-600 text-white text-xs"><User className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />Support</Badge>;
      case "coach":
        return <Badge variant="outline" className="bg-orange-600 text-white text-xs"><User className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />Coach</Badge>;
      case "analyst":
        return <Badge variant="outline" className="bg-indigo-600 text-white text-xs"><User className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />Analyst</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{role}</Badge>;
    }
  };

  const isLoading = scoutsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
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
            <div className="flex items-center justify-between py-4 lg:h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/system-admin")}
                className="lg:hidden mr-4"
                data-testid="back-to-admin"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
              <div className="flex flex-col space-y-1">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground">Admin Management</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Create and manage administrators and staff members</p>
              </div>
            </div>
            
            <Dialog open={showAddScout} onOpenChange={setShowAddScout}>
              <DialogTrigger asChild>
                <Button className="gold-gradient text-accent-foreground text-xs sm:text-sm" size="sm" data-testid="button-add-admin">
                  <UserPlus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Create Admin</span>
                  <span className="sm:hidden">Create</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create Administrator</DialogTitle>
                  <DialogDescription>
                    Create a new administrator with profile picture and credentials.
                  </DialogDescription>
                </DialogHeader>
                <Form {...adminForm}>
                  <form onSubmit={adminForm.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Profile Picture Upload */}
                    <div className="space-y-4">
                      <Label>Profile Picture</Label>
                      <div className="flex items-center space-x-4">
                        {profilePicPreview ? (
                          <div className="relative">
                            <img
                              src={profilePicPreview}
                              alt="Profile preview"
                              className="w-24 h-24 rounded-full object-cover border-2 border-border"
                              data-testid="profile-pic-preview"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute -top-2 -right-2 rounded-full w-6 h-6 p-0"
                              onClick={removeProfilePic}
                              data-testid="remove-profile-pic"
                            >
                              ×
                            </Button>
                          </div>
                        ) : (
                          <div className="w-24 h-24 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center">
                            <User className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                            id="profile-pic-input"
                            data-testid="profile-pic-input"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById("profile-pic-input")?.click()}
                            data-testid="upload-profile-pic"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Photo
                          </Button>
                          <p className="text-xs text-muted-foreground mt-1">
                            Max 5MB, JPG or PNG
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Basic Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={adminForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="John Smith" {...field} data-testid="input-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={adminForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address *</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="john@example.com" 
                                {...field} 
                                data-testid="input-email" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={adminForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-role">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="system_admin">System Admin</SelectItem>
                                <SelectItem value="moderator">Moderator</SelectItem>
                                <SelectItem value="scout_admin">Scout Admin</SelectItem>
                                <SelectItem value="xen_scout">XEN Scout</SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                                <SelectItem value="support">Support</SelectItem>
                                <SelectItem value="coach">Coach</SelectItem>
                                <SelectItem value="analyst">Analyst</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <DialogFooter>
                      <Button 
                        type="submit" 
                        disabled={createAdminMutation.isPending}
                        data-testid="button-submit-admin"
                      >
                        {createAdminMutation.isPending ? "Creating..." : "Create Admin"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Card className="p-3 sm:p-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Admins</CardTitle>
              <User className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-xl sm:text-2xl font-bold">{scoutAdmins?.length || 0}</div>
            </CardContent>
          </Card>
          
          <Card className="p-3 sm:p-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium">System Admins</CardTitle>
              <Crown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-xl sm:text-2xl font-bold text-red-600">
                {scoutAdmins?.filter(s => s.role === "system_admin").length || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card className="p-3 sm:p-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium">Scout Admins</CardTitle>
              <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-xl sm:text-2xl font-bold text-blue-600">
                {scoutAdmins?.filter(s => s.role === "scout_admin").length || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card className="p-3 sm:p-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium">Other Roles</CardTitle>
              <User className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-xl sm:text-2xl font-bold text-green-600">
                {scoutAdmins?.filter(s => !["system_admin", "scout_admin", "xen_scout"].includes(s.role)).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admins List */}
        {scoutAdmins && scoutAdmins.length > 0 ? (
          <div className="space-y-3 sm:space-y-6">
            {scoutAdmins.map((scout) => (
              <Card key={scout.id} className="overflow-hidden" data-testid={`scout-${scout.id}`}>
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        {scout.profilePicUrl ? (
                          <img
                            src={scout.profilePicUrl}
                            alt={scout.name}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg truncate">{scout.name}</CardTitle>
                        <CardDescription className="text-xs sm:text-sm truncate">{scout.email}</CardDescription>
                        {scout.xenId && (
                          <div className="text-xs text-muted-foreground mt-1">
                            XEN ID: {scout.xenId}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                      {getRoleBadge(scout.role)}
                      <div className="text-xs text-muted-foreground">
                        Since {new Date(scout.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 sm:py-12">
            <User className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">No Administrators</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 px-4">
              No administrators have been created yet.
            </p>
            <Button 
              onClick={() => setShowAddScout(true)}
              className="gold-gradient text-accent-foreground text-xs sm:text-sm"
              size="sm"
              data-testid="button-add-first-admin"
            >
              <UserPlus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Create First Administrator
            </Button>
          </div>
        )}

        {/* OTP Success Modal */}
        <Dialog open={showOtpModal} onOpenChange={setShowOtpModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center text-green-600">
                <Check className="w-6 h-6 mr-2" />
                Administrator Created Successfully!
              </DialogTitle>
              <DialogDescription>
                The administrator has been registered and a temporary password has been generated.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Admin Info */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Administrator Information</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Name:</span> {scoutData?.name}</p>
                  <p><span className="font-medium">Email:</span> {scoutData?.email}</p>
                  {scoutData?.xenId && <p><span className="font-medium">XEN ID:</span> {scoutData?.xenId}</p>}
                  <p><span className="font-medium">Role:</span> {scoutData?.role}</p>
                </div>
              </div>

              {/* OTP Display */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Temporary Password (OTP)</Label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 p-3 bg-muted rounded-lg border-2 border-dashed border-muted-foreground/25">
                    <code className="text-lg font-mono font-bold text-primary tracking-wider">
                      {otpDisplay}
                    </code>
                  </div>
                  <Button
                    onClick={copyOTP}
                    variant="outline"
                    size="sm"
                    className="px-3"
                  >
                    {otpCopied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Security Warning */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                      Important Security Notice
                    </p>
                    <ul className="text-amber-700 dark:text-amber-300 space-y-1">
                      <li>• Share this OTP securely with the administrator</li>
                      <li>• Administrator must reset password after first login</li>
                      <li>• This OTP can only be used once</li>
                      <li>• Store securely - it won't be shown again</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Notification Status */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Notification Status</h4>
                <div className="flex items-center space-x-2 text-sm">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>Welcome email sent to administrator</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={closeOTPModal}
                  className="flex-1"
                >
                  Create Another Admin
                </Button>
                <Button
                  onClick={() => setLocation("/system-admin")}
                  variant="outline"
                  className="flex-1"
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </div>
  );
}