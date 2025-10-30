-- XEN Watch Refactor Migration
-- Create new tables for the refactored XEN Watch system

-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumb_url TEXT,
  notes TEXT,
  promo_code TEXT,
  status TEXT NOT NULL DEFAULT 'in_review' CHECK (status IN ('in_review', 'finalized', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create submission_reviews table
CREATE TABLE IF NOT EXISTS submission_reviews (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id VARCHAR NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  scout_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  notes TEXT,
  is_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id, scout_id)
);

-- Create submission_final_feedback table
CREATE TABLE IF NOT EXISTS submission_final_feedback (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id VARCHAR NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  admin_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  final_rating INTEGER CHECK (final_rating BETWEEN 1 AND 5),
  summary TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS submissions_student_id_idx ON submissions(student_id);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions(status);
CREATE INDEX IF NOT EXISTS submission_reviews_submission_id_idx ON submission_reviews(submission_id);
CREATE INDEX IF NOT EXISTS submission_reviews_scout_id_idx ON submission_reviews(scout_id);
CREATE INDEX IF NOT EXISTS submission_final_feedback_submission_id_idx ON submission_final_feedback(submission_id);
CREATE INDEX IF NOT EXISTS submission_final_feedback_admin_id_idx ON submission_final_feedback(admin_id);
