import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Building2, Check, Plus } from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

const createSchoolSchema = z.object({
  name: z.string().min(1, "School name is required").max(200, "Name must be less than 200 characters"),
  address: z.string().optional().refine((val) => !val || val.length <= 500, "Address must be less than 500 characters"),
  contactEmail: z.string().email("Valid email is required").max(255, "Email must be less than 255 characters"),
  contactPhone: z.string().optional().refine((val) => !val || /^[\+]?[1-9][\d]{0,15}$/.test(val), "Invalid phone number format"),
});

type CreateSchoolFormData = z.infer<typeof createSchoolSchema>;

export default function CreateSchool() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdSchool, setCreatedSchool] = useState<any>(null);

  const form = useForm<CreateSchoolFormData>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: {
      name: "",
      address: "",
      contactEmail: "",
      contactPhone: "",
    },
  });

  const createSchoolMutation = useMutation({
    mutationFn: async (data: CreateSchoolFormData) => {
      console.log("🏫 Creating school with data:", data);
      
      const response = await fetch('/api/system-admin/create-school', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data),
      });

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const error = await response.json();
        console.log("❌ Error response:", error);
        throw new Error(error.error?.message || error.message || "Failed to create school");
      }

      const result = await response.json();
      console.log("✅ Success response:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("🎉 School created successfully:", data);
      setCreatedSchool(data.school);
      setShowSuccessModal(true);
      
      // Invalidate schools query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools"] });
      
      toast({
        title: "School Created Successfully! 🎉",
        description: `${data.school.name} has been registered in the system.`,
      });
    },
    onError: (error: any) => {
      console.log("💥 School creation error:", error);
      toast({
        title: "School Creation Failed",
        description: error.message || "Failed to create school. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: CreateSchoolFormData) => {
    createSchoolMutation.mutate(data);
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setLocation("/system-admin");
  };

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
                  <h1 className="text-xl font-semibold text-foreground">Create New School</h1>
                  <p className="text-sm text-muted-foreground">Register a new school in the LockerRoom platform</p>
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
                <Plus className="w-5 h-5 mr-2" />
                School Information
              </CardTitle>
              <CardDescription>
                Enter the school details to create a new institution account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* School Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">School Name *</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder="e.g., St. Mary's High School"
                    disabled={createSchoolMutation.isPending}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    {...form.register("address")}
                    placeholder="123 Main Street, City, State, ZIP Code"
                    rows={3}
                    disabled={createSchoolMutation.isPending}
                  />
                  {form.formState.errors.address && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.address.message}
                    </p>
                  )}
                </div>

                {/* Contact Email */}
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    {...form.register("contactEmail")}
                    placeholder="admin@school.edu"
                    disabled={createSchoolMutation.isPending}
                  />
                  {form.formState.errors.contactEmail && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.contactEmail.message}
                    </p>
                  )}
                </div>

                {/* Contact Phone */}
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    {...form.register("contactPhone")}
                    placeholder="+1-555-0123"
                    disabled={createSchoolMutation.isPending}
                  />
                  {form.formState.errors.contactPhone && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.contactPhone.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/system-admin")}
                    disabled={createSchoolMutation.isPending}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createSchoolMutation.isPending}
                    className="flex-1"
                  >
                    {createSchoolMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Creating School...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create School
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
                School Created Successfully!
              </DialogTitle>
              <DialogDescription>
                The school has been registered in the LockerRoom platform.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* School Info */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">School Information</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Name:</span> {createdSchool?.name}</p>
                  <p><span className="font-medium">ID:</span> <code className="text-xs bg-muted px-1 rounded">{createdSchool?.id}</code></p>
                  {createdSchool?.address && (
                    <p><span className="font-medium">Address:</span> {createdSchool.address}</p>
                  )}
                  <p><span className="font-medium">Contact Email:</span> {createdSchool?.contactEmail}</p>
                  {createdSchool?.contactPhone && (
                    <p><span className="font-medium">Contact Phone:</span> {createdSchool.contactPhone}</p>
                  )}
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Next Steps
                  </p>
                  <ul className="text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Create a School Admin account for this school</li>
                    <li>• School Admin can then add students</li>
                    <li>• Students will receive OTP for first login</li>
                  </ul>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={() => setLocation(`/system-admin/create-school-admin?schoolId=${createdSchool?.id}`)}
                  className="flex-1"
                >
                  Create School Admin
                </Button>
                <Button
                  onClick={closeSuccessModal}
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
