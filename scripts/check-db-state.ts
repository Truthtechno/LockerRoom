#!/usr/bin/env tsx

/**
 * Database State Checker for LockerRoom
 * 
 * This script checks the current state of the database to see what demo accounts exist
 * and whether they have proper linkedId relationships.
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function checkDatabaseState() {
  console.log("🔍 Checking current database state...\n");

  try {
    // Check users table
    console.log("📋 Users table:");
    const users = await sql`
      SELECT id, email, role, linked_id, name, school_id, created_at
      FROM users 
      ORDER BY created_at DESC
    `;
    
    console.log(`Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) - linkedId: ${user.linked_id}`);
    });

    // Check specific demo accounts
    console.log("\n🎯 Checking specific demo accounts:");
    const demoAccounts = [
      'sysadmin@lockerroom.com',
      'godwin@xen-hub.com', 
      'thiago@gmail.com',
      'brayamooti@gmail.com',
      'scout123@xen.com'
    ];

    for (const email of demoAccounts) {
      const user = await sql`
        SELECT id, email, role, linked_id, name, school_id
        FROM users 
        WHERE email = ${email}
      `;
      
      if (user.length > 0) {
        console.log(`  ✅ ${email} exists (${user[0].role}) - linkedId: ${user[0].linked_id}`);
        
        // Check if linkedId points to valid record
        if (user[0].role === 'student') {
          const student = await sql`
            SELECT id, name, school_id
            FROM students 
            WHERE user_id = ${user[0].id}
          `;
          if (student.length > 0) {
            console.log(`    📚 Student record: ${student[0].name} (school: ${student[0].school_id})`);
          } else {
            console.log(`    ❌ No student record found for user_id: ${user[0].id}`);
          }
        } else if (user[0].role === 'system_admin') {
          const admin = await sql`
            SELECT id, name
            FROM system_admins 
            WHERE id = ${user[0].linked_id}
          `;
          if (admin.length > 0) {
            console.log(`    👑 System admin record: ${admin[0].name}`);
          } else {
            console.log(`    ❌ No system admin record found for linkedId: ${user[0].linked_id}`);
          }
        } else if (user[0].role === 'school_admin') {
          const admin = await sql`
            SELECT id, name, school_id
            FROM school_admins 
            WHERE id = ${user[0].linked_id}
          `;
          if (admin.length > 0) {
            console.log(`    🎓 School admin record: ${admin[0].name} (school: ${admin[0].school_id})`);
          } else {
            console.log(`    ❌ No school admin record found for linkedId: ${user[0].linked_id}`);
          }
        } else if (user[0].role === 'viewer' || user[0].role === 'public_viewer') {
          const viewer = await sql`
            SELECT id, name
            FROM viewers 
            WHERE id = ${user[0].linked_id}
          `;
          if (viewer.length > 0) {
            console.log(`    👀 Viewer record: ${viewer[0].name}`);
          } else {
            console.log(`    ❌ No viewer record found for linkedId: ${user[0].linked_id}`);
          }
        }
      } else {
        console.log(`  ❌ ${email} does not exist`);
      }
    }

    // Check students table
    console.log("\n📚 Students table:");
    const students = await sql`
      SELECT id, user_id, name, school_id, sport, position
      FROM students 
      ORDER BY created_at DESC
    `;
    
    console.log(`Found ${students.length} students:`);
    students.forEach(student => {
      console.log(`  - ${student.name} (user_id: ${student.user_id}, school: ${student.school_id})`);
    });

    // Check schools table
    console.log("\n🏫 Schools table:");
    const schools = await sql`
      SELECT id, name, subscription_plan, max_students
      FROM schools 
      ORDER BY created_at DESC
    `;
    
    console.log(`Found ${schools.length} schools:`);
    schools.forEach(school => {
      console.log(`  - ${school.name} (plan: ${school.subscription_plan}, max: ${school.max_students})`);
    });

    console.log("\n✅ Database state check completed!");

  } catch (error) {
    console.error("❌ Error checking database state:", error);
    process.exit(1);
  }
}

// Run the check
checkDatabaseState().catch(console.error);
