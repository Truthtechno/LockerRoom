import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2 } from "lucide-react";
import { 
  Building2, 
  DollarSign, 
  Calendar, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Users,
  UserPlus,
  Mail,
  Phone,
  Filter,
  Search,
  Ban,
  Trash2,
  Power
} from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const renewSubscriptionSchema = z.object({
  paymentAmount: z.string().min(1, "Payment amount is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Payment amount must be a positive number"),
  paymentFrequency: z.enum(["monthly", "annual"], {
    required_error: "Payment frequency is required",
  }),
});

type RenewSubscriptionFormData = z.infer<typeof renewSubscriptionSchema>;

interface School {
  id: string;
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  paymentAmount?: string | number | null;
  payment_amount?: string | number | null; // Database field name
  paymentFrequency?: "monthly" | "annual";
  payment_frequency?: "monthly" | "annual"; // Database field name
  subscriptionExpiresAt?: string;
  subscription_expires_at?: string; // Database field name
  isActive?: boolean;
  is_active?: boolean; // Database field name
  lastPaymentDate?: string;
  last_payment_date?: string; // Database field name
  createdAt: string;
  created_at?: string; // Database field name
  admin_count?: number;
  student_count?: number;
  post_count?: number;
}

export default function ManageSchools() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "expired" | "expiring">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const renewForm = useForm<RenewSubscriptionFormData>({
    resolver: zodResolver(renewSubscriptionSchema),
    defaultValues: {
      paymentAmount: "",
      paymentFrequency: "monthly",
    },
  });

  // Fetch schools
  const { data: schoolsData, isLoading } = useQuery<{ success: boolean; schools: School[] }>({
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

  // Normalize school data to handle both camelCase and snake_case from API
  const normalizeSchool = (school: any): School => {
    return {
      ...school,
      paymentAmount: school.paymentAmount || school.payment_amount || '0',
      paymentFrequency: school.paymentFrequency || school.payment_frequency || 'monthly',
      subscriptionExpiresAt: school.subscriptionExpiresAt || school.subscription_expires_at,
      isActive: school.isActive ?? school.is_active ?? true,
      lastPaymentDate: school.lastPaymentDate || school.last_payment_date,
      createdAt: school.createdAt || school.created_at || school.createdAt,
    };
  };

  // Filter and sort schools
  const filteredSchools = schoolsData?.schools?.map(normalizeSchool).filter((school) => {
    // Search filter
    if (searchQuery && !school.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Status filter
    if (filterStatus === "all") return true;
    
    const now = new Date();
    const expiresAt = school.subscriptionExpiresAt ? new Date(school.subscriptionExpiresAt) : null;
    const isActive = school.isActive ?? true;
    const frequency = school.paymentFrequency || 'monthly';
    
    if (filterStatus === "active") {
      return isActive && expiresAt && expiresAt > now;
    }
    
    if (filterStatus === "expired") {
      return !isActive || (expiresAt && expiresAt <= now);
    }
    
    if (filterStatus === "expiring") {
      if (!expiresAt || expiresAt <= now) return false;
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return isActive && (frequency === "monthly" ? daysUntilExpiry <= 7 : daysUntilExpiry <= 30);
    }
    
    return true;
  }) || [];

  const renewMutation = useMutation({
    mutationFn: async (data: RenewSubscriptionFormData) => {
      if (!selectedSchool) throw new Error("No school selected");
      
      const response = await fetch(`/api/system-admin/schools/${selectedSchool.id}/renew`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || "Failed to renew subscription");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscription Renewed! 🎉",
        description: `${selectedSchool?.name}'s subscription has been renewed successfully.`,
      });
      setShowRenewModal(false);
      renewForm.reset();
      setSelectedSchool(null);
      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools"] });
    },
    onError: (error: any) => {
      toast({
        title: "Renewal Failed",
        description: error.message || "Failed to renew subscription. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleRenewClick = (school: School) => {
    setSelectedSchool(school);
    const paymentAmount = school.paymentAmount || school.payment_amount || "";
    const paymentFrequency = school.paymentFrequency || school.payment_frequency || "monthly";
    renewForm.setValue("paymentAmount", String(paymentAmount || ""));
    renewForm.setValue("paymentFrequency", paymentFrequency as "monthly" | "annual");
    setShowRenewModal(true);
  };

  const getSubscriptionStatus = (school: School) => {
    const expiresAt = school.subscriptionExpiresAt;
    const isActive = school.isActive ?? true;
    const frequency = school.paymentFrequency || 'monthly';
    
    if (!expiresAt) {
      return { label: "No Expiry", variant: "secondary" as const };
    }

    const now = new Date();
    const expiryDate = new Date(expiresAt);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (!isActive || expiryDate <= now) {
      return { label: "Expired", variant: "destructive" as const };
    }

    const warningThreshold = frequency === "monthly" ? 7 : 30;
    
    if (daysUntilExpiry <= warningThreshold) {
      return { label: `Expiring in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`, variant: "default" as const };
    }

    return { label: "Active", variant: "default" as const };
  };

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (amount === null || amount === undefined || amount === '') {
      return '$0.00';
    }
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num) || !isFinite(num)) {
      return '$0.00';
    }
    return `$${num.toFixed(2)}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleDisableSchool = async (schoolId: string, schoolName: string) => {
    setActionLoading(schoolId);
    try {
      const response = await fetch(`/api/system-admin/schools/${schoolId}/disable`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to disable school');
      }

      const result = await response.json();
      
      toast({
        title: "School Disabled",
        description: result.message || `"${schoolName}" has been disabled. School admins and students will see a deactivated message when logging in.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools"] });
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disable school",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnableSchool = async (schoolId: string, schoolName: string) => {
    setActionLoading(schoolId);
    try {
      const response = await fetch(`/api/system-admin/schools/${schoolId}/enable`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to enable school');
      }

      const result = await response.json();
      
      toast({
        title: "School Enabled",
        description: result.message || `"${schoolName}" has been enabled. School admins and students can now log in again.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools"] });
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to enable school",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    setActionLoading(schoolId);
    try {
      const response = await fetch(`/api/system-admin/schools/${schoolId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to delete school');
      }

      const result = await response.json();
      
      toast({
        title: "School Deleted",
        description: result.message || `"${schoolName}" has been permanently deleted.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools"] });
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete school",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
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
              <div>
                <h1 className="text-xl font-semibold text-foreground">Manage Schools</h1>
                <p className="text-sm text-muted-foreground">Manage school subscriptions and payments</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filters and Search */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search schools by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Schools</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expiring">Expiring Soon</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schools Table */}
          <Card>
            <CardHeader>
              <CardTitle>Schools ({filteredSchools.length})</CardTitle>
              <CardDescription>
                Manage subscriptions, view payment history, and monitor school status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading schools...</div>
              ) : filteredSchools.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No schools found matching your criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>School Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Last Payment</TableHead>
                        <TableHead>Stats</TableHead>
                        <TableHead className="w-[200px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSchools.map((school) => {
                        const status = getSubscriptionStatus(school);
                        return (
                          <TableRow key={school.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{school.name}</div>
                                {school.contactEmail && (
                                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {school.contactEmail}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant}>
                                {(school.isActive ?? true) ? (
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                ) : (
                                  <XCircle className="w-3 h-3 mr-1" />
                                )}
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(school.paymentAmount || school.payment_amount || 0)}
                            </TableCell>
                            <TableCell className="capitalize">
                              {school.paymentFrequency || school.payment_frequency || 'monthly'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                {formatDate(school.subscriptionExpiresAt || school.subscription_expires_at)}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(school.lastPaymentDate || school.last_payment_date)}</TableCell>
                            <TableCell>
                              <div className="text-sm space-y-1">
                                <div className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {school.student_count || 0} students
                                </div>
                                <div className="flex items-center gap-1">
                                  <UserPlus className="w-3 h-3" />
                                  {school.admin_count || 0} admins
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleRenewClick(school)}
                                  variant="outline"
                                >
                                  <RefreshCw className="w-4 h-4 mr-1" />
                                  Renew
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      disabled={actionLoading === school.id}
                                    >
                                      {actionLoading === school.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        "..."
                                      )}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {school.isActive ?? true ? (
                                      <DropdownMenuItem
                                        onClick={() => handleDisableSchool(school.id, school.name)}
                                        className="text-yellow-600 focus:text-yellow-600"
                                      >
                                        <Ban className="w-4 h-4 mr-2" />
                                        Disable School
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() => handleEnableSchool(school.id, school.name)}
                                        className="text-green-600 focus:text-green-600"
                                      >
                                        <Power className="w-4 h-4 mr-2" />
                                        Enable School
                                      </DropdownMenuItem>
                                    )}
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem
                                          onSelect={(e) => e.preventDefault()}
                                          className="text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Delete School
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="flex items-center">
                                            <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                                            Delete School Permanently
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete:
                                            <ul className="mt-2 ml-4 list-disc">
                                              <li>School "{school.name}"</li>
                                              <li>All school admin accounts</li>
                                              <li>All student accounts</li>
                                              <li>All posts and content</li>
                                            </ul>
                                            <p className="mt-2 font-medium">If matters are resolved, the school accounts will have to be created from scratch again.</p>
                                            <p className="mt-2">Are you absolutely sure you want to proceed?</p>
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteSchool(school.id, school.name)}
                                            className="bg-red-600 hover:bg-red-700"
                                          >
                                            Delete Permanently
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Renew Subscription Modal */}
        <Dialog open={showRenewModal} onOpenChange={setShowRenewModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Renew Subscription</DialogTitle>
              <DialogDescription>
                Renew subscription for {selectedSchool?.name}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={renewForm.handleSubmit((data) => renewMutation.mutate(data))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount ($) *</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  {...renewForm.register("paymentAmount")}
                  placeholder="0.00"
                  disabled={renewMutation.isPending}
                />
                {renewForm.formState.errors.paymentAmount && (
                  <p className="text-sm text-destructive">
                    {renewForm.formState.errors.paymentAmount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentFrequency">Payment Frequency *</Label>
                <Select
                  value={renewForm.watch("paymentFrequency")}
                  onValueChange={(value) => renewForm.setValue("paymentFrequency", value as "monthly" | "annual")}
                  disabled={renewMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
                {renewForm.formState.errors.paymentFrequency && (
                  <p className="text-sm text-destructive">
                    {renewForm.formState.errors.paymentFrequency.message}
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowRenewModal(false);
                    renewForm.reset();
                  }}
                  disabled={renewMutation.isPending}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={renewMutation.isPending}
                  className="flex-1"
                >
                  {renewMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Renewing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Renew Subscription
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

