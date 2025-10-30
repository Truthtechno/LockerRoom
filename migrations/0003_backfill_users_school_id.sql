-- Migration: Backfill users.school_id for existing school admins and students
-- This ensures that existing school admins and students have their school_id properly set in the users table

-- Update school admins: Set users.school_id from school_admins.school_id
UPDATE users 
SET school_id = sa.school_id
FROM school_admins sa
WHERE users.role = 'school_admin' 
  AND users.linked_id = sa.id
  AND users.school_id IS NULL;

-- Update students: Set users.school_id from students.school_id  
UPDATE users 
SET school_id = s.school_id
FROM students s
WHERE users.role = 'student' 
  AND users.linked_id = s.id
  AND users.school_id IS NULL;

-- Verify the updates
SELECT 
  u.id,
  u.email,
  u.role,
  u.school_id,
  CASE 
    WHEN u.role = 'school_admin' THEN sa.name
    WHEN u.role = 'student' THEN s.name
    ELSE 'N/A'
  END as profile_name
FROM users u
LEFT JOIN school_admins sa ON u.linked_id = sa.id AND u.role = 'school_admin'
LEFT JOIN students s ON u.linked_id = s.id AND u.role = 'student'
WHERE u.role IN ('school_admin', 'student')
ORDER BY u.role, u.email;
