#!/usr/bin/env tsx

/**
 * Scout Test Accounts Setup for LockerRoom XEN Watch
 * 
 * Creates test accounts for end-to-end testing of the scout workflow:
 * - student@xen.com (Student)
 * - scout@xen.com (Scout) 
 * - scoutadmin@xen.com (Scout Admin)
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';

const sql = neon(process.env.DATABASE_URL!);

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

async function ensureSchoolExists(name: string = "XEN Test Academy") {
  console.log(`🏫 Ensuring school exists: ${name}`);
  
  // Check if school already exists
  const existing = await sql`
    SELECT id FROM schools WHERE name = ${name}
  `;
  
  if (existing.length > 0) {
    console.log(`  ℹ️  School already exists: ${name}`);
    return existing[0].id;
  }
  
  // Create new school
  const result = await sql`
    INSERT INTO schools (name, subscription_plan, max_students)
    VALUES (${name}, 'premium', 500)
    RETURNING id
  `;
  
  console.log(`  ✅ Created new school: ${name}`);
  return result[0].id;
}

async function createTestStudent() {
  console.log("🎓 Creating test student...");
  
  const schoolId = await ensureSchoolExists();
  
  // Create student user first
  const passwordHash = await hashPassword("student123");
  const user = await sql`
    INSERT INTO users (email, password_hash, role, linked_id, name, school_id)
    VALUES ('student@xen.com', ${passwordHash}, 'student', gen_random_uuid(), 'Test Student', ${schoolId})
    ON CONFLICT (email) DO UPDATE SET 
      password_hash = ${passwordHash},
      name = 'Test Student'
    RETURNING id, linked_id
  `;
  
  const userId = user[0].id;
  const linkedId = user[0].linked_id;
  
  // Create student profile
  await sql`
    INSERT INTO students (id, user_id, school_id, name, phone, gender, date_of_birth, grade, 
                        guardian_contact, sport, position, role_number, bio, profile_pic_url)
    VALUES (${linkedId}, ${userId}, ${schoolId}, 'Test Student', '555-1001', 'male', 
            '2006-01-01', '12th Grade', 'parent@email.com', 'Soccer', 'Forward', 
            'TS100', 'Test student for XEN Watch submission testing.',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200')
    ON CONFLICT (id) DO UPDATE SET
      name = 'Test Student',
      sport = 'Soccer',
      position = 'Forward'
    RETURNING id
  `;
  
  console.log("  ✅ Created/updated test student");
  return userId;
}

async function createTestScout() {
  console.log("🔍 Creating test scout...");
  
  // Create scout user
  const passwordHash = await hashPassword("scout123");
  const user = await sql`
    INSERT INTO users (email, password_hash, role, linked_id, name, xen_id, otp, is_one_time_password, profile_pic_url)
    VALUES ('scout@xen.com', ${passwordHash}, 'xen_scout', gen_random_uuid(), 'Test Scout', 
            'XSA-25100', 'scout123', true, 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200')
    ON CONFLICT (email) DO UPDATE SET 
      password_hash = ${passwordHash},
      role = 'xen_scout',
      name = 'Test Scout',
      xen_id = 'XSA-25100',
      otp = 'scout123'
    RETURNING id, linked_id
  `;
  
  const userId = user[0].id;
  
  // Update linked_id to point to self for scout roles
  await sql`
    UPDATE users SET linked_id = ${userId} WHERE id = ${userId}
  `;
  
  console.log("  ✅ Created/updated test scout");
  return userId;
}

async function createTestScoutAdmin() {
  console.log("👑 Creating test scout admin...");
  
  // Create scout admin user
  const passwordHash = await hashPassword("scoutadmin123");
  const user = await sql`
    INSERT INTO users (email, password_hash, role, linked_id, name, xen_id, otp, is_one_time_password, profile_pic_url)
    VALUES ('scoutadmin@xen.com', ${passwordHash}, 'scout_admin', gen_random_uuid(), 'Test Scout Admin', 
            'XSA-25200', 'scoutadmin123', true, 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200')
    ON CONFLICT (email) DO UPDATE SET 
      password_hash = ${passwordHash},
      name = 'Test Scout Admin',
      xen_id = 'XSA-25200',
      otp = 'scoutadmin123'
    RETURNING id, linked_id
  `;
  
  const userId = user[0].id;
  
  // Update linked_id to point to self for scout roles
  await sql`
    UPDATE users SET linked_id = ${userId} WHERE id = ${userId}
  `;
  
  console.log("  ✅ Created/updated test scout admin");
  return userId;
}

async function createTestSubmission(studentUserId: string) {
  console.log("📹 Creating test submission...");
  
  // Create a test submission
  const submission = await sql`
    INSERT INTO submissions (student_id, video_url, thumb_url, notes, promo_code, status)
    VALUES (${studentUserId}, 
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
            'This is a test submission for scout review testing.',
            'TEST2024',
            'in_review')
    RETURNING id
  `;
  
  const submissionId = submission[0].id;
  
  // Get all scout users (both xen_scout and scout_admin)
  const scouts = await sql`
    SELECT id FROM users WHERE role IN ('xen_scout', 'scout_admin')
  `;
  
  // Create placeholder reviews for all scouts
  for (const scout of scouts) {
    await sql`
      INSERT INTO submission_reviews (submission_id, scout_id, rating, notes, is_submitted)
      VALUES (${submissionId}, ${scout.id}, NULL, NULL, false)
      ON CONFLICT (submission_id, scout_id) DO NOTHING
    `;
  }
  
  console.log(`  ✅ Created test submission with ${scouts.length} review placeholders`);
  return submissionId;
}

async function main() {
  try {
    console.log("🌱 Setting up XEN Watch scout test accounts...\n");
    
    // Create test accounts
    const studentUserId = await createTestStudent();
    console.log();
    
    const scoutUserId = await createTestScout();
    console.log();
    
    const scoutAdminUserId = await createTestScoutAdmin();
    console.log();
    
    // Create test submission
    const submissionId = await createTestSubmission(studentUserId);
    console.log();
    
    console.log("🎉 Scout test accounts setup completed successfully!");
    console.log("\n📋 Test Account Credentials:");
    console.log("Student: student@xen.com / student123");
    console.log("Scout: scout@xen.com / scout123");
    console.log("Scout Admin: scoutadmin@xen.com / scoutadmin123");
    console.log(`\n📹 Test Submission ID: ${submissionId}`);
    console.log("\n🧪 Test Workflow:");
    console.log("1. Login as student@xen.com to see submission status");
    console.log("2. Login as scout@xen.com to review the submission");
    console.log("3. Login as scoutadmin@xen.com to finalize and send feedback");
    
  } catch (error) {
    console.error("❌ Error setting up scout test accounts:", error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
