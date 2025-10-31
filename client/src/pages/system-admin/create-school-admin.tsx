import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { UserPlus, Check, Building2, Copy, AlertTriangle } from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

const createSchoolAdminSchema = z.object({
  schoolId: z.string().min(1, "School is required"),
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().email("Valid email is required").max(255, "Email must be less than 255 characters"),
});

type CreateSchoolAdminFormData = z.infer<typeof createSchoolAdminSchema>;

export default function CreateSchoolAdmin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdAdmin, setCreatedAdmin] = useState<any>(null);
  const [otpDisplay, setOtpDisplay] = useState<string>("");
  const [otpCopied, setOtpCopied] = useState(false);

  // Get schoolId from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const schoolIdFromUrl = urlParams.get('schoolId');

  const form = useForm<CreateSchoolAdminFormData>({
    resolver: zodResolver(createSchoolAdminSchema),
    defaultValues: {
      schoolId: schoolIdFromUrl || "",
      name: "",
      email: "",
    },
  });

  // Fetch schools for dropdown
  const { data: schoolsData, isLoading: schoolsLoading } = useQuery({
    queryKey: ["/api/system-admin/schools"],
    queryFn: async () => {
      const response = await fetch('/api/system-admin/schools', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch schools');
      return response.json();
    },
  });

  // Set schoolId from URL if available
  useEffect(() => {
    if (schoolIdFromUrl) {
      form.setValue('schoolId', schoolIdFromUrl);
    }
  }, [schoolIdFromUrl, form]);

  const createSchoolAdminMutation = useMutation({
    mutationFn: async (data: CreateSchoolAdminFormData) => {
      console.log("👨‍💼 Creating school admin with data:", data);
      // Only send schoolId, name, and email in the payload
      const { schoolId, name, email } = data;
      const response = await fetch('/api/system-admin/create-school-admin', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ schoolId, name, email }),
      });

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const error = await response.json();
        console.log("❌ Error response:", error);
        throw new Error(error.error?.message || error.message || "Failed to create school admin");
      }

      const result = await response.json();
      console.log("✅ Success response:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("🎉 School admin created successfully:", data);
      setCreatedAdmin(data.schoolAdmin);
      setOtpDisplay(data.otp);
      setShowSuccessModal(true);
      
      toast({
        title: "School Admin Created Successfully! 🎉",
        description: `${data.schoolAdmin.name} can now manage ${data.schoolAdmin.schoolName}.`,
      });
    },
    onError: (error: any) => {
      console.log("💥 School admin creation error:", error);
      toast({
        title: "School Admin Creation Failed",
        description: error.message || "Failed to create school admin. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: CreateSchoolAdminFormData) => {
    createSchoolAdminMutation.mutate(data);
  };

  const copyOTP = async () => {
    try {
      await navigator.clipboard.writeText(otpDisplay);
      setOtpCopied(true);
      toast({
        title: "OTP Copied!",
        description: "Temporary password copied to clipboard.",
      });
      setTimeout(() => setOtpCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy OTP:', error);
      toast({
        title: "Copy Failed",
        description: "Could not copy OTP to clipboard.",
        variant: "destructive",
      });
    }
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setLocation("/system-admin");
  };

  const selectedSchool = schoolsData?.schools?.find((school: any) => school.id === form.watch('schoolId'));

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
              <div className="flex items-center">
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Create School Admin</h1>
                  <p className="text-sm text-muted-foreground">Create an administrator account for a school</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-full lg:max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserPlus className="w-5 h-5 mr-2" />
                School Admin Information
              </CardTitle>
              <CardDescription>
                Create a new administrator account for school management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* School Selection */}
                <div className="space-y-2">
                  <Label htmlFor="schoolId">School *</Label>
                  <Select
                    value={form.watch('schoolId')}
                    onValueChange={(value) => form.setValue('schoolId', value)}
                    disabled={createSchoolAdminMutation.isPending || schoolsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolsData?.schools?.map((school: any) => (
                        <SelectItem key={school.id} value={school.id}>
                          <div className="flex items-center space-x-2">
                            <Building2 className="w-4 h-4" />
                            <span>{school.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.schoolId && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.schoolId.message}
                    </p>
                  )}
                  {selectedSchool && (
                    <div className="text-sm text-muted-foreground">
                      <p><strong>Selected School:</strong> {selectedSchool.name}</p>
                      {selectedSchool.address && (
                        <p><strong>Address:</strong> {selectedSchool.address}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Admin Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Admin Name *</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder="e.g., Principal John Smith"
                    disabled={createSchoolAdminMutation.isPending}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    placeholder="principal@school.edu"
                    disabled={createSchoolAdminMutation.isPending}
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {/*
                Password
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    {...form.register("password")}
                    placeholder="Enter a secure password"
                    disabled={createSchoolAdminMutation.isPending}
                  />
                  {form.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters long
                  </p>
                </div>
                */}

                {/* Submit Button */}
                <div className="flex space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/system-admin")}
                    disabled={createSchoolAdminMutation.isPending}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createSchoolAdminMutation.isPending || !form.watch('schoolId')}
                    className="flex-1"
                  >
                    {createSchoolAdminMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Creating Admin...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Create School Admin
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center text-green-600">
                <Check className="w-6 h-6 mr-2" />
                School Admin Created Successfully!
              </DialogTitle>
              <DialogDescription>
                The school administrator account has been created and is ready to use.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Admin Info */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Admin Information</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Name:</span> {createdAdmin?.name}</p>
                  <p><span className="font-medium">Email:</span> {createdAdmin?.email}</p>
                  <p><span className="font-medium">School:</span> {createdAdmin?.schoolName}</p>
                  <p><span className="font-medium">Position:</span> {createdAdmin?.position}</p>
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
                      <li>• Share this OTP securely with the school admin</li>
                      <li>• Admin must reset password after first login</li>
                      <li>• This OTP can only be used once</li>
                      <li>• Store securely - it won't be shown again</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Next Steps
                  </p>
                  <ul className="text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• School admin can now log in with their credentials</li>
                    <li>• They can add students to their school</li>
                    <li>• Students will receive OTP for first login</li>
                  </ul>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={() => setLocation("/system-admin")}
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
