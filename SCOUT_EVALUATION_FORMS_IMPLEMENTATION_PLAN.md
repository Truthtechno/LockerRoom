# Scout Evaluation Forms System - Comprehensive Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for a dynamic form generation and data collection system for the LockerRoom platform. The system will enable System Administrators to create customizable evaluation forms that can be distributed to Scout Admins and XEN Scouts for collecting structured player evaluation data during tournaments and events.

## System Overview

### Current State
- Hard copy forms are manually filled during tournaments/events
- Scouts manually write data and store in files
- No digital system for form data collection
- No centralized evaluation repository

### Proposed State
- Digital form creation and management system
- Dynamic form builder with multiple field types
- Student profile auto-population from database
- Centralized evaluation repository with role-based access
- Real-time form submission and editing capabilities

## Terminology & Naming Conventions

### Page Names
- **"Evaluation Forms"** (replaces "Scout Forms" / "Forms page")
  - More professional and descriptive
  - Clearly indicates purpose
- **"Evaluation Submissions"** (replaces "Form Feedback" / "Form Feedback page")
  - Better describes the data view
  - Aligns with industry standards

### System Components
- **Evaluation Form Templates**: The form definitions created by system admin
- **Form Instances**: Individual form submissions by scouts
- **Student Profiles**: Auto-populated or manually entered student information

## Database Schema Design

### 1. `evaluation_form_templates` Table
Stores form template definitions created by system admins.

```sql
CREATE TABLE evaluation_form_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., "Evaluation Sheet", "Potential Talent"
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'archived'
  created_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL,
  published_at TIMESTAMP, -- When form was published to scouts
  version INTEGER DEFAULT 1 -- For form versioning
);
```

### 2. `evaluation_form_fields` Table
Stores individual field definitions for each form template.

```sql
CREATE TABLE evaluation_form_fields (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id VARCHAR NOT NULL REFERENCES evaluation_form_templates(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL, -- 'short_text', 'paragraph', 'star_rating', 'multiple_choice', 'multiple_selection', 'number', 'date', 'dropdown'
  label TEXT NOT NULL,
  placeholder TEXT,
  help_text TEXT,
  required BOOLEAN DEFAULT false,
  order_index INTEGER NOT NULL, -- For field ordering
  options JSONB, -- For multiple_choice/multiple_selection/dropdown: [{value: "option1", label: "Option 1"}]
  validation_rules JSONB, -- For min/max length, numeric ranges, etc.
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
```

### 3. `evaluation_submissions` Table
Stores individual form submissions by scouts.

```sql
CREATE TABLE evaluation_submissions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id VARCHAR NOT NULL REFERENCES evaluation_form_templates(id),
  submitted_by VARCHAR NOT NULL REFERENCES users(id), -- Scout who submitted
  student_id VARCHAR REFERENCES students(id), -- Nullable if student not in system
  -- Student info (for manual entries or snapshot at submission time)
  student_name TEXT,
  student_profile_pic_url TEXT,
  student_position TEXT,
  student_height TEXT,
  student_weight TEXT,
  student_role_number TEXT,
  student_sport TEXT,
  student_school_id VARCHAR REFERENCES schools(id),
  student_school_name TEXT,
  -- Submission metadata
  status TEXT DEFAULT 'draft', -- 'draft', 'submitted'
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
```

### 4. `evaluation_submission_responses` Table
Stores individual field responses for each submission.

```sql
CREATE TABLE evaluation_submission_responses (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id VARCHAR NOT NULL REFERENCES evaluation_submissions(id) ON DELETE CASCADE,
  field_id VARCHAR NOT NULL REFERENCES evaluation_form_fields(id),
  response_value TEXT, -- JSON string for complex types (arrays, objects)
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL,
  UNIQUE(submission_id, field_id) -- One response per field per submission
);
```

### 5. `evaluation_form_access` Table (Optional)
Tracks which forms are accessible to which roles (for future role-based form distribution).

```sql
CREATE TABLE evaluation_form_access (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id VARCHAR NOT NULL REFERENCES evaluation_form_templates(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'scout_admin', 'xen_scout', or specific user IDs
  granted_at TIMESTAMP DEFAULT now() NOT NULL,
  granted_by VARCHAR REFERENCES users(id)
);
```

## API Endpoints Design

### Form Template Management (System Admin Only)

#### 1. Create Form Template
```
POST /api/evaluation-forms/templates
Authorization: Bearer <system_admin_token>
Body: {
  name: string,
  description?: string,
  fields: Array<{
    field_type: string,
    label: string,
    placeholder?: string,
    help_text?: string,
    required: boolean,
    order_index: number,
    options?: Array<{value: string, label: string}>,
    validation_rules?: object
  }>
}
Response: { id: string, ...formTemplate }
```

#### 2. Update Form Template
```
PUT /api/evaluation-forms/templates/:templateId
Authorization: Bearer <system_admin_token>
Body: { ...same as create }
Response: { ...updatedFormTemplate }
```

#### 3. Get All Form Templates
```
GET /api/evaluation-forms/templates
Authorization: Bearer <token>
Query: ?status=active|draft|archived
Response: Array<{ id, name, description, status, fields: [...], ... }>
```

#### 4. Get Single Form Template
```
GET /api/evaluation-forms/templates/:templateId
Authorization: Bearer <token>
Response: { id, name, description, status, fields: [...], ... }
```

#### 5. Publish Form Template
```
POST /api/evaluation-forms/templates/:templateId/publish
Authorization: Bearer <system_admin_token>
Response: { message: "Form published", published_at: timestamp }
```

#### 6. Archive Form Template
```
POST /api/evaluation-forms/templates/:templateId/archive
Authorization: Bearer <system_admin_token>
Response: { message: "Form archived" }
```

#### 7. Delete Form Template
```
DELETE /api/evaluation-forms/templates/:templateId
Authorization: Bearer <system_admin_token>
Response: { message: "Form deleted" }
```

### Form Submission Management

#### 8. Search Students for Form
```
GET /api/evaluation-forms/students/search
Authorization: Bearer <scout_token>
Query: ?q=<search_term>&limit=20
Response: Array<{
  id: string,
  name: string,
  profilePicUrl?: string,
  position?: string,
  height?: string,
  weight?: string,
  roleNumber?: string,
  sport?: string,
  schoolId?: string,
  schoolName?: string
}>
```

#### 9. Get Student Profile Data
```
GET /api/evaluation-forms/students/:studentId/profile
Authorization: Bearer <scout_token>
Response: {
  id: string,
  name: string,
  profilePicUrl?: string,
  position?: string,
  height?: string,
  weight?: string,
  roleNumber?: string,
  sport?: string,
  schoolId?: string,
  schoolName?: string,
  // Note: Contact info (phone, guardianContact) excluded
}
```

#### 10. Create Form Submission (Draft)
```
POST /api/evaluation-forms/submissions
Authorization: Bearer <scout_token>
Body: {
  form_template_id: string,
  student_id?: string, // If student exists in system
  student_data?: { // If manual entry
    name: string,
    profile_pic?: File,
    position?: string,
    height?: string,
    weight?: string,
    role_number?: string,
    sport?: string,
    school_id?: string,
    school_name?: string
  },
  responses: Array<{
    field_id: string,
    response_value: string | number | Array<any>
  }>,
  status: 'draft' | 'submitted'
}
Response: { id: string, ...submission }
```

#### 11. Update Form Submission
```
PUT /api/evaluation-forms/submissions/:submissionId
Authorization: Bearer <scout_token>
Body: { ...same as create }
Response: { ...updatedSubmission }
```

#### 12. Get Submissions (Role-Based)
```
GET /api/evaluation-forms/submissions
Authorization: Bearer <token>
Query: 
  ?form_template_id=<id>
  &submitted_by=<user_id> (for xen_scout: auto-filtered to own)
  &status=draft|submitted
  &page=1&limit=20
Response: {
  submissions: Array<{
    id, form_template, student_info, submitted_by, status, 
    responses: [...], created_at, updated_at
  }>,
  pagination: { page, limit, total, totalPages }
}
```

#### 13. Get Single Submission
```
GET /api/evaluation-forms/submissions/:submissionId
Authorization: Bearer <token>
Response: { ...fullSubmissionDetails }
```

#### 14. Delete Submission
```
DELETE /api/evaluation-forms/submissions/:submissionId
Authorization: Bearer <scout_token> (own submissions only)
Response: { message: "Submission deleted" }
```

### Statistics & Analytics

#### 15. Get Form Statistics
```
GET /api/evaluation-forms/templates/:templateId/stats
Authorization: Bearer <system_admin|scout_admin_token>
Response: {
  total_submissions: number,
  draft_submissions: number,
  submitted_count: number,
  unique_students_evaluated: number,
  submissions_by_scout: Array<{ scout_id, scout_name, count }>
}
```

## Frontend Pages Implementation

### 1. Evaluation Forms Page (`/admin/evaluation-forms`)
**Access**: System Admin only

**Features**:
- List all form templates (Active, Draft, Archived tabs)
- Create new form template button
- Edit existing form template
- Delete/Archive form template
- Publish form to scouts
- View form statistics
- Form preview

**Components**:
- `EvaluationFormsList`: Main list view with filters
- `FormBuilder`: Drag-and-drop form builder (or simplified version)
- `FormPreview`: Preview form as scouts will see it
- `FormStatsCard`: Statistics display

### 2. Form Builder Component
**Features**:
- Add/remove/reorder fields
- Field type selection (short_text, paragraph, star_rating, multiple_choice, etc.)
- Field configuration (label, placeholder, required, validation)
- Options management for choice fields
- Live preview
- Save as draft or publish

**Field Types**:
1. **Short Text**: Single line input
2. **Paragraph**: Multi-line textarea
3. **Star Rating**: 1-5 star selector
4. **Multiple Choice**: Radio buttons (single selection)
5. **Multiple Selection**: Checkboxes (multiple selections)
6. **Number**: Numeric input with min/max
7. **Date**: Date picker
8. **Dropdown**: Select dropdown

### 3. Evaluation Submissions Page (`/admin/evaluation-submissions`)
**Access**: System Admin, Scout Admin, XEN Scout

**Features**:
- Form template selector (dropdown)
- List all submissions for selected form
- Filter by scout (for system/scout admins)
- Filter by status (draft/submitted)
- Search by student name
- View submission details
- Edit submission (for own submissions - xen_scout)
- Delete submission (for own submissions - xen_scout)
- Export submissions to Excel

**Permission-Based Views**:
- **XEN Scout**: Only sees own submissions, can edit/delete own
- **Scout Admin**: Sees all submissions from scouts under their supervision
- **System Admin**: Sees all submissions from all scouts

**Components**:
- `SubmissionList`: List view with filters
- `SubmissionDetailModal`: Detailed view of submission
- `SubmissionForm`: Form for creating/editing submissions
- `StudentSearchSelect`: Student search and selection component

### 4. Submission Form Component
**Features**:
- Student search/select (autocomplete dropdown)
- Auto-populate student bio fields when student selected
- Manual entry mode for students not in system
- Profile picture upload (for manual entries)
- Dynamic form fields based on template
- Field validation
- Save as draft or submit
- Edit existing submission

**Student Bio Fields (Auto-populated)**:
- Profile Photo
- Name
- Position
- Height
- Weight
- Role Number
- Sport
- School Name
- (Excludes: Phone, Guardian Contact, Email)

## Implementation Phases

### Phase 1: Database & Backend API (Week 1)
1. Create database migrations for all tables
2. Implement Drizzle schema definitions
3. Create storage layer methods
4. Implement API endpoints (1-7: Form Template Management)
5. Add authentication and authorization middleware
6. Unit tests for API endpoints

### Phase 2: Form Builder Frontend (Week 2)
1. Create Evaluation Forms page component
2. Build Form Builder component
3. Implement field type components
4. Form preview functionality
5. Form template CRUD operations
6. Publish/Archive functionality

### Phase 3: Submission System (Week 3)
1. Implement API endpoints (8-14: Submissions)
2. Create Evaluation Submissions page
3. Build Student Search component
4. Build Submission Form component
5. Auto-populate student data
6. Manual student entry mode
7. Draft/Submit functionality

### Phase 4: Permissions & Access Control (Week 4)
1. Implement role-based filtering in API
2. Permission checks in frontend
3. Different views for different roles
4. Access control testing

### Phase 5: Polish & Enhancement (Week 5)
1. Export to Excel functionality
2. Statistics and analytics
3. Form versioning (if needed)
4. UI/UX improvements
5. Performance optimization
6. Comprehensive testing
7. Documentation

## Technical Stack Integration

### Existing Technologies
- **Frontend**: React + TypeScript, TanStack Query, React Hook Form, Zod
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **File Storage**: Cloudinary
- **Authentication**: JWT tokens

### New Dependencies (if needed)
- Form builder library (optional): `react-form-builder2` or custom implementation
- Excel export: `xlsx` (already in use)
- Date picker: `react-datepicker` or shadcn date picker
- Star rating: Custom component or `react-star-ratings`

## Security Considerations

1. **Authorization Checks**:
   - System Admin: Full access to all forms and submissions
   - Scout Admin: Read access to all submissions, full access to own submissions
   - XEN Scout: Read/write access to own submissions only

2. **Data Validation**:
   - All inputs validated with Zod schemas
   - Field responses validated against field definitions
   - File uploads validated (type, size)

3. **Privacy**:
   - Student contact info excluded from auto-population
   - Manual entries stored securely
   - Access logs for sensitive operations

4. **Form Template Versioning**:
   - Archive old versions instead of deleting
   - Track changes for audit trail

## User Experience Flow

### System Admin Creating a Form
1. Navigate to "Evaluation Forms"
2. Click "Create New Form"
3. Enter form name and description
4. Add fields using form builder
5. Configure each field (type, label, options, validation)
6. Preview form
7. Save as draft or publish immediately
8. Form becomes available to scouts

### Scout Filling a Form
1. Navigate to "Evaluation Submissions"
2. Select form template from dropdown
3. Click "New Evaluation"
4. Search for student by name/school
5. Select student → auto-populate bio fields
6. Fill in evaluation fields
7. Save as draft or submit
8. Can return later to edit (if draft or own submission)

### Viewing Submissions
1. Navigate to "Evaluation Submissions"
2. Select form template
3. View list of submissions
4. Filter by scout/status (if admin)
5. Click submission to view details
6. Edit/Delete (if permissions allow)
7. Export to Excel (if admin)

## Edge Cases & Considerations

1. **Student Not in System**:
   - Scout can manually enter all student info
   - Upload profile picture
   - System stores as separate entry (not linked to students table)

2. **Form Updates After Submissions**:
   - Existing submissions remain unchanged
   - New submissions use updated form template
   - Consider form versioning for major changes

3. **Deleting Form Template**:
   - Option 1: Soft delete (archive) - preserves submissions
   - Option 2: Hard delete with cascade - removes all submissions
   - Recommendation: Use soft delete (archive)

4. **Multiple Submissions for Same Student**:
   - Allow multiple submissions per student per form
   - Track submission history
   - Show latest submission prominently

5. **Offline Capability** (Future Enhancement):
   - Store drafts locally
   - Sync when online
   - PWA implementation

## Success Metrics

1. **Adoption Rate**: % of scouts using digital forms vs. paper
2. **Submission Rate**: Number of evaluations submitted per week/month
3. **Data Quality**: % of complete submissions vs. drafts
4. **Time Savings**: Average time to fill digital form vs. paper
5. **User Satisfaction**: Feedback from scouts and admins

## Future Enhancements

1. **Form Templates Library**: Pre-built templates for common evaluation types
2. **Advanced Analytics**: Charts showing evaluation trends, player performance over time
3. **Scout Performance Metrics**: Track which scouts submit most evaluations
4. **Integration with XEN Watch**: Link evaluations to video submissions
5. **Mobile App**: Native mobile app for scouts in the field
6. **Offline Mode**: PWA with offline form filling
7. **Form Versioning**: Track form changes and migration of old submissions
8. **Conditional Logic**: Show/hide fields based on previous answers
9. **File Attachments**: Allow scouts to attach photos/videos to evaluations
10. **Collaborative Evaluations**: Multiple scouts evaluate same student

## Migration Strategy

1. **Data Migration**: N/A (new feature)
2. **User Training**: 
   - Provide documentation
   - Create video tutorials
   - Conduct training sessions
3. **Gradual Rollout**:
   - Beta test with select scouts
   - Gather feedback
   - Refine and improve
   - Full rollout

## Conclusion

This implementation plan provides a comprehensive roadmap for building a professional, scalable evaluation forms system. The design prioritizes user experience, data integrity, and security while maintaining flexibility for future enhancements.

---

**Next Steps**: Review and approve this plan, then proceed with Phase 1 implementation.

