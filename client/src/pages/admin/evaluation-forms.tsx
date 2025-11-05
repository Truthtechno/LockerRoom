import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Plus, Edit, Trash2, Eye, Archive, CheckCircle, XCircle, GripVertical, X, AlertCircle, Save, Send, BarChart3, Users } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

type FormFieldType = 'short_text' | 'paragraph' | 'star_rating' | 'multiple_choice' | 'multiple_selection' | 'number' | 'date' | 'dropdown';

type FormField = {
  id?: string;
  fieldType: FormFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  orderIndex: number;
  options?: Array<{ id?: string; value: string; label: string }>;
  validationRules?: Record<string, any>;
};

type FormTemplate = {
  id: string;
  name: string;
  description?: string | null;
  status: 'draft' | 'active' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  version: number;
  fields: FormField[];
};

const formTemplateSchema = z.object({
  name: z.string().min(1, "Form name is required").max(200, "Name must be less than 200 characters"),
  description: z.string().optional().or(z.literal("")),
  fields: z.array(z.object({
    fieldType: z.enum(['short_text', 'paragraph', 'star_rating', 'multiple_choice', 'multiple_selection', 'number', 'date', 'dropdown']),
    label: z.string().min(1, "Label is required"),
    placeholder: z.string().optional().or(z.literal("")),
    helpText: z.string().optional().or(z.literal("")),
    required: z.boolean(),
    orderIndex: z.number().int().min(0),
    options: z.array(z.object({
      id: z.string().optional(),
      value: z.string().min(1, "Option value is required"),
      label: z.string().min(1, "Option label is required"),
    })).optional(),
    validationRules: z.record(z.any()).optional(),
  })).min(1, "At least one field is required"),
}).superRefine((data, ctx) => {
  // Validate that fields with choice/dropdown types have options
  data.fields.forEach((field, fieldIndex) => {
    if (['multiple_choice', 'multiple_selection', 'dropdown'].includes(field.fieldType)) {
      if (!field.options || field.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field "${field.label || `Field ${fieldIndex + 1}`}" requires at least one option`,
          path: ["fields", fieldIndex, "options"],
        });
        return;
      }
      // Validate that all options have non-empty values and labels
      field.options.forEach((opt, optIndex) => {
        if (!opt.value || !opt.value.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Option value is required for "${field.label || `Field ${fieldIndex + 1}`}"`,
            path: ["fields", fieldIndex, "options", optIndex, "value"],
          });
        }
        if (!opt.label || !opt.label.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Option label is required for "${field.label || `Field ${fieldIndex + 1}`}"`,
            path: ["fields", fieldIndex, "options", optIndex, "label"],
          });
        }
      });
    }
  });
});

type FormTemplateData = z.infer<typeof formTemplateSchema>;

export default function EvaluationForms() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingForm, setEditingForm] = useState<FormTemplate | null>(null);
  const [previewForm, setPreviewForm] = useState<FormTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'draft' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<FormTemplateData>({
    resolver: zodResolver(formTemplateSchema),
    mode: "onSubmit", // Only validate on submit, not onChange or onBlur
    defaultValues: {
      name: "",
      description: "",
      fields: [],
    },
  });

  const { data: forms, isLoading } = useQuery<FormTemplate[]>({
    queryKey: ["/api/evaluation-forms/templates"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/evaluation-forms/templates");
      if (!response.ok) throw new Error("Failed to fetch forms");
      return response.json();
    },
  });

  // Fetch statistics for active forms
  const { data: formStats } = useQuery<Record<string, any>>({
    queryKey: ["/api/evaluation-forms/templates/stats"],
    queryFn: async () => {
      const activeForms = forms?.filter(f => f.status === 'active') || [];
      const statsPromises = activeForms.map(async (form) => {
        try {
          const response = await apiRequest("GET", `/api/evaluation-forms/templates/${form.id}/stats`);
          if (response.ok) {
            return { formId: form.id, stats: await response.json() };
          }
        } catch (error) {
          console.error(`Failed to fetch stats for form ${form.id}:`, error);
        }
        return { formId: form.id, stats: null };
      });
      const results = await Promise.all(statsPromises);
      const statsMap: Record<string, any> = {};
      results.forEach(r => {
        if (r.stats) {
          statsMap[r.formId] = r.stats;
        }
      });
      return statsMap;
    },
    enabled: !!forms && forms.length > 0,
  });

  const createFormMutation = useMutation({
    mutationFn: async (data: FormTemplateData) => {
      const response = await apiRequest("POST", "/api/evaluation-forms/templates", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-forms/templates"] });
      form.reset();
      setShowCreateForm(false);
      toast({
        title: "Form Created",
        description: "Evaluation form template has been created successfully.",
      });
    },
    onError: (error: any) => {
      // Extract better error message
      let errorMessage = "Failed to create form template.";
      if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Validation Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateFormMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormTemplateData }) => {
      const response = await apiRequest("PUT", `/api/evaluation-forms/templates/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-forms/templates"] });
      setEditingForm(null);
      form.reset();
      toast({
        title: "Form Updated",
        description: "Evaluation form template has been updated successfully.",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to update form template.";
      if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Validation Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const publishFormMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/evaluation-forms/templates/${id}/publish`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to publish form");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-forms/templates"] });
      toast({
        title: "Form Published",
        description: "Form has been published and is now available to scouts.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to publish form.",
        variant: "destructive",
      });
    },
  });

  const archiveFormMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/evaluation-forms/templates/${id}/archive`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to archive form");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-forms/templates"] });
      toast({
        title: "Form Archived",
        description: "Form has been archived successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive form.",
        variant: "destructive",
      });
    },
  });

  const deleteFormMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/evaluation-forms/templates/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to delete form");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-forms/templates"] });
      toast({
        title: "Form Deleted",
        description: "Form template has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete form template.",
        variant: "destructive",
      });
    },
  });

  const filteredForms = useMemo(() => {
    if (!forms) return [];
    
    let filtered = forms.filter(form => {
      if (activeTab === 'active' && form.status !== 'active') return false;
      if (activeTab === 'draft' && form.status !== 'draft') return false;
      if (activeTab === 'archived' && form.status !== 'archived') return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return form.name.toLowerCase().includes(query) || 
               (form.description && form.description.toLowerCase().includes(query));
      }
      
      return true;
    });
    
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [forms, activeTab, searchQuery]);

  // Helper to parse options
  const parseOptions = (options: any): Array<{ id?: string; value: string; label: string }> => {
    if (!options) return [];
    let parsed: any[] = [];
    if (Array.isArray(options)) {
      parsed = options;
    } else if (typeof options === 'string') {
      try {
        parsed = JSON.parse(options);
      } catch {
        return [];
      }
    } else {
      return [];
    }
    // Ensure all options have IDs for stable React keys
    return parsed.map((opt: any, idx) => ({
      id: opt.id || `opt_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`,
      value: opt.value,
      label: opt.label
    }));
  };

  const handleEdit = (formTemplate: FormTemplate) => {
    setEditingForm(formTemplate);
    form.reset({
      name: formTemplate.name,
      description: formTemplate.description || "",
      fields: formTemplate.fields.map(f => ({
        fieldType: f.fieldType,
        label: f.label,
        placeholder: f.placeholder || "",
        helpText: f.helpText || "",
        required: f.required,
        orderIndex: f.orderIndex,
        options: parseOptions(f.options),
        validationRules: f.validationRules || {},
      })),
    });
  };

  const handleSubmit = (data: FormTemplateData) => {
    // Validate name before processing
    if (!data.name || !data.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Form name is required. Please enter a name for the form.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate fields before processing
    if (!data.fields || data.fields.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one field is required. Please add a field to the form.",
        variant: "destructive",
      });
      return;
    }
    
    // Clean up the data before submission
    // Filter out empty options before validation
    const cleanedData: FormTemplateData = {
      name: data.name.trim(),
      description: data.description?.trim() || "",
      fields: data.fields.map(field => {
        // Filter out empty options for choice/dropdown fields
        let cleanedOptions = undefined;
        if (field.options && field.options.length > 0) {
          const validOptions = field.options
            .filter(opt => opt.value && opt.value.trim() && opt.label && opt.label.trim())
            .map(opt => ({ value: opt.value.trim(), label: opt.label.trim() }));
          
          if (validOptions.length > 0) {
            cleanedOptions = validOptions;
          }
        }
        
        const cleanedField = {
          fieldType: field.fieldType,
          label: field.label.trim(),
          placeholder: field.placeholder?.trim() || "",
          helpText: field.helpText?.trim() || "",
          required: field.required,
          orderIndex: field.orderIndex,
          options: cleanedOptions,
          validationRules: field.validationRules || undefined,
        };
        
        // Remove empty optional fields
        if (!cleanedField.placeholder) delete (cleanedField as any).placeholder;
        if (!cleanedField.helpText) delete (cleanedField as any).helpText;
        if (!cleanedField.options || cleanedField.options.length === 0) {
          delete (cleanedField as any).options;
        }
        if (!cleanedField.validationRules) delete (cleanedField as any).validationRules;
        
        return cleanedField;
      }),
    };
    
    // Remove description if empty
    if (!cleanedData.description) {
      delete (cleanedData as any).description;
    }
    
    if (editingForm) {
      updateFormMutation.mutate({ id: editingForm.id, data: cleanedData });
    } else {
      createFormMutation.mutate(cleanedData);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'draft':
        return <Badge variant="outline"><Save className="w-3 h-3 mr-1" />Draft</Badge>;
      case 'archived':
        return <Badge variant="secondary"><Archive className="w-3 h-3 mr-1" />Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
        <div className="lg:hidden">
          <Header />
        </div>
        
        <div className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4 lg:h-16">
              <div className="flex flex-col space-y-1">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground">Create Forms</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Create and manage evaluation form templates</p>
              </div>
              
              <Dialog 
                open={showCreateForm} 
                onOpenChange={(open) => {
                  setShowCreateForm(open);
                  if (open) {
                    // Reset form when dialog opens for a new form
                    // Use setTimeout to ensure form is properly reset after dialog is fully rendered
                    setTimeout(() => {
                      form.reset({
                        name: "",
                        description: "",
                        fields: [],
                      }, {
                        keepValues: false,
                        keepErrors: false,
                        keepDirty: false,
                        keepIsSubmitted: false,
                        keepTouched: false,
                        keepIsValid: false,
                        keepSubmitCount: false,
                      });
                    }, 0);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="gold-gradient text-accent-foreground text-xs sm:text-sm" size="sm">
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Create Form</span>
                    <span className="sm:hidden">Create</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto mx-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">Create Evaluation Form Template</DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                      Create a new form template that scouts can use to evaluate students.
                    </DialogDescription>
                  </DialogHeader>
                  <FormBuilder
                    form={form}
                    onSubmit={handleSubmit}
                    onCancel={() => {
                      setShowCreateForm(false);
                      form.reset({
                        name: "",
                        description: "",
                        fields: [],
                      });
                    }}
                    isLoading={createFormMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mb-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
              <TabsList className="w-full sm:w-auto grid grid-cols-3 h-10 sm:h-9">
                <TabsTrigger value="active" className="text-xs sm:text-sm">Active</TabsTrigger>
                <TabsTrigger value="draft" className="text-xs sm:text-sm">Draft</TabsTrigger>
                <TabsTrigger value="archived" className="text-xs sm:text-sm">Archived</TabsTrigger>
              </TabsList>
              
              <div className="relative flex-1 sm:max-w-md">
                <Input
                  placeholder="Search forms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 sm:h-11 text-sm"
                />
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            <TabsContent value={activeTab} className="mt-4 sm:mt-6">
              {filteredForms.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Forms Found</h3>
                    <p className="text-sm text-muted-foreground mb-4 text-center">
                      {searchQuery 
                        ? "No forms match your search criteria."
                        : `No ${activeTab} forms found. Create your first form template to get started.`}
                    </p>
                    {!searchQuery && (
                      <Button onClick={() => setShowCreateForm(true)} className="gold-gradient text-accent-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Form
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:gap-4">
                  {filteredForms.map((formTemplate) => (
                    <Card key={formTemplate.id} className="shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3 sm:pb-4">
                        <div className="flex items-start justify-between gap-2 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap">
                              <CardTitle className="text-sm sm:text-base font-semibold truncate">{formTemplate.name}</CardTitle>
                              <div className="flex-shrink-0">
                                {getStatusBadge(formTemplate.status)}
                              </div>
                            </div>
                            {formTemplate.description && (
                              <CardDescription className="text-xs sm:text-sm line-clamp-2">{formTemplate.description}</CardDescription>
                            )}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 sm:mt-3 text-xs text-muted-foreground">
                              <span>{formTemplate.fields.length} field{formTemplate.fields.length !== 1 ? 's' : ''}</span>
                              <span>•</span>
                              <span>Version {formTemplate.version}</span>
                              {formTemplate.publishedAt && (
                                <>
                                  <span>•</span>
                                  <span className="hidden sm:inline">Published {new Date(formTemplate.publishedAt).toLocaleDateString()}</span>
                                  <span className="sm:hidden">Pub. {new Date(formTemplate.publishedAt).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                            {formStats && formStats[formTemplate.id] && (
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 sm:mt-3">
                                <div className="flex items-center gap-1 text-xs">
                                  <BarChart3 className="w-3 h-3 flex-shrink-0" />
                                  <span>{formStats[formTemplate.id].submitted_count || 0} submitted</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs">
                                  <Users className="w-3 h-3 flex-shrink-0" />
                                  <span>{formStats[formTemplate.id].unique_students_evaluated || 0} students</span>
                                </div>
                              </div>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0">
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(formTemplate)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPreviewForm(formTemplate)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              {formTemplate.status === 'draft' && (
                                <DropdownMenuItem onClick={() => publishFormMutation.mutate(formTemplate.id)}>
                                  <Send className="w-4 h-4 mr-2" />
                                  Publish
                                </DropdownMenuItem>
                              )}
                              {formTemplate.status === 'active' && (
                                <DropdownMenuItem onClick={() => archiveFormMutation.mutate(formTemplate.id)}>
                                  <Archive className="w-4 h-4 mr-2" />
                                  Archive
                                </DropdownMenuItem>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Form Template</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the form template "{formTemplate.name}". 
                                      This action cannot be undone. All submissions using this form will also be deleted.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteFormMutation.mutate(formTemplate.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
        </div>

        {/* Edit Form Dialog */}
        {editingForm && (
          <Dialog open={!!editingForm} onOpenChange={(open) => !open && setEditingForm(null)}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto mx-auto">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Edit Form Template</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Update the form template and its fields.
                </DialogDescription>
              </DialogHeader>
              <FormBuilder
                form={form}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setEditingForm(null);
                  form.reset();
                }}
                isLoading={updateFormMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Preview Dialog */}
        {previewForm && (
          <Dialog open={!!previewForm} onOpenChange={(open) => !open && setPreviewForm(null)}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-auto">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Form Preview</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  This is how scouts will see the form.
                </DialogDescription>
              </DialogHeader>
              <FormPreview form={previewForm} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// Form Builder Component
function FormBuilder({ 
  form, 
  onSubmit, 
  onCancel, 
  isLoading 
}: { 
  form: ReturnType<typeof useForm<FormTemplateData>>;
  onSubmit: (data: FormTemplateData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { toast } = useToast();
  // Use watch with specific fields to reduce re-renders
  const fields = form.watch("fields", []);
  
  // Use refs to track field IDs for stable keys
  const fieldIdRef = useRef(0);
  const fieldIdMapRef = useRef<Map<number, number>>(new Map());
  
  // Initialize field IDs when fields change
  useEffect(() => {
    fields.forEach((_, index) => {
      if (!fieldIdMapRef.current.has(index)) {
        fieldIdMapRef.current.set(index, fieldIdRef.current++);
      }
    });
  }, [fields.length]);
  
  const addField = useCallback((fieldType: FormFieldType) => {
    const currentFields = form.getValues("fields");
    const newIndex = currentFields.length;
    const newId = fieldIdRef.current++;
    fieldIdMapRef.current.set(newIndex, newId);
    
    const newField: FormField = {
      fieldType,
      label: "",
      placeholder: "",
      helpText: "",
      required: false,
      orderIndex: newIndex,
      options: fieldType === 'multiple_choice' || fieldType === 'multiple_selection' || fieldType === 'dropdown' 
        ? [{ value: "option1", label: "Option 1" }] 
        : undefined,
    };
    
    form.setValue("fields", [...currentFields, newField], { shouldValidate: false, shouldDirty: true });
  }, [form]);

  const removeField = useCallback((index: number) => {
    const currentFields = form.getValues("fields");
    const newFields = currentFields
      .filter((_, i) => i !== index)
      .map((f, i) => ({ ...f, orderIndex: i }));
    
    // Update field ID map
    const newMap = new Map<number, number>();
    newFields.forEach((_, newIndex) => {
      const oldIndex = newIndex < index ? newIndex : newIndex + 1;
      if (fieldIdMapRef.current.has(oldIndex)) {
        newMap.set(newIndex, fieldIdMapRef.current.get(oldIndex)!);
      }
    });
    fieldIdMapRef.current = newMap;
    
    form.setValue("fields", newFields, { shouldValidate: false, shouldDirty: true });
  }, [form]);

  const moveField = useCallback((index: number, direction: 'up' | 'down') => {
    const currentFields = form.getValues("fields");
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentFields.length - 1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newFields = [...currentFields];
    
    // Swap fields
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    
    // Update order indices
    newFields.forEach((f, i) => { 
      f.orderIndex = i; 
    });
    
    // Update field ID map
    const tempId = fieldIdMapRef.current.get(index);
    const targetId = fieldIdMapRef.current.get(targetIndex);
    if (tempId !== undefined && targetId !== undefined) {
      fieldIdMapRef.current.set(index, targetId);
      fieldIdMapRef.current.set(targetIndex, tempId);
    }
    
    form.setValue("fields", newFields, { shouldValidate: false, shouldDirty: true });
  }, [form]);

  const addOption = useCallback((fieldIndex: number) => {
    const currentFields = form.getValues("fields");
    const field = currentFields[fieldIndex];
    
    if (!field) return;
    
    // Generate unique ID for the new option
    const optionId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optionNumber = (field.options?.length || 0) + 1;
    
    // Create new options array instead of mutating
    const newOptions = field.options 
      ? [...field.options, { id: optionId, value: `option${optionNumber}`, label: `Option ${optionNumber}` }]
      : [{ id: optionId, value: "option1", label: "Option 1" }];
    
    // CRITICAL: Update the entire fields array to ensure React detects the change
    // This forces a re-render even with React.memo
    const updatedFields = [...currentFields];
    updatedFields[fieldIndex] = {
      ...field,
      options: newOptions,
    };
    
    form.setValue("fields", updatedFields, { 
      shouldValidate: false, 
      shouldDirty: true,
      shouldTouch: false 
    });
  }, [form]);

  const removeOption = useCallback((fieldIndex: number, optionIndex: number) => {
    const currentFields = form.getValues("fields");
    const field = currentFields[fieldIndex];
    
    if (!field || !field.options || field.options.length <= 1) return;
    
    // Create new options array without the removed option
    const newOptions = field.options.filter((_, i) => i !== optionIndex);
    
    // CRITICAL: Update the entire fields array to ensure React detects the change
    // This forces a re-render even with React.memo
    const updatedFields = [...currentFields];
    updatedFields[fieldIndex] = {
      ...field,
      options: newOptions,
    };
    
    form.setValue("fields", updatedFields, { 
      shouldValidate: false, 
      shouldDirty: true,
      shouldTouch: false 
    });
  }, [form]);

  const handleFormSubmit = useCallback((data: FormTemplateData) => {
    // Get the latest form values directly to ensure we have the most up-to-date data
    const currentValues = form.getValues();
    
    // Use current values if data seems incomplete
    const fieldsData = (data.fields && data.fields.length > 0 ? data.fields : (currentValues.fields || []))
      .map(field => ({
        ...field,
        // Strip IDs from options before submission (backend doesn't need them)
        options: field.options?.map(opt => ({
          value: opt.value,
          label: opt.label
        }))
      }));
    
    const formData = {
      name: data.name || currentValues.name || "",
      description: data.description || currentValues.description || "",
      fields: fieldsData,
    };
    
    // Ensure we have valid data before submitting
    if (!formData.name || !formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Form name is required. Please enter a name for the form.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.fields || formData.fields.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one field is required. Please add at least one field to your form.",
        variant: "destructive",
      });
      return;
    }
    
    onSubmit(formData);
  }, [onSubmit, toast, form]);

  const handleFormError = useCallback((errors: any) => {
    console.error("Form validation errors:", errors);
    
    // Helper function to recursively extract error messages
    const extractErrors = (errorObj: any, path: string = ""): string[] => {
      const messages: string[] = [];
      
      if (!errorObj) return messages;
      
      // Handle direct message
      if (errorObj.message) {
        const fieldName = path === "name" ? "Form Name" : path === "fields" ? "Form Fields" : path;
        messages.push(`${fieldName ? `${fieldName}: ` : ""}${errorObj.message}`);
      }
      
      // Handle _errors array
      if (Array.isArray(errorObj._errors)) {
        errorObj._errors.forEach((err: string) => {
          const fieldName = path === "name" ? "Form Name" : path === "fields" ? "Form Fields" : path;
          messages.push(`${fieldName ? `${fieldName}: ` : ""}${err}`);
        });
      }
      
      // Handle nested objects
      Object.keys(errorObj).forEach((key) => {
        if (key !== "message" && key !== "_errors" && key !== "ref") {
          const nestedPath = path ? `${path}.${key}` : key;
          const nestedErrors = extractErrors(errorObj[key], nestedPath);
          messages.push(...nestedErrors);
        }
      });
      
      return messages;
    };
    
    const errorMessages = extractErrors(errors);
    
    // Create user-friendly error message
    let errorMessage = "Please fix the following errors:\n";
    
    if (errorMessages.length > 0) {
      // Check for common errors and provide helpful messages
      const hasNameError = errorMessages.some(msg => msg.toLowerCase().includes("name") || msg.toLowerCase().includes("required"));
      const hasFieldsError = errorMessages.some(msg => msg.toLowerCase().includes("field") || msg.toLowerCase().includes("required"));
      
      if (hasNameError && errorMessages.some(msg => msg.includes("name"))) {
        errorMessage = "Form Name is required. Please enter a name for your form.\n";
      } else if (hasFieldsError && errorMessages.some(msg => msg.includes("field") && !msg.includes("name"))) {
        errorMessage = "At least one field is required. Please add at least one field to your form.\n";
      } else {
        errorMessage = errorMessages.slice(0, 3).join("\n");
      }
      
      if (errorMessages.length > 3) {
        errorMessage += `\n(and ${errorMessages.length - 3} more errors)`;
      }
    } else {
      errorMessage = "Please fill in all required fields correctly.";
    }
    
    toast({
      title: "Validation Error",
      description: errorMessage,
      variant: "destructive",
    });
  }, [toast]);

  // Memoize field cards to prevent unnecessary re-renders
  const fieldCards = useMemo(() => {
    return fields.map((field, index) => {
      const fieldId = fieldIdMapRef.current.get(index) ?? index;
      return { field, index, fieldId };
    });
  }, [fields]);

  return (
    <Form {...form}>
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          // Get current form values before validation
          const currentValues = form.getValues();
          console.log("Form submission - Current values:", currentValues);
          
          // Manually trigger validation and submit
          form.handleSubmit(handleFormSubmit, handleFormError)();
        }} 
        className="space-y-4 sm:space-y-6"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm sm:text-base">Form Name *</FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., Evaluation Sheet, Potential Talent" 
                  {...field}
                  value={field.value || ""}
                  onChange={(e) => {
                    field.onChange(e);
                    // Ensure form state is updated
                    form.setValue("name", e.target.value, { shouldDirty: true });
                  }}
                  className="h-10 sm:h-11 text-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm sm:text-base">Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Describe the purpose of this form..."
                  {...field}
                  rows={3}
                  className="text-sm resize-none"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <Label className="text-sm sm:text-base font-medium">Form Fields</Label>
            <Select onValueChange={(value) => addField(value as FormFieldType)}>
              <SelectTrigger className="w-full sm:w-[200px] h-10 sm:h-11 text-sm">
                <SelectValue placeholder="Add Field Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short_text">Short Text</SelectItem>
                <SelectItem value="paragraph">Paragraph</SelectItem>
                <SelectItem value="star_rating">Star Rating</SelectItem>
                <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                <SelectItem value="multiple_selection">Multiple Selection</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="dropdown">Dropdown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {fields.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No fields added yet. Add a field to get started.</p>
              </CardContent>
            </Card>
          )}

          {fieldCards.map(({ field, index, fieldId }) => (
            <FieldCard
              key={fieldId}
              form={form}
              field={field}
              index={index}
              totalFields={fields.length}
              onMove={moveField}
              onRemove={removeField}
              onAddOption={addOption}
              onRemoveOption={removeOption}
            />
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            className="w-full sm:w-auto order-2 sm:order-1 h-9 sm:h-10 text-sm"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full sm:w-auto order-1 sm:order-2 h-9 sm:h-10 text-sm"
          >
            {isLoading ? "Saving..." : "Save Form"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// Separate FieldCard component to prevent re-renders
const FieldCard = React.memo(function FieldCard({
  form,
  field,
  index,
  totalFields,
  onMove,
  onRemove,
  onAddOption,
  onRemoveOption,
}: {
  form: ReturnType<typeof useForm<FormTemplateData>>;
  field: FormField;
  index: number;
  totalFields: number;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onRemove: (index: number) => void;
  onAddOption: (fieldIndex: number) => void;
  onRemoveOption: (fieldIndex: number, optionIndex: number) => void;
}) {
  // Watch the specific field's options to ensure updates are reflected immediately
  const watchedOptions = useWatch({
    control: form.control,
    name: `fields.${index}.options`,
  });
  
  // Use watched options if available, fallback to field.options
  const currentOptions = watchedOptions || field.options;
  
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <CardTitle className="text-sm sm:text-base font-semibold truncate">
              Field {index + 1}: {field.label || 'Untitled Field'}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMove(index, 'up')}
              disabled={index === 0}
              className="h-8 w-8 sm:h-9 sm:w-9 p-0"
              title="Move up"
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMove(index, 'down')}
              disabled={index === totalFields - 1}
              className="h-8 w-8 sm:h-9 sm:w-9 p-0"
              title="Move down"
            >
              ↓
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              className="h-8 w-8 sm:h-9 sm:w-9 p-0"
              title="Remove field"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <FormField
            control={form.control}
            name={`fields.${index}.label`}
            render={({ field: fieldControl }) => (
              <FormItem>
                <FormLabel className="text-sm sm:text-base">Label *</FormLabel>
                <FormControl>
                  <Input placeholder="Field label" {...fieldControl} className="h-10 sm:h-11 text-sm" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`fields.${index}.fieldType`}
            render={({ field: fieldControl }) => (
              <FormItem>
                <FormLabel className="text-sm sm:text-base">Field Type</FormLabel>
                <Select
                  value={fieldControl.value}
                  onValueChange={(value) => {
                    const newType = value as FormFieldType;
                    const isChoiceType = ['multiple_choice', 'multiple_selection', 'dropdown'].includes(newType);
                    const wasChoiceType = ['multiple_choice', 'multiple_selection', 'dropdown'].includes(fieldControl.value);
                    
                    fieldControl.onChange(newType);
                    
                    // If changing to a choice type, ensure options exist
                    if (isChoiceType && !wasChoiceType) {
                      const currentFields = form.getValues("fields");
                      const currentField = currentFields[index];
                      if (!currentField.options || currentField.options.length === 0) {
                        const optionId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        form.setValue(`fields.${index}.options`, [{ id: optionId, value: "option1", label: "Option 1" }], { shouldValidate: false });
                      }
                    }
                    // If changing from a choice type, remove options
                    if (!isChoiceType && wasChoiceType) {
                      form.setValue(`fields.${index}.options`, undefined, { shouldValidate: false });
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="h-10 sm:h-11 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="short_text">Short Text</SelectItem>
                    <SelectItem value="paragraph">Paragraph</SelectItem>
                    <SelectItem value="star_rating">Star Rating</SelectItem>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="multiple_selection">Multiple Selection</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="dropdown">Dropdown</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name={`fields.${index}.placeholder`}
          render={({ field: fieldControl }) => (
            <FormItem>
              <FormLabel className="text-sm sm:text-base">Placeholder</FormLabel>
              <FormControl>
                <Input placeholder="Placeholder text" {...fieldControl} className="h-10 sm:h-11 text-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`fields.${index}.helpText`}
          render={({ field: fieldControl }) => (
            <FormItem>
              <FormLabel className="text-sm sm:text-base">Help Text</FormLabel>
              <FormControl>
                <Input placeholder="Help text for users" {...fieldControl} className="h-10 sm:h-11 text-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`fields.${index}.required`}
          render={({ field: fieldControl }) => (
            <FormItem className="flex flex-row items-center space-x-2 sm:space-x-3 space-y-0">
              <FormControl>
                <input
                  type="checkbox"
                  checked={fieldControl.value}
                  onChange={fieldControl.onChange}
                  className="rounded border-gray-300 w-4 h-4 sm:w-[18px] sm:h-[18px]"
                />
              </FormControl>
              <FormLabel className="text-sm sm:text-base cursor-pointer">Required Field</FormLabel>
            </FormItem>
          )}
        />

        {(field.fieldType === 'multiple_choice' || field.fieldType === 'multiple_selection' || field.fieldType === 'dropdown') && (
          <div className="space-y-2 sm:space-y-3">
            <Label className="text-sm sm:text-base font-medium">Options *</Label>
            {currentOptions?.map((option, optIndex) => {
              // Use stable key: prefer option.id, fallback to index
              const optionKey = option.id || `opt_${index}_${optIndex}`;
              return (
                <div key={optionKey} className="flex gap-2 sm:gap-3">
                  <FormField
                    control={form.control}
                    name={`fields.${index}.options.${optIndex}.value`}
                    render={({ field: optField }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="Option value" {...optField} className="h-10 sm:h-11 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`fields.${index}.options.${optIndex}.label`}
                    render={({ field: optField }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="Option label" {...optField} className="h-10 sm:h-11 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveOption(index, optIndex);
                    }}
                    disabled={(currentOptions?.length || 0) <= 1}
                    className="mt-0 h-10 w-10 sm:h-11 sm:w-11 p-0 flex-shrink-0"
                    title="Remove option"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
            {(!currentOptions || currentOptions.length === 0) && (
              <p className="text-xs sm:text-sm text-destructive">At least one option is required for this field type.</p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddOption(index);
              }}
              className="h-9 sm:h-10 text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Option
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// Helper to parse options from DB (can be JSON string or array)
const parseFormOptions = (options: any): Array<{ value: string; label: string }> => {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  if (typeof options === 'string') {
    try {
      return JSON.parse(options);
    } catch {
      return [];
    }
  }
  return [];
};

// Form Preview Component
function FormPreview({ form }: { form: FormTemplate }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">{form.name}</h3>
        {form.description && (
          <p className="text-sm text-muted-foreground">{form.description}</p>
        )}
      </div>

      <div className="space-y-4">
        {form.fields.sort((a, b) => a.orderIndex - b.orderIndex).map((field, index) => {
          const options = parseFormOptions(field.options);
          return (
            <div key={field.id || index} className="space-y-2">
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {field.helpText && (
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              )}
              
              {field.fieldType === 'short_text' && (
                <Input placeholder={field.placeholder || "Enter text..."} disabled />
              )}
              {field.fieldType === 'paragraph' && (
                <Textarea placeholder={field.placeholder || "Enter text..."} disabled rows={4} />
              )}
              {field.fieldType === 'star_rating' && (
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} disabled className="text-2xl text-yellow-400">★</button>
                  ))}
                </div>
              )}
              {field.fieldType === 'number' && (
                <Input type="number" placeholder={field.placeholder || "Enter number..."} disabled />
              )}
              {field.fieldType === 'date' && (
                <Input type="date" disabled />
              )}
              {(field.fieldType === 'multiple_choice' || field.fieldType === 'dropdown') && options.length > 0 && (
                <Select disabled>
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder || "Select an option..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt, optIndex) => (
                      <SelectItem key={optIndex} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {field.fieldType === 'multiple_selection' && options.length > 0 && (
                <div className="space-y-2">
                  {options.map((opt, optIndex) => (
                    <div key={optIndex} className="flex items-center space-x-2">
                      <input type="checkbox" disabled className="rounded" />
                      <Label>{opt.label}</Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t">
        <Button disabled className="w-full">Submit (Preview Only)</Button>
      </div>
    </div>
  );
}

