import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  Eye, 
  Clock, 
  CheckCircle, 
  MessageCircle,
  DollarSign,
  User,
  Video,
  Send,
  Users
} from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import { timeAgo } from "@/lib/timeAgo";

interface Submission {
  id: string;
  studentId: string;
  schoolId?: string;
  postId?: string;
  mediaUrl?: string;
  mediaPublicId?: string;
  caption?: string;
  amountCents: number;
  currency: string;
  paymentProvider?: string;
  paymentIntentId?: string;
  paidAt?: string;
  status: string;
  selectedScoutId?: string;
  createdAt: string;
  updatedAt: string;
}

interface Scout {
  id: string;
  xenId: string;
  name: string;
}

const statusConfig = {
  pending_payment: {
    label: "Payment Pending",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    icon: DollarSign
  },
  paid: {
    label: "Paid",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    icon: CheckCircle
  },
  assigned: {
    label: "Assigned to Scout",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    icon: Users
  },
  in_review: {
    label: "Under Review",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    icon: Clock
  },
  reviewed: {
    label: "Reviewed",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    icon: CheckCircle
  },
  feedback_sent: {
    label: "Feedback Sent",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    icon: MessageCircle
  },
  canceled: {
    label: "Canceled",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    icon: Clock
  },
  refunded: {
    label: "Refunded",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    icon: DollarSign
  }
};

export default function ScoutSubmissionsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Fetch submissions
  const { data: submissions, isLoading, error } = useQuery<Submission[]>({
    queryKey: ["/api/xen-watch/submissions", { assignedTo: 'all', status: statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('assignedTo', 'all');
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      const response = await apiRequest("GET", `/api/xen-watch/submissions?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch submissions');
      const data = await response.json();
      return data.submissions;
    },
    retry: 3
  });

  // Fetch scouts for assignment
  const { data: scouts } = useQuery<Scout[]>({
    queryKey: ["/api/admin/scouts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/scouts");
      if (!response.ok) throw new Error('Failed to fetch scouts');
      const data = await response.json();
      return data.scouts;
    }
  });

  // Assign submission mutation
  const assignSubmissionMutation = useMutation({
    mutationFn: async ({ submissionId, scoutId }: { submissionId: string; scoutId: string }) => {
      const response = await apiRequest("PATCH", `/api/xen-watch/submissions/${submissionId}/assign`, {
        scoutProfileId: scoutId
      });
      if (!response.ok) throw new Error('Failed to assign submission');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Submission Assigned",
        description: "The submission has been assigned to the scout successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/submissions"] });
    },
    onError: (error) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign submission. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Send feedback mutation
  const sendFeedbackMutation = useMutation({
    mutationFn: async ({ submissionId, message }: { submissionId: string; message: string }) => {
      const response = await apiRequest("POST", `/api/xen-watch/submissions/${submissionId}/final-feedback`, {
        message
      });
      if (!response.ok) throw new Error('Failed to send feedback');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback Sent",
        description: "The feedback has been sent to the player successfully.",
      });
      setShowFeedbackModal(false);
      setFeedbackMessage('');
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/submissions"] });
    },
    onError: (error) => {
      toast({
        title: "Feedback Failed",
        description: error.message || "Failed to send feedback. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleAssignSubmission = (submissionId: string, scoutId: string) => {
    assignSubmissionMutation.mutate({ submissionId, scoutId });
  };

  const handleSendFeedback = () => {
    if (!selectedSubmission || !feedbackMessage.trim()) return;
    sendFeedbackMutation.mutate({
      submissionId: selectedSubmission.id,
      message: feedbackMessage.trim()
    });
  };

  const filteredSubmissions = submissions?.filter(submission => {
    const matchesSearch = searchTerm === '' || 
      submission.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.caption?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Manage Submissions</h1>
            <p className="text-muted-foreground">
              Review and manage XEN Watch submissions
            </p>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="search">Search Submissions</Label>
                  <Input
                    id="search"
                    placeholder="Search by ID or caption..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="sm:w-48">
                  <Label htmlFor="status">Filter by Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending_payment">Payment Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="feedback_sent">Feedback Sent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submissions List */}
          <div className="space-y-4">
            {filteredSubmissions?.map((submission) => {
              const statusInfo = statusConfig[submission.status as keyof typeof statusConfig];
              const StatusIcon = statusInfo.icon;
              
              return (
                <Card key={submission.id} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <StatusIcon className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <h3 className="font-semibold">Submission #{submission.id.slice(-8)}</h3>
                            <p className="text-sm text-muted-foreground">
                              Created {timeAgo(submission.createdAt)}
                            </p>
                          </div>
                        </div>
                        <Badge className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSubmission(submission);
                            setShowDetailModal(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                        
                        {submission.status === 'paid' && (
                          <Select onValueChange={(scoutId) => handleAssignSubmission(submission.id, scoutId)}>
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Assign to Scout" />
                            </SelectTrigger>
                            <SelectContent>
                              {scouts?.map((scout) => (
                                <SelectItem key={scout.id} value={scout.id}>
                                  {scout.name} ({scout.xenId})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {submission.status === 'reviewed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSubmission(submission);
                              setShowFeedbackModal(true);
                            }}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Send Feedback
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Video Preview */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Video Content</Label>
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                          {submission.postId ? (
                            <div className="text-center">
                              <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">Linked to Post</p>
                            </div>
                          ) : submission.mediaUrl ? (
                            <video
                              src={submission.mediaUrl}
                              className="w-full h-full object-cover rounded-lg"
                              controls
                            />
                          ) : (
                            <div className="text-center">
                              <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">Video not available</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Submission Details */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Details</Label>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount:</span>
                            <span className="font-medium">${(submission.amountCents / 100).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Payment:</span>
                            <span className="font-medium">
                              {submission.paymentProvider || 'Not specified'}
                            </span>
                          </div>
                          {submission.paidAt && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Paid:</span>
                              <span className="font-medium">{timeAgo(submission.paidAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Notes */}
                      {submission.caption && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Player Notes</Label>
                          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                            {submission.caption}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredSubmissions?.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Eye className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Submissions Found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'No submissions match your current filters.'
                    : 'No submissions have been created yet.'
                  }
                </p>
              </CardContent>
            </Card>
          )}

          {/* Detail Modal */}
          <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Submission Details</DialogTitle>
                <DialogDescription>
                  Detailed information about submission #{selectedSubmission?.id.slice(-8)}
                </DialogDescription>
              </DialogHeader>
              
              {selectedSubmission && (
                <ScrollArea className="max-h-[60vh]">
                  <div className="space-y-6 p-1">
                    {/* Video Section */}
                    <div>
                      <h4 className="font-medium mb-3">Video Content</h4>
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        {selectedSubmission.postId ? (
                          <div className="text-center">
                            <Video className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-muted-foreground">Linked to Post</p>
                            <Button variant="outline" size="sm" className="mt-2">
                              View Original Post
                            </Button>
                          </div>
                        ) : selectedSubmission.mediaUrl ? (
                          <video
                            src={selectedSubmission.mediaUrl}
                            className="w-full h-full object-contain rounded-lg"
                            controls
                          />
                        ) : (
                          <div className="text-center">
                            <Video className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-muted-foreground">Video not available</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Payment Information</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount:</span>
                            <span>${(selectedSubmission.amountCents / 100).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Currency:</span>
                            <span>{selectedSubmission.currency}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Provider:</span>
                            <span>{selectedSubmission.paymentProvider || 'Not specified'}</span>
                          </div>
                          {selectedSubmission.paidAt && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Paid:</span>
                              <span>{timeAgo(selectedSubmission.paidAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Timeline</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created:</span>
                            <span>{timeAgo(selectedSubmission.createdAt)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Updated:</span>
                            <span>{timeAgo(selectedSubmission.updatedAt)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge className={statusConfig[selectedSubmission.status as keyof typeof statusConfig].color}>
                              {statusConfig[selectedSubmission.status as keyof typeof statusConfig].label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Player Notes */}
                    {selectedSubmission.caption && (
                      <div>
                        <h4 className="font-medium mb-2">Player Notes</h4>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                          {selectedSubmission.caption}
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </DialogContent>
          </Dialog>

          {/* Feedback Modal */}
          <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Send Final Feedback</DialogTitle>
                <DialogDescription>
                  Send detailed feedback to the player for submission #{selectedSubmission?.id.slice(-8)}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="feedback">Feedback Message</Label>
                  <Textarea
                    id="feedback"
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="Provide detailed feedback on the player's performance..."
                    rows={6}
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowFeedbackModal(false)}
                    disabled={sendFeedbackMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendFeedback}
                    disabled={sendFeedbackMutation.isPending || !feedbackMessage.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {sendFeedbackMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Feedback
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
