import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Eye, Clock, CheckCircle, Upload, Plus, Star, MessageSquare, X, Search, Filter, ArrowUpDown, User, Calendar, Play, Pause, Users, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import type { StudentSubmission, StudentSubmissionsResponse } from "@shared/schema";

export default function XenWatch() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Filter and sort state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Modal state
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery<StudentSubmissionsResponse>({
    queryKey: ["/api/xen-watch/submissions/me"],
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  const submissions = submissionsData?.submissions || [];
  const studentInfo = submissionsData?.student;

  // Handle URL parameters to open specific submission
  useEffect(() => {
    if (!submissions.length || !location) return;

    const urlParams = new URLSearchParams(window.location.search);
    const submissionId = urlParams.get('submissionId');
    const showFeedback = urlParams.get('showFeedback') === 'true';

    if (submissionId) {
      const submission = submissions.find(s => s.id === submissionId);
      if (submission) {
        setSelectedSubmission(submission);
        setIsFeedbackModalOpen(true);
        
        // If showFeedback is true, scroll to feedback section after modal opens
        if (showFeedback) {
          // Small delay to ensure modal is rendered before scrolling
          setTimeout(() => {
            const feedbackSection = document.querySelector('[data-feedback-section]');
            if (feedbackSection) {
              feedbackSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              // Highlight the feedback section briefly
              feedbackSection.classList.add('ring-2', 'ring-green-500', 'ring-offset-2', 'transition-all', 'duration-1000');
              setTimeout(() => {
                feedbackSection.classList.remove('ring-2', 'ring-green-500', 'ring-offset-2');
              }, 2000);
            }
          }, 300);
        }
        
        // Clean up URL parameters after opening
        const newUrl = location.split('?')[0];
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [submissions, location]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const total = submissions.length;
    const inReview = submissions.filter(s => s.status === 'in_review').length;
    const finalized = submissions.filter(s => s.status === 'finalized').length;
    const avgRating = submissions
      .filter(s => s.finalFeedback?.finalRating)
      .reduce((sum, s) => sum + (s.finalFeedback?.finalRating || 0), 0) / 
      Math.max(submissions.filter(s => s.finalFeedback?.finalRating).length, 1);

    return { total, inReview, finalized, avgRating };
  }, [submissions]);

  // Filter and sort submissions
  const filteredAndSortedSubmissions = useMemo(() => {
    let filtered = submissions;

    // Filter by status
    if (statusFilter !== 'all') {
      if (statusFilter === 'in_review') {
        filtered = filtered.filter(s => s.status === 'in_review');
      } else if (statusFilter === 'finalized') {
        filtered = filtered.filter(s => s.status === 'finalized');
      } else if (statusFilter === 'rejected') {
        filtered = filtered.filter(s => s.status === 'rejected');
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
      
      filtered = filtered.filter(s => new Date(s.createdAt) >= filterDate);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.id.toLowerCase().includes(query) ||
        (s.notes && s.notes.toLowerCase().includes(query)) ||
        (s.promoCode && s.promoCode.toLowerCase().includes(query))
      );
    }

    // Sort submissions
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'rating':
          const aRating = a.finalFeedback?.finalRating || 0;
          const bRating = b.finalFeedback?.finalRating || 0;
          comparison = aRating - bRating;
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [submissions, statusFilter, dateFilter, searchQuery, sortBy, sortOrder]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_review":
        return <Badge variant="default" className="bg-blue-600 text-white"><Eye className="w-3 h-3 mr-1" />In Review</Badge>;
      case "finalized":
        return <Badge variant="secondary" className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Finalized</Badge>;
      case "rejected":
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isLoading = submissionsLoading;

  // Modal functions
  const openFeedbackModal = (submission: StudentSubmission) => {
    setSelectedSubmission(submission);
    setIsFeedbackModalOpen(true);
  };

  const closeFeedbackModal = () => {
    setSelectedSubmission(null);
    setIsFeedbackModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
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
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">XEN Watch</h1>
                <p className="text-muted-foreground text-sm lg:text-base">
                  Submit content for professional scout review
                </p>
              </div>
              <Button 
                onClick={() => setLocation("/xen-watch/submit")}
                className="gold-gradient text-accent-foreground flex items-center space-x-2"
                data-testid="button-submit-content"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Content</span>
              </Button>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                <div className="p-2 bg-muted rounded-lg">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground mb-1">
                  {stats.total}
                </div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Review</CardTitle>
                <div className="p-2 bg-muted rounded-lg">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {stats.inReview}
                </div>
                <p className="text-xs text-muted-foreground">Pending feedback</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Finalized</CardTitle>
                <div className="p-2 bg-muted rounded-lg">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {stats.finalized}
                </div>
                <p className="text-xs text-muted-foreground">Completed reviews</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
                <div className="p-2 bg-muted rounded-lg">
                  <Star className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600 mb-1">
                  {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">Out of 5 stars</p>
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
                      placeholder="Submission ID, notes..."
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
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="finalized">Finalized</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
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
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="rating">Rating</SelectItem>
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
                <h2 className="text-xl font-bold text-foreground">My Submissions</h2>
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
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Submission ID</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Student</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">School</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Position</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Date</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Rating</th>
                          <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredAndSortedSubmissions.map((submission) => (
                          <tr key={submission.id} className="hover:bg-background transition-colors duration-150">
                            <td className="px-6 py-4">
                              <span className="text-sm text-muted-foreground font-mono">
                                #{submission.id.slice(-8)}
                              </span>
                            </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{studentInfo?.name || user?.name || 'Student'}</div>
                      <div className="text-xs text-muted-foreground">You</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-foreground">
                    {studentInfo?.school?.name || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-foreground">
                    {studentInfo?.position || 'N/A'}
                  </span>
                </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-muted-foreground">
                                {new Date(submission.createdAt).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                {getStatusBadge(submission.status)}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {submission.finalFeedback?.finalRating ? (
                                <div className="flex items-center space-x-1">
                                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                  <span className="text-sm font-medium">
                                    {submission.finalFeedback.finalRating}/5
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <Button
                                  onClick={() => openFeedbackModal(submission)}
                                  variant="outline"
                                  size="sm"
                                  className="px-4 py-2"
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Full Feedback
                                </Button>
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
                  <h3 className="text-base font-semibold text-foreground">{studentInfo?.name || user?.name || 'Student'}</h3>
                  <p className="text-sm text-muted-foreground">#{submission.id.slice(-8)}</p>
                </div>
                        </div>
                        {getStatusBadge(submission.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-4">
                        <div>
                          <span className="font-medium">School:</span> {studentInfo?.school?.name || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Position:</span> {studentInfo?.position || 'N/A'}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Date:</span> {new Date(submission.createdAt).toLocaleDateString()}
                        </div>
                        {submission.finalFeedback?.finalRating && (
                          <div className="col-span-2 flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="font-medium">Rating: {submission.finalFeedback.finalRating}/5</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Button
                          onClick={() => openFeedbackModal(submission)}
                          variant="outline"
                          className="w-full"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Full Feedback
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Student Information Card */}
              {studentInfo && (
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 rounded-xl shadow-sm overflow-hidden">
                        <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 flex items-center justify-center">
                          <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-foreground mb-2">{studentInfo.name}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          {studentInfo.school && (
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-muted-foreground">School:</span>
                              <span className="text-foreground">{studentInfo.school.name}</span>
                            </div>
                          )}
                          {studentInfo.position && (
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-muted-foreground">Position:</span>
                              <span className="text-foreground">{studentInfo.position}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* No Submissions Message */}
              <Card className="bg-card border shadow-sm">
                <CardContent className="text-center py-16">
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                    <Upload className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">No Submissions Found</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-4">
                    {searchQuery || statusFilter !== 'all' || dateFilter !== 'all' 
                      ? "No submissions match your current filters. Try adjusting your search criteria."
                      : "You haven't submitted any content for review yet. Share your athletic highlights and get professional feedback from our scout team."
                    }
                  </p>
                  {(searchQuery || statusFilter !== 'all' || dateFilter !== 'all') ? (
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
                  ) : (
                    <Button 
                      onClick={() => setLocation("/xen-watch/submit")}
                      className="gold-gradient text-accent-foreground mt-4"
                      data-testid="button-submit-first"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Submit Your First Content
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Full Feedback Modal */}
      <Dialog open={isFeedbackModalOpen} onOpenChange={setIsFeedbackModalOpen}>
        <DialogContent className="max-w-6xl h-[95vh] sm:h-[90vh] flex flex-col bg-card p-0 mx-4 sm:mx-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 flex-shrink-0">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground">Submission Details</DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-muted-foreground">
              Complete feedback and reviews from our scout team
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 space-y-6 sm:space-y-8 min-h-0 pb-4">
            {selectedSubmission && (
              <>
                {/* Student Information */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 sm:p-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex flex-col sm:flex-row sm:items-start space-y-4 sm:space-y-0 sm:space-x-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl shadow-sm mx-auto sm:mx-0 overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 flex items-center justify-center">
                        <User className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h4 className="text-lg sm:text-xl font-bold text-foreground mb-2">{studentInfo?.name || user?.name || 'Student'}</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Submission #{selectedSubmission.id.slice(-8)}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                        {studentInfo?.school && (
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-muted-foreground">School:</span>
                            <span className="text-foreground">{studentInfo.school.name}</span>
                          </div>
                        )}
                        {studentInfo?.position && (
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-muted-foreground">Position:</span>
                            <span className="text-foreground">{studentInfo.position}</span>
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
                    <div className="flex justify-center sm:justify-end">
                      {getStatusBadge(selectedSubmission.status)}
                    </div>
                  </div>
                </div>

                {/* Video Player */}
                {selectedSubmission.videoUrl && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Video Submission</h3>
                    <div className="relative bg-black rounded-lg overflow-hidden">
                      <video
                        src={selectedSubmission.videoUrl}
                        controls
                        className="w-full h-auto max-h-96"
                        data-testid="modal-submission-video"
                      />
                    </div>
                  </div>
                )}

                {/* Review Progress */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Review Progress</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Scout Reviews</span>
                      <span className="font-medium">
                        {selectedSubmission.reviewProgress.submittedCount} / {selectedSubmission.reviewProgress.totalScouts} scouts
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${(selectedSubmission.reviewProgress.submittedCount / selectedSubmission.reviewProgress.totalScouts) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Final Feedback */}
                {selectedSubmission.finalFeedback && (
                  <div className="space-y-4" data-feedback-section>
                    <h3 className="text-lg font-semibold text-foreground">Final Assessment</h3>
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 sm:p-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        <h4 className="text-lg font-semibold text-green-800 dark:text-green-200">Overall Rating</h4>
                      </div>
                      
                      {selectedSubmission.finalFeedback.finalRating && (
                        <div className="flex items-center space-x-2 mb-4">
                          <div className="flex space-x-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-5 h-5 ${
                                  i < selectedSubmission.finalFeedback!.finalRating!
                                    ? 'text-yellow-500 fill-current'
                                    : 'text-gray-300 dark:text-gray-600'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-lg font-medium text-green-800 dark:text-green-200">
                            {selectedSubmission.finalFeedback.finalRating}/5
                          </span>
                        </div>
                      )}

                      {selectedSubmission.finalFeedback.summary && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-green-800 dark:text-green-200">Summary</h5>
                          <p className="text-sm text-green-700 dark:text-green-300 leading-relaxed">
                            {selectedSubmission.finalFeedback.summary}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Finalized: {new Date(selectedSubmission.finalFeedback.publishedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Individual Scout Reviews - Only show submitted reviews for privacy */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Individual Scout Reviews</h3>
                  {selectedSubmission.reviews && selectedSubmission.reviews.filter(review => review.isSubmitted).length > 0 ? (
                    <div className="space-y-4">
                      {selectedSubmission.reviews
                        .filter(review => review.isSubmitted)
                        .map((review, index) => (
                        <div key={review.id} className="border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium text-foreground">
                                    {review.scout?.name || `Scout ${index + 1}`}
                                  </h4>
                                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                    Submitted
                                  </span>
                                </div>
                                {review.rating && (
                                  <div className="flex space-x-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-4 h-4 ${
                                          i < review.rating!
                                            ? 'text-yellow-500 fill-current'
                                            : 'text-gray-300 dark:text-gray-600'
                                        }`}
                                      />
                                    ))}
                                    <span className="ml-1 text-sm font-medium text-foreground">
                                      {review.rating}/5
                                    </span>
                                  </div>
                                )}
                              </div>
                              {review.notes ? (
                                <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                                  {review.notes}
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">
                                  No additional notes provided
                                </p>
                              )}
                              <div className="text-xs text-muted-foreground">
                                Submitted: {new Date(review.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No scout reviews available yet</p>
                      <p className="text-sm mt-2">Reviews will appear here once scouts submit their feedback</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
