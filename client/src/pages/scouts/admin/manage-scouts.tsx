import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Search, 
  Plus, 
  Star, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Filter,
  Download,
  Eye,
  Edit,
  MoreHorizontal,
  Calendar,
  Award,
  Target,
  Activity,
  Check,
  CheckCircle,
  Copy,
  AlertTriangle,
  Trash2,
  Lock,
  Unlock,
  RefreshCw
} from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { ScoutListSkeleton } from "@/components/ui/admin-skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from 'xlsx';

interface ScoutProfile {
  id: string;
  name: string;
  email: string;
  xen_id: string;
  profile_pic_url?: string;
  created_at: string;
  role: string;
  total_assignments: number;
  completed_reviews: number;
  avg_rating: number;
  high_quality_reviews: number;
  low_quality_reviews: number;
  pending_reviews: number;
  first_review_date?: string;
  last_activity?: string;
  recent_activity_7d: number;
  recent_activity_30d: number;
  consistencyScore: number;
  performanceTrend: 'improving' | 'declining' | 'stable';
  completionRate: number;
  qualityScore: number;
  isFrozen?: boolean;
}

interface ScoutAnalytics {
  scoutStats: ScoutProfile[];
  submissionStats: {
    total_submissions: number;
    in_review: number;
    finalized: number;
    rejected: number;
    avg_final_rating: number;
  };
  revenueStats: {
    total_paid_submissions: number;
    total_revenue: number;
    avg_submission_value: number;
  };
  timeFilter: string;
}

export default function ManageScoutsCRM() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  
  // Debug authentication state
  console.log('🔍 Manage Scouts Auth State:', {
    user: user ? { id: user.id, role: user.role, name: user.name } : null,
    authLoading,
    hasToken: !!localStorage.getItem('token')
  });
  
  // State for filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('completed_reviews');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [otpDisplay, setOtpDisplay] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCopied, setOtpCopied] = useState(false);
  const [scoutData, setScoutData] = useState<any>(null);
  const [selectedScout, setSelectedScout] = useState<ScoutProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [scoutToDelete, setScoutToDelete] = useState<ScoutProfile | null>(null);

  // Fetch detailed scout profiles
  const { data: scoutsData, isLoading, error: scoutsError } = useQuery({
    queryKey: ["/api/scouts/detailed", { page, search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(searchQuery && { search: searchQuery })
      });
      const response = await apiRequest("GET", `/api/scouts/detailed?${params}`);
      if (!response.ok) throw new Error('Failed to fetch scouts');
      return response.json();
    },
    enabled: !!user && !authLoading, // Only fetch when user is authenticated
    retry: 3,
    refetchInterval: 30000 // Refetch every 30 seconds for real-time updates
  });

  // Fetch scout analytics
  const { data: analytics } = useQuery<ScoutAnalytics>({
    queryKey: ["/api/scouts/analytics", timeFilter],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/scouts/analytics?timeFilter=${timeFilter}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      console.log('📊 Scout Analytics Data:', data);
      return data;
    },
    enabled: !!user && !authLoading, // Only fetch when user is authenticated
    retry: 3
  });

  const scouts = scoutsData?.scouts || [];


  // Filter and sort scouts
  const filteredAndSortedScouts = useMemo(() => {
    let filtered = scouts;

    // Filter by performance
    if (performanceFilter !== 'all') {
      switch (performanceFilter) {
        case 'top_performers':
          filtered = filtered.filter(s => s.qualityScore >= 80 && s.completionRate >= 90);
          break;
        case 'needs_attention':
          filtered = filtered.filter(s => s.qualityScore < 60 || s.completionRate < 70);
          break;
        case 'new_scouts':
          filtered = filtered.filter(s => !s.first_review_date || new Date(s.first_review_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
          break;
        case 'inactive':
          filtered = filtered.filter(s => s.recent_activity_30d === 0);
          break;
      }
    }

    // Sort scouts
    filtered.sort((a, b) => {
      let comparison = 0;
      const aValue = (a as any)[sortBy];
      const bValue = (b as any)[sortBy];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [scouts, performanceFilter, sortBy, sortOrder]);

  // Create scout mutation
  const createScoutMutation = useMutation({
    mutationFn: async (scoutData: { name: string; email: string; xenId: string; role: string }) => {
      const response = await apiRequest("POST", "/api/scout-admin/create-scout", scoutData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || 'Failed to create scout');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Show OTP modal if OTP was generated
      if (data?.otp || data?.oneTimePassword) {
        setOtpDisplay(data.otp || data.oneTimePassword);
        setScoutData(data.scout);
        setShowOtpModal(true);
      }
      
      toast({
        title: "Scout Created",
        description: data.message || "New scout has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/detailed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/count"] });
      setIsCreateModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create scout",
        variant: "destructive",
      });
    }
  });

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
  };

  // Delete scout mutation
  const deleteScoutMutation = useMutation({
    mutationFn: async (scoutId: string) => {
      const response = await apiRequest("DELETE", `/api/scout-admin/scouts/${scoutId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to delete scout');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Scout Deleted",
        description: "The scout has been permanently deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/detailed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/count"] });
      setIsDeleteDialogOpen(false);
      setScoutToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete scout",
        variant: "destructive",
      });
    }
  });

  // Generate new OTP mutation
  const generateOTPMutation = useMutation({
    mutationFn: async (scoutId: string) => {
      const response = await apiRequest("POST", `/api/scout-admin/scouts/${scoutId}/generate-otp`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to generate OTP');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setOtpDisplay(data.otp || data.oneTimePassword);
      setShowOtpModal(true);
      toast({
        title: "New OTP Generated",
        description: "A new one-time password has been generated for this scout.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/detailed"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate OTP",
        variant: "destructive",
      });
    }
  });

  // Freeze/unfreeze account mutation
  const toggleFreezeMutation = useMutation({
    mutationFn: async ({ scoutId, isFrozen }: { scoutId: string; isFrozen: boolean }) => {
      const response = await apiRequest("PATCH", `/api/scout-admin/scouts/${scoutId}/freeze`, { isFrozen });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update account status');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.isFrozen ? "Account Frozen" : "Account Unfrozen",
        description: `The scout account has been ${variables.isFrozen ? 'frozen' : 'unfrozen'} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/detailed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/count"] });
      if (selectedScout) {
        setSelectedScout({ ...selectedScout, isFrozen: variables.isFrozen } as ScoutProfile);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update account status",
        variant: "destructive",
      });
    }
  });

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredAndSortedScouts.map(scout => ({
      'Name': scout.name || 'Unnamed Scout',
      'Email': scout.email,
      'XEN ID': scout.xen_id,
      'Role': scout.role,
      'Total Assignments': scout.total_assignments,
      'Completed Reviews': scout.completed_reviews,
      'Completion Rate (%)': scout.completionRate,
      'Average Rating': scout.avg_rating ? Number(scout.avg_rating).toFixed(2) : 'N/A',
      'Quality Score (%)': scout.qualityScore,
      'Consistency Score (%)': scout.consistencyScore,
      'Performance Trend': scout.performanceTrend,
      'High Quality Reviews': scout.high_quality_reviews,
      'Low Quality Reviews': scout.low_quality_reviews,
      'Pending Reviews': scout.pending_reviews,
      'Recent Activity (7d)': scout.recent_activity_7d,
      'Recent Activity (30d)': scout.recent_activity_30d,
      'First Review Date': scout.first_review_date ? new Date(scout.first_review_date).toLocaleDateString() : 'N/A',
      'Last Activity': scout.last_activity ? new Date(scout.last_activity).toLocaleDateString() : 'N/A',
      'Created At': new Date(scout.created_at).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Scout Performance Report');
    
    // Style the worksheet
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws[cellAddress]) continue;
        
        if (row === 0) {
          // Header row styling
          ws[cellAddress].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4472C4" } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        } else {
          ws[cellAddress].s = {
            alignment: { horizontal: "left", vertical: "center" }
          };
        }
      }
    }

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Name
      { wch: 25 }, // Email
      { wch: 15 }, // XEN ID
      { wch: 15 }, // Role
      { wch: 18 }, // Total Assignments
      { wch: 18 }, // Completed Reviews
      { wch: 18 }, // Completion Rate
      { wch: 15 }, // Average Rating
      { wch: 18 }, // Quality Score
      { wch: 20 }, // Consistency Score
      { wch: 18 }, // Performance Trend
      { wch: 20 }, // High Quality Reviews
      { wch: 20 }, // Low Quality Reviews
      { wch: 18 }, // Pending Reviews
      { wch: 18 }, // Recent Activity 7d
      { wch: 18 }, // Recent Activity 30d
      { wch: 20 }, // First Review Date
      { wch: 18 }, // Last Activity
      { wch: 15 }  // Created At
    ];

    XLSX.writeFile(wb, `scout-performance-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Export Complete",
      description: "Scout performance report has been exported to Excel.",
    });
  };

  const getPerformanceBadge = (scout: ScoutProfile) => {
    if (scout.qualityScore >= 80 && scout.completionRate >= 90) {
      return <Badge className="bg-green-100 text-green-800 border-green-200"><Award className="w-3 h-3 mr-1" />Top Performer</Badge>;
    } else if (scout.qualityScore < 60 || scout.completionRate < 70) {
      return <Badge variant="destructive"><Target className="w-3 h-3 mr-1" />Needs Attention</Badge>;
    } else if (scout.recent_activity_30d === 0) {
      return <Badge variant="secondary"><Activity className="w-3 h-3 mr-1" />Inactive</Badge>;
    } else {
      return <Badge variant="outline"><TrendingUp className="w-3 h-3 mr-1" />Active</Badge>;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64">
          <ScoutListSkeleton />
        </div>
      </div>
    );
  }

  if (scoutsError) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <div className="text-destructive mb-4">
                Failed to load scouts: {scoutsError.message}
              </div>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
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
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Title - Enhanced */}
          <div className="mb-8">
            <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">Scout Management CRM</h1>
                <p className="text-muted-foreground text-sm lg:text-base">
                  Comprehensive scout performance tracking and management
                </p>
              </div>
              <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
                <Button 
                  onClick={exportToExcel} 
                  variant="outline" 
                  className="flex items-center space-x-2 flex-1 sm:flex-none hover:bg-muted"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Export</span>
                </Button>
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center space-x-2 flex-1 sm:flex-none bg-primary hover:bg-primary/90">
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">+ Create Scout</span>
                      <span className="sm:hidden">Create</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Scout</DialogTitle>
                      <DialogDescription>
                        Add a new scout to the system with their credentials.
                      </DialogDescription>
                    </DialogHeader>
                    <CreateScoutForm 
                      onSubmit={(data) => createScoutMutation.mutate(data)}
                      isLoading={createScoutMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Analytics Overview - Enhanced with Professional Styling */}
          {analytics && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-2 sm:pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Scouts</CardTitle>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {(() => {
                      const scoutCount = analytics?.scoutStats?.length || 0;
                      return scoutCount;
                    })()}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Active scout accounts
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2 sm:pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Avg Completion</CardTitle>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Target className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {(() => {
                      const scoutStats = analytics?.scoutStats || [];
                      const avgCompletion = scoutStats.length > 0 
                        ? Math.round(scoutStats.reduce((sum, s) => sum + (Number(s.completionRate) || 0), 0) / scoutStats.length)
                        : 0;
                      return `${avgCompletion}%`;
                    })()}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">
                    Reviews completed vs assigned
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-2 sm:pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Avg Quality</CardTitle>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Star className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {(() => {
                      const scoutStats = analytics?.scoutStats || [];
                      const avgQuality = scoutStats.length > 0 
                        ? Math.round(scoutStats.reduce((sum, s) => sum + (Number(s.qualityScore) || 0), 0) / scoutStats.length)
                        : 0;
                      return `${avgQuality}%`;
                    })()}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">
                    High-quality review percentage
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-emerald-500">
                <CardHeader className="pb-2 sm:pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {(() => {
                      const revenue = analytics?.revenueStats?.total_revenue || 0;
                      const revenueValue = Number(revenue);
                      if (revenueValue >= 1000) {
                        return `$${(revenueValue / 1000).toFixed(1)}k`;
                      }
                      return `$${revenueValue.toFixed(2)}`;
                    })()}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">
                    {analytics?.revenueStats?.total_paid_submissions || 0} paid submissions
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters and Search - Enhanced */}
          <Card className="mb-4 sm:mb-6">
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <Filter className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Filters & Search
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setPerformanceFilter('all');
                    setTimeFilter('all');
                    setSortBy('completed_reviews');
                  }}
                  className="text-xs h-8 px-2 sm:px-3"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Reset</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label>Search Scouts</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Name, email, XEN ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Performance Filter</Label>
                  <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Scouts</SelectItem>
                      <SelectItem value="top_performers">Top Performers</SelectItem>
                      <SelectItem value="needs_attention">Needs Attention</SelectItem>
                      <SelectItem value="new_scouts">New Scouts</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Time Filter</Label>
                  <Select value={timeFilter} onValueChange={setTimeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                      <SelectItem value="6m">Last 6 Months</SelectItem>
                      <SelectItem value="1y">Last Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed_reviews">Completed Reviews</SelectItem>
                      <SelectItem value="avg_rating">Average Rating</SelectItem>
                      <SelectItem value="qualityScore">Quality Score</SelectItem>
                      <SelectItem value="consistencyScore">Consistency Score</SelectItem>
                      <SelectItem value="completionRate">Completion Rate</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="created_at">Join Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scouts Table */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                  <CardTitle className="text-lg sm:text-xl">Scout Performance Details</CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1">
                    {filteredAndSortedScouts.length} scout{filteredAndSortedScouts.length !== 1 ? 's' : ''} found
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <div className="space-y-3 sm:space-y-4 px-2 sm:px-4 lg:px-0">
                  {filteredAndSortedScouts.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                        <Users className="w-12 h-12 text-muted-foreground" />
                      </div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">No Scouts Found</h3>
                      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        {searchQuery || performanceFilter !== 'all' || timeFilter !== 'all'
                          ? 'No scouts match your current filters. Try adjusting your search criteria.'
                          : 'There are no scouts in the system yet. Create your first scout to start managing submissions.'
                        }
                      </p>
                      {!searchQuery && performanceFilter === 'all' && timeFilter === 'all' && (
                        <Button onClick={() => setIsCreateModalOpen(true)} variant="default">
                          <Plus className="w-4 h-4 mr-2" />
                          Create First Scout
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredAndSortedScouts.map((scout) => (
                    <Card key={scout.id} className="hover:shadow-md transition-all duration-200 border border-border/50 hover:border-primary/50">
                      <CardContent className="p-0">
                        {/* Complete Redesign - Mobile Responsive Card Layout */}
                        <div className="flex flex-col lg:flex-row w-full">
                          {/* Left Section: Avatar & Basic Info - Enhanced Desktop Design */}
                          <div className="flex items-start gap-3 sm:gap-3 p-3 sm:p-4 border-b lg:border-b-0 lg:border-r border-border/50 lg:min-w-[220px] lg:max-w-[260px] w-full lg:w-auto bg-muted/30 lg:bg-transparent">
                            <div className="flex items-start gap-3 w-full lg:flex-col lg:items-center lg:text-center">
                              <Avatar className="w-12 h-12 sm:w-14 sm:h-14 lg:w-20 lg:h-20 border-2 border-primary/30 dark:border-primary/50 flex-shrink-0 shadow-lg lg:mb-3">
                                <AvatarImage src={scout.profile_pic_url} />
                                <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-bold text-base sm:text-lg lg:text-2xl">
                                  {scout.name?.charAt(0).toUpperCase() || 'S'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0 lg:flex-none lg:w-full">
                                <h3 className="font-bold text-sm sm:text-base lg:text-xl text-foreground truncate lg:text-center mb-1.5 lg:mb-2">
                                  {scout.name || 'Unnamed Scout'}
                                </h3>
                                <div className="flex flex-col gap-1.5 lg:items-center lg:gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap lg:justify-center">
                                    {getPerformanceBadge(scout)}
                                    {scout.isFrozen && (
                                      <Badge variant="destructive" className="text-[10px] px-2 py-0.5 h-5">
                                        <Lock className="w-3 h-3 mr-1" />
                                        Frozen
                                      </Badge>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 w-fit lg:w-auto">
                                    {scout.role}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Center Section: Performance Metrics */}
                          <div className="flex-1 min-w-0 p-3 sm:p-4">
                            {/* Mobile: Compact Metrics Grid - All visible, no scroll */}
                            <div className="lg:hidden space-y-2.5">
                              {/* Primary Metrics - 3x2 Grid Layout */}
                              <div className="grid grid-cols-3 gap-1.5">
                                <div className="flex flex-col items-center gap-0.5 bg-blue-500/10 dark:bg-blue-500/20 px-1.5 py-1.5 rounded-md">
                                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400">{scout.total_assignments}</div>
                                  <div className="text-[8px] text-muted-foreground leading-tight text-center">Assign</div>
                                </div>
                                <div className="flex flex-col items-center gap-0.5 bg-green-500/10 dark:bg-green-500/20 px-1.5 py-1.5 rounded-md">
                                  <div className="text-xs font-bold text-green-600 dark:text-green-400">{scout.completed_reviews}</div>
                                  <div className="text-[8px] text-muted-foreground leading-tight text-center">Done</div>
                                </div>
                                <div className="flex flex-col items-center gap-0.5 bg-purple-500/10 dark:bg-purple-500/20 px-1.5 py-1.5 rounded-md">
                                  <div className="text-xs font-bold text-purple-600 dark:text-purple-400">{Number(scout.completionRate) || 0}%</div>
                                  <div className="text-[8px] text-muted-foreground leading-tight text-center">Rate</div>
                                </div>
                                <div className="flex flex-col items-center gap-0.5 bg-yellow-500/10 dark:bg-yellow-500/20 px-1.5 py-1.5 rounded-md">
                                  <div className="flex items-center gap-0.5">
                                    <Star className="w-2 h-2 text-yellow-600 dark:text-yellow-400 fill-current flex-shrink-0" />
                                    <div className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                                      {scout.avg_rating ? Number(scout.avg_rating).toFixed(1) : 'N/A'}
                                    </div>
                                  </div>
                                  <div className="text-[8px] text-muted-foreground leading-tight text-center">Rating</div>
                                </div>
                                <div className="flex flex-col items-center gap-0.5 bg-emerald-500/10 dark:bg-emerald-500/20 px-1.5 py-1.5 rounded-md">
                                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{Number(scout.qualityScore) || 0}%</div>
                                  <div className="text-[8px] text-muted-foreground leading-tight text-center">Quality</div>
                                </div>
                                <div className="flex flex-col items-center gap-0.5 bg-indigo-500/10 dark:bg-indigo-500/20 px-1.5 py-1.5 rounded-md">
                                  <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{Number(scout.consistencyScore) || 0}%</div>
                                  <div className="text-[8px] text-muted-foreground leading-tight text-center">Consist</div>
                                </div>
                              </div>
                              
                              {/* Contact Info - Compact with better wrapping */}
                              <div className="flex flex-col gap-1 text-[10px] sm:text-xs text-muted-foreground">
                                <span className="break-all min-w-0 leading-tight">{scout.email}</span>
                                {scout.xen_id && (
                                  <span className="break-all min-w-0 leading-tight text-muted-foreground/80">{scout.xen_id}</span>
                                )}
                              </div>
                            </div>

                            {/* Desktop: Enhanced Metrics Grid with Modern Card Design */}
                            <div className="hidden lg:block space-y-4">
                              {/* Primary Performance Metrics - 3x2 Grid with Cards */}
                              <div className="grid grid-cols-3 gap-3">
                                <div className="bg-blue-500/10 dark:bg-blue-500/20 border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-3 hover:bg-blue-500/15 dark:hover:bg-blue-500/25 transition-colors">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="p-1.5 bg-blue-500/20 dark:bg-blue-500/30 rounded-md">
                                      <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                  </div>
                                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">{scout.total_assignments}</div>
                                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assignments</div>
                                </div>
                                
                                <div className="bg-green-500/10 dark:bg-green-500/20 border border-green-200/50 dark:border-green-800/50 rounded-lg p-3 hover:bg-green-500/15 dark:hover:bg-green-500/25 transition-colors">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="p-1.5 bg-green-500/20 dark:bg-green-500/30 rounded-md">
                                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    </div>
                                  </div>
                                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">{scout.completed_reviews}</div>
                                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed</div>
                                </div>
                                
                                <div className="bg-purple-500/10 dark:bg-purple-500/20 border border-purple-200/50 dark:border-purple-800/50 rounded-lg p-3 hover:bg-purple-500/15 dark:hover:bg-purple-500/25 transition-colors">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="p-1.5 bg-purple-500/20 dark:bg-purple-500/30 rounded-md">
                                      <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                  </div>
                                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">{Number(scout.completionRate) || 0}%</div>
                                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completion</div>
                                </div>
                                
                                <div className="bg-yellow-500/10 dark:bg-yellow-500/20 border border-yellow-200/50 dark:border-yellow-800/50 rounded-lg p-3 hover:bg-yellow-500/15 dark:hover:bg-yellow-500/25 transition-colors">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="p-1.5 bg-yellow-500/20 dark:bg-yellow-500/30 rounded-md">
                                      <Star className="w-4 h-4 text-yellow-600 dark:text-yellow-400 fill-current" />
                                    </div>
                                  </div>
                                  <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                      {scout.avg_rating ? Number(scout.avg_rating).toFixed(1) : 'N/A'}
                                    </span>
                                    <Star className="w-3 h-3 text-yellow-600 dark:text-yellow-400 fill-current mb-0.5" />
                                  </div>
                                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Rating</div>
                                </div>
                                
                                <div className="bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-200/50 dark:border-emerald-800/50 rounded-lg p-3 hover:bg-emerald-500/15 dark:hover:bg-emerald-500/25 transition-colors">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="p-1.5 bg-emerald-500/20 dark:bg-emerald-500/30 rounded-md">
                                      <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                  </div>
                                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{Number(scout.qualityScore) || 0}%</div>
                                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quality</div>
                                </div>
                                
                                <div className="bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-200/50 dark:border-indigo-800/50 rounded-lg p-3 hover:bg-indigo-500/15 dark:hover:bg-indigo-500/25 transition-colors">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="p-1.5 bg-indigo-500/20 dark:bg-indigo-500/30 rounded-md">
                                      <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                  </div>
                                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">{Number(scout.consistencyScore) || 0}%</div>
                                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consistency</div>
                                </div>
                              </div>

                              {/* Secondary Info Bar - Modern Design */}
                              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-muted rounded-md">
                                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>
                                    <span className="text-muted-foreground font-medium truncate max-w-[200px]">{scout.email}</span>
                                  </div>
                                  {scout.xen_id && (
                                    <div className="flex items-center gap-2">
                                      <div className="p-1.5 bg-muted rounded-md">
                                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                      </div>
                                      <span className="text-muted-foreground font-medium">XEN: {scout.xen_id}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-muted rounded-md">
                                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>
                                    <span className="text-muted-foreground font-medium">{new Date(scout.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getTrendIcon(scout.performanceTrend)}
                                    <span className="text-muted-foreground font-medium capitalize">{scout.performanceTrend}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Section: Actions */}
                          <div className="flex items-center justify-end lg:justify-center p-2.5 sm:p-3 border-t lg:border-t-0 lg:border-l border-border/50 lg:min-w-[48px] lg:w-12 flex-shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedScout(scout);
                                  setIsEditModalOpen(true);
                                }}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedScout(scout);
                                  setIsEditModalOpen(true);
                                }}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedScout(scout);
                                  toast({
                                    title: "View Activity",
                                    description: `Activity for ${scout.name || scout.email} - Feature coming soon!`,
                                  });
                                }}>
                                  <Calendar className="w-4 h-4 mr-2" />
                                  View Activity
                                </DropdownMenuItem>
                                {scout.role === 'xen_scout' && (
                                  <>
                                    <div className="h-px bg-border my-1" />
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setScoutToDelete(scout);
                                        setIsDeleteDialogOpen(true);
                                      }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete Scout
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                  )}
                </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Professional OTP Success Modal */}
      <Dialog open={showOtpModal} onOpenChange={setShowOtpModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-green-600">
              <Check className="w-6 h-6 mr-2" />
              Scout Created Successfully!
            </DialogTitle>
            <DialogDescription>
              The scout has been registered and a temporary password has been generated.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Scout Info */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Scout Information</h4>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Name:</span> {scoutData?.name}</p>
                <p><span className="font-medium">Email:</span> {scoutData?.email}</p>
                {scoutData?.xenId && (
                  <p><span className="font-medium">XEN ID:</span> {scoutData?.xenId}</p>
                )}
                {scoutData?.role && (
                  <p><span className="font-medium">Role:</span> {scoutData?.role}</p>
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
                    <li>• Share this OTP securely with the scout</li>
                    <li>• Scout must reset password after first login</li>
                    <li>• This OTP can only be used once</li>
                    <li>• Store securely - it won't be shown again</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <Button
                onClick={closeOTPModal}
                className="flex-1"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Scout Profile</DialogTitle>
            <DialogDescription>
              Manage scout account settings and permissions
            </DialogDescription>
          </DialogHeader>
          {selectedScout && (
            <div className="space-y-6">
              {/* Scout Information */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Scout Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Name:</span>
                    <p className="text-foreground">{selectedScout.name || 'Unnamed Scout'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Email:</span>
                    <p className="text-foreground">{selectedScout.email}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">XEN ID:</span>
                    <p className="text-foreground">{selectedScout.xen_id || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Role:</span>
                    <p className="text-foreground">{selectedScout.role}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Joined:</span>
                    <p className="text-foreground">{new Date(selectedScout.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Generate New OTP */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Reset Password</Label>
                    <p className="text-sm text-muted-foreground">
                      Generate a new one-time password for this scout
                    </p>
                  </div>
                  <Button
                    onClick={() => generateOTPMutation.mutate(selectedScout.id)}
                    disabled={generateOTPMutation.isPending}
                    variant="outline"
                    className="flex items-center space-x-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${generateOTPMutation.isPending ? 'animate-spin' : ''}`} />
                    <span>{generateOTPMutation.isPending ? 'Generating...' : 'Generate New OTP'}</span>
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
              Delete Scout Permanently
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete:
              <ul className="mt-2 ml-4 list-disc">
                <li>Scout account: {scoutToDelete?.name || scoutToDelete?.email}</li>
                <li>All associated reviews and ratings</li>
                <li>All submission assignments</li>
              </ul>
              <p className="mt-2 font-medium">Are you absolutely sure you want to proceed?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteScoutMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (scoutToDelete) {
                  deleteScoutMutation.mutate(scoutToDelete.id);
                }
              }}
              disabled={deleteScoutMutation.isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteScoutMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Create Scout Form Component
function CreateScoutForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    xenId: '',
    role: 'xen_scout'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="xenId">XEN ID</Label>
        <Input
          id="xenId"
          value={formData.xenId}
          onChange={(e) => setFormData({ ...formData, xenId: e.target.value })}
          placeholder="e.g., XSA-25001"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="xen_scout">XEN Scout</SelectItem>
            <SelectItem value="scout_admin">Scout Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Scout'}
        </Button>
      </div>
    </form>
  );
}
