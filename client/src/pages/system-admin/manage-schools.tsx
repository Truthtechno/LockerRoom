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
  Power,
  Eye,
  Edit,
  CreditCard,
  MoreHorizontal,
  Download
} from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

const renewSubscriptionSchema = z.object({
  renewalDate: z.string().optional(),
});

const updateSchoolSchema = z.object({
  name: z.string().min(1, "School name is required").max(200),
  address: z.string().optional(),
  contactEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});

const recordPaymentSchema = z.object({
  paymentAmount: z.string().min(1, "Payment amount is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Payment amount must be a positive number"),
  paymentFrequency: z.enum(["monthly", "annual", "one-time"], {
    required_error: "Payment frequency is required",
  }),
  paymentType: z.enum(["initial", "renewal", "student_limit_increase", "student_limit_decrease", "frequency_change"], {
    required_error: "Payment type is required",
  }),
  studentLimitBefore: z.string().optional(),
  studentLimitAfter: z.string().optional(),
  oldFrequency: z.string().optional(),
  newFrequency: z.string().optional(),
  notes: z.string().optional(),
});

type RenewSubscriptionFormData = z.infer<typeof renewSubscriptionSchema>;
type UpdateSchoolFormData = z.infer<typeof updateSchoolSchema>;
type RecordPaymentFormData = z.infer<typeof recordPaymentSchema>;

interface School {
  id: string;
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  paymentAmount?: string | number | null;
  payment_amount?: string | number | null; // Database field name
  paymentFrequency?: "monthly" | "annual" | "one-time";
  payment_frequency?: "monthly" | "annual" | "one-time"; // Database field name
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "expired" | "expiring">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeDetailsTab, setActiveDetailsTab] = useState<"info" | "admins" | "students">("info");
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [paymentSearchQuery, setPaymentSearchQuery] = useState("");
  const [paymentFilterType, setPaymentFilterType] = useState<string>("all");
  const [paymentFilterFrequency, setPaymentFilterFrequency] = useState<string>("all");
  const [paymentSortBy, setPaymentSortBy] = useState<"date" | "amount" | "type">("date");
  const [paymentSortOrder, setPaymentSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch school details when modal opens
  const { data: schoolDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["/api/system-admin/schools", selectedSchool?.id],
    queryFn: async () => {
      if (!selectedSchool?.id) return null;
      const response = await fetch(`/api/system-admin/schools/${selectedSchool.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch school details');
      return response.json();
    },
    enabled: showDetailsModal && !!selectedSchool?.id,
  });

  // Fetch school admins
  const { data: adminsData, isLoading: adminsLoading } = useQuery({
    queryKey: ["/api/system-admin/schools", selectedSchool?.id, "admins"],
    queryFn: async () => {
      if (!selectedSchool?.id) return null;
      const response = await fetch(`/api/system-admin/schools/${selectedSchool.id}/admins`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch admins');
      return response.json();
    },
    enabled: showDetailsModal && !!selectedSchool?.id && activeDetailsTab === "admins",
  });

  // Fetch school students
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ["/api/system-admin/schools", selectedSchool?.id, "students", studentSearchQuery],
    queryFn: async () => {
      if (!selectedSchool?.id) return null;
      const url = `/api/system-admin/schools/${selectedSchool.id}/students${studentSearchQuery ? `?search=${encodeURIComponent(studentSearchQuery)}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch students');
      const data = await response.json();
      // Debug: Log student data to see what's actually returned
      if (data.students && data.students.length > 0) {
        const firstStudent = data.students[0];
        console.log('📊 Frontend received student data:', firstStudent);
        console.log('📊 First student roleNumber:', firstStudent.roleNumber);
        console.log('📊 First student role_number:', firstStudent.role_number);
        console.log('📊 First student keys:', Object.keys(firstStudent));
        console.log('📊 All student data:', JSON.stringify(data.students, null, 2));
      }
      return data;
    },
    enabled: showDetailsModal && !!selectedSchool?.id && activeDetailsTab === "students",
  });

  // Fetch payment history
  const { data: paymentHistoryData, isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/system-admin/schools", selectedSchool?.id, "payments"],
    queryFn: async () => {
      if (!selectedSchool?.id) return null;
      const response = await fetch(`/api/system-admin/schools/${selectedSchool.id}/payments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch payment history');
      return response.json();
    },
    enabled: showPaymentsModal && !!selectedSchool?.id,
  });

  const renewForm = useForm<RenewSubscriptionFormData>({
    resolver: zodResolver(renewSubscriptionSchema),
    defaultValues: {
      renewalDate: new Date().toISOString().split('T')[0],
    },
  });

  const updateForm = useForm<UpdateSchoolFormData>({
    resolver: zodResolver(updateSchoolSchema),
  });

  const paymentForm = useForm<RecordPaymentFormData>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      paymentType: "renewal",
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
        body: JSON.stringify({
          renewalDate: data.renewalDate ? new Date(data.renewalDate).toISOString() : undefined,
        }),
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

  // Update school mutation
  const updateSchoolMutation = useMutation({
    mutationFn: async (data: UpdateSchoolFormData) => {
      if (!selectedSchool) throw new Error("No school selected");
      
      const response = await fetch(`/api/system-admin/schools/${selectedSchool.id}`, {
        method: "PUT",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || "Failed to update school");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "School Updated! 🎉",
        description: `${selectedSchool?.name} has been updated successfully.`,
      });
      setShowUpdateModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools", selectedSchool?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update school. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: RecordPaymentFormData) => {
      if (!selectedSchool) throw new Error("No school selected");
      
      const response = await fetch(`/api/system-admin/schools/${selectedSchool.id}/payments`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || "Failed to record payment");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment Recorded! 🎉",
        description: "Payment has been recorded successfully.",
      });
      paymentForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools", selectedSchool?.id, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools"] });
    },
    onError: (error: any) => {
      toast({
        title: "Payment Recording Failed",
        description: error.message || "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleRenewClick = (school: School) => {
    setSelectedSchool(school);
    renewForm.setValue("renewalDate", new Date().toISOString().split('T')[0]);
    setShowRenewModal(true);
  };

  const handleViewDetails = (school: School) => {
    setSelectedSchool(school);
    setActiveDetailsTab("info");
    setShowDetailsModal(true);
  };

  const handleUpdateSchool = (school: School) => {
    setSelectedSchool(school);
    updateForm.reset({
      name: school.name,
      address: school.address || "",
      contactEmail: school.contactEmail || "",
      contactPhone: school.contactPhone || "",
    });
    setShowUpdateModal(true);
  };

  const handlePayments = (school: School) => {
    setSelectedSchool(school);
    paymentForm.reset({
      paymentAmount: String(school.paymentAmount || school.payment_amount || ""),
      paymentFrequency: (school.paymentFrequency || school.payment_frequency || "monthly") as "monthly" | "annual" | "one-time",
      paymentType: "renewal",
    });
    setShowPaymentsModal(true);
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

  const formatPaymentFrequency = (frequency?: string) => {
    if (!frequency) return 'Monthly';
    if (frequency === 'one-time') return 'One-Time';
    return frequency.charAt(0).toUpperCase() + frequency.slice(1);
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
                                        <MoreHorizontal className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => handleViewDetails(school)}
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      View School Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleUpdateSchool(school)}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Update School Information
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handlePayments(school)}
                                    >
                                      <CreditCard className="w-4 h-4 mr-2" />
                                      School Payments
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleRenewClick(school)}
                                    >
                                      <RefreshCw className="w-4 h-4 mr-2" />
                                      Renew Subscription
                                    </DropdownMenuItem>
                                    <div className="border-t my-1" />
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
          <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-lg sm:text-xl">Renew Subscription</DialogTitle>
              <DialogDescription className="text-sm">
                Renew subscription for <span className="truncate">{selectedSchool?.name}</span>
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Current Subscription</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Frequency:</span>
                    <p className="font-medium">
                      {formatPaymentFrequency(selectedSchool?.paymentFrequency || selectedSchool?.payment_frequency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount:</span>
                    <p className="font-medium">
                      {formatCurrency(selectedSchool?.paymentAmount || selectedSchool?.payment_amount || 0)}
                    </p>
                  </div>
                </div>
                  {(() => {
                    const frequency = selectedSchool?.paymentFrequency || selectedSchool?.payment_frequency || 'monthly';
                    if (frequency === 'one-time') {
                      return (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-2">
                          <p className="text-xs text-blue-800 dark:text-blue-200">
                            <strong>Note:</strong> This is a one-time payment subscription. One-time payments do not expire and cannot be renewed.
                            To record additional one-time payments, use "School Payments" instead.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <p className="text-xs text-muted-foreground mt-2">
                        Note: Renewal will restart the subscription timer from the renewal date using the current payment frequency.
                        To record a payment or change frequency, use "School Payments" instead.
                      </p>
                    );
                  })()}
                </div>
              
                {(() => {
                  const frequency = selectedSchool?.paymentFrequency || selectedSchool?.payment_frequency || 'monthly';
                  const isOneTime = frequency === 'one-time';
                  
                  if (isOneTime) {
                    return (
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground text-center">
                          One-time payment subscriptions cannot be renewed.
                        </p>
                      </div>
                    );
                  }
                  
                  return (
                    <form onSubmit={renewForm.handleSubmit((data) => renewMutation.mutate(data))} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="renewalDate">Renewal Date</Label>
                        <Input
                          id="renewalDate"
                          type="date"
                          {...renewForm.register("renewalDate")}
                          disabled={renewMutation.isPending}
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty to renew from today. Subscription will expire based on current payment frequency.
                        </p>
                        {renewForm.formState.errors.renewalDate && (
                          <p className="text-sm text-destructive">
                            {renewForm.formState.errors.renewalDate.message}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4 pb-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowRenewModal(false);
                            renewForm.reset();
                          }}
                          disabled={renewMutation.isPending}
                          className="w-full sm:flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={renewMutation.isPending}
                          className="w-full sm:flex-1"
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
                  );
                })()}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View School Details Modal */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl h-[95vh] sm:h-[90vh] flex flex-col overflow-hidden p-0">
            <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="truncate">{selectedSchool?.name}</span> - Details
              </DialogTitle>
              <DialogDescription className="text-sm">
                View comprehensive school information and database
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 pb-4 sm:pb-6">
              {detailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <Tabs value={activeDetailsTab} onValueChange={(v) => setActiveDetailsTab(v as "info" | "admins" | "students")} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto text-xs sm:text-sm">
                  <TabsTrigger value="info" className="px-2 sm:px-3 py-1.5 sm:py-2">Basic Info</TabsTrigger>
                  <TabsTrigger value="admins" className="px-2 sm:px-3 py-1.5 sm:py-2 truncate">Admins ({schoolDetails?.school?.adminCount || 0})</TabsTrigger>
                  <TabsTrigger value="students" className="px-2 sm:px-3 py-1.5 sm:py-2 truncate">Students ({schoolDetails?.school?.studentCount || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  {schoolDetails?.school && (
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="p-4 sm:p-6">
                          <CardTitle className="text-base sm:text-lg">School Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 p-4 sm:p-6 pt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-muted-foreground">School Name</Label>
                              <p className="font-medium">{schoolDetails.school.name}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">School ID</Label>
                              <p className="font-mono text-xs">{schoolDetails.school.id}</p>
                            </div>
                            {schoolDetails.school.address && (
                              <div className="col-span-2">
                                <Label className="text-muted-foreground">Address</Label>
                                <p>{schoolDetails.school.address}</p>
                              </div>
                            )}
                            {schoolDetails.school.contactEmail && (
                              <div>
                                <Label className="text-muted-foreground">Contact Email</Label>
                                <p>{schoolDetails.school.contactEmail}</p>
                              </div>
                            )}
                            {schoolDetails.school.contactPhone && (
                              <div>
                                <Label className="text-muted-foreground">Contact Phone</Label>
                                <p>{schoolDetails.school.contactPhone}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="p-4 sm:p-6">
                          <CardTitle className="text-base sm:text-lg">Subscription Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 p-4 sm:p-6 pt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-muted-foreground">Payment Amount</Label>
                              <p className="font-medium">{formatCurrency(schoolDetails.school.paymentAmount || schoolDetails.school.payment_amount)}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Payment Frequency</Label>
                              <p className="font-medium">{formatPaymentFrequency(schoolDetails.school.paymentFrequency || schoolDetails.school.payment_frequency)}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Subscription Expires</Label>
                              <p>{formatDate(schoolDetails.school.subscriptionExpiresAt || schoolDetails.school.subscription_expires_at)}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Status</Label>
                              <Badge variant={getSubscriptionStatus(selectedSchool || {} as School).variant}>
                                {getSubscriptionStatus(selectedSchool || {} as School).label}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="p-4 sm:p-6">
                          <CardTitle className="text-base sm:text-lg">Student Limit</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                              <Label className="text-muted-foreground">Maximum Students</Label>
                              <p className="text-2xl font-bold">{schoolDetails.school.maxStudents || schoolDetails.school.max_students || 10}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Current Enrollment</Label>
                              <p className="text-2xl font-bold">{schoolDetails.school.studentCount || 0}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Available Slots</Label>
                              <p className="text-2xl font-bold text-green-600">
                                {(schoolDetails.school.maxStudents || schoolDetails.school.max_students || 10) - (schoolDetails.school.studentCount || 0)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="p-4 sm:p-6">
                          <CardTitle className="text-base sm:text-lg">Statistics</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <Label className="text-muted-foreground">Total Admins</Label>
                              <p className="text-xl font-semibold">{schoolDetails.school.adminCount || 0}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Total Students</Label>
                              <p className="text-xl font-semibold">{schoolDetails.school.studentCount || 0}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Total Posts</Label>
                              <p className="text-xl font-semibold">{schoolDetails.school.postCount || 0}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="admins" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <Input
                        placeholder="Search admins..."
                        value={adminSearchQuery}
                        onChange={(e) => setAdminSearchQuery(e.target.value)}
                        className="w-full sm:max-w-sm"
                      />
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>
                    {adminsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : (
                      <div className="overflow-y-auto max-h-[50vh] sm:max-h-[60vh] -mx-4 sm:mx-0 px-4 sm:px-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Created</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {adminsData?.admins?.filter((admin: any) => 
                              !adminSearchQuery || 
                              admin.name.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
                              admin.email.toLowerCase().includes(adminSearchQuery.toLowerCase())
                            ).map((admin: any) => (
                              <TableRow key={admin.adminId}>
                                <TableCell className="font-medium">{admin.name}</TableCell>
                                <TableCell>{admin.email}</TableCell>
                                <TableCell>{formatDate(admin.createdAt)}</TableCell>
                              </TableRow>
                            ))}
                            {(!adminsData?.admins || adminsData.admins.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                  No admins found
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="students" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <Input
                        placeholder="Search students..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="w-full sm:max-w-sm"
                      />
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>
                    {studentsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : (
                      <div className="overflow-y-auto max-h-[50vh] sm:max-h-[60vh] -mx-4 sm:mx-0 px-4 sm:px-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Position</TableHead>
                              <TableHead>Number</TableHead>
                              <TableHead>Sport</TableHead>
                              <TableHead>Created</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studentsData?.students?.filter((student: any) => 
                              !studentSearchQuery || 
                              student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                              student.email.toLowerCase().includes(studentSearchQuery.toLowerCase())
                            ).map((student: any) => (
                              <TableRow key={student.studentId}>
                                <TableCell>
                                  <Avatar className="w-8 h-8">
                                    <AvatarImage 
                                      src={student.profilePicUrl}
                                      alt={student.name}
                                    />
                                    <AvatarFallback className="text-xs">
                                      {student.name ? student.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '??'}
                                    </AvatarFallback>
                                  </Avatar>
                                </TableCell>
                                <TableCell className="font-medium">{student.name}</TableCell>
                                <TableCell>{student.email}</TableCell>
                                <TableCell>{student.position || 'N/A'}</TableCell>
                                <TableCell className="font-medium">
                                  {(() => {
                                    const number = student.roleNumber || student.role_number;
                                    const numberStr = number?.toString().trim();
                                    if (numberStr && numberStr !== 'null' && numberStr !== 'undefined' && numberStr !== '') {
                                      return (
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                                          {numberStr}
                                        </span>
                                      );
                                    }
                                    return 'N/A';
                                  })()}
                                </TableCell>
                                <TableCell>{student.sport || 'N/A'}</TableCell>
                                <TableCell>{formatDate(student.createdAt)}</TableCell>
                              </TableRow>
                            ))}
                            {(!studentsData?.students || studentsData.students.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                  No students found
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Update School Information Modal */}
        <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-lg sm:text-xl">Update School Information</DialogTitle>
              <DialogDescription className="text-sm">
                Update basic information for <span className="truncate">{selectedSchool?.name}</span>
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              <form onSubmit={updateForm.handleSubmit((data) => updateSchoolMutation.mutate(data))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="update-name">School Name *</Label>
                <Input
                  id="update-name"
                  {...updateForm.register("name")}
                  disabled={updateSchoolMutation.isPending}
                />
                {updateForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{updateForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="update-address">Address</Label>
                <Textarea
                  id="update-address"
                  {...updateForm.register("address")}
                  rows={3}
                  disabled={updateSchoolMutation.isPending}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="update-email">Contact Email</Label>
                  <Input
                    id="update-email"
                    type="email"
                    {...updateForm.register("contactEmail")}
                    disabled={updateSchoolMutation.isPending}
                  />
                  {updateForm.formState.errors.contactEmail && (
                    <p className="text-sm text-destructive">{updateForm.formState.errors.contactEmail.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="update-phone">Contact Phone</Label>
                  <Input
                    id="update-phone"
                    {...updateForm.register("contactPhone")}
                    disabled={updateSchoolMutation.isPending}
                  />
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Student limit and payment information cannot be updated here. 
                  Use "School Payments" to change payment frequency or student limits.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4 pb-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowUpdateModal(false)}
                  disabled={updateSchoolMutation.isPending}
                  className="w-full sm:flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateSchoolMutation.isPending}
                  className="w-full sm:flex-1"
                >
                  {updateSchoolMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Update School
                    </>
                  )}
                </Button>
              </div>
            </form>
            </div>
          </DialogContent>
        </Dialog>

        {/* School Payments Modal */}
        <Dialog open={showPaymentsModal} onOpenChange={setShowPaymentsModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl h-[95vh] sm:h-[90vh] flex flex-col overflow-hidden p-0">
            <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="truncate">School Payments - {selectedSchool?.name}</span>
              </DialogTitle>
              <DialogDescription className="text-sm">
                View payment history and record new payments
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 pb-4 sm:pb-6">
              <Tabs defaultValue="history" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-auto text-xs sm:text-sm mb-4">
                  <TabsTrigger value="history" className="px-2 sm:px-3 py-1.5 sm:py-2">Payment History</TabsTrigger>
                  <TabsTrigger value="record" className="px-2 sm:px-3 py-1.5 sm:py-2">Record Payment</TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="mt-0">
                  {paymentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Search, Filter, Sort, and Export Controls */}
                      <div className="flex flex-col gap-3">
                        {/* Search and Export Row */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder="Search payments..."
                              value={paymentSearchQuery}
                              onChange={(e) => setPaymentSearchQuery(e.target.value)}
                              className="pl-9 w-full"
                            />
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              // Compute filtered and sorted payments
                              let filtered = paymentHistoryData?.payments || [];
                              
                              // Apply search filter
                              if (paymentSearchQuery) {
                                const query = paymentSearchQuery.toLowerCase();
                                filtered = filtered.filter((p: any) => 
                                  formatCurrency(p.paymentAmount).toLowerCase().includes(query) ||
                                  p.paymentType.replace(/_/g, ' ').toLowerCase().includes(query) ||
                                  formatPaymentFrequency(p.paymentFrequency).toLowerCase().includes(query) ||
                                  (p.recordedByName || 'System').toLowerCase().includes(query) ||
                                  (p.notes || '').toLowerCase().includes(query) ||
                                  formatDate(p.recordedAt).toLowerCase().includes(query)
                                );
                              }
                              
                              // Apply type filter
                              if (paymentFilterType !== "all") {
                                filtered = filtered.filter((p: any) => p.paymentType === paymentFilterType);
                              }
                              
                              // Apply frequency filter
                              if (paymentFilterFrequency !== "all") {
                                filtered = filtered.filter((p: any) => p.paymentFrequency === paymentFilterFrequency);
                              }
                              
                              // Apply sorting
                              filtered = [...filtered].sort((a: any, b: any) => {
                                let comparison = 0;
                                if (paymentSortBy === "date") {
                                  const dateA = new Date(a.recordedAt).getTime();
                                  const dateB = new Date(b.recordedAt).getTime();
                                  comparison = dateA - dateB;
                                } else if (paymentSortBy === "amount") {
                                  const amountA = parseFloat(a.paymentAmount || 0);
                                  const amountB = parseFloat(b.paymentAmount || 0);
                                  comparison = amountA - amountB;
                                } else if (paymentSortBy === "type") {
                                  comparison = a.paymentType.localeCompare(b.paymentType);
                                }
                                
                                return paymentSortOrder === "asc" ? comparison : -comparison;
                              });
                              
                              if (filtered.length === 0) {
                                toast({
                                  title: "No Data",
                                  description: "No payment records to export",
                                  variant: "destructive"
                                });
                                return;
                              }
                              
                              // Create CSV content
                              const headers = ['Date', 'Amount', 'Type', 'Frequency', 'Recorded By', 'Notes'];
                              const rows = filtered.map((p: any) => [
                                formatDate(p.recordedAt),
                                formatCurrency(p.paymentAmount).replace('$', ''),
                                p.paymentType.replace(/_/g, ' '),
                                formatPaymentFrequency(p.paymentFrequency),
                                p.recordedByName || 'System',
                                (p.notes || '').replace(/,/g, ';') // Replace commas in notes
                              ]);
                              
                              const csvContent = [
                                headers.join(','),
                                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                              ].join('\n');
                              
                              // Download CSV
                              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                              const link = document.createElement('a');
                              const url = URL.createObjectURL(blob);
                              link.setAttribute('href', url);
                              link.setAttribute('download', `payments_${selectedSchool?.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
                              link.style.visibility = 'hidden';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              
                              toast({
                                title: "Export Successful! 🎉",
                                description: `${filtered.length} payment record(s) exported to CSV`,
                              });
                            }}
                            className="w-full sm:w-auto"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export CSV
                          </Button>
                        </div>

                        {/* Filters and Sort Row */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <Select value={paymentFilterType} onValueChange={setPaymentFilterType}>
                            <SelectTrigger className="w-full sm:w-[140px]">
                              <SelectValue placeholder="Filter by Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Types</SelectItem>
                              <SelectItem value="initial">Initial</SelectItem>
                              <SelectItem value="renewal">Renewal</SelectItem>
                              <SelectItem value="student_limit_increase">Limit Increase</SelectItem>
                              <SelectItem value="student_limit_decrease">Limit Decrease</SelectItem>
                              <SelectItem value="frequency_change">Frequency Change</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select value={paymentFilterFrequency} onValueChange={setPaymentFilterFrequency}>
                            <SelectTrigger className="w-full sm:w-[140px]">
                              <SelectValue placeholder="Filter by Frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Frequencies</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="annual">Annual</SelectItem>
                              <SelectItem value="one-time">One-Time</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select value={paymentSortBy} onValueChange={(v) => setPaymentSortBy(v as "date" | "amount" | "type")}>
                            <SelectTrigger className="w-full sm:w-[120px]">
                              <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="amount">Amount</SelectItem>
                              <SelectItem value="type">Type</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPaymentSortOrder(paymentSortOrder === "asc" ? "desc" : "asc")}
                            className="w-full sm:w-auto"
                          >
                            {paymentSortOrder === "asc" ? (
                              <>
                                <span className="mr-1">↑</span> Ascending
                              </>
                            ) : (
                              <>
                                <span className="mr-1">↓</span> Descending
                              </>
                            )}
                          </Button>

                          {(paymentFilterType !== "all" || paymentFilterFrequency !== "all" || paymentSearchQuery) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPaymentFilterType("all");
                                setPaymentFilterFrequency("all");
                                setPaymentSearchQuery("");
                              }}
                              className="w-full sm:w-auto"
                            >
                              Clear Filters
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Payment History Table */}
                      <div className="overflow-y-auto max-h-[40vh] sm:max-h-[50vh] -mx-4 sm:mx-0 px-4 sm:px-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="cursor-pointer" onClick={() => {
                                setPaymentSortBy("date");
                                setPaymentSortOrder(paymentSortBy === "date" && paymentSortOrder === "desc" ? "asc" : "desc");
                              }}>
                                <div className="flex items-center gap-2">
                                  Date
                                  {paymentSortBy === "date" && (
                                    <span className="text-xs">{paymentSortOrder === "asc" ? "↑" : "↓"}</span>
                                  )}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer" onClick={() => {
                                setPaymentSortBy("amount");
                                setPaymentSortOrder(paymentSortBy === "amount" && paymentSortOrder === "desc" ? "asc" : "desc");
                              }}>
                                <div className="flex items-center gap-2">
                                  Amount
                                  {paymentSortBy === "amount" && (
                                    <span className="text-xs">{paymentSortOrder === "asc" ? "↑" : "↓"}</span>
                                  )}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer" onClick={() => {
                                setPaymentSortBy("type");
                                setPaymentSortOrder(paymentSortBy === "type" && paymentSortOrder === "desc" ? "asc" : "desc");
                              }}>
                                <div className="flex items-center gap-2">
                                  Type
                                  {paymentSortBy === "type" && (
                                    <span className="text-xs">{paymentSortOrder === "asc" ? "↑" : "↓"}</span>
                                  )}
                                </div>
                              </TableHead>
                              <TableHead>Frequency</TableHead>
                              <TableHead>Recorded By</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              // Filter and sort payments
                              let filtered = paymentHistoryData?.payments || [];
                              
                              // Apply search filter
                              if (paymentSearchQuery) {
                                const query = paymentSearchQuery.toLowerCase();
                                filtered = filtered.filter((p: any) => 
                                  formatCurrency(p.paymentAmount).toLowerCase().includes(query) ||
                                  p.paymentType.replace(/_/g, ' ').toLowerCase().includes(query) ||
                                  formatPaymentFrequency(p.paymentFrequency).toLowerCase().includes(query) ||
                                  (p.recordedByName || 'System').toLowerCase().includes(query) ||
                                  (p.notes || '').toLowerCase().includes(query) ||
                                  formatDate(p.recordedAt).toLowerCase().includes(query)
                                );
                              }
                              
                              // Apply type filter
                              if (paymentFilterType !== "all") {
                                filtered = filtered.filter((p: any) => p.paymentType === paymentFilterType);
                              }
                              
                              // Apply frequency filter
                              if (paymentFilterFrequency !== "all") {
                                filtered = filtered.filter((p: any) => p.paymentFrequency === paymentFilterFrequency);
                              }
                              
                              // Apply sorting
                              filtered = [...filtered].sort((a: any, b: any) => {
                                let comparison = 0;
                                if (paymentSortBy === "date") {
                                  const dateA = new Date(a.recordedAt).getTime();
                                  const dateB = new Date(b.recordedAt).getTime();
                                  comparison = dateA - dateB;
                                } else if (paymentSortBy === "amount") {
                                  const amountA = parseFloat(a.paymentAmount || 0);
                                  const amountB = parseFloat(b.paymentAmount || 0);
                                  comparison = amountA - amountB;
                                } else if (paymentSortBy === "type") {
                                  comparison = a.paymentType.localeCompare(b.paymentType);
                                }
                                
                                return paymentSortOrder === "asc" ? comparison : -comparison;
                              });
                              
                              return filtered;
                            })().map((payment: any) => (
                              <TableRow key={payment.id}>
                                <TableCell>{formatDate(payment.recordedAt)}</TableCell>
                                <TableCell className="font-medium">{formatCurrency(payment.paymentAmount)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize">
                                    {payment.paymentType.replace(/_/g, ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell>{formatPaymentFrequency(payment.paymentFrequency)}</TableCell>
                                <TableCell>{payment.recordedByName || 'System'}</TableCell>
                                <TableCell className="max-w-xs truncate" title={payment.notes || ''}>
                                  {payment.notes || '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                            {(!paymentHistoryData?.payments || (() => {
                              let filtered = paymentHistoryData?.payments || [];
                              if (paymentSearchQuery) {
                                const query = paymentSearchQuery.toLowerCase();
                                filtered = filtered.filter((p: any) => 
                                  formatCurrency(p.paymentAmount).toLowerCase().includes(query) ||
                                  p.paymentType.replace(/_/g, ' ').toLowerCase().includes(query) ||
                                  formatPaymentFrequency(p.paymentFrequency).toLowerCase().includes(query) ||
                                  (p.recordedByName || 'System').toLowerCase().includes(query) ||
                                  (p.notes || '').toLowerCase().includes(query) ||
                                  formatDate(p.recordedAt).toLowerCase().includes(query)
                                );
                              }
                              if (paymentFilterType !== "all") {
                                filtered = filtered.filter((p: any) => p.paymentType === paymentFilterType);
                              }
                              if (paymentFilterFrequency !== "all") {
                                filtered = filtered.filter((p: any) => p.paymentFrequency === paymentFilterFrequency);
                              }
                              return filtered.length === 0;
                            })()) && (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                  {paymentHistoryData?.payments?.length === 0 
                                    ? "No payment records found"
                                    : "No payments match your filters"}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      
                      {/* Results Count */}
                      {(() => {
                        let filtered = paymentHistoryData?.payments || [];
                        if (paymentSearchQuery) {
                          const query = paymentSearchQuery.toLowerCase();
                          filtered = filtered.filter((p: any) => 
                            formatCurrency(p.paymentAmount).toLowerCase().includes(query) ||
                            p.paymentType.replace(/_/g, ' ').toLowerCase().includes(query) ||
                            formatPaymentFrequency(p.paymentFrequency).toLowerCase().includes(query) ||
                            (p.recordedByName || 'System').toLowerCase().includes(query) ||
                            (p.notes || '').toLowerCase().includes(query) ||
                            formatDate(p.recordedAt).toLowerCase().includes(query)
                          );
                        }
                        if (paymentFilterType !== "all") {
                          filtered = filtered.filter((p: any) => p.paymentType === paymentFilterType);
                        }
                        if (paymentFilterFrequency !== "all") {
                          filtered = filtered.filter((p: any) => p.paymentFrequency === paymentFilterFrequency);
                        }
                        return filtered.length;
                      })() > 0 && (
                        <p className="text-xs text-muted-foreground text-center">
                          Showing {(() => {
                            let filtered = paymentHistoryData?.payments || [];
                            if (paymentSearchQuery) {
                              const query = paymentSearchQuery.toLowerCase();
                              filtered = filtered.filter((p: any) => 
                                formatCurrency(p.paymentAmount).toLowerCase().includes(query) ||
                                p.paymentType.replace(/_/g, ' ').toLowerCase().includes(query) ||
                                formatPaymentFrequency(p.paymentFrequency).toLowerCase().includes(query) ||
                                (p.recordedByName || 'System').toLowerCase().includes(query) ||
                                (p.notes || '').toLowerCase().includes(query) ||
                                formatDate(p.recordedAt).toLowerCase().includes(query)
                              );
                            }
                            if (paymentFilterType !== "all") {
                              filtered = filtered.filter((p: any) => p.paymentType === paymentFilterType);
                            }
                            if (paymentFilterFrequency !== "all") {
                              filtered = filtered.filter((p: any) => p.paymentFrequency === paymentFilterFrequency);
                            }
                            return filtered.length;
                          })()} of {paymentHistoryData?.payments?.length || 0} payment record(s)
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="record" className="mt-0">
                  <div className="overflow-y-auto max-h-[50vh] sm:max-h-[60vh] pr-1">
                    <form onSubmit={paymentForm.handleSubmit((data) => recordPaymentMutation.mutate(data))} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment-amount">Payment Amount ($) *</Label>
                      <Input
                        id="payment-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        {...paymentForm.register("paymentAmount")}
                        disabled={recordPaymentMutation.isPending}
                      />
                      {paymentForm.formState.errors.paymentAmount && (
                        <p className="text-sm text-destructive">{paymentForm.formState.errors.paymentAmount.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payment-frequency">Payment Frequency *</Label>
                <Select
                        value={paymentForm.watch("paymentFrequency")}
                        onValueChange={(value) => paymentForm.setValue("paymentFrequency", value as "monthly" | "annual" | "one-time")}
                        disabled={recordPaymentMutation.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="one-time">One-Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-type">Payment Type *</Label>
                    <Select
                      value={paymentForm.watch("paymentType")}
                      onValueChange={(value) => {
                        paymentForm.setValue("paymentType", value as any);
                      }}
                      disabled={recordPaymentMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="initial">Initial Payment</SelectItem>
                        <SelectItem value="renewal">Renewal</SelectItem>
                        <SelectItem value="student_limit_increase">Student Limit Increase</SelectItem>
                        <SelectItem value="student_limit_decrease">Student Limit Decrease</SelectItem>
                        <SelectItem value="frequency_change">Frequency Change</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                      {(paymentForm.watch("paymentType") === "student_limit_increase" || paymentForm.watch("paymentType") === "student_limit_decrease") && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="limit-before">Current Limit</Label>
                        <Input
                          id="limit-before"
                          type="number"
                          {...paymentForm.register("studentLimitBefore")}
                          defaultValue={selectedSchool?.maxStudents || 10}
                          disabled={recordPaymentMutation.isPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="limit-after">New Limit *</Label>
                        <Input
                          id="limit-after"
                          type="number"
                          {...paymentForm.register("studentLimitAfter")}
                          disabled={recordPaymentMutation.isPending}
                        />
                        {paymentForm.formState.errors.studentLimitAfter && (
                          <p className="text-sm text-destructive">{paymentForm.formState.errors.studentLimitAfter.message}</p>
                        )}
                      </div>
                    </div>
                  )}

                      {paymentForm.watch("paymentType") === "frequency_change" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="old-frequency">Current Frequency</Label>
                        <Input
                          id="old-frequency"
                          {...paymentForm.register("oldFrequency")}
                          defaultValue={selectedSchool?.paymentFrequency || selectedSchool?.payment_frequency || "monthly"}
                          disabled
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-frequency">New Frequency *</Label>
                        <Select
                          value={paymentForm.watch("newFrequency") || ""}
                          onValueChange={(value) => paymentForm.setValue("newFrequency", value)}
                          disabled={recordPaymentMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="annual">Annual</SelectItem>
                            <SelectItem value="one-time">One-Time</SelectItem>
                          </SelectContent>
                </Select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="payment-notes">Notes (Optional)</Label>
                    <Textarea
                      id="payment-notes"
                      {...paymentForm.register("notes")}
                      rows={3}
                      placeholder="Add any notes about this payment..."
                      disabled={recordPaymentMutation.isPending}
                    />
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> Recording a payment does NOT renew the subscription. 
                      After recording, use "Renew Subscription" to restart the timer.
                    </p>
              </div>

                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4 pb-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowPaymentsModal(false)}
                          disabled={recordPaymentMutation.isPending}
                          className="w-full sm:flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={recordPaymentMutation.isPending}
                          className="w-full sm:flex-1"
                        >
                          {recordPaymentMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Recording...
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 mr-2" />
                              Record Payment
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

