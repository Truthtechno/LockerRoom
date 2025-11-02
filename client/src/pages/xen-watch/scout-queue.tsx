import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, Clock, CheckCircle, Star, Save, Send, Play, User, X, Calendar, TrendingUp, Users, Filter, Search, ArrowUpDown, ChevronRight, ChevronLeft } from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";

interface SubmissionWithReview {
  id: string;
  studentId: string;
  videoUrl: string;
  thumbUrl?: string | null;
  notes?: string | null;
  promoCode?: string | null;
  status: 'in_review' | 'finalized' | 'rejected';
  createdAt: string;
  updatedAt: string;
  review?: {
    id: string;
    submissionId: string;
    scoutId: string;
    rating?: number | null;
    notes?: string | null;
    isSubmitted: boolean;
    createdAt: string;
    updatedAt: string;
  };
  reviews?: Array<{
    id: string;
    submissionId: string;
    scoutId: string;
    rating?: number | null;
    notes?: string | null;
    isSubmitted: boolean;
    createdAt: string;
    updatedAt: string;
    scout: {
      id: string;
      name: string;
      xenId: string;
      profilePicUrl?: string | null;
    };
  }>;
  student: {
    id: string;
    name: string;
    profilePicUrl?: string | null;
    roleNumber?: string | null;
    position?: string | null;
    schoolId?: string | null;
    school?: {
      id: string;
      name: string;
    } | null;
  };
  allReviews?: Array<{
    id: string;
    submissionId: string;
    scoutId: string;
    rating?: number | null;
    notes?: string | null;
    isSubmitted: boolean;
    createdAt: string;
    updatedAt: string;
    scout: {
      id: string;
      name: string;
      xenId: string;
      profilePicUrl?: string | null;
    };
  }>;
}

export default function ScoutReviewQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithReview | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState<string | null>(null);
  
  // New state for filters and search
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: submissionsData, isLoading } = useQuery<{
    submissions: SubmissionWithReview[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: user?.role === 'scout_admin' 
      ? ["/api/xen-watch/admin/submissions"] 
      : ["/api/xen-watch/scout/review-queue"],
    queryFn: async () => {
      const endpoint = user?.role === 'scout_admin' 
        ? "/api/xen-watch/admin/submissions" 
        : "/api/xen-watch/scout/review-queue";
      const response = await apiRequest("GET", endpoint);
      if (!response.ok) throw new Error('Failed to fetch submissions');
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  const submissions = submissionsData?.submissions || [];

  // Open review modal function (defined early for use in useEffect)
  const openReviewModalWithSubmission = useCallback((submission: SubmissionWithReview) => {
    setSelectedSubmission(submission);
    
    // Check if we should focus on a specific review (from notification)
    const urlParams = new URLSearchParams(window.location.search);
    const showReview = urlParams.get('showReview') === 'true';
    const reviewScoutId = urlParams.get('reviewScoutId');
    
    if (user?.role === 'scout_admin') {
      // For scout admins, if we're showing a specific review, find that one
      if (showReview && reviewScoutId && submission.allReviews) {
        const specificReview = submission.allReviews.find(r => r.scoutId === reviewScoutId);
        if (specificReview) {
          setRating(specificReview.rating || null);
          setNotes(specificReview.notes || '');
        } else {
          // Fallback to user's own review
          const userReview = submission.allReviews.find(r => r.scoutId === user.id);
          setRating(userReview?.rating || null);
          setNotes(userReview?.notes || '');
        }
      } else {
        // Find their own review in the reviews array
        const userReview = submission.allReviews?.find(r => r.scoutId === user.id);
        setRating(userReview?.rating || null);
        setNotes(userReview?.notes || '');
      }
    } else {
      // For regular scouts, use the single review
      // Allow editing submitted reviews if submission hasn't been finalized
      setRating(submission.review?.rating || null);
      setNotes(submission.review?.notes || '');
    }
    
    setIsReviewModalOpen(true);
  }, [user?.role, user?.id]);

  // Handle URL parameters to open specific submission
  useEffect(() => {
    if (!submissions.length || !location) return;

    const urlParams = new URLSearchParams(window.location.search);
    const submissionId = urlParams.get('submissionId');

    if (submissionId) {
      const submission = submissions.find(s => s.id === submissionId);
      if (submission) {
        openReviewModalWithSubmission(submission);
        // Clean up URL parameters after opening
        const newUrl = location.split('?')[0];
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [submissions, location, openReviewModalWithSubmission]);

  // Finalize submission mutation
  const finalizeMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const response = await apiRequest("POST", `/api/xen-watch/finalize/${submissionId}`);
      if (!response.ok) throw new Error('Failed to finalize submission');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Submission Finalized",
        description: "The submission has been finalized and feedback sent to the student.",
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/admin/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/scout/review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/admin/dashboard"] });
      setIsFinalizing(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to finalize submission",
        variant: "destructive",
      });
      setIsFinalizing(null);
    }
  });

  // Filter and sort submissions
  const filteredAndSortedSubmissions = useMemo(() => {
    let filtered = submissions;

    // Filter by status
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        // New videos with no reviews yet
        filtered = filtered.filter(s => {
          if (user?.role === 'scout_admin') {
            return !s.reviews || s.reviews.length === 0 || !s.reviews.some(r => r.isSubmitted);
          } else {
            return !s.review?.isSubmitted;
          }
        });
      } else if (statusFilter === 'in_review') {
        // Submissions whose reviews haven't been finalized yet
        filtered = filtered.filter(s => {
          if (user?.role === 'scout_admin') {
            return s.status === 'in_review' && s.reviews && s.reviews.length > 0 && s.reviews.some(r => r.isSubmitted);
          } else {
            return s.status === 'in_review' && s.review?.isSubmitted;
          }
        });
      } else if (statusFilter === 'finalized') {
        // Those that have been finalized
        filtered = filtered.filter(s => s.status === 'finalized');
      }
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case '7days':
          filterDate.setDate(now.getDate() - 7);
          break;
        case '30days':
          filterDate.setDate(now.getDate() - 30);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear(), 0, 1);
          break;
      }
      
      filtered = filtered.filter(submission => new Date(submission.createdAt) >= filterDate);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(submission => 
        submission.student.name.toLowerCase().includes(query) ||
        submission.id.toLowerCase().includes(query) ||
        submission.student.school?.name.toLowerCase().includes(query) ||
        submission.student.position?.toLowerCase().includes(query)
      );
    }

    // Sort submissions
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.student.name.localeCompare(b.student.name);
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'school':
          comparison = (a.student.school?.name || '').localeCompare(b.student.school?.name || '');
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [submissions, statusFilter, dateFilter, searchQuery, sortBy, sortOrder]);

  const getStatusBadge = (status: string, isReviewed: boolean = false) => {
    if (user?.role === 'scout_admin') {
      // For scout admins, show submission status
      switch (status) {
        case "in_review":
          return (
            <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 text-white border-0 shadow-sm">
              <Eye className="w-3 h-3 mr-1.5" />
              In Review
            </Badge>
          );
        case "finalized":
          return (
            <Badge variant="secondary" className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm">
              <CheckCircle className="w-3 h-3 mr-1.5" />
              Finalized
            </Badge>
          );
        case "rejected":
          return (
            <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white border-0 shadow-sm">
              <X className="w-3 h-3 mr-1.5" />
              Rejected
            </Badge>
          );
        default:
          return (
            <Badge variant="outline" className="bg-muted text-foreground border">
              <Clock className="w-3 h-3 mr-1.5" />
              Pending
            </Badge>
          );
      }
    } else {
      // For regular scouts, show review status
      if (isReviewed) {
        return (
          <Badge variant="secondary" className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm">
            <CheckCircle className="w-3 h-3 mr-1.5" />
            Reviewed
          </Badge>
        );
      }

      switch (status) {
        case "in_review":
          return (
            <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 text-white border-0 shadow-sm">
              <Eye className="w-3 h-3 mr-1.5" />
              In Review
            </Badge>
          );
        case "finalized":
          return (
            <Badge variant="secondary" className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm">
              <CheckCircle className="w-3 h-3 mr-1.5" />
              Finalized
            </Badge>
          );
        case "rejected":
          return (
            <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white border-0 shadow-sm">
              <X className="w-3 h-3 mr-1.5" />
              Rejected
            </Badge>
          );
        default:
          return (
            <Badge variant="outline" className="bg-muted text-foreground border">
              <Clock className="w-3 h-3 mr-1.5" />
              Pending
            </Badge>
          );
      }
    }
  };

  const openReviewModal = (submission: SubmissionWithReview) => {
    openReviewModalWithSubmission(submission);
  };

  const closeReviewModal = () => {
    setSelectedSubmission(null);
    setRating(null);
    setNotes('');
    setIsReviewModalOpen(false);
  };

  const saveReviewMutation = useMutation({
    mutationFn: async ({ isSubmitted }: { isSubmitted: boolean }) => {
      if (!selectedSubmission) throw new Error('No submission selected');
      
      const response = await apiRequest("POST", `/api/xen-watch/reviews/${selectedSubmission.id}`, {
        rating,
        notes: notes.trim() || null,
        isSubmitted
      });
      
      if (!response.ok) throw new Error('Failed to save review');
      return response.json();
    },
    onSuccess: (_, { isSubmitted }) => {
      toast({
        title: "Review Saved",
        description: isSubmitted ? "Your review has been submitted successfully." : "Your draft has been saved.",
      });
      // Refresh data for both scout and admin views
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/scout/review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/admin/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/admin/dashboard"] });
      // Invalidate all dashboard analytics
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/analytics/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/detailed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/analytics"] });
      closeReviewModal();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save review",
        variant: "destructive",
      });
    }
  });

  const finalizeSubmissionMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const response = await apiRequest("POST", `/api/xen-watch/finalize/${submissionId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to finalize submission');
      }
      return response.json();
    },
    onSuccess: (data, submissionId) => {
      console.log('🎉 Finalization successful:', { submissionId, data });
      
      toast({
        title: "Submission Finalized",
        description: `The submission has been finalized with an average rating of ${data.aggregatedData?.averageRating?.toFixed(1) || 'N/A'}/5 based on ${data.aggregatedData?.totalReviews || 0} reviews.`,
      });
      
      // Optimistically update the cache to immediately reflect the change
      queryClient.setQueryData(
        ["/api/xen-watch/admin/submissions"],
        (oldData: any) => {
          if (!oldData) return oldData;
          
          return {
            ...oldData,
            submissions: oldData.submissions.map((submission: any) =>
              submission.id === submissionId
                ? { ...submission, status: 'finalized' }
                : submission
            )
          };
        }
      );
      
      // Invalidate all relevant queries to ensure all dashboards update
      queryClient.invalidateQueries({ 
        queryKey: ["/api/xen-watch/admin/submissions"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/xen-watch/scout/review-queue"] 
      });
      // Invalidate dashboard analytics
      queryClient.invalidateQueries({ 
        queryKey: ["/api/xen-watch/admin/dashboard"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/xen-watch/analytics/overview"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/scouts/count"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/scouts/detailed"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/scouts/analytics"] 
      });
    },
    onError: (error) => {
      console.error('❌ Finalization failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to finalize submission",
        variant: "destructive",
      });
    }
  });

  const handleSaveDraft = () => {
    saveReviewMutation.mutate({ isSubmitted: false });
  };

  const handleSubmitReview = () => {
    if (!rating) {
      toast({
        title: "Rating Required",
        description: "Please provide a rating before submitting your review.",
        variant: "destructive",
      });
      return;
    }
    saveReviewMutation.mutate({ isSubmitted: true });
  };

  const handleFinalizeSubmission = (submissionId: string) => {
    finalizeSubmissionMutation.mutate(submissionId);
  };

  const canFinalizeSubmission = (submission: SubmissionWithReview) => {
    if (user?.role === 'scout_admin') {
      // For scout admins, check if submission has submitted reviews and is not already finalized
      return submission.status !== 'finalized' && 
             submission.reviews && 
             submission.reviews.length > 0 && 
             submission.reviews.some(r => r.isSubmitted);
    }
    return false;
  };

  // Statistics calculations
  const stats = useMemo(() => {
    if (user?.role === 'scout_admin') {
      // For scout admins, count submissions by status
      const pending = filteredAndSortedSubmissions.filter(s => 
        s.status === 'in_review' && (!s.reviews || s.reviews.length === 0 || !s.reviews.some(r => r.isSubmitted))
      ).length;
      const completed = filteredAndSortedSubmissions.filter(s => 
        s.status === 'in_review' && s.reviews && s.reviews.length > 0 && s.reviews.some(r => r.isSubmitted)
      ).length;
      const finalized = filteredAndSortedSubmissions.filter(s => s.status === 'finalized').length;
      const total = filteredAndSortedSubmissions.length;
      
      return { pending, completed, finalized, total };
    } else {
      // For regular scouts, use the original logic
      const pending = filteredAndSortedSubmissions.filter(s => !s.review?.isSubmitted).length;
      const completed = filteredAndSortedSubmissions.filter(s => s.review?.isSubmitted).length;
      const total = filteredAndSortedSubmissions.length;
      
      return { pending, completed, finalized: 0, total };
    }
  }, [filteredAndSortedSubmissions, user?.role]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground font-medium">Loading submissions...</p>
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
        
        {/* Enhanced Header */}
        <div className="bg-card border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-6 space-y-4 sm:space-y-0">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  {user?.role === 'scout_admin' ? 'Scout Admin Dashboard' : 'Scout Review Queue'}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {user?.role === 'scout_admin' 
                    ? 'Manage all submissions and scout reviews across the platform' 
                    : 'Review student submissions and provide professional feedback'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Statistics Cards */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${user?.role === 'scout_admin' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6 mb-8`}>
            <Card className="bg-card border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">
                  {user?.role === 'scout_admin' ? 'Pending Review' : 'Pending Reviews'}
                </CardTitle>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 dark:bg-blue-900/30 rounded-lg">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 dark:text-blue-400 mb-1">
                  {stats.pending}
                </div>
                <p className="text-xs text-muted-foreground">
                  {user?.role === 'scout_admin' ? 'Awaiting scout reviews' : 'Awaiting your review'}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-card border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">
                  {user?.role === 'scout_admin' ? 'Ready to Finalize' : 'Completed Reviews'}
                </CardTitle>
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 dark:bg-emerald-900/30 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 dark:text-emerald-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 dark:text-emerald-400 mb-1">
                  {stats.completed}
                </div>
                <p className="text-xs text-muted-foreground">
                  {user?.role === 'scout_admin' ? 'Ready for finalization' : 'Reviews submitted'}
                </p>
              </CardContent>
            </Card>
            
            {user?.role === 'scout_admin' && (
              <Card className="bg-card border shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-foreground">Finalized</CardTitle>
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                    {stats.finalized}
                  </div>
                  <p className="text-xs text-muted-foreground">Completed submissions</p>
                </CardContent>
              </Card>
            )}
            
            <Card className="bg-card border shadow-sm hover:shadow-md transition-shadow duration-200 sm:col-span-2 lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">Total Assigned</CardTitle>
                <div className="p-2 bg-muted rounded-lg">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground mb-1">
                  {stats.total}
                </div>
                <p className="text-xs text-muted-foreground">Submissions assigned</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="bg-card border shadow-sm mb-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center">
                <Filter className="w-5 h-5 mr-2 text-muted-foreground" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Student name, ID, school..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="border focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending (No Reviews Yet)</SelectItem>
                      <SelectItem value="in_review">In Review (Ready to Finalize)</SelectItem>
                      <SelectItem value="finalized">Finalized</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Date Range</Label>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="border focus:border-blue-500 focus:ring-blue-500">
                      <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Sort By</Label>
                  <div className="flex space-x-2">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="flex-1 border focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="school">School</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3 border hover:border-gray-400"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submissions List */}
          {filteredAndSortedSubmissions && filteredAndSortedSubmissions.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Submissions</h2>
                <div className="text-sm text-muted-foreground">
                  Showing {filteredAndSortedSubmissions.length} of {submissions.length} submissions
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <Card className="bg-card border shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-background border-b border">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Student</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Submission ID</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">School</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Position</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Date</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                          <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredAndSortedSubmissions.map((submission) => (
                          <tr key={submission.id} className="hover:bg-background transition-colors duration-150">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg flex items-center justify-center">
                                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-foreground">{submission.student.name}</div>
                                  {submission.student.roleNumber && (
                                    <div className="text-xs text-muted-foreground">#{submission.student.roleNumber}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-muted-foreground font-mono">
                                #{submission.id.slice(-8)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-foreground">
                                {submission.student.school?.name || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-foreground">
                                {submission.student.position || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-muted-foreground">
                                {new Date(submission.createdAt).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                {getStatusBadge(submission.status, user?.role === 'scout_admin' ? false : submission.review?.isSubmitted)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <Button
                                  onClick={() => openReviewModal(submission)}
                                  variant={user?.role === 'scout_admin' ? "default" : (submission.review?.isSubmitted ? "outline" : "default")}
                                  size="sm"
                                  className="px-4 py-2"
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </Button>
                                {user?.role === 'scout_admin' && (
                                  <Button
                                    onClick={() => handleFinalizeSubmission(submission.id)}
                                    variant={submission.status === 'finalized' ? "outline" : "secondary"}
                                    size="sm"
                                    className={`px-4 py-2 ${
                                      submission.status === 'finalized' 
                                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 border-emerald-200 cursor-not-allowed" 
                                        : "bg-green-600 hover:bg-green-700 text-white"
                                    }`}
                                    disabled={finalizeSubmissionMutation.isPending || submission.status === 'finalized'}
                                  >
                                    {finalizeSubmissionMutation.isPending ? (
                                      <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                        Finalizing...
                                      </>
                                    ) : submission.status === 'finalized' ? (
                                      <>
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Finalized
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Finalize
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {filteredAndSortedSubmissions.map((submission) => (
                  <Card key={submission.id} className="bg-card border shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg flex items-center justify-center">
                            <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-foreground">{submission.student.name}</h3>
                            <p className="text-sm text-muted-foreground">#{submission.id.slice(-8)}</p>
                          </div>
                        </div>
                        {getStatusBadge(submission.status, user?.role === 'scout_admin' ? false : submission.review?.isSubmitted)}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-4">
                        <div>
                          <span className="font-medium">School:</span> {submission.student.school?.name || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Position:</span> {submission.student.position || 'N/A'}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Date:</span> {new Date(submission.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Button
                          onClick={() => openReviewModal(submission)}
                          variant={user?.role === 'scout_admin' ? "default" : (submission.review?.isSubmitted ? "outline" : "default")}
                          className="w-full"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                        {user?.role === 'scout_admin' && (
                          <Button
                            onClick={() => handleFinalizeSubmission(submission.id)}
                            variant={submission.status === 'finalized' ? "outline" : "secondary"}
                            className={`w-full ${
                              submission.status === 'finalized' 
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 border-emerald-200 cursor-not-allowed" 
                                : "bg-green-600 hover:bg-green-700 text-white"
                            }`}
                            disabled={finalizeSubmissionMutation.isPending || submission.status === 'finalized'}
                          >
                            {finalizeSubmissionMutation.isPending ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                Finalizing...
                              </>
                            ) : submission.status === 'finalized' ? (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Finalized
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Finalize Submission
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card className="bg-card border shadow-sm">
              <CardContent className="text-center py-16">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  <Eye className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">No Submissions Found</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  {searchQuery || statusFilter !== 'all' || dateFilter !== 'all' 
                    ? "No submissions match your current filters. Try adjusting your search criteria."
                    : "You don't have any submissions assigned for review at the moment. Check back later for new assignments."
                  }
                </p>
                {(searchQuery || statusFilter !== 'all' || dateFilter !== 'all') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setDateFilter('all');
                    }}
                    className="mt-4"
                  >
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Enhanced Detail Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={closeReviewModal}>
        <DialogContent className="max-w-6xl h-[95vh] sm:h-[90vh] flex flex-col bg-card p-0 left-4 right-4 sm:left-[50%] sm:right-auto translate-x-0 sm:translate-x-[-50%] top-[50%] translate-y-[-50%] rounded-lg">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 flex-shrink-0">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground">Submission Details</DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-muted-foreground">
              Review student submission and provide professional assessment. Your review will help determine their potential.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 space-y-6 sm:space-y-8 min-h-0 pb-4">
            {/* Student Information */}
            {selectedSubmission && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 sm:p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex flex-col sm:flex-row sm:items-start space-y-4 sm:space-y-0 sm:space-x-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl shadow-sm overflow-hidden">
                    {selectedSubmission.student.profilePicUrl ? (
                      <img
                        src={selectedSubmission.student.profilePicUrl}
                        alt={`${selectedSubmission.student.name}'s profile`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 flex items-center justify-center">
                        <User className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="text-lg sm:text-xl font-bold text-foreground mb-2">{selectedSubmission.student.name}</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Submission #{selectedSubmission.id.slice(-8)}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                      {selectedSubmission.student.school && (
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-muted-foreground">School:</span>
                          <span className="text-foreground">{selectedSubmission.student.school.name}</span>
                        </div>
                      )}
                      {selectedSubmission.student.position && (
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-muted-foreground">Position:</span>
                          <span className="text-foreground">{selectedSubmission.student.position}</span>
                        </div>
                      )}
                      {selectedSubmission.student.roleNumber && (
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-muted-foreground">Number:</span>
                          <span className="text-foreground">{selectedSubmission.student.roleNumber}</span>
                        </div>
                      )}
                      {selectedSubmission.promoCode && (
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-muted-foreground">Promo Code:</span>
                          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-lg text-sm font-mono border border-blue-200 dark:border-blue-800">
                            {selectedSubmission.promoCode}
                          </span>
                        </div>
                      )}
                    </div>
                    {selectedSubmission.notes && (
                      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-foreground bg-card/50 rounded-lg p-3 border border-blue-100">
                          <span className="font-semibold">Student Notes:</span> {selectedSubmission.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Video Player */}
            {selectedSubmission?.videoUrl && (
              <div className="space-y-4">
                <Label className="text-base font-semibold text-foreground">Performance Video</Label>
                <div className="bg-muted rounded-xl p-4">
                  <div className="aspect-video w-full">
                    <video
                      src={selectedSubmission.videoUrl}
                      controls
                      className="w-full h-full rounded-lg shadow-sm"
                      preload="metadata"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Review Progress */}
            {(selectedSubmission?.allReviews || selectedSubmission?.reviews) && ((selectedSubmission.allReviews?.length || 0) > 0 || (selectedSubmission.reviews?.length || 0) > 0) && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-indigo-900 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Review Progress
                  </h4>
                  <div className="text-sm text-indigo-700 bg-card px-3 py-1 rounded-full font-medium">
                    {(selectedSubmission.allReviews || selectedSubmission.reviews)?.filter(r => r.isSubmitted).length || 0} of {(selectedSubmission.allReviews || selectedSubmission.reviews)?.length || 0} scouts reviewed
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-sm"></div>
                    <span className="text-emerald-700 font-medium">
                      {(selectedSubmission.allReviews || selectedSubmission.reviews)?.filter(r => r.isSubmitted).length || 0} Submitted
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full shadow-sm"></div>
                    <span className="text-amber-700 font-medium">
                      {(selectedSubmission.allReviews || selectedSubmission.reviews)?.filter(r => !r.isSubmitted).length || 0} Drafts
                    </span>
                  </div>
                  {((selectedSubmission.allReviews || selectedSubmission.reviews)?.filter(r => r.rating).length || 0) > 0 && (
                    <div className="flex items-center space-x-2">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="text-yellow-700 font-medium">
                        Avg: {((selectedSubmission.allReviews || selectedSubmission.reviews)?.filter(r => r.rating).reduce((sum, r) => sum + (r.rating || 0), 0) || 0) / ((selectedSubmission.allReviews || selectedSubmission.reviews)?.filter(r => r.rating).length || 1)}/5
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rating Section */}
            <div className="space-y-4">
              <Label className="text-base font-semibold text-foreground">Performance Rating (1-5) *</Label>
              <div className="flex justify-start space-x-2 sm:space-x-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      // Allow editing if submission is not finalized
                      if (selectedSubmission?.status !== 'finalized') {
                        setRating(star);
                      }
                    }}
                    disabled={selectedSubmission?.status === 'finalized'}
                    className={`p-2 sm:p-3 rounded-xl transition-all duration-200 hover:scale-110 ${
                      selectedSubmission?.status === 'finalized'
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    } ${
                      rating && star <= rating
                        ? 'text-yellow-500 bg-yellow-50 shadow-md border-2 border-yellow-200'
                        : 'text-muted-foreground hover:text-yellow-500 hover:bg-yellow-50 border-2 border-transparent'
                    }`}
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    <Star className="w-6 h-6 sm:w-8 sm:h-8 fill-current" />
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedSubmission?.status === 'finalized' 
                  ? 'This submission has been finalized. Reviews cannot be edited.'
                  : 'Click stars to rate the performance (1 = poor, 5 = excellent)'}
              </p>
            </div>

            {/* Notes Section */}
            <div className="space-y-4">
              <Label className="text-base font-semibold text-foreground">Review Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => {
                  // Allow editing if submission is not finalized
                  if (selectedSubmission?.status !== 'finalized') {
                    setNotes(e.target.value);
                  }
                }}
                disabled={selectedSubmission?.status === 'finalized'}
                placeholder="Provide detailed feedback on technique, strengths, areas for improvement, athletic potential, etc. Be specific and constructive in your assessment."
                rows={6}
                className={`rounded-xl border focus:border-blue-500 focus:ring-blue-500 resize-none ${
                  selectedSubmission?.status === 'finalized' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              <p className="text-sm text-muted-foreground">
                {selectedSubmission?.status === 'finalized'
                  ? 'This submission has been finalized. Your review cannot be modified.'
                  : selectedSubmission?.review?.isSubmitted && selectedSubmission?.status !== 'finalized'
                  ? 'You can update your submitted review until the submission is finalized by the scout admin.'
                  : 'Your detailed feedback will help the student understand their performance and areas for development.'}
              </p>
            </div>

            {/* Your Review Section */}
            {(selectedSubmission?.review || (selectedSubmission?.allReviews && selectedSubmission.allReviews.find(r => r.scoutId === user?.id))) && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground flex items-center">
                  <Star className="w-5 h-5 mr-2 text-yellow-500" />
                  Your Review
                </h4>
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl p-4 border-2 border-yellow-200 dark:border-yellow-800">
                  {(() => {
                    const myReview = selectedSubmission?.review || selectedSubmission?.allReviews?.find(r => r.scoutId === user?.id);
                    if (!myReview) return null;
                    
                    return (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full flex items-center justify-center shadow-sm border-2 border-yellow-300 dark:border-yellow-700">
                              <User className="w-5 h-5 text-yellow-700 dark:text-yellow-300" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-foreground">You</span>
                              {user?.xenId && (
                                <span className="text-xs text-muted-foreground ml-2">({user.xenId})</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {myReview.rating && (
                              <div className="flex items-center space-x-1 bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 rounded-full border border-yellow-300 dark:border-yellow-700">
                                <Star className="w-4 h-4 text-yellow-600 fill-current" />
                                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">{myReview.rating}/5</span>
                              </div>
                            )}
                            <Badge 
                              variant={myReview.isSubmitted ? "default" : "outline"}
                              className={myReview.isSubmitted ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"}
                            >
                              {myReview.isSubmitted ? "Submitted" : "Draft"}
                            </Badge>
                          </div>
                        </div>
                        {myReview.notes && (
                          <p className="text-sm text-foreground bg-background/50 rounded-lg p-3 border border-yellow-100 dark:border-yellow-900/30">
                            {myReview.notes}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground mt-3 flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {myReview.updatedAt 
                            ? `${new Date(myReview.updatedAt).toLocaleDateString()} at ${new Date(myReview.updatedAt).toLocaleTimeString()}`
                            : myReview.createdAt 
                            ? `${new Date(myReview.createdAt).toLocaleDateString()} at ${new Date(myReview.createdAt).toLocaleTimeString()}`
                            : 'Just now'}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Other Scouts' Reviews - Only show submitted reviews */}
            {(selectedSubmission?.allReviews || selectedSubmission?.reviews) && ((selectedSubmission.allReviews?.length || 0) > 0 || (selectedSubmission.reviews?.length || 0) > 0) && (
              ((selectedSubmission.allReviews || selectedSubmission.reviews) || []).filter(r => r.scoutId !== user?.id && r.isSubmitted).length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-foreground flex items-center">
                    <Users className="w-5 h-5 mr-2 text-muted-foreground" />
                    Other Scouts' Reviews
                  </h4>
                  <div className="space-y-3">
                    {((selectedSubmission.allReviews || selectedSubmission.reviews) || [])
                      .filter(r => r.scoutId !== user?.id && r.isSubmitted)
                      .map((review) => (
                      <div key={review.id} className="bg-card rounded-xl p-4 border border shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-sm">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-foreground">{review.scout.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">({review.scout.xenId})</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {review.rating && (
                              <div className="flex items-center space-x-1 bg-yellow-50 px-2 py-1 rounded-full">
                                <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                <span className="text-xs font-medium text-yellow-700">{review.rating}/5</span>
                              </div>
                            )}
                            <Badge 
                              variant={review.isSubmitted ? "default" : "outline"}
                              className={review.isSubmitted ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border"}
                            >
                              {review.isSubmitted ? "Submitted" : "Draft"}
                            </Badge>
                          </div>
                        </div>
                        {review.notes && (
                          <p className="text-sm text-foreground bg-background rounded-lg p-3 border border-gray-100">
                            {review.notes}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground mt-2 flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(review.createdAt).toLocaleDateString()} at {new Date(review.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Action Buttons - Fixed at bottom */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-card border-t border">
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-4">
              <Button 
                variant="outline" 
                onClick={closeReviewModal}
                className="w-full sm:w-auto px-6 py-3 font-semibold rounded-xl border hover:border-gray-400"
              >
                Cancel
              </Button>
              {selectedSubmission?.status !== 'finalized' && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={saveReviewMutation.isPending}
                    className="w-full sm:w-auto px-6 py-3 font-semibold rounded-xl border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    {saveReviewMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Draft
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleSubmitReview}
                    disabled={saveReviewMutation.isPending || !rating}
                    className="w-full sm:w-auto px-8 py-3 font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    {saveReviewMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        {selectedSubmission?.review?.isSubmitted ? 'Updating...' : 'Submitting...'}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {selectedSubmission?.review?.isSubmitted ? 'Update Review' : 'Submit Review'}
                      </>
                    )}
                  </Button>
                </>
              )}
              {selectedSubmission?.status === 'finalized' && (
                <div className="w-full sm:w-auto px-6 py-3 text-sm text-muted-foreground bg-muted rounded-xl flex items-center justify-center">
                  <span>This submission has been finalized. Reviews cannot be edited.</span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
