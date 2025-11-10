import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Plus, Edit, Trash2, Eye, Search, Filter, Calendar, User, School, MapPin, Download, CheckCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadToCloudinary } from "@/lib/cloudinary";
import * as XLSX from 'xlsx';
import { Upload, X as XIcon } from "lucide-react";

type FormFieldType = 'short_text' | 'paragraph' | 'star_rating' | 'multiple_choice' | 'multiple_selection' | 'number' | 'date' | 'dropdown' | 'section_header';

type FormField = {
  id: string;
  fieldType: FormFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  orderIndex: number;
  options?: Array<{ value: string; label: string }> | string; // Can be JSON string from DB
};

// Helper to parse options
const parseOptions = (options: FormField['options']): Array<{ value: string; label: string }> => {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  try {
    return JSON.parse(options as string);
  } catch {
    return [];
  }
};

type FormTemplate = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  fields: FormField[];
};

type SubmissionResponse = {
  fieldId: string;
  responseValue: string;
};

type Submission = {
  id: string;
  formTemplateId: string;
  submittedBy: string;
  studentId?: string | null;
  studentName?: string | null;
  studentProfilePicUrl?: string | null;
  studentPosition?: string | null;
  studentHeight?: string | null;
  studentWeight?: string | null;
  studentRoleNumber?: string | null;
  studentSport?: string | null;
  studentSchoolId?: string | null;
  studentSchoolName?: string | null;
  status: 'draft' | 'submitted';
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  responses: SubmissionResponse[];
  submittedByUser?: {
    id: string;
    name: string;
  };
  formTemplate?: FormTemplate;
};

type SubmissionsResponse = {
  submissions: Submission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function EvaluationSubmissions() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFormId, setSelectedFormId] = useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'submitted' | 'draft'>('submitted');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScout, setSelectedScout] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data: forms, isLoading: formsLoading } = useQuery<FormTemplate[]>({
    queryKey: ["/api/evaluation-forms/templates"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/evaluation-forms/templates?status=active");
      if (!response.ok) throw new Error("Failed to fetch forms");
      return response.json();
    },
  });

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery<SubmissionsResponse>({
    queryKey: ["/api/evaluation-forms/submissions", selectedFormId, activeTab, selectedScout, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: activeTab,
        page: page.toString(),
        limit: "20",
      });
      
      if (selectedFormId && selectedFormId !== "all") {
        params.append("form_template_id", selectedFormId);
      }
      
      if (selectedScout !== "all" && user?.role !== 'xen_scout') {
        params.append("submitted_by", selectedScout);
      }
      
      const response = await apiRequest("GET", `/api/evaluation-forms/submissions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch submissions");
      return response.json();
    },
    enabled: true,
  });

  // Separate lightweight count queries for tab badges
  const { data: submittedCountData } = useQuery<SubmissionsResponse>({
    queryKey: ["/api/evaluation-forms/submissions", "count", selectedFormId, selectedScout, "submitted"],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "submitted", page: "1", limit: "1" });
      if (selectedFormId && selectedFormId !== "all") {
        params.append("form_template_id", selectedFormId);
      }
      if (selectedScout !== "all" && user?.role !== 'xen_scout') {
        params.append("submitted_by", selectedScout);
      }
      const response = await apiRequest("GET", `/api/evaluation-forms/submissions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch submitted count");
      return response.json();
    },
  });

  const { data: draftCountData } = useQuery<SubmissionsResponse>({
    queryKey: ["/api/evaluation-forms/submissions", "count", selectedFormId, selectedScout, "draft"],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "draft", page: "1", limit: "1" });
      if (selectedFormId && selectedFormId !== "all") {
        params.append("form_template_id", selectedFormId);
      }
      if (selectedScout !== "all" && user?.role !== 'xen_scout') {
        params.append("submitted_by", selectedScout);
      }
      const response = await apiRequest("GET", `/api/evaluation-forms/submissions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch draft count");
      return response.json();
    },
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/evaluation-forms/submissions/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to delete submission");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-forms/submissions"] });
      toast({
        title: "Submission Deleted",
        description: "Submission has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete submission.",
        variant: "destructive",
      });
    },
  });

  const filteredSubmissions = useMemo(() => {
    if (!submissionsData?.submissions) return [];
    
    let filtered = submissionsData.submissions;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sub => 
        sub.studentName?.toLowerCase().includes(query) ||
        sub.studentSchoolName?.toLowerCase().includes(query) ||
        sub.formTemplate?.name.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [submissionsData, searchQuery]);

  const uniqueScouts = useMemo(() => {
    if (!submissionsData?.submissions) return [];
    const scouts = new Map<string, { id: string; name: string }>();
    submissionsData.submissions.forEach(sub => {
      if (sub.submittedByUser) {
        scouts.set(sub.submittedByUser.id, sub.submittedByUser);
      }
    });
    return Array.from(scouts.values());
  }, [submissionsData]);

  const handleExport = () => {
    if (!filteredSubmissions.length) {
      toast({
        title: "No Data",
        description: "No submissions to export",
        variant: "destructive",
      });
      return;
    }

    const exportData = filteredSubmissions.map((sub) => {
      const baseData: any = {
        'Form Name': sub.formTemplate?.name || 'N/A',
        'Player Name': sub.studentName || 'N/A',
        'Academy': sub.studentSchoolName || 'N/A',
        'Position': sub.studentPosition || 'N/A',
        'Sport': sub.studentSport || 'N/A',
        'Height': sub.studentHeight || 'N/A',
        'Weight': sub.studentWeight || 'N/A',
        'Role Number': sub.studentRoleNumber || 'N/A',
        'Status': sub.status,
        'Submitted By': sub.submittedByUser?.name || 'N/A',
        'Submitted At': sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A',
        'Created At': new Date(sub.createdAt).toLocaleString(),
      };

      // Add responses
      if (sub.formTemplate?.fields) {
        sub.formTemplate.fields.forEach((field) => {
          const response = sub.responses.find(r => r.fieldId === field.id);
          baseData[field.label] = response?.responseValue || '';
        });
      }

      return baseData;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Submissions');

    const filename = `evaluation_submissions_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);

    toast({
      title: "Export Successful",
      description: `${filteredSubmissions.length} submission(s) exported to Excel`,
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'submitted') {
      return <Badge className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Submitted</Badge>;
    }
    return <Badge variant="outline">Draft</Badge>;
  };

  if (formsLoading || submissionsLoading) {
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
        <div className="lg:hidden">
          <Header />
        </div>
        
        <div className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4 lg:h-16">
              <div className="flex flex-col space-y-1">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground">XEN Forms</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {user?.role === 'xen_scout' 
                    ? "View and manage your evaluation submissions"
                    : "View all evaluation submissions from scouts"}
                </p>
              </div>
              
              <Button 
                className="gold-gradient text-accent-foreground text-xs sm:text-sm" 
                size="sm"
                onClick={() => setShowSubmissionForm(true)}
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">New Evaluation</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Filters */}
          <Card className="mb-6 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="text-base sm:text-lg font-semibold">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Form Template</Label>
                  <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                    <SelectTrigger className="h-10 sm:h-11 text-sm">
                      <SelectValue placeholder="All Forms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Forms</SelectItem>
                      {forms?.map((form) => (
                        <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {user?.role !== 'xen_scout' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Scout</Label>
                    <Select value={selectedScout} onValueChange={setSelectedScout}>
                      <SelectTrigger className="h-10 sm:h-11 text-sm">
                        <SelectValue placeholder="All Scouts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Scouts</SelectItem>
                        {uniqueScouts.map((scout) => (
                          <SelectItem key={scout.id} value={scout.id}>{scout.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label className="text-sm font-medium">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by player, academy..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 sm:h-11 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label className="text-sm font-medium">Actions</Label>
                  <Button 
                    variant="outline" 
                    onClick={handleExport} 
                    className="w-full h-10 sm:h-11 text-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Export Excel</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as typeof activeTab);
            setPage(1); // Reset to first page when switching tabs
          }} className="mb-6">
            <TabsList className="w-full sm:w-auto grid grid-cols-2 h-10 sm:h-9">
              <TabsTrigger value="submitted" className="text-xs sm:text-sm">
                Submitted ({submittedCountData?.total || 0})
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs sm:text-sm">
                Draft ({draftCountData?.total || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4 sm:mt-6">
              {filteredSubmissions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Submissions Found</h3>
                    <p className="text-sm text-muted-foreground mb-4 text-center">
                      {searchQuery 
                        ? "No submissions match your search criteria."
                        : `No ${activeTab} submissions found.`}
                    </p>
                    <Button onClick={() => setShowSubmissionForm(true)} className="gold-gradient text-accent-foreground">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Submission
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filteredSubmissions.map((submission) => (
                    <Card key={submission.id} className="shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3 sm:pb-4">
                        <div className="flex items-start justify-between gap-2 sm:gap-4">
                          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                            {submission.studentProfilePicUrl && (
                              <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                                <AvatarImage src={submission.studentProfilePicUrl} />
                                <AvatarFallback className="text-xs sm:text-sm">
                                  {submission.studentName?.charAt(0).toUpperCase() || 'S'}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap">
                                <CardTitle className="text-sm sm:text-base font-semibold truncate">
                                  {submission.studentName || 'Unknown Player'}
                                </CardTitle>
                                <div className="flex-shrink-0">
                                  {getStatusBadge(submission.status)}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mb-1.5 sm:mb-2">
                                {submission.studentSchoolName && (
                                  <div className="flex items-center gap-1">
                                    <School className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                    <span className="truncate">{submission.studentSchoolName}</span>
                                  </div>
                                )}
                                {submission.studentPosition && (
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                    <span>{submission.studentPosition}</span>
                                  </div>
                                )}
                                {submission.studentSport && (
                                  <span className="truncate">{submission.studentSport}</span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                                <span className="font-medium truncate">{submission.formTemplate?.name || 'Unknown Form'}</span>
                                {submission.submittedByUser && (
                                  <span className="hidden sm:inline">• By {submission.submittedByUser.name}</span>
                                )}
                                {submission.submittedAt && (
                                  <span>• {new Date(submission.submittedAt).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-9 sm:w-9 p-0">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedSubmission(submission)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {(user?.role === 'xen_scout' && submission.submittedBy === user.id) || user?.role !== 'xen_scout' ? (
                                <>
                                  {(submission.status === 'draft' || (user?.role === 'xen_scout' && submission.submittedBy === user.id)) && (
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedSubmission(submission);
                                      setShowSubmissionForm(true);
                                    }}>
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {(user?.role === 'xen_scout' && submission.submittedBy === user.id) && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will permanently delete this submission. This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteSubmissionMutation.mutate(submission.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Pagination */}
          {submissionsData && submissionsData.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {submissionsData.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(submissionsData.totalPages, p + 1))}
                disabled={page === submissionsData.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Submission Details Dialog */}
        {selectedSubmission && !showSubmissionForm && (
          <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto mx-auto">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Submission Details</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  View complete evaluation submission details
                </DialogDescription>
              </DialogHeader>
              <SubmissionDetails submission={selectedSubmission} />
            </DialogContent>
          </Dialog>
        )}

        {/* Submission Form Dialog */}
        {showSubmissionForm && (
          <SubmissionFormDialog
            open={showSubmissionForm}
            onClose={() => {
              setShowSubmissionForm(false);
              setSelectedSubmission(null);
            }}
            editingSubmission={selectedSubmission || undefined}
            onSuccess={() => {
              setShowSubmissionForm(false);
              setSelectedSubmission(null);
              queryClient.invalidateQueries({ queryKey: ["/api/evaluation-forms/submissions"] });
            }}
          />
        )}
      </div>
    </div>
  );
}

// Submission Details Component
function SubmissionDetails({ submission }: { submission: Submission }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Player Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <Label className="text-muted-foreground">Player Name</Label>
          <p className="font-medium">{submission.studentName || 'N/A'}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Academy</Label>
          <p className="font-medium">{submission.studentSchoolName || 'N/A'}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Position</Label>
          <p className="font-medium">{submission.studentPosition || 'N/A'}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Sport</Label>
          <p className="font-medium">{submission.studentSport || 'N/A'}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Height</Label>
          <p className="font-medium">{submission.studentHeight || 'N/A'}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Weight</Label>
          <p className="font-medium">{submission.studentWeight || 'N/A'}</p>
        </div>
      </div>

      {/* Responses */}
      <div className="space-y-3 sm:space-y-4">
        <Label className="text-base sm:text-lg font-semibold">Evaluation Responses</Label>
        {submission.formTemplate?.fields.map((field) => {
          const response = submission.responses.find(r => r.fieldId === field.id);
          
          // Debug: Log multiple selection fields to help diagnose issues
          if (field.fieldType === 'multiple_selection' && response) {
            console.log(`[DEBUG] Multiple selection field "${field.label}":`, {
              fieldId: field.id,
              responseValue: response.responseValue,
              hasOptions: !!field.options,
              optionsType: typeof field.options,
              optionsLength: Array.isArray(field.options) ? field.options.length : 'N/A',
              options: field.options
            });
          }
          
          return (
            <Card key={field.id}>
              <CardHeader>
                <CardTitle className="text-sm">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </CardTitle>
                {field.helpText && (
                  <CardDescription className="text-xs">{field.helpText}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {(() => {
                  const responseValue = response?.responseValue || '';
                  if (!responseValue || responseValue.trim() === '') {
                    return <p className="text-sm text-muted-foreground">No response</p>;
                  }

                  // Handle star rating - display actual stars
                  if (field.fieldType === 'star_rating') {
                    const rating = parseInt(responseValue, 10);
                    if (isNaN(rating) || rating < 1 || rating > 5) {
                      return <p className="text-sm text-muted-foreground">{responseValue}</p>;
                    }
                    return (
                      <div className="flex gap-1 items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`text-2xl ${
                              star <= rating ? "text-yellow-400" : "text-gray-300"
                            }`}
                          >
                            ★
                          </span>
                        ))}
                        <span className="ml-2 text-sm text-muted-foreground">({rating}/5)</span>
                      </div>
                    );
                  }

                  // Handle multiple choice, dropdown, and multiple selection - show option labels
                  if (['multiple_choice', 'dropdown', 'multiple_selection'].includes(field.fieldType)) {
                    // Check if field has options
                    if (!field.options || (Array.isArray(field.options) && field.options.length === 0)) {
                      // If no options defined, just show the raw response value
                      return <p className="text-sm text-muted-foreground">{responseValue || 'No response'}</p>;
                    }
                    
                    const options = parseOptions(field.options);
                    
                    if (field.fieldType === 'multiple_selection') {
                      // Multiple selection: responseValue might be JSON array or comma-separated values
                      let selectedValues: string[] = [];
                      
                      // First, try to parse as JSON (if it was stored as JSON stringified array)
                      if (responseValue.trim().startsWith('[') && responseValue.trim().endsWith(']')) {
                        try {
                          const parsed = JSON.parse(responseValue);
                          if (Array.isArray(parsed)) {
                            selectedValues = parsed.map(v => String(v).trim()).filter(v => v);
                          }
                        } catch {
                          // If JSON parsing fails, fall through to comma-separated handling
                        }
                      }
                      
                      // If not parsed as JSON array, treat as comma-separated
                      if (selectedValues.length === 0) {
                        selectedValues = responseValue.split(',').map(v => v.trim()).filter(v => v && v !== '');
                      }
                      
                      const selectedLabels = selectedValues
                        .map(value => {
                          // Try exact match first, then case-insensitive, then with trimmed values
                          let option = options.find(opt => opt.value === value);
                          if (!option) {
                            option = options.find(opt => opt.value === String(value));
                          }
                          if (!option) {
                            option = options.find(opt => opt.value.trim() === value.trim());
                          }
                          if (!option) {
                            // Try case-insensitive match
                            option = options.find(opt => opt.value.toLowerCase() === value.toLowerCase());
                          }
                          return option ? option.label : value;
                        })
                        .filter(Boolean);
                      
                      if (selectedLabels.length === 0) {
                        // If we have selected values but no labels, show the raw values
                        if (selectedValues.length > 0) {
                          return (
                            <div className="flex flex-wrap gap-2">
                              {selectedValues.map((value, idx) => (
                                <Badge key={idx} variant="outline">{value}</Badge>
                              ))}
                            </div>
                          );
                        }
                        return <p className="text-sm text-muted-foreground">No response</p>;
                      }
                      
                      return (
                        <div className="flex flex-wrap gap-2">
                          {selectedLabels.map((label, idx) => (
                            <Badge key={idx} variant="secondary">{label}</Badge>
                          ))}
                        </div>
                      );
                    } else {
                      // Single choice/dropdown: find matching option
                      const option = options.find(opt => opt.value === responseValue || opt.value === String(responseValue));
                      if (option) {
                        return <p className="text-sm font-medium">{option.label}</p>;
                      }
                      // Fallback if option not found - show raw value
                      return <p className="text-sm text-muted-foreground">{responseValue}</p>;
                    }
                  }

                  // Default: display raw value for other field types
                  return <p className="text-sm">{responseValue}</p>;
                })()}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Submission Form Dialog Component
function SubmissionFormDialog({ 
  open, 
  onClose, 
  editingSubmission, 
  onSuccess 
}: { 
  open: boolean;
  onClose: () => void;
  editingSubmission?: Submission;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFormId, setSelectedFormId] = useState<string>(editingSubmission?.formTemplateId || "");
  const [selectedStudentId, setSelectedStudentId] = useState<string>(editingSubmission?.studentId || "");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [manualEntry, setManualEntry] = useState(!editingSubmission?.studentId);
  const [studentData, setStudentData] = useState({
    name: editingSubmission?.studentName || "",
    profile_pic: editingSubmission?.studentProfilePicUrl || "",
    position: editingSubmission?.studentPosition || "",
    height: editingSubmission?.studentHeight || "",
    weight: editingSubmission?.studentWeight || "",
    role_number: editingSubmission?.studentRoleNumber || "",
    sport: editingSubmission?.studentSport || "",
    school_id: editingSubmission?.studentSchoolId || "",
    school_name: editingSubmission?.studentSchoolName || "",
  });
  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(editingSubmission?.studentProfilePicUrl || null);

  const { data: forms } = useQuery<FormTemplate[]>({
    queryKey: ["/api/evaluation-forms/templates"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/evaluation-forms/templates?status=active");
      if (!response.ok) throw new Error("Failed to fetch forms");
      return response.json();
    },
  });

  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["/api/evaluation-forms/students/search", studentSearchQuery],
    queryFn: async () => {
      if (!studentSearchQuery || studentSearchQuery.length < 2) return [];
      const response = await apiRequest("GET", `/api/evaluation-forms/students/search?q=${encodeURIComponent(studentSearchQuery)}&limit=10`);
      if (!response.ok) throw new Error("Failed to search students");
      return response.json();
    },
    enabled: !manualEntry && studentSearchQuery.length >= 2,
  });

  const { data: selectedForm } = useQuery<FormTemplate>({
    queryKey: ["/api/evaluation-forms/templates", selectedFormId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/evaluation-forms/templates/${selectedFormId}`);
      if (!response.ok) throw new Error("Failed to fetch form");
      return response.json();
    },
    enabled: !!selectedFormId,
  });

  // Load editing submission data
  useEffect(() => {
    if (editingSubmission) {
      setSelectedFormId(editingSubmission.formTemplateId);
      setSelectedStudentId(editingSubmission.studentId || "");
      setManualEntry(!editingSubmission.studentId);
      setStudentData({
        name: editingSubmission.studentName || "",
        profile_pic: editingSubmission.studentProfilePicUrl || "",
        position: editingSubmission.studentPosition || "",
        height: editingSubmission.studentHeight || "",
        weight: editingSubmission.studentWeight || "",
        role_number: editingSubmission.studentRoleNumber || "",
        sport: editingSubmission.studentSport || "",
        school_id: editingSubmission.studentSchoolId || "",
        school_name: editingSubmission.studentSchoolName || "",
      });
      setImagePreview(editingSubmission.studentProfilePicUrl || null);
      
      // Load responses
      const responses: Record<string, string> = {};
      editingSubmission.responses.forEach(r => {
        responses[r.fieldId] = r.responseValue;
      });
      setFormResponses(responses);
    } else {
      // Reset when creating new
      setSelectedFormId("");
      setSelectedStudentId("");
      setManualEntry(true);
      setStudentData({
        name: "",
        profile_pic: "",
        position: "",
        height: "",
        weight: "",
        role_number: "",
        sport: "",
        school_id: "",
        school_name: "",
      });
      setFormResponses({});
      setImagePreview(null);
    }
  }, [editingSubmission]);

  const handleStudentSelect = async (studentId: string) => {
    const response = await apiRequest("GET", `/api/evaluation-forms/students/${studentId}/profile`);
    if (response.ok) {
      const profile = await response.json();
      setSelectedStudentId(studentId);
      setStudentData({
        name: profile.name,
        profile_pic: profile.profilePicUrl || "",
        position: profile.position || "",
        height: profile.height || "",
        weight: profile.weight || "",
        role_number: profile.roleNumber || "",
        sport: profile.sport || "",
        school_id: profile.schoolId || "",
        school_name: profile.schoolName || "",
      });
      setImagePreview(profile.profilePicUrl || null);
      setManualEntry(false);
      setStudentSearchQuery("");
    }
  };

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    // Validate formTemplateId - must be a valid UUID and not empty
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!selectedFormId || selectedFormId === "all" || selectedFormId.trim() === "" || !uuidRegex.test(selectedFormId)) {
      toast({
        title: "Error",
        description: "Please select a valid form template",
        variant: "destructive",
      });
      return;
    }

    if (!selectedStudentId && !manualEntry) {
      toast({
        title: "Error",
        description: "Please select a student or enable manual entry",
        variant: "destructive",
      });
      return;
    }

    if (manualEntry && !studentData.name) {
      toast({
        title: "Error",
        description: "Player name is required for manual entry",
        variant: "destructive",
      });
      return;
    }

    if (!selectedForm) {
      toast({
        title: "Error",
        description: "Form template not found",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    const missingFields = selectedForm.fields.filter(f => 
      f.required && (!formResponses[f.id] || formResponses[f.id].trim() === "")
    );

    if (missingFields.length > 0 && status === 'submitted') {
      toast({
        title: "Validation Error",
        description: `Please fill in all required fields: ${missingFields.map(f => f.label).join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const responses = selectedForm.fields
        .filter(f => formResponses[f.id] && formResponses[f.id].trim() !== "")
        .map(f => ({
          fieldId: f.id,
          responseValue: formResponses[f.id],
        }));

      // Clean studentData - remove empty strings and only include valid values
      // Only send studentData if manual entry is enabled
      let cleanedStudentData: any = undefined;
      if (manualEntry) {
        // Include profile_pic if it's a valid URL (either uploaded or manually entered)
        const hasValidProfilePic = studentData.profile_pic && 
          studentData.profile_pic.trim() !== "" && 
          (studentData.profile_pic.startsWith('http://') || 
           studentData.profile_pic.startsWith('https://') ||
           studentData.profile_pic.startsWith('/'));
        
        cleanedStudentData = {
          name: studentData.name,
          ...(hasValidProfilePic ? { profile_pic: studentData.profile_pic.trim() } : {}),
          ...(studentData.position && studentData.position.trim() !== "" ? { position: studentData.position } : {}),
          ...(studentData.height && studentData.height.trim() !== "" ? { height: studentData.height } : {}),
          ...(studentData.weight && studentData.weight.trim() !== "" ? { weight: studentData.weight } : {}),
          ...(studentData.role_number && studentData.role_number.trim() !== "" ? { role_number: studentData.role_number } : {}),
          ...(studentData.sport && studentData.sport.trim() !== "" ? { sport: studentData.sport } : {}),
          ...(studentData.school_id && studentData.school_id.trim() !== "" && studentData.school_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? { school_id: studentData.school_id } : {}),
          ...(studentData.school_name && studentData.school_name.trim() !== "" ? { school_name: studentData.school_name } : {}),
        };
      }

      // Final validation - ensure formTemplateId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(selectedFormId)) {
        toast({
          title: "Error",
          description: "Invalid form template ID. Please select a form again.",
          variant: "destructive",
        });
        return;
      }

      const payload = {
        formTemplateId: selectedFormId.trim(),
        studentId: (manualEntry || !selectedStudentId || selectedStudentId.trim() === "") ? undefined : selectedStudentId.trim(),
        studentData: cleanedStudentData,
        responses: responses || [],
        status,
      };

      console.log('Submitting payload:', {
        formTemplateId: payload.formTemplateId,
        formTemplateIdLength: payload.formTemplateId?.length,
        isUUID: uuidRegex.test(payload.formTemplateId),
        studentId: payload.studentId,
        hasStudentData: !!payload.studentData,
        responsesCount: payload.responses.length,
        status: payload.status
      });

      const url = editingSubmission 
        ? `/api/evaluation-forms/submissions/${editingSubmission.id}`
        : '/api/evaluation-forms/submissions';
      
      const method = editingSubmission ? 'PUT' : 'POST';

      const response = await apiRequest(method, url, payload);

      if (!response.ok) {
        const error = await response.json();
        console.error('Submission error:', error);
        console.error('Error details:', error.error?.details);
        
        // Build a more detailed error message
        let errorMessage = error.error?.message || error.message || "Failed to save submission";
        if (error.error?.details && Array.isArray(error.error.details) && error.error.details.length > 0) {
          const details = error.error.details.map((d: any) => 
            `${d.path?.join('.') || 'unknown'}: ${d.message}`
          ).join(', ');
          errorMessage = `${errorMessage} (${details})`;
        }
        
        throw new Error(errorMessage);
      }

      toast({
        title: status === 'submitted' ? "Submission Successful" : "Draft Saved",
        description: status === 'submitted' 
          ? "Evaluation has been submitted successfully."
          : "Draft has been saved. You can continue editing later.",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save submission",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">{editingSubmission ? 'Edit Submission' : 'New Evaluation'}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Fill out the evaluation form for a student.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Form Selection */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-sm sm:text-base">Form Template *</Label>
            <Select value={selectedFormId} onValueChange={setSelectedFormId} disabled={!!editingSubmission}>
              <SelectTrigger>
                <SelectValue placeholder="Select a form template" />
              </SelectTrigger>
              <SelectContent>
                {forms?.map((form) => (
                  <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student Selection */}
          <div className="space-y-3 sm:space-y-4 border-t pt-3 sm:pt-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm sm:text-base">Player Information</Label>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <input
                  type="checkbox"
                  id="manual-entry"
                  checked={manualEntry}
                  onChange={(e) => setManualEntry(e.target.checked)}
                  className="rounded w-4 h-4 sm:w-[18px] sm:h-[18px]"
                />
                <Label htmlFor="manual-entry" className="text-xs sm:text-sm font-normal cursor-pointer">
                  Manual Entry
                </Label>
              </div>
            </div>

            {!manualEntry ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search for player by name, academy, or position..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {searching && (
                  <p className="text-sm text-muted-foreground">Searching...</p>
                )}
                {searchResults && searchResults.length > 0 && (
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    {searchResults.map((student: any) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleStudentSelect(student.id)}
                        className="w-full p-3 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          {student.profilePicUrl && (
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={student.profilePicUrl} />
                              <AvatarFallback>{student.name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          )}
                          <div className="flex-1">
                            <p className="font-medium">{student.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {student.schoolName && <span>{student.schoolName}</span>}
                              {student.position && <span>• {student.position}</span>}
                              {student.sport && <span>• {student.sport}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {studentSearchQuery.length >= 2 && searchResults && searchResults.length === 0 && !searching && (
                  <p className="text-sm text-muted-foreground">No students found</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2 sm:col-span-2">
                  <Label className="text-sm sm:text-base">Player Name *</Label>
                  <Input
                    value={studentData.name}
                    onChange={(e) => setStudentData({ ...studentData, name: e.target.value })}
                    placeholder="Player name"
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2 sm:col-span-2">
                  <Label className="text-sm sm:text-base">Profile Picture</Label>
                  <div className="space-y-2">
                    {imagePreview ? (
                      <div className="relative inline-block">
                        <img
                          src={imagePreview}
                          alt="Profile preview"
                          className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview(null);
                            setStudentData({ ...studentData, profile_pic: "" });
                          }}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                        >
                          <XIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-20 sm:h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-4 sm:pt-5 pb-4 sm:pb-6">
                          <Upload className="w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-2 text-muted-foreground" />
                          <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            // Validate file type
                            if (!file.type.startsWith('image/')) {
                              toast({
                                title: "Invalid File",
                                description: "Please select an image file.",
                                variant: "destructive",
                              });
                              return;
                            }

                            // Validate file size (5MB)
                            if (file.size > 5 * 1024 * 1024) {
                              toast({
                                title: "File Too Large",
                                description: "Image must be less than 5MB.",
                                variant: "destructive",
                              });
                              return;
                            }

                            setIsUploadingImage(true);
                            try {
                              // Create preview
                              const previewUrl = URL.createObjectURL(file);
                              setImagePreview(previewUrl);

                              // Upload to Cloudinary
                              const { url } = await uploadToCloudinary(file, "evaluation-profiles");
                              setStudentData({ ...studentData, profile_pic: url });
                              
                              // Clean up preview URL
                              URL.revokeObjectURL(previewUrl);
                              setImagePreview(url);

                              toast({
                                title: "Image Uploaded",
                                description: "Profile picture has been uploaded successfully.",
                              });
                            } catch (error: any) {
                              console.error('Image upload failed:', error);
                              setImagePreview(null);
                              toast({
                                title: "Upload Failed",
                                description: error?.message || "Failed to upload image. Please try again.",
                                variant: "destructive",
                              });
                            } finally {
                              setIsUploadingImage(false);
                              // Reset input
                              e.target.value = '';
                            }
                          }}
                          disabled={isUploadingImage}
                        />
                      </label>
                    )}
                    {isUploadingImage && (
                      <p className="text-xs text-muted-foreground">Uploading image...</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm sm:text-base">Position</Label>
                  <Input
                    value={studentData.position}
                    onChange={(e) => setStudentData({ ...studentData, position: e.target.value })}
                    placeholder="e.g., Forward, Midfielder"
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm sm:text-base">Sport</Label>
                  <Input
                    value={studentData.sport}
                    onChange={(e) => setStudentData({ ...studentData, sport: e.target.value })}
                    placeholder="e.g., Soccer, Basketball"
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm sm:text-base">Height</Label>
                  <Input
                    value={studentData.height}
                    onChange={(e) => setStudentData({ ...studentData, height: e.target.value })}
                    placeholder="e.g., 175 cm"
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm sm:text-base">Weight</Label>
                  <Input
                    value={studentData.weight}
                    onChange={(e) => setStudentData({ ...studentData, weight: e.target.value })}
                    placeholder="e.g., 70 kg"
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm sm:text-base">Role Number</Label>
                  <Input
                    value={studentData.role_number}
                    onChange={(e) => setStudentData({ ...studentData, role_number: e.target.value })}
                    placeholder="Jersey number"
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2 sm:col-span-2">
                  <Label className="text-sm sm:text-base">Academy Name</Label>
                  <Input
                    value={studentData.school_name}
                    onChange={(e) => setStudentData({ ...studentData, school_name: e.target.value })}
                    placeholder="Academy name"
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Display selected student info */}
            {!manualEntry && selectedStudentId && (
              <Card className="bg-muted/50 border-border/50">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    {studentData.profile_pic && (
                      <Avatar className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
                        <AvatarImage src={studentData.profile_pic} />
                        <AvatarFallback className="text-xs sm:text-sm">{studentData.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm sm:text-base truncate">{studentData.name}</p>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
                        {studentData.school_name && <span className="truncate">{studentData.school_name}</span>}
                        {studentData.position && <span>• {studentData.position}</span>}
                        {studentData.sport && <span>• {studentData.sport}</span>}
                        {studentData.height && <span className="hidden sm:inline">• H: {studentData.height}</span>}
                        {studentData.weight && <span className="hidden sm:inline">• W: {studentData.weight}</span>}
                        {studentData.role_number && <span>• #{studentData.role_number}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Form Fields */}
          {selectedForm && (
            <div className="space-y-3 sm:space-y-4 border-t pt-3 sm:pt-4">
              <Label className="text-base sm:text-lg font-semibold">Evaluation Responses</Label>
              {selectedForm.fields.sort((a, b) => a.orderIndex - b.orderIndex).map((field) => (
                field.fieldType === 'section_header' ? (
                  <div key={field.id} className="pt-2 sm:pt-3">
                    <h3 className="text-base sm:text-lg font-semibold">{field.label}</h3>
                    {field.helpText && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">{field.helpText}</p>
                    )}
                  </div>
                ) : (
                  <Card key={field.id} className="border-border/50">
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="text-sm">
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </CardTitle>
                      {field.helpText && (
                        <CardDescription className="text-xs">{field.helpText}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {field.fieldType === 'short_text' && (
                        <Input
                          value={formResponses[field.id] || ""}
                          onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                          placeholder={field.placeholder || "Enter text..."}
                          className="h-9 sm:h-10 text-sm"
                        />
                      )}
                      {field.fieldType === 'paragraph' && (
                        <Textarea
                          value={formResponses[field.id] || ""}
                          onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                          placeholder={field.placeholder || "Enter text..."}
                          rows={3}
                          className="text-sm resize-none"
                        />
                      )}
                      {field.fieldType === 'star_rating' && (
                        <div className="flex gap-0.5 sm:gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFormResponses({ ...formResponses, [field.id]: star.toString() })}
                              className={`text-2xl sm:text-3xl transition-colors ${
                                parseInt(formResponses[field.id] || "0") >= star
                                  ? "text-yellow-400"
                                  : "text-gray-300 hover:text-yellow-300"
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      )}
                      {field.fieldType === 'number' && (
                        <Input
                          type="number"
                          value={formResponses[field.id] || ""}
                          onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                          placeholder={field.placeholder || "Enter number..."}
                          className="h-9 sm:h-10 text-sm"
                        />
                      )}
                      {field.fieldType === 'date' && (
                        <Input
                          type="date"
                          value={formResponses[field.id] || ""}
                          onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                          className="h-9 sm:h-10 text-sm"
                        />
                      )}
                      {(field.fieldType === 'multiple_choice' || field.fieldType === 'dropdown') && field.options && (
                        <Select
                          value={formResponses[field.id] || ""}
                          onValueChange={(value) => setFormResponses({ ...formResponses, [field.id]: value })}
                        >
                          <SelectTrigger className="h-9 sm:h-10 text-sm">
                            <SelectValue placeholder={field.placeholder || "Select an option..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {parseOptions(field.options)
                              .filter(opt => opt.value && opt.value.trim() !== "")
                              .map((opt, optIndex) => (
                              <SelectItem key={optIndex} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {field.fieldType === 'multiple_selection' && field.options && (
                        <div className="space-y-1.5 sm:space-y-2">
                          {parseOptions(field.options).map((opt, optIndex) => (
                            <div key={optIndex} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`${field.id}-${optIndex}`}
                                checked={(formResponses[field.id] || "").split(',').includes(opt.value)}
                                onChange={(e) => {
                                  const currentValues = (formResponses[field.id] || "").split(',').filter(v => v);
                                  if (e.target.checked) {
                                    setFormResponses({ ...formResponses, [field.id]: [...currentValues, opt.value].join(',') });
                                  } else {
                                    setFormResponses({ ...formResponses, [field.id]: currentValues.filter(v => v !== opt.value).join(',') });
                                  }
                                }}
                                className="rounded w-4 h-4 sm:w-[18px] sm:h-[18px]"
                              />
                              <Label htmlFor={`${field.id}-${optIndex}`} className="cursor-pointer text-sm">{opt.label}</Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isSubmitting}
            className="w-full sm:w-auto order-3 sm:order-1 h-9 sm:h-10 text-sm"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting || !selectedFormId}
            className="w-full sm:w-auto order-2 h-9 sm:h-10 text-sm"
          >
            Save Draft
          </Button>
          <Button
            onClick={() => handleSubmit('submitted')}
            disabled={isSubmitting || !selectedFormId}
            className="gold-gradient text-accent-foreground w-full sm:w-auto order-1 sm:order-3 h-9 sm:h-10 text-sm"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

