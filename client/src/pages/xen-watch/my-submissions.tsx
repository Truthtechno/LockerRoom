import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Eye, Clock, CheckCircle, MessageCircle, DollarSign, Calendar } from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import { timeAgo } from "@/lib/timeAgo";
import type { XenWatchSubmission } from "@shared/schema";

const statusConfig = {
  in_review: {
    label: "Under Review",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    icon: Clock
  },
  finalized: {
    label: "Review Complete",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    icon: CheckCircle
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    icon: Clock
  }
};

export default function MySubmissions() {
  const { toast } = useToast();

  // Fetch user's submissions
  const { data: submissionsData, isLoading, error } = useQuery<{
    submissions: XenWatchSubmission[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/xen-watch/submissions/me"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/xen-watch/submissions/me");
      if (!response.ok) throw new Error('Failed to fetch submissions');
      return response.json();
    },
    retry: 3
  });

  const submissions = submissionsData?.submissions || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <div className="text-destructive mb-4">
                Failed to load submissions
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
      <div className="lg:pl-64">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">My XEN Watch Submissions</h1>
            <p className="text-muted-foreground">
              Track your video submissions and scout feedback
            </p>
          </div>

          {/* Submissions List */}
          {submissions && submissions.length > 0 ? (
            <div className="space-y-6">
              {submissions.map((submission) => {
                const statusInfo = statusConfig[submission.status];
                const StatusIcon = statusInfo.icon;
                
                return (
                  <Card key={submission.id} className="overflow-hidden">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <StatusIcon className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <CardTitle className="text-lg">
                              Submission #{submission.id.slice(-8)}
                            </CardTitle>
                            <CardDescription>
                              Created {timeAgo(submission.createdAt)}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Video Preview */}
                        <div className="space-y-3">
                          <h4 className="font-medium">Video Content</h4>
                          {submission.videoUrl ? (
                            <video
                              src={submission.videoUrl}
                              className="w-full aspect-video object-cover rounded-lg"
                              controls
                            />
                          ) : (
                            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                              <div className="text-center">
                                <Eye className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">Video not available</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Submission Details */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Submission Details</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <span className="font-medium">{statusInfo.label}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Submitted:</span>
                                <span className="font-medium">{timeAgo(submission.createdAt)}</span>
                              </div>
                              {submission.updatedAt && submission.updatedAt !== submission.createdAt && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Last Updated:</span>
                                  <span className="font-medium">{timeAgo(submission.updatedAt)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {submission.notes && (
                            <div>
                              <h4 className="font-medium mb-2">Your Notes</h4>
                              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                                {submission.notes}
                              </p>
                            </div>
                          )}

                          {/* Final Feedback Section */}
                          {submission.status === 'finalized' && submission.finalFeedback && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              <h4 className="font-medium mb-3 text-emerald-800 dark:text-emerald-200 flex items-center">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Final Scout Feedback
                              </h4>
                              {submission.finalFeedback.finalRating && (
                                <div className="mb-3">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Overall Rating:</span>
                                    <div className="flex items-center space-x-1">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                          key={star}
                                          className={`text-lg ${
                                            star <= submission.finalFeedback.finalRating
                                              ? 'text-yellow-500'
                                              : 'text-gray-300 dark:text-gray-600'
                                          }`}
                                        >
                                          ★
                                        </span>
                                      ))}
                                    </div>
                                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                      {submission.finalFeedback.finalRating}/5
                                    </span>
                                  </div>
                                </div>
                              )}
                              {submission.finalFeedback.summary && (
                                <div>
                                  <p className="text-sm text-emerald-700 dark:text-emerald-300 bg-white/50 dark:bg-black/20 p-3 rounded border border-emerald-200 dark:border-emerald-700">
                                    {submission.finalFeedback.summary}
                                  </p>
                                </div>
                              )}
                              {submission.finalFeedback.publishedAt && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                                  Feedback published {timeAgo(submission.finalFeedback.publishedAt)}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Status Messages */}
                          <div className="pt-4">
                            {submission.status === 'in_review' && (
                              <div className="text-center">
                                <Clock className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                                <p className="text-sm text-muted-foreground">
                                  Your submission is being reviewed by our professional scouts
                                </p>
                              </div>
                            )}
                            {submission.status === 'finalized' && (
                              <div className="text-center">
                                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                                <p className="text-sm text-muted-foreground">
                                  Review complete! Check the feedback above.
                                </p>
                              </div>
                            )}
                            {submission.status === 'rejected' && (
                              <div className="text-center">
                                <Clock className="w-8 h-8 mx-auto mb-2 text-red-500" />
                                <p className="text-sm text-muted-foreground">
                                  This submission was not approved for review.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Eye className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Submissions Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Submit your first video for professional scout review and get detailed feedback on your performance.
                </p>
                <Button 
                  onClick={() => window.location.href = '/profile'}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Submit Video for Review
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
