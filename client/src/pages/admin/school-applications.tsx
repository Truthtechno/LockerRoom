import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, Building2, Calendar, MapPin, Users, Check, X, Plus } from "lucide-react";
import { useLocation } from "wouter";

type SchoolApplication = {
  id: string;
  schoolName: string;
  contactEmail: string;
  contactName: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  expectedStudents?: number;
  planType: string;
  status: string;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
};

const addSchoolFormSchema = z.object({
  schoolName: z.string().min(1, "School name is required"),
  contactEmail: z.string().email("Valid email is required"),
  contactName: z.string().min(1, "Contact name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  expectedStudents: z.number().min(1).max(10000).default(100),
  planType: z.enum(["standard", "premium"]).default("standard"),
});

type AddSchoolFormData = z.infer<typeof addSchoolFormSchema>;

export default function SchoolApplications() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectNotes, setRejectNotes] = useState("");
  const [showAddSchool, setShowAddSchool] = useState(false);

  const addSchoolForm = useForm<AddSchoolFormData>({
    resolver: zodResolver(addSchoolFormSchema),
    defaultValues: {
      expectedStudents: 100,
      planType: "standard",
    },
  });

  const { data: applications, isLoading } = useQuery<SchoolApplication[]>({
    queryKey: ["/api/admin/school-applications"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/school-applications/${id}/approve`, {
        method: "POST",
        body: { reviewerId: user?.id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/school-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system/stats"] });
      toast({
        title: "Application Approved",
        description: "School application has been approved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve application.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return apiRequest(`/api/admin/school-applications/${id}/reject`, {
        method: "POST",
        body: { reviewerId: user?.id, notes },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/school-applications"] });
      setRejectNotes("");
      toast({
        title: "Application Rejected",
        description: "School application has been rejected.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject application.",
        variant: "destructive",
      });
    },
  });

  const addSchoolMutation = useMutation({
    mutationFn: async (data: AddSchoolFormData) => {
      return apiRequest("/api/admin/school-applications", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/school-applications"] });
      addSchoolForm.reset();
      setShowAddSchool(false);
      toast({
        title: "School Application Created",
        description: "New school application has been submitted for review.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create school application.",
        variant: "destructive",
      });
    },
  });

  const onAddSchool = (data: AddSchoolFormData) => {
    addSchoolMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
                <h1 className="text-xl font-semibold text-foreground">School Applications</h1>
                <p className="text-sm text-muted-foreground">Review and manage school registration requests</p>
              </div>
            </div>
            
            <Dialog open={showAddSchool} onOpenChange={setShowAddSchool}>
              <DialogTrigger asChild>
                <Button className="gold-gradient text-accent-foreground" data-testid="button-add-school">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New School
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add New School</DialogTitle>
                  <DialogDescription>
                    Create a new school application that will be reviewed and approved.
                  </DialogDescription>
                </DialogHeader>
                <Form {...addSchoolForm}>
                  <form onSubmit={addSchoolForm.handleSubmit(onAddSchool)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addSchoolForm.control}
                        name="schoolName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>School Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Elite Soccer Academy" {...field} data-testid="input-school-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={addSchoolForm.control}
                        name="contactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Smith" {...field} data-testid="input-contact-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addSchoolForm.control}
                        name="contactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="admin@school.edu" {...field} data-testid="input-contact-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={addSchoolForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="(555) 123-4567" {...field} data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addSchoolForm.control}
                        name="expectedStudents"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expected Students</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="100"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                data-testid="input-expected-students"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={addSchoolForm.control}
                        name="planType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plan Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-plan-type">
                                  <SelectValue placeholder="Select plan" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="standard">Standard ($75/month)</SelectItem>
                                <SelectItem value="premium">Premium ($150/month)</SelectItem>
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
                        disabled={addSchoolMutation.isPending}
                        data-testid="button-submit-school"
                      >
                        {addSchoolMutation.isPending ? "Creating..." : "Create School Application"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Applications List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {applications && applications.length > 0 ? (
          <div className="space-y-6">
            {applications.map((application) => (
              <Card key={application.id} className="overflow-hidden" data-testid={`application-${application.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{application.schoolName}</CardTitle>
                        <CardDescription>{application.contactName} • {application.contactEmail}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(application.status)}
                      <Badge variant="outline">{application.planType}</Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Users className="w-4 h-4 mr-2" />
                        {application.expectedStudents || 'N/A'} Expected Students
                      </div>
                      {application.phone && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 mr-2" />
                          {application.phone}
                        </div>
                      )}
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-2" />
                        Applied {new Date(application.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {application.notes && (
                      <div className="md:col-span-2">
                        <h4 className="font-medium text-sm mb-2">Review Notes</h4>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                          {application.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {application.status === "pending" && (
                    <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-border">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`button-reject-${application.id}`}>
                            <X className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reject Application</DialogTitle>
                            <DialogDescription>
                              Please provide a reason for rejecting {application.schoolName}'s application.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="reject-notes">Rejection Notes</Label>
                              <Textarea
                                id="reject-notes"
                                value={rejectNotes}
                                onChange={(e) => setRejectNotes(e.target.value)}
                                placeholder="Please explain why this application is being rejected..."
                                className="mt-1"
                                data-testid="textarea-reject-notes"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => rejectMutation.mutate({ id: application.id, notes: rejectNotes })}
                              disabled={rejectMutation.isPending}
                              variant="destructive"
                              data-testid="button-confirm-reject"
                            >
                              {rejectMutation.isPending ? "Rejecting..." : "Reject Application"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button
                        onClick={() => approveMutation.mutate(application.id)}
                        disabled={approveMutation.isPending}
                        className="gold-gradient text-accent-foreground"
                        size="sm"
                        data-testid={`button-approve-${application.id}`}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {approveMutation.isPending ? "Approving..." : "Approve"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No School Applications</h3>
            <p className="text-muted-foreground mb-6">
              There are currently no school applications to review.
            </p>
            <Button 
              onClick={() => setShowAddSchool(true)}
              className="gold-gradient text-accent-foreground"
              data-testid="button-add-first-school"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New School
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}