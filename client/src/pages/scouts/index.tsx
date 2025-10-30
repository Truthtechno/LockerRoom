import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Shield, Eye, Clock, CheckCircle, XCircle, AlertCircle, Star, Play } from "lucide-react";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

type Submission = {
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
  student: {
    id: string;
    name: string;
    profilePicUrl?: string | null;
  };
};

export default function ScoutPortal() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery<{
    submissions: Submission[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/scouts/my-submissions"],
  });

  const submissions = submissionsData?.submissions || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_review":
        return <Badge variant="default" className="bg-blue-600"><Eye className="w-3 h-3 mr-1" />In Review</Badge>;
      case "finalized":
        return <Badge variant="secondary" className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Finalized</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isLoading = submissionsLoading;

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
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        {/* Page Title */}
        <div className="mb-8 px-4 sm:px-6 lg:px-8 pt-8">
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">Scout Portal</h1>
              <p className="text-muted-foreground text-sm lg:text-base">Review student submissions and provide feedback</p>
            </div>
            {user?.role === "scout_admin" && (
              <Button 
                onClick={() => setLocation("/scouts/admin")}
                className="gold-gradient text-accent-foreground"
                data-testid="button-admin-portal"
              >
                <Shield className="w-4 h-4 mr-2" />
                Admin Portal
              </Button>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{submissions?.length || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {submissions?.filter(s => !s.review?.isSubmitted).length || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Reviews</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {submissions?.filter(s => s.review?.isSubmitted).length || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {submissions?.filter(s => s.review?.rating).length > 0 
                  ? (submissions.filter(s => s.review?.rating).reduce((sum, s) => sum + (s.review?.rating || 0), 0) / submissions.filter(s => s.review?.rating).length).toFixed(1)
                  : '0.0'
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submissions List */}
        {submissions && submissions.length > 0 ? (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Assigned Submissions</h2>
            {submissions.map((submission) => (
              <Card key={submission.id} className="overflow-hidden" data-testid={`submission-${submission.id}`}>
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
                      {submission.review?.isSubmitted && (
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />Reviewed
                        </Badge>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {new Date(submission.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-4">
                    {/* Video Preview */}
                    {submission.videoUrl && (
                      <div className="relative">
                        <video
                          src={submission.videoUrl}
                          controls
                          className="w-full max-w-sm sm:max-w-md rounded-lg"
                          data-testid="submission-video"
                        />
                      </div>
                    )}

                    {/* Review Status */}
                    {submission.review && (
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Your Review:</span>
                          {submission.review.rating && (
                            <div className="flex items-center space-x-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              <span className="text-sm">{submission.review.rating}/5</span>
                            </div>
                          )}
                        </div>
                        {submission.review.notes && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {submission.review.notes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Action Button */}
                    <Button
                      onClick={() => setLocation(`/xen-watch/scout-queue`)}
                      className="w-full sm:w-auto"
                      variant={submission.review?.isSubmitted ? "outline" : "default"}
                    >
                      {submission.review?.isSubmitted ? (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          View Review
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          {submission.review ? 'Update Review' : 'Start Review'}
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
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Submissions Assigned</h3>
            <p className="text-muted-foreground mb-6">
              You don't have any submissions assigned for review at the moment.
            </p>
            <div className="text-sm text-muted-foreground">
              Submissions will appear here when students submit content for review.
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}