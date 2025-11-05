-- Migration: Evaluation Forms System
-- Description: Creates tables for evaluation form templates, fields, submissions, and responses

-- Evaluation Form Templates Table
CREATE TABLE IF NOT EXISTS evaluation_form_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'archived'
  created_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL,
  published_at TIMESTAMP, -- When form was published to scouts
  version INTEGER DEFAULT 1 -- For form versioning
);

-- Evaluation Form Fields Table
CREATE TABLE IF NOT EXISTS evaluation_form_fields (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id VARCHAR NOT NULL REFERENCES evaluation_form_templates(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL, -- 'short_text', 'paragraph', 'star_rating', 'multiple_choice', 'multiple_selection', 'number', 'date', 'dropdown'
  label TEXT NOT NULL,
  placeholder TEXT,
  help_text TEXT,
  required BOOLEAN DEFAULT false,
  order_index INTEGER NOT NULL, -- For field ordering
  options JSONB, -- For multiple_choice/multiple_selection/dropdown: [{"value": "option1", "label": "Option 1"}]
  validation_rules JSONB, -- For min/max length, numeric ranges, etc.
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Evaluation Submissions Table
CREATE TABLE IF NOT EXISTS evaluation_submissions (
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

-- Evaluation Submission Responses Table
CREATE TABLE IF NOT EXISTS evaluation_submission_responses (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id VARCHAR NOT NULL REFERENCES evaluation_submissions(id) ON DELETE CASCADE,
  field_id VARCHAR NOT NULL REFERENCES evaluation_form_fields(id),
  response_value TEXT, -- JSON string for complex types (arrays, objects)
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL,
  UNIQUE(submission_id, field_id) -- One response per field per submission
);

-- Evaluation Form Access Table (for future role-based form distribution)
CREATE TABLE IF NOT EXISTS evaluation_form_access (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id VARCHAR NOT NULL REFERENCES evaluation_form_templates(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'scout_admin', 'xen_scout', or specific user IDs
  granted_at TIMESTAMP DEFAULT now() NOT NULL,
  granted_by VARCHAR REFERENCES users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_evaluation_form_templates_status ON evaluation_form_templates(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_form_templates_created_by ON evaluation_form_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_evaluation_form_fields_template_id ON evaluation_form_fields(form_template_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_form_fields_order ON evaluation_form_fields(form_template_id, order_index);
CREATE INDEX IF NOT EXISTS idx_evaluation_submissions_template_id ON evaluation_submissions(form_template_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_submissions_submitted_by ON evaluation_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_evaluation_submissions_student_id ON evaluation_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_submissions_status ON evaluation_submissions(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_submission_responses_submission_id ON evaluation_submission_responses(submission_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_submission_responses_field_id ON evaluation_submission_responses(field_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_form_access_template_id ON evaluation_form_access(form_template_id);

