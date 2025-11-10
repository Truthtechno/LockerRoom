import { Express } from 'express';
import { requireAuth, requireRole, requireRoles } from '../middleware/auth';
import { storage } from '../storage';
import { z } from 'zod';
import { notifyFormCreated, notifyFormSubmitted } from '../utils/notification-helpers';

// Validation schemas
// Base schema without refinement for reuse
const baseFormTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional().or(z.literal("")),
  fields: z.array(z.object({
    fieldType: z.enum(['short_text', 'paragraph', 'star_rating', 'multiple_choice', 'multiple_selection', 'number', 'date', 'dropdown', 'section_header']),
    label: z.string().min(1, 'Label is required'),
    placeholder: z.string().optional().or(z.literal("")),
    helpText: z.string().optional().or(z.literal("")),
    required: z.boolean().default(false),
    orderIndex: z.number().int().min(0),
    options: z.array(z.object({
      value: z.string().min(1, 'Option value is required'),
      label: z.string().min(1, 'Option label is required'),
    })).optional(),
    validationRules: z.record(z.any()).optional(),
  })).min(1, 'At least one field is required'),
});

// Create schema with refinement
const createFormTemplateSchema = baseFormTemplateSchema.refine((data) => {
  // Validate that fields with choice/dropdown types have options
  for (const field of data.fields) {
    if (['multiple_choice', 'multiple_selection', 'dropdown'].includes(field.fieldType)) {
      if (!field.options || field.options.length === 0) {
        return false;
      }
      // Validate that all options have non-empty values and labels
      if (field.options.some(opt => !opt.value.trim() || !opt.label.trim())) {
        return false;
      }
    }
  }
  return true;
}, {
  message: "Fields with choice/dropdown types must have at least one option with both value and label",
  path: ["fields"],
});

// Update schema - use base schema for partial() since refine() returns ZodEffects
const updateFormTemplateSchema = baseFormTemplateSchema.partial().extend({
  fields: z.array(z.object({
    fieldType: z.enum(['short_text', 'paragraph', 'star_rating', 'multiple_choice', 'multiple_selection', 'number', 'date', 'dropdown', 'section_header']),
    label: z.string().min(1, 'Label is required'),
    placeholder: z.string().optional().or(z.literal("")),
    helpText: z.string().optional().or(z.literal("")),
    required: z.boolean().default(false),
    orderIndex: z.number().int().min(0),
    options: z.array(z.object({
      value: z.string().min(1, 'Option value is required'),
      label: z.string().min(1, 'Option label is required'),
    })).optional(),
    validationRules: z.record(z.any()).optional(),
  })).optional(),
}).refine((data) => {
  // Validate that fields with choice/dropdown types have options (only if fields are provided)
  if (data.fields) {
    for (const field of data.fields) {
      if (['multiple_choice', 'multiple_selection', 'dropdown'].includes(field.fieldType)) {
        if (!field.options || field.options.length === 0) {
          return false;
        }
        if (field.options.some(opt => !opt.value.trim() || !opt.label.trim())) {
          return false;
        }
      }
    }
  }
  return true;
}, {
  message: "Fields with choice/dropdown types must have at least one option with both value and label",
  path: ["fields"],
});

const createSubmissionSchema = z.object({
  formTemplateId: z.string().uuid(),
  studentId: z.string().uuid().optional(),
  studentData: z.object({
    name: z.string().min(1),
    profile_pic: z.string().url().optional(),
    position: z.string().optional(),
    height: z.string().optional(),
    weight: z.string().optional(),
    role_number: z.string().optional(),
    sport: z.string().optional(),
    school_id: z.string().uuid().optional(),
    school_name: z.string().optional(),
  }).optional(),
  responses: z.array(z.object({
    fieldId: z.string().uuid(),
    responseValue: z.string(),
  })),
  status: z.enum(['draft', 'submitted']).default('draft'),
});

const updateSubmissionSchema = createSubmissionSchema.partial();

export function registerEvaluationFormsRoutes(app: Express) {
  // ============================================
  // Form Template Management (System Admin Only)
  // ============================================

  // Create Form Template
  app.post('/api/evaluation-forms/templates',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const parsed = createFormTemplateSchema.safeParse(req.body);
        if (!parsed.success) {
          // Collect all validation errors
          const errors = parsed.error.errors;
          const errorMessages = errors.map(err => {
            const path = err.path.join('.');
            return `${path}: ${err.message}`;
          });
          
          // Create a more descriptive error message
          let mainMessage = "Validation failed";
          if (errors.length === 1) {
            mainMessage = errors[0].message;
          } else {
            mainMessage = `Multiple validation errors: ${errorMessages.join('; ')}`;
          }
          
          return res.status(400).json({
            error: { code: 'validation_error', message: mainMessage, details: errors }
          });
        }

        const { name, description, fields } = parsed.data;
        const template = await storage.createEvaluationFormTemplate(
          {
            name,
            description: description || null,
            status: 'draft',
            createdBy: req.user!.id,
            version: 1,
          },
          (fields.map(field => ({
            fieldType: field.fieldType,
            label: field.label,
            placeholder: field.placeholder || null,
            helpText: field.helpText || null,
            required: field.required,
            orderIndex: field.orderIndex,
            options: field.options ? JSON.stringify(field.options) as any : null,
            validationRules: field.validationRules ? JSON.stringify(field.validationRules) as any : null,
          })) as any)
        );

        // Notify system admin, scouts admin, and xen scouts about the new form
        notifyFormCreated(template.id, template.name, req.user!.email).catch(err => {
          console.error('Error sending form creation notifications:', err);
          // Don't fail the request if notifications fail
        });

        res.status(201).json(template);
      } catch (error: any) {
        console.error('Create form template error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to create form template' }
        });
      }
    }
  );

  // Get All Form Templates
  app.get('/api/evaluation-forms/templates',
    requireAuth,
    requireRoles(['system_admin', 'scout_admin', 'xen_scout']),
    async (req, res) => {
      try {
        const status = req.query.status as string | undefined;
        const createdBy = req.query.created_by as string | undefined;
        
        const templates = await storage.getEvaluationFormTemplates({ status, createdBy });
        res.json(templates);
      } catch (error: any) {
        console.error('Get form templates error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to fetch form templates' }
        });
      }
    }
  );

  // Get Single Form Template
  app.get('/api/evaluation-forms/templates/:templateId',
    requireAuth,
    requireRoles(['system_admin', 'scout_admin', 'xen_scout']),
    async (req, res) => {
      try {
        const { templateId } = req.params;
        const template = await storage.getEvaluationFormTemplate(templateId);
        
        if (!template) {
          return res.status(404).json({
            error: { code: 'not_found', message: 'Form template not found' }
          });
        }

        res.json(template);
      } catch (error: any) {
        console.error('Get form template error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to fetch form template' }
        });
      }
    }
  );

  // Update Form Template
  app.put('/api/evaluation-forms/templates/:templateId',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { templateId } = req.params;
        const parsed = updateFormTemplateSchema.safeParse(req.body);
        
        if (!parsed.success) {
          // Collect all validation errors
          const errors = parsed.error.errors;
          const errorMessages = errors.map(err => {
            const path = err.path.join('.');
            return `${path}: ${err.message}`;
          });
          
          // Create a more descriptive error message
          let mainMessage = "Validation failed";
          if (errors.length === 1) {
            mainMessage = errors[0].message;
          } else {
            mainMessage = `Multiple validation errors: ${errorMessages.join('; ')}`;
          }
          
          return res.status(400).json({
            error: { code: 'validation_error', message: mainMessage, details: errors }
          });
        }

        const { name, description, fields } = parsed.data;
        const template = await storage.updateEvaluationFormTemplate(
          templateId,
          {
            name: name || undefined,
            description: description !== undefined ? description || null : undefined,
          },
          fields ? (fields.map(field => ({
            fieldType: field.fieldType,
            label: field.label,
            placeholder: field.placeholder || null,
            helpText: field.helpText || null,
            required: field.required,
            orderIndex: field.orderIndex,
            options: field.options ? JSON.stringify(field.options) as any : null,
            validationRules: field.validationRules ? JSON.stringify(field.validationRules) as any : null,
          })) as any) : undefined
        );

        if (!template) {
          return res.status(404).json({
            error: { code: 'not_found', message: 'Form template not found' }
          });
        }

        res.json(template);
      } catch (error: any) {
        console.error('Update form template error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to update form template' }
        });
      }
    }
  );

  // Publish Form Template
  app.post('/api/evaluation-forms/templates/:templateId/publish',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { templateId } = req.params;
        const template = await storage.publishEvaluationFormTemplate(templateId);
        
        if (!template) {
          return res.status(404).json({
            error: { code: 'not_found', message: 'Form template not found' }
          });
        }

        res.json({ message: 'Form published successfully', template });
      } catch (error: any) {
        console.error('Publish form template error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to publish form template' }
        });
      }
    }
  );

  // Archive Form Template
  app.post('/api/evaluation-forms/templates/:templateId/archive',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { templateId } = req.params;
        const template = await storage.archiveEvaluationFormTemplate(templateId);
        
        if (!template) {
          return res.status(404).json({
            error: { code: 'not_found', message: 'Form template not found' }
          });
        }

        res.json({ message: 'Form archived successfully', template });
      } catch (error: any) {
        console.error('Archive form template error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to archive form template' }
        });
      }
    }
  );

  // Delete Form Template
  app.delete('/api/evaluation-forms/templates/:templateId',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { templateId } = req.params;
        await storage.deleteEvaluationFormTemplate(templateId);
        res.json({ message: 'Form template deleted successfully' });
      } catch (error: any) {
        console.error('Delete form template error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to delete form template' }
        });
      }
    }
  );

  // ============================================
  // Student Search for Evaluation Forms
  // ============================================

  // Search Students
  app.get('/api/evaluation-forms/students/search',
    requireAuth,
    requireRoles(['scout_admin', 'xen_scout']),
    async (req, res) => {
      try {
        const query = req.query.q as string;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
        
        if (!query || query.length < 2) {
          return res.status(400).json({
            error: { code: 'validation_error', message: 'Search query must be at least 2 characters' }
          });
        }

        const students = await storage.searchStudentsForEvaluation(query, limit);
        res.json(students);
      } catch (error: any) {
        console.error('Search students error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to search students' }
        });
      }
    }
  );

  // Get Student Profile for Evaluation
  app.get('/api/evaluation-forms/students/:studentId/profile',
    requireAuth,
    requireRoles(['scout_admin', 'xen_scout']),
    async (req, res) => {
      try {
        const { studentId } = req.params;
        const profile = await storage.getStudentProfileForEvaluation(studentId);
        
        if (!profile) {
          return res.status(404).json({
            error: { code: 'not_found', message: 'Student not found' }
          });
        }

        res.json(profile);
      } catch (error: any) {
        console.error('Get student profile error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to fetch student profile' }
        });
      }
    }
  );

  // ============================================
  // Submission Management
  // ============================================

  // Create Submission
  app.post('/api/evaluation-forms/submissions',
    requireAuth,
    requireRoles(['scout_admin', 'xen_scout']),
    async (req, res) => {
      try {
        console.log('Received submission request:', {
          body: req.body,
          formTemplateId: req.body?.formTemplateId,
          formTemplateIdType: typeof req.body?.formTemplateId,
          hasFormTemplateId: !!req.body?.formTemplateId,
          keys: Object.keys(req.body || {})
        });
        
        const parsed = createSubmissionSchema.safeParse(req.body);
        if (!parsed.success) {
          console.error('Validation error:', parsed.error.errors);
          console.error('Request body received:', JSON.stringify(req.body, null, 2));
          const firstError = parsed.error.errors[0];
          const errorMessage = firstError.path.length > 0 
            ? `${firstError.path.join('.')}: ${firstError.message}`
            : firstError.message;
          return res.status(400).json({
            error: { code: 'validation_error', message: errorMessage, details: parsed.error.errors }
          });
        }

        const { formTemplateId, studentId, studentData, responses, status } = parsed.data;
        
        // If studentId is provided but studentData is not, fetch student profile
        let finalStudentData = studentData;
        if (studentId && !studentData) {
          const studentProfile = await storage.getStudentProfileForEvaluation(studentId);
          if (studentProfile) {
            finalStudentData = {
              name: studentProfile.name,
              profile_pic: studentProfile.profilePicUrl || undefined,
              position: studentProfile.position || undefined,
              height: studentProfile.height || undefined,
              weight: studentProfile.weight || undefined,
              role_number: studentProfile.roleNumber || undefined,
              sport: studentProfile.sport || undefined,
              school_id: studentProfile.schoolId || undefined,
              school_name: studentProfile.schoolName || undefined,
            };
          }
        }
        
        const submission = await storage.createEvaluationSubmission(
          {
            formTemplateId,
            submittedBy: req.user!.id,
            studentId: studentId || null,
            studentName: finalStudentData?.name || null,
            studentProfilePicUrl: finalStudentData?.profile_pic || null,
            studentPosition: finalStudentData?.position || null,
            studentHeight: finalStudentData?.height || null,
            studentWeight: finalStudentData?.weight || null,
            studentRoleNumber: finalStudentData?.role_number || null,
            studentSport: finalStudentData?.sport || null,
            studentSchoolId: finalStudentData?.school_id || null,
            studentSchoolName: finalStudentData?.school_name || null,
            status: status || 'draft',
          },
          responses.map(r => ({
            fieldId: r.fieldId,
            responseValue: typeof r.responseValue === 'string' ? r.responseValue : JSON.stringify(r.responseValue),
          }))
        );

        // Notify scout admin and system admin when a scout (xen_scout or scout_admin) submits a form
        console.log('🔔 Checking notification conditions:', {
          status,
          userRole: req.user!.role,
          shouldNotify: status === 'submitted' && (req.user!.role === 'xen_scout' || req.user!.role === 'scout_admin')
        });
        
        if (status === 'submitted' && (req.user!.role === 'xen_scout' || req.user!.role === 'scout_admin')) {
          console.log('✅ Notification conditions met, fetching form template...');
          // Get form template name
          const formTemplate = await storage.getEvaluationFormTemplate(formTemplateId);
          if (formTemplate) {
            console.log(`📬 Calling notifyFormSubmitted for submission ${submission.id}, form: ${formTemplate.name}`);
            notifyFormSubmitted(
              submission.id,
              formTemplateId,
              formTemplate.name,
              req.user!.id,
              req.user!.email,
              finalStudentData?.name || null
            ).then(() => {
              console.log('✅ notifyFormSubmitted completed successfully');
            }).catch(err => {
              console.error('❌ Error sending form submission notifications:', err);
              console.error('Error stack:', err.stack);
              // Don't fail the request if notifications fail
            });
          } else {
            console.error('❌ Form template not found for templateId:', formTemplateId);
          }
        } else {
          console.log('⚠️ Notification conditions not met - skipping notification');
        }

        res.status(201).json(submission);
      } catch (error: any) {
        console.error('Create submission error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to create submission' }
        });
      }
    }
  );

  // Get Submissions (Role-Based)
  app.get('/api/evaluation-forms/submissions',
    requireAuth,
    requireRoles(['system_admin', 'scout_admin', 'xen_scout']),
    async (req, res) => {
      try {
        const formTemplateId = req.query.form_template_id as string | undefined;
        const submittedBy = req.query.submitted_by as string | undefined;
        const status = req.query.status as string | undefined;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

        // XEN Scouts can only see their own submissions
        const finalSubmittedBy = req.user!.role === 'xen_scout' ? req.user!.id : submittedBy;

        const result = await storage.getEvaluationSubmissions({
          formTemplateId,
          submittedBy: finalSubmittedBy,
          status,
          page,
          limit,
        });

        res.json(result);
      } catch (error: any) {
        console.error('Get submissions error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to fetch submissions' }
        });
      }
    }
  );

  // Get Single Submission
  app.get('/api/evaluation-forms/submissions/:submissionId',
    requireAuth,
    requireRoles(['system_admin', 'scout_admin', 'xen_scout']),
    async (req, res) => {
      try {
        const { submissionId } = req.params;
        const submission = await storage.getEvaluationSubmission(submissionId);
        
        if (!submission) {
          return res.status(404).json({
            error: { code: 'not_found', message: 'Submission not found' }
          });
        }

        // XEN Scouts can only view their own submissions
        if (req.user!.role === 'xen_scout' && submission.submittedBy !== req.user!.id) {
          return res.status(403).json({
            error: { code: 'forbidden', message: 'You can only view your own submissions' }
          });
        }

        res.json(submission);
      } catch (error: any) {
        console.error('Get submission error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to fetch submission' }
        });
      }
    }
  );

  // Update Submission
  app.put('/api/evaluation-forms/submissions/:submissionId',
    requireAuth,
    requireRoles(['scout_admin', 'xen_scout']),
    async (req, res) => {
      try {
        const { submissionId } = req.params;
        
        // Check if submission exists and user has permission
        const existingSubmission = await storage.getEvaluationSubmission(submissionId);
        if (!existingSubmission) {
          return res.status(404).json({
            error: { code: 'not_found', message: 'Submission not found' }
          });
        }

        // XEN Scouts can only edit their own submissions
        if (req.user!.role === 'xen_scout' && existingSubmission.submittedBy !== req.user!.id) {
          return res.status(403).json({
            error: { code: 'forbidden', message: 'You can only edit your own submissions' }
          });
        }

        const parsed = updateSubmissionSchema.safeParse(req.body);
        if (!parsed.success) {
          console.error('Validation error (update):', parsed.error.errors);
          const firstError = parsed.error.errors[0];
          const errorMessage = firstError.path.length > 0 
            ? `${firstError.path.join('.')}: ${firstError.message}`
            : firstError.message;
          return res.status(400).json({
            error: { code: 'validation_error', message: errorMessage, details: parsed.error.errors }
          });
        }

        const { formTemplateId, studentId, studentData, responses, status } = parsed.data;
        
        // If studentId is provided but studentData is not, fetch student profile
        let finalStudentData = studentData;
        if (studentId && !studentData) {
          const studentProfile = await storage.getStudentProfileForEvaluation(studentId);
          if (studentProfile) {
            finalStudentData = {
              name: studentProfile.name,
              profile_pic: studentProfile.profilePicUrl || undefined,
              position: studentProfile.position || undefined,
              height: studentProfile.height || undefined,
              weight: studentProfile.weight || undefined,
              role_number: studentProfile.roleNumber || undefined,
              sport: studentProfile.sport || undefined,
              school_id: studentProfile.schoolId || undefined,
              school_name: studentProfile.schoolName || undefined,
            };
          }
        }
        
        // Check if status is being changed from draft to submitted
        const wasDraft = existingSubmission.status === 'draft';
        const isNowSubmitted = status === 'submitted';
        const statusChangedToSubmitted = wasDraft && isNowSubmitted;

        const submission = await storage.updateEvaluationSubmission(
          submissionId,
          {
            formTemplateId: formTemplateId || undefined,
            studentId: studentId !== undefined ? studentId || null : undefined,
            studentName: finalStudentData?.name || undefined,
            studentProfilePicUrl: finalStudentData?.profile_pic || undefined,
            studentPosition: finalStudentData?.position || undefined,
            studentHeight: finalStudentData?.height || undefined,
            studentWeight: finalStudentData?.weight || undefined,
            studentRoleNumber: finalStudentData?.role_number || undefined,
            studentSport: finalStudentData?.sport || undefined,
            studentSchoolId: finalStudentData?.school_id || undefined,
            studentSchoolName: finalStudentData?.school_name || undefined,
            status: status || undefined,
          },
          responses ? responses.map(r => ({
            fieldId: r.fieldId,
            responseValue: typeof r.responseValue === 'string' ? r.responseValue : JSON.stringify(r.responseValue),
          })) : undefined
        );

        if (!submission) {
          return res.status(404).json({
            error: { code: 'not_found', message: 'Submission not found' }
          });
        }

        // Notify scout admin and system admin when a scout (xen_scout or scout_admin) submits a form (status changed from draft to submitted)
        console.log('🔔 Checking notification conditions (update):', {
          statusChangedToSubmitted,
          submittedBy: existingSubmission.submittedBy,
          status,
          oldStatus: existingSubmission.status
        });
        
        if (statusChangedToSubmitted && existingSubmission.submittedBy) {
          console.log('✅ Status changed to submitted, checking submitter role...');
          // Get the submitter user info to check their role
          const submitterUser = await storage.getUser(existingSubmission.submittedBy);
          console.log('Submitter user:', { id: submitterUser?.id, name: submitterUser?.name, role: submitterUser?.role });
          
          if (submitterUser && (submitterUser.role === 'xen_scout' || submitterUser.role === 'scout_admin')) {
            console.log('✅ Submitter role is valid, fetching form template...');
            // Get form template name
            const formTemplate = await storage.getEvaluationFormTemplate(submission.formTemplateId);
            if (formTemplate) {
              console.log(`📬 Calling notifyFormSubmitted for submission ${submission.id}, form: ${formTemplate.name}`);
              notifyFormSubmitted(
                submission.id,
                submission.formTemplateId,
                formTemplate.name,
                existingSubmission.submittedBy,
                submitterUser.name || '',
                submission.studentName || null
              ).then(() => {
                console.log('✅ notifyFormSubmitted completed successfully');
              }).catch(err => {
                console.error('❌ Error sending form submission notifications:', err);
                console.error('Error stack:', err.stack);
                // Don't fail the request if notifications fail
              });
            } else {
              console.error('❌ Form template not found for templateId:', submission.formTemplateId);
            }
          } else {
            console.log('⚠️ Submitter role is not xen_scout or scout_admin:', submitterUser?.role);
          }
        } else {
          console.log('⚠️ Notification conditions not met - skipping notification');
        }

        res.json(submission);
      } catch (error: any) {
        console.error('Update submission error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to update submission' }
        });
      }
    }
  );

  // Delete Submission
  app.delete('/api/evaluation-forms/submissions/:submissionId',
    requireAuth,
    requireRoles(['scout_admin', 'xen_scout']),
    async (req, res) => {
      try {
        const { submissionId } = req.params;
        
        // Check if submission exists and user has permission
        const existingSubmission = await storage.getEvaluationSubmission(submissionId);
        if (!existingSubmission) {
          return res.status(404).json({
            error: { code: 'not_found', message: 'Submission not found' }
          });
        }

        // XEN Scouts can only delete their own submissions
        if (req.user!.role === 'xen_scout' && existingSubmission.submittedBy !== req.user!.id) {
          return res.status(403).json({
            error: { code: 'forbidden', message: 'You can only delete your own submissions' }
          });
        }

        await storage.deleteEvaluationSubmission(submissionId);
        res.json({ message: 'Submission deleted successfully' });
      } catch (error: any) {
        console.error('Delete submission error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to delete submission' }
        });
      }
    }
  );

  // ============================================
  // Statistics & Analytics
  // ============================================

  // Get Form Statistics
  app.get('/api/evaluation-forms/templates/:templateId/stats',
    requireAuth,
    requireRoles(['system_admin', 'scout_admin']),
    async (req, res) => {
      try {
        const { templateId } = req.params;
        
        const submissions = await storage.getEvaluationSubmissions({
          formTemplateId: templateId,
        });

        const totalSubmissions = submissions.total;
        const draftSubmissions = submissions.submissions.filter(s => s.status === 'draft').length;
        const submittedCount = submissions.submissions.filter(s => s.status === 'submitted').length;
        
        // Get unique students evaluated
        const uniqueStudentIds = new Set(
          submissions.submissions
            .filter(s => s.studentId)
            .map(s => s.studentId)
        );
        
        // Get submissions by scout
        const submissionsByScout = new Map<string, { scoutId: string; scoutName: string; count: number }>();
        submissions.submissions.forEach(sub => {
          if (sub.submittedByUser) {
            const existing = submissionsByScout.get(sub.submittedByUser.id);
            if (existing) {
              existing.count++;
            } else {
              submissionsByScout.set(sub.submittedByUser.id, {
                scoutId: sub.submittedByUser.id,
                scoutName: sub.submittedByUser.name,
                count: 1,
              });
            }
          }
        });

        res.json({
          total_submissions: totalSubmissions,
          draft_submissions: draftSubmissions,
          submitted_count: submittedCount,
          unique_students_evaluated: uniqueStudentIds.size,
          submissions_by_scout: Array.from(submissionsByScout.values()),
        });
      } catch (error: any) {
        console.error('Get form statistics error:', error);
        res.status(500).json({
          error: { code: 'server_error', message: error.message || 'Failed to fetch form statistics' }
        });
      }
    }
  );
}

