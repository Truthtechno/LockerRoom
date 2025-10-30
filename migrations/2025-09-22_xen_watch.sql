-- Roles: extend existing roles enum or store as text; LockerRoom stores roles on "users". We assume a roles enum or text column exists. We'll just store text and enforce via app.
-- If you use an enum, add: ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'scout_admin'; ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'xen_scout';

CREATE TABLE IF NOT EXISTS scout_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  xen_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  profile_pic_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM (
    'pending_payment','paid','assigned','in_review','reviewed','feedback_sent','canceled','refunded'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS xen_watch_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  -- If video comes from a post, link it; otherwise store media fields
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  media_url TEXT,
  media_public_id TEXT,
  caption TEXT,
  amount_cents INT NOT NULL DEFAULT 1000,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_provider TEXT,
  payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  status submission_status NOT NULL DEFAULT 'pending_payment',
  selected_scout_id UUID REFERENCES scout_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xws_student ON xen_watch_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_xws_status ON xen_watch_submissions(status);
CREATE INDEX IF NOT EXISTS idx_xws_selected_scout ON xen_watch_submissions(selected_scout_id);

CREATE TABLE IF NOT EXISTS xen_watch_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES xen_watch_submissions(id) ON DELETE CASCADE,
  scout_id UUID NOT NULL REFERENCES scout_profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, scout_id)
);

-- Final remarks from a Scout Admin (single authoritative message sent to student)
CREATE TABLE IF NOT EXISTS xen_watch_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES xen_watch_submissions(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simple view for analytics (top students / schools by avg rating)
CREATE MATERIALIZED VIEW IF NOT EXISTS xen_watch_stats AS
SELECT
  s.student_id,
  s.school_id,
  COUNT(DISTINCT s.id) AS total_submissions,
  AVG(r.rating)::NUMERIC(4,2) AS avg_rating
FROM xen_watch_submissions s
LEFT JOIN xen_watch_reviews r ON r.submission_id = s.id
GROUP BY s.student_id, s.school_id;

CREATE INDEX IF NOT EXISTS idx_xws_mv_student ON xen_watch_stats(student_id);
CREATE INDEX IF NOT EXISTS idx_xws_mv_school ON xen_watch_stats(school_id);
