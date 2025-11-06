import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Copy, Check, Mail, Phone, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

const addStudentFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().email("Valid email is required").max(255, "Email must be less than 255 characters"),
  phone: z.string().optional().refine((val) => !val || /^[\+]?[1-9][\d]{0,15}$/.test(val), "Invalid phone number format"),
});

type AddStudentFormData = z.infer<typeof addStudentFormSchema>;

export default function AddStudent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [otpDisplay, setOtpDisplay] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCopied, setOtpCopied] = useState(false);
  const [studentData, setStudentData] = useState<any>(null);

  // Fetch enrollment status
  const { data: enrollmentStatus } = useQuery({
    queryKey: ["/api/school-admin/enrollment-status"],
    queryFn: async () => {
      const response = await fetch('/api/school-admin/enrollment-status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch enrollment status');
      return response.json();
    },
    enabled: !!user?.schoolId,
  });

  const form = useForm<AddStudentFormData>({
    resolver: zodResolver(addStudentFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
    },
  });

  const addStudentMutation = useMutation({
    mutationFn: async (data: AddStudentFormData) => {
      console.log("🚀 Creating student with data:", data);
      
      // Get schoolId from user object or localStorage as fallback
      const schoolId = user?.schoolId || localStorage.getItem('schoolId');
      
      // Log warning if schoolId is missing
      if (!schoolId) {
        console.warn("⚠️ School ID missing from both user object and localStorage");
        console.warn("📝 User object:", user);
        console.warn("📝 LocalStorage schoolId:", localStorage.getItem('schoolId'));
        throw new Error("You are not linked to a school. Please log out and log back in with a valid school admin account.");
      }
      
      console.log("🏫 Using schoolId:", schoolId);
      
      // Create FormData to handle file upload
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('email', data.email);
      formData.append('phone', data.phone || '');
      formData.append('schoolId', schoolId);
      
      const response = await fetch('/api/school-admin/add-student', {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData,
      });

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const error = await response.json();
        console.log("❌ Error response:", error);
        
        // Check if it's a schoolId related error
        if (error.error?.message?.includes("School ID")) {
          throw new Error("You are not linked to a school. Please log out and log back in with a valid school admin account.");
        }
        
        throw new Error(error.error?.message || error.message || "Failed to create student");
      }

      const result = await response.json();
      console.log("✅ Success response:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("🎉 Student creation success:", data);
      
      // Invalidate all school admin dashboard queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "top-performers"] });
      
        // Show OTP modal if OTP was generated
        if (data?.oneTimePassword) {
          setOtpDisplay(data.oneTimePassword);
          setStudentData(data.student);
          setShowOtpModal(true);
        }
      
      // Show success message
      toast({
        title: "Player Added Successfully! 🎉",
        description: data.message || "Player has been successfully registered. Please share the OTP securely.",
      });
    },
    onError: (error: any) => {
      console.log("💥 Student creation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add player.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddStudentFormData) => {
    // Check enrollment limit before submitting
    if (enrollmentStatus?.enrollmentStatus && !enrollmentStatus.enrollmentStatus.canEnroll) {
      toast({
        title: "Enrollment Limit Reached",
        description: enrollmentStatus.enrollmentStatus.warningLevel === 'at_limit' 
          ? `You've reached your student limit (${enrollmentStatus.enrollmentStatus.currentCount}/${enrollmentStatus.enrollmentStatus.maxStudents}). Please contact system admin to increase capacity.`
          : "Cannot enroll new students at this time.",
        variant: "destructive",
      });
      return;
    }
    addStudentMutation.mutate(data);
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
    setStudentData(null);
    setOtpCopied(false);
    form.reset(); // Reset form for next student
  };


  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
          {/* Mobile Back Button and Title */}
          <div className="bg-card border-b border-border px-4 py-4 space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/school-admin")}
              className="w-full justify-start -ml-2"
              data-testid="back-to-admin"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Add New Student</h1>
              <p className="text-sm text-muted-foreground">Register a new student in your school</p>
            </div>
          </div>
        </div>
        
        {/* Desktop Header */}
        <div className="hidden lg:block bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Add New Student</h1>
                <p className="text-sm text-muted-foreground">Register a new student in your school</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              Player Registration
            </CardTitle>
            <CardDescription>
              Fill in the player's information below. Fields marked with * are required.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {/* Enrollment Status Alert */}
            {enrollmentStatus?.enrollmentStatus && (
              <div className={`mb-6 p-4 rounded-lg border ${
                enrollmentStatus.enrollmentStatus.warningLevel === 'at_limit'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : enrollmentStatus.enrollmentStatus.warningLevel === 'approaching'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                    enrollmentStatus.enrollmentStatus.warningLevel === 'at_limit'
                      ? 'text-red-600 dark:text-red-400'
                      : enrollmentStatus.enrollmentStatus.warningLevel === 'approaching'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`} />
                  <div className="flex-1">
                    <p className={`font-medium ${
                      enrollmentStatus.enrollmentStatus.warningLevel === 'at_limit'
                        ? 'text-red-800 dark:text-red-200'
                        : enrollmentStatus.enrollmentStatus.warningLevel === 'approaching'
                        ? 'text-yellow-800 dark:text-yellow-200'
                        : 'text-blue-800 dark:text-blue-200'
                    }`}>
                      {enrollmentStatus.enrollmentStatus.warningLevel === 'at_limit'
                        ? 'Enrollment Limit Reached'
                        : enrollmentStatus.enrollmentStatus.warningLevel === 'approaching'
                        ? 'Approaching Enrollment Limit'
                        : 'Enrollment Status'}
                    </p>
                    <p className={`text-sm mt-1 ${
                      enrollmentStatus.enrollmentStatus.warningLevel === 'at_limit'
                        ? 'text-red-700 dark:text-red-300'
                        : enrollmentStatus.enrollmentStatus.warningLevel === 'approaching'
                        ? 'text-yellow-700 dark:text-yellow-300'
                        : 'text-blue-700 dark:text-blue-300'
                    }`}>
                      {enrollmentStatus.enrollmentStatus.warningLevel === 'at_limit'
                        ? `You've reached your student limit (${enrollmentStatus.enrollmentStatus.currentCount}/${enrollmentStatus.enrollmentStatus.maxStudents}). Cannot enroll new students. Please contact system admin to increase capacity.`
                        : enrollmentStatus.enrollmentStatus.warningLevel === 'approaching'
                        ? `You're approaching your student limit (${enrollmentStatus.enrollmentStatus.currentCount}/${enrollmentStatus.enrollmentStatus.maxStudents}). ${enrollmentStatus.enrollmentStatus.availableSlots} slot(s) remaining.`
                        : `Current enrollment: ${enrollmentStatus.enrollmentStatus.currentCount}/${enrollmentStatus.enrollmentStatus.maxStudents} students (${enrollmentStatus.enrollmentStatus.availableSlots} slots available)`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
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
                    control={form.control}
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
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>




                {/* Submit Button */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/school-admin")}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addStudentMutation.isPending || (enrollmentStatus?.enrollmentStatus && !enrollmentStatus.enrollmentStatus.canEnroll)}
                    className="gold-gradient text-accent-foreground min-w-32"
                    data-testid="button-submit"
                  >
                    {addStudentMutation.isPending ? (
                      "Adding..."
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Add Student
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Professional OTP Success Modal */}
      <Dialog open={showOtpModal} onOpenChange={setShowOtpModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-green-600">
              <Check className="w-6 h-6 mr-2" />
              Student Created Successfully!
            </DialogTitle>
            <DialogDescription>
              The student has been registered and a temporary password has been generated.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Student Info */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Student Information</h4>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Name:</span> {studentData?.name}</p>
                <p><span className="font-medium">Email:</span> {studentData?.email}</p>
                {studentData?.phone && (
                  <p><span className="font-medium">Phone:</span> {studentData?.phone}</p>
                )}
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
                    <li>• Share this OTP securely with the student</li>
                    <li>• Student must reset password after first login</li>
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
                <span>Welcome email sent to student</span>
              </div>
              {studentData?.phone && (
                <div className="flex items-center space-x-2 text-sm">
                  <Phone className="w-4 h-4 text-green-600" />
                  <span>SMS sent to {studentData.phone}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <Button
                onClick={closeOTPModal}
                className="flex-1"
              >
                Add Another Student
              </Button>
              <Button
                onClick={() => setLocation("/school-admin")}
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
  );
}