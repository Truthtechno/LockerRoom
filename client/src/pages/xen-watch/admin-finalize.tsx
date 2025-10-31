import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, Clock, CheckCircle, Star, Send, Play, User, X, MessageSquare } from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SubmissionWithReviews } from "@shared/schema";

export default function AdminFinalize() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithReviews | null>(null);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [finalRating, setFinalRating] = useState<number | null>(null);
  const [summary, setSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch submissions from the real API
  const { data: submissionsData, isLoading } = useQuery<{
    submissions: SubmissionWithReviews[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/xen-watch/admin/submissions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/xen-watch/admin/submissions");
      if (!response.ok) throw new Error('Failed to fetch submissions');
      return response.json();
    }
  });

  const submissions = submissionsData?.submissions || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_review":
        return <Badge variant="default" className="bg-blue-600"><Eye className="w-3 h-3 mr-1" />In Review</Badge>;
      case "finalized":
        return <Badge variant="secondary" className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Finalized</Badge>;
      case "rejected":
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openFinalizeModal = (submission: SubmissionWithReviews) => {
    setSelectedSubmission(submission);
    setFinalRating(submission.finalFeedback?.finalRating || null);
    setSummary(submission.finalFeedback?.summary || '');
    setIsFinalizeModalOpen(true);
  };

  const closeFinalizeModal = () => {
    setSelectedSubmission(null);
    setFinalRating(null);
    setSummary('');
    setIsFinalizeModalOpen(false);
  };

  const finalizeSubmissionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubmission) throw new Error('No submission selected');
      
      const response = await apiRequest("POST", `/api/xen-watch/finalize/${selectedSubmission.id}`, {
        finalRating,
        summary: summary.trim() || null
      });
      
      if (!response.ok) throw new Error('Failed to finalize submission');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Submission Finalized",
        description: "Final feedback has been published to the student.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/admin/submissions"] });
      closeFinalizeModal();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to finalize submission",
        variant: "destructive",
      });
    }
  });

  const handleFinalize = () => {
    finalizeSubmissionMutation.mutate();
  };

  const calculateAverageRating = (reviews: any[]) => {
    const submittedReviews = reviews.filter(r => r.isSubmitted && r.rating);
    if (submittedReviews.length === 0) return null;
    
    const sum = submittedReviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    return (sum / submittedReviews.length).toFixed(1);
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
      <Sidebar />
      <MobileNav />
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Header */}
        <div className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Admin Finalize</h1>
                  <p className="text-sm text-muted-foreground">Review scout feedback and publish final results</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Finalization</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {submissions.filter(s => s.status === 'in_review').length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Finalized</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {submissions.filter(s => s.status === 'finalized').length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{submissions.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Scout Rating</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {submissions.length > 0 
                    ? calculateAverageRating(submissions.flatMap(s => s.reviews)) || "N/A"
                    : "N/A"
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Submissions List */}
          {submissions && submissions.length > 0 ? (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Submissions Awaiting Finalization</h2>
              {submissions.map((submission) => (
                <Card key={submission.id} className="overflow-hidden">
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base sm:text-lg truncate">
                            {submission.student.name}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            Submission #{submission.id.slice(-8)}
                          </CardDescription>
                          <div className="text-xs text-muted-foreground mt-1">
                            {submission.notes && `Notes: ${submission.notes}`}
                            {submission.promoCode && ` • Promo Code: ${submission.promoCode}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                        {getStatusBadge(submission.status)}
                        <div className="text-xs text-muted-foreground">
                          {new Date(submission.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-4 sm:p-6">
                    <div className="space-y-4">
                      {/* Scout Reviews Summary */}
                      <div className="bg-muted rounded-lg p-3 sm:p-4">
                        <h4 className="font-semibold mb-3 text-sm sm:text-base">Scout Reviews ({submission.reviews.length})</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                          {submission.reviews.map((review) => (
                            <div key={review.id} className="flex items-center justify-between p-2 bg-background rounded">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">{review.scout.name}</span>
                                <span className="text-xs text-muted-foreground">({review.scout.xenId})</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                {review.rating && (
                                  <div className="flex items-center space-x-1">
                                    <Star className="w-4 h-4 text-yellow-500" />
                                    <span className="text-sm">{review.rating}/5</span>
                                  </div>
                                )}
                                <Badge variant={review.isSubmitted ? "default" : "outline"} className="text-xs">
                                  {review.isSubmitted ? "Submitted" : "Draft"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                        {submission.reviews.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between text-sm">
                              <span>Average Rating:</span>
                              <span className="font-medium">
                                {calculateAverageRating(submission.reviews) || "N/A"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Video Preview */}
                      {submission.videoUrl && (
                        <div className="relative">
                          <video
                            src={submission.videoUrl}
                            controls
                            className="w-full max-w-sm sm:max-w-md rounded-lg"
                          />
                        </div>
                      )}

                      {/* Action Button */}
                      <Button
                        onClick={() => openFinalizeModal(submission)}
                        className="w-full sm:w-auto"
                        disabled={submission.status === 'finalized'}
                      >
                        {submission.status === 'finalized' ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Already Finalized
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Finalize Submission
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Submissions to Finalize</h3>
              <p className="text-muted-foreground">
                All submissions have been finalized or there are no submissions yet.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Finalize Modal */}
      <Dialog open={isFinalizeModalOpen} onOpenChange={closeFinalizeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Finalize Submission</DialogTitle>
            <DialogDescription>
              Review scout feedback and publish final results to the student.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 overflow-y-auto max-h-[60vh]">
            {/* Student Info */}
            {selectedSubmission && (
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold mb-2">Student: {selectedSubmission.student.name}</h4>
                <p className="text-sm text-muted-foreground">
                  Submission #{selectedSubmission.id.slice(-8)}
                </p>
                {selectedSubmission.notes && (
                  <p className="text-sm mt-2">
                    <strong>Student Notes:</strong> {selectedSubmission.notes}
                  </p>
                )}
              </div>
            )}

            {/* Scout Reviews */}
            {selectedSubmission && selectedSubmission.reviews.length > 0 && (
              <div className="space-y-3">
                <Label>Scout Reviews</Label>
                {selectedSubmission.reviews.map((review) => (
                  <div key={review.id} className="bg-muted rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{review.scout.name} ({review.scout.xenId})</span>
                      <div className="flex items-center space-x-2">
                        {review.rating && (
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm">{review.rating}/5</span>
                          </div>
                        )}
                        <Badge variant={review.isSubmitted ? "default" : "outline"} className="text-xs">
                          {review.isSubmitted ? "Submitted" : "Draft"}
                        </Badge>
                      </div>
                    </div>
                    {review.notes && (
                      <p className="text-sm text-muted-foreground">{review.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Video Player */}
            {selectedSubmission?.videoUrl && (
              <div className="space-y-2">
                <Label>Performance Video</Label>
                <video
                  src={selectedSubmission.videoUrl}
                  controls
                  className="w-full rounded-lg"
                />
              </div>
            )}

            {/* Final Rating */}
            <div className="space-y-2">
              <Label>Final Rating (1-5)</Label>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFinalRating(star)}
                    className={`p-2 rounded-lg transition-colors ${
                      finalRating && star <= finalRating
                        ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-950/30'
                        : 'text-muted-foreground hover:text-yellow-500'
                    }`}
                  >
                    <Star className="w-6 h-6 fill-current" />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Optional: Provide a final overall rating
              </p>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label>Final Summary</Label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Provide a comprehensive summary of the scout feedback and final assessment..."
                rows={6}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={closeFinalizeModal}>
              Cancel
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={finalizeSubmissionMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              Publish Final Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
