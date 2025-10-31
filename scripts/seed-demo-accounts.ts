#!/usr/bin/env tsx

/**
 * Idempotent Demo Account Seeder for LockerRoom
 * 
 * This script safely adds demo accounts without wiping existing data.
 * It uses "INSERT ... ON CONFLICT DO NOTHING" to avoid duplicates.
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';

const sql = neon(process.env.DATABASE_URL!);

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

async function ensureSchoolExists(name: string, plan: string = 'premium', maxStudents: number = 200) {
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
    VALUES (${name}, ${plan}, ${maxStudents})
    RETURNING id
  `;
  
  console.log(`  ✅ Created new school: ${name}`);
  return result[0].id;
}

async function ensureSystemAdminExists() {
  console.log("👑 Ensuring system admin exists...");
  
  // First create the system admin profile
  const adminProfile = await sql`
    INSERT INTO system_admins (id, name, profile_pic_url, bio, phone, permissions)
    VALUES (gen_random_uuid(), 'System Administrator', 
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
            'System administrator managing the LockerRoom platform.',
            '555-0001', 
            ARRAY['manage_schools', 'manage_users', 'view_analytics'])
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  
  let adminProfileId;
  if (adminProfile.length > 0) {
    adminProfileId = adminProfile[0].id;
    console.log("  ✅ Created new system admin profile");
  } else {
    // Profile already exists, get its ID
    const existing = await sql`
      SELECT id FROM system_admins WHERE name = 'System Administrator' LIMIT 1
    `;
    adminProfileId = existing[0].id;
    console.log("  ℹ️  System admin profile already exists");
  }
  
  // Then create the user account
  const passwordHash = await hashPassword("SuperSecure123!");
  const user = await sql`
    INSERT INTO users (email, password_hash, role, linked_id, name)
    VALUES ('sysadmin@lockerroom.com', ${passwordHash}, 'system_admin', ${adminProfileId}, 'System Administrator')
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;
  
  if (user.length > 0) {
    console.log("  ✅ Created new system admin user");
  } else {
    console.log("  ℹ️  System admin user already exists");
  }
  
  return adminProfileId;
}

async function ensureSchoolAdminExists() {
  console.log("🎓 Ensuring school admin exists...");
  
  // Ensure school exists first
  const schoolId = await ensureSchoolExists("XEN Hub Academy", "premium", 300);
  
  // Create school admin profile
  const adminProfile = await sql`
    INSERT INTO school_admins (id, name, school_id, profile_pic_url, bio, phone, position)
    VALUES (gen_random_uuid(), 'Godwin Manager', ${schoolId},
            'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200',
            'School administrator at XEN Hub Academy, passionate about student athletics.',
            '555-0002', 'Principal')
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  
  let adminProfileId;
  if (adminProfile.length > 0) {
    adminProfileId = adminProfile[0].id;
    console.log("  ✅ Created new school admin profile");
  } else {
    // Profile already exists, get its ID
    const existing = await sql`
      SELECT id FROM school_admins WHERE name = 'Godwin Manager' LIMIT 1
    `;
    adminProfileId = existing[0].id;
    console.log("  ℹ️  School admin profile already exists");
  }
  
  // Create the user account
  const passwordHash = await hashPassword("Test12345");
  const user = await sql`
    INSERT INTO users (email, password_hash, role, linked_id, name, school_id)
    VALUES ('godwin@xen-hub.com', ${passwordHash}, 'school_admin', ${adminProfileId}, 'Godwin Manager', ${schoolId})
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;
  
  if (user.length > 0) {
    console.log("  ✅ Created new school admin user");
  } else {
    console.log("  ℹ️  School admin user already exists");
  }
  
  return { userId: user.length > 0 ? user[0].id : null, schoolId, adminProfileId };
}

async function ensureStudentExists() {
  console.log("🎓 Ensuring student exists...");
  
  // Ensure school exists first
  const schoolId = await ensureSchoolExists("XEN Hub Academy", "premium", 300);
  
  // Create student user first
  const passwordHash = await hashPassword("Test123456");
  const user = await sql`
    INSERT INTO users (email, password_hash, role, linked_id, name, school_id)
    VALUES ('thiago@gmail.com', ${passwordHash}, 'student', gen_random_uuid(), 'Thiago Silva', ${schoolId})
    ON CONFLICT (email) DO NOTHING
    RETURNING id, linked_id
  `;
  
  let userId, linkedId;
  if (user.length > 0) {
    userId = user[0].id;
    linkedId = user[0].linked_id;
    console.log("  ✅ Created new student user");
  } else {
    // User already exists, get their info
    const existing = await sql`
      SELECT id, linked_id FROM users WHERE email = 'thiago@gmail.com'
    `;
    userId = existing[0].id;
    linkedId = existing[0].linked_id;
    console.log("  ℹ️  Student user already exists");
  }
  
  // Create student profile
  const student = await sql`
    INSERT INTO students (id, user_id, school_id, name, phone, gender, date_of_birth, grade, 
                        guardian_contact, sport, position, role_number, bio)
    VALUES (${linkedId}, ${userId}, ${schoolId}, 'Thiago Silva', '555-0003', 'male', 
            '2005-03-15', '11th Grade', 'guardian@email.com', 'Soccer', 'Midfielder', 
            'TS001', 'Passionate soccer player with dreams of playing professionally.')
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  
  if (student.length > 0) {
    console.log("  ✅ Created new student profile");
  } else {
    console.log("  ℹ️  Student profile already exists");
  }
  
  return { userId, schoolId };
}

async function ensurePublicViewerExists() {
  console.log("👀 Ensuring public viewer exists...");
  
  // Create viewer profile first
  const viewerProfile = await sql`
    INSERT INTO viewers (id, name, profile_pic_url, bio, phone)
    VALUES (gen_random_uuid(), 'Brian Mooti', 
            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200',
            'Public viewer interested in student athletics and sports development.',
            '555-0004')
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  
  let viewerProfileId;
  if (viewerProfile.length > 0) {
    viewerProfileId = viewerProfile[0].id;
    console.log("  ✅ Created new viewer profile");
  } else {
    // Profile already exists, get its ID
    const existing = await sql`
      SELECT id FROM viewers WHERE name = 'Brian Mooti' LIMIT 1
    `;
    viewerProfileId = existing[0].id;
    console.log("  ℹ️  Viewer profile already exists");
  }
  
  // Create the user account
  const passwordHash = await hashPassword("Pkw0epLSFG");
  const user = await sql`
    INSERT INTO users (email, password_hash, role, linked_id, name)
    VALUES ('brayamooti@gmail.com', ${passwordHash}, 'public_viewer', ${viewerProfileId}, 'Brian Mooti')
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;
  
  if (user.length > 0) {
    console.log("  ✅ Created new public viewer user");
  } else {
    console.log("  ℹ️  Public viewer user already exists");
  }
  
  return viewerProfileId;
}

async function ensureScoutExists() {
  console.log("🔍 Ensuring scout exists...");
  
  // Create scout user
  const passwordHash = await hashPassword("908734");
  const user = await sql`
    INSERT INTO users (email, password_hash, role, linked_id, name, xen_id, otp, is_one_time_password)
    VALUES ('scout123@xen.com', ${passwordHash}, 'xen_scout', gen_random_uuid(), 'Scout User', 
            'XSA-25001', '908734', true)
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;
  
  let userId;
  if (user.length > 0) {
    userId = user[0].id;
    console.log("  ✅ Created new scout user");
  } else {
    // User already exists, get their ID
    const existing = await sql`
      SELECT id FROM users WHERE email = 'scout123@xen.com'
    `;
    userId = existing[0].id;
    console.log("  ℹ️  Scout user already exists");
  }
  
  // Create scout admin record
  const admin = await sql`
    INSERT INTO admins (id, name, email, role, profile_pic_url, xen_id, otp)
    VALUES (${userId}, 'Scout User', 'scout123@xen.com', 'xen_scout', 
            'https://res.cloudinary.com/dh9cfkyhc/image/upload/v1758530852/admin-profiles/dzjg5fe4gc8rcw8s33pg.jpg',
            'XSA-25001', '908734')
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;
  
  if (admin.length > 0) {
    console.log("  ✅ Created new scout admin record");
  } else {
    console.log("  ℹ️  Scout admin record already exists");
  }
  
  return userId;
}

async function main() {
  try {
    console.log("🌱 Starting idempotent demo account seeding...\n");
    
    // Ensure all demo accounts exist
    await ensureSystemAdminExists();
    console.log();
    
    await ensureSchoolAdminExists();
    console.log();
    
    await ensureStudentExists();
    console.log();
    
    await ensurePublicViewerExists();
    console.log();
    
    await ensureScoutExists();
    console.log();
    
    console.log("🎉 Demo account seeding completed successfully!");
    console.log("\n📋 Demo Account Credentials:");
    console.log("System Admin: sysadmin@lockerroom.com / SuperSecure123!");
    console.log("School Admin: godwin@xen-hub.com / Test12345");
    console.log("Student: thiago@gmail.com / Test123456");
    console.log("Public Viewer: brayamooti@gmail.com / Pkw0epLSFG");
    console.log("Scout: scout123@xen.com / 908734");
    
  } catch (error) {
    console.error("❌ Error seeding demo accounts:", error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
