import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Activity
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
      if (!response.ok) throw new Error('Failed to create scout');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Scout Created",
        description: "New scout has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/detailed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/count"] });
      setIsCreateModalOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create scout",
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
          {/* Page Title */}
          <div className="mb-8">
            <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">Scout Management CRM</h1>
                <p className="text-muted-foreground text-sm lg:text-base">
                  Comprehensive scout performance tracking and management
                </p>
              </div>
              <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
                <Button onClick={exportToExcel} variant="outline" className="flex items-center space-x-2 flex-1 sm:flex-none">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Export</span>
                </Button>
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center space-x-2 flex-1 sm:flex-none">
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Create Scout</span>
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

          {/* Analytics Overview */}
          {analytics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Scouts</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(() => {
                      const scoutCount = analytics?.scoutStats?.length || 0;
                      console.log('👥 Total Scouts Count:', { scoutCount, scoutStats: analytics?.scoutStats?.length });
                      return scoutCount;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active scout accounts
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(() => {
                      const scoutStats = analytics?.scoutStats || [];
                      const avgCompletion = scoutStats.length > 0 
                        ? Math.round(scoutStats.reduce((sum, s) => sum + (Number(s.completionRate) || 0), 0) / scoutStats.length)
                        : 0;
                      console.log('📈 Avg Completion Rate Calculation:', { scoutStats: scoutStats.length, avgCompletion });
                      return `${avgCompletion}%`;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reviews completed vs assigned
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(() => {
                      const scoutStats = analytics?.scoutStats || [];
                      const avgQuality = scoutStats.length > 0 
                        ? Math.round(scoutStats.reduce((sum, s) => sum + (Number(s.qualityScore) || 0), 0) / scoutStats.length)
                        : 0;
                      console.log('⭐ Avg Quality Score Calculation:', { scoutStats: scoutStats.length, avgQuality });
                      return `${avgQuality}%`;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    High-quality review percentage
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(() => {
                      const revenue = analytics?.revenueStats?.total_revenue || 0;
                      console.log('💰 Revenue Calculation:', { revenue, revenueStats: analytics?.revenueStats });
                      return `$${Number(revenue).toFixed(2)}`;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From paid submissions
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters and Search */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <CardHeader>
              <CardTitle>Scout Performance Details</CardTitle>
              <CardDescription>
                {filteredAndSortedScouts.length} scouts found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] lg:h-[600px]">
                <div className="space-y-4">
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
                    <Card key={scout.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 lg:p-6">
                        <div className="flex flex-col space-y-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
                          <div className="flex items-start space-x-4">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={scout.profile_pic_url} />
                              <AvatarFallback>{scout.name?.charAt(0) || 'S'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex flex-col space-y-2 mb-2 lg:flex-row lg:items-center lg:space-y-0 lg:space-x-3">
                                <h3 className="text-lg font-semibold">{scout.name || 'Unnamed Scout'}</h3>
                                <div className="flex items-center space-x-2">
                                  {getPerformanceBadge(scout)}
                                  <Badge variant="outline">{scout.role}</Badge>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 text-sm text-muted-foreground mb-4">
                                <div>
                                  <span className="font-medium">Email:</span> {scout.email}
                                </div>
                                <div>
                                  <span className="font-medium">XEN ID:</span> {scout.xen_id}
                                </div>
                                <div>
                                  <span className="font-medium">Joined:</span> {new Date(scout.created_at).toLocaleDateString()}
                                </div>
                                <div className="flex items-center">
                                  <span className="font-medium mr-2">Trend:</span>
                                  {getTrendIcon(scout.performanceTrend)}
                                  <span className="ml-1 capitalize">{scout.performanceTrend}</span>
                                </div>
                              </div>
                              
                              {/* Performance Metrics */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-4">
                                <div className="text-center">
                                  <div className="text-lg lg:text-2xl font-bold text-blue-600">{scout.total_assignments}</div>
                                  <div className="text-xs text-muted-foreground">Assignments</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg lg:text-2xl font-bold text-green-600">{scout.completed_reviews}</div>
                                  <div className="text-xs text-muted-foreground">Completed</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg lg:text-2xl font-bold text-purple-600">{Number(scout.completionRate) || 0}%</div>
                                  <div className="text-xs text-muted-foreground">Completion</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg lg:text-2xl font-bold text-yellow-600">{scout.avg_rating ? Number(scout.avg_rating).toFixed(1) : 'N/A'}</div>
                                  <div className="text-xs text-muted-foreground">Avg Rating</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg lg:text-2xl font-bold text-emerald-600">{Number(scout.qualityScore) || 0}%</div>
                                  <div className="text-xs text-muted-foreground">Quality</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg lg:text-2xl font-bold text-indigo-600">{Number(scout.consistencyScore) || 0}%</div>
                                  <div className="text-xs text-muted-foreground">Consistency</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Calendar className="w-4 h-4 mr-2" />
                                View Activity
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
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
