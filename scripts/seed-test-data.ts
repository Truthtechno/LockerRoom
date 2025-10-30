#!/usr/bin/env tsx

/**
 * Test Data Seeding Script
 * 
 * This script creates test schools and students to verify system integrity
 * after a data reset. It ensures proper school-student linkages and
 * provides verification of the system's data integrity.
 * 
 * Usage:
 *   npm run seed-test-data
 *   or
 *   tsx scripts/seed-test-data.ts
 */

import { db } from '../server/db';
import { 
  users, 
  schools, 
  schoolAdmins, 
  students, 
  analyticsLogs 
} from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';

interface TestSchool {
  id: string;
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  subscriptionPlan: 'standard' | 'premium';
  maxStudents: number;
}

interface TestStudent {
  id: string;
  userId: string;
  schoolId: string;
  name: string;
  email: string;
  phone: string;
  sport: string;
  position: string;
  grade: string;
}

async function seedTestData() {
  console.log('🌱 Starting test data seeding...');
  
  try {
    // Step 1: Create Test Schools
    console.log('\n📚 Step 1: Creating test schools...');
    
    const testSchools: TestSchool[] = [
      {
        id: 'test-school-a',
        name: 'Test Academy A',
        address: '123 Education Street, Learning City, LC 12345',
        contactEmail: 'admin@testacademya.edu',
        contactPhone: '(555) 123-4567',
        subscriptionPlan: 'premium',
        maxStudents: 200
      },
      {
        id: 'test-school-b',
        name: 'Test Academy B',
        address: '456 Knowledge Avenue, Wisdom Town, WT 67890',
        contactEmail: 'admin@testacademyb.edu',
        contactPhone: '(555) 987-6543',
        subscriptionPlan: 'standard',
        maxStudents: 150
      }
    ];

    for (const schoolData of testSchools) {
      // Check if school already exists
      const existingSchool = await db.select().from(schools).where(eq(schools.id, schoolData.id));
      
      if (existingSchool.length === 0) {
        await db.insert(schools).values({
          id: schoolData.id,
          name: schoolData.name,
          address: schoolData.address,
          contactEmail: schoolData.contactEmail,
          contactPhone: schoolData.contactPhone,
          subscriptionPlan: schoolData.subscriptionPlan,
          maxStudents: schoolData.maxStudents
        });
        console.log(`✅ Created school: ${schoolData.name}`);
      } else {
        console.log(`⚠️ School already exists: ${schoolData.name}`);
      }
    }

    // Step 2: Create School Admins
    console.log('\n👨‍💼 Step 2: Creating school admins...');
    
    const schoolAdminsData = [
      {
        schoolId: 'test-school-a',
        name: 'Principal Alice Johnson',
        email: 'alice.johnson@testacademya.edu',
        position: 'Principal'
      },
      {
        schoolId: 'test-school-b',
        name: 'Principal Bob Smith',
        email: 'bob.smith@testacademyb.edu',
        position: 'Principal'
      }
    ];

    const createdAdmins: { id: string; schoolId: string; name: string; email: string }[] = [];

    for (const adminData of schoolAdminsData) {
      // Check if admin already exists
      const existingUser = await db.select().from(users).where(eq(users.email, adminData.email));
      
      if (existingUser.length === 0) {
        // Create school admin profile
        const [schoolAdmin] = await db.insert(schoolAdmins).values({
          name: adminData.name,
          schoolId: adminData.schoolId,
          position: adminData.position
        }).returning();

        // Create user account
        const passwordHash = await bcrypt.hash('admin123', 12);
        const [user] = await db.insert(users).values({
          email: adminData.email,
          name: adminData.name,
          schoolId: adminData.schoolId,
          passwordHash,
          role: 'school_admin',
          linkedId: schoolAdmin.id,
          emailVerified: true,
          isOneTimePassword: false
        }).returning();

        createdAdmins.push({
          id: user.id,
          schoolId: adminData.schoolId,
          name: adminData.name,
          email: adminData.email
        });

        console.log(`✅ Created school admin: ${adminData.name} for ${adminData.schoolId}`);
      } else {
        console.log(`⚠️ Admin already exists: ${adminData.email}`);
        createdAdmins.push({
          id: existingUser[0].id,
          schoolId: adminData.schoolId,
          name: adminData.name,
          email: adminData.email
        });
      }
    }

    // Step 3: Create Test Students
    console.log('\n🎓 Step 3: Creating test students...');
    
    const testStudentsData = [
      // Test Academy A students
      {
        schoolId: 'test-school-a',
        name: 'Alex Thompson',
        email: 'alex.thompson@testacademya.edu',
        phone: '(555) 111-2222',
        sport: 'Basketball',
        position: 'Point Guard',
        grade: '11th Grade'
      },
      {
        schoolId: 'test-school-a',
        name: 'Sarah Davis',
        email: 'sarah.davis@testacademya.edu',
        phone: '(555) 333-4444',
        sport: 'Soccer',
        position: 'Forward',
        grade: '10th Grade'
      },
      {
        schoolId: 'test-school-a',
        name: 'Mike Wilson',
        email: 'mike.wilson@testacademya.edu',
        phone: '(555) 555-6666',
        sport: 'Football',
        position: 'Quarterback',
        grade: '12th Grade'
      },
      // Test Academy B students
      {
        schoolId: 'test-school-b',
        name: 'Emma Brown',
        email: 'emma.brown@testacademyb.edu',
        phone: '(555) 777-8888',
        sport: 'Volleyball',
        position: 'Setter',
        grade: '11th Grade'
      },
      {
        schoolId: 'test-school-b',
        name: 'James Miller',
        email: 'james.miller@testacademyb.edu',
        phone: '(555) 999-0000',
        sport: 'Baseball',
        position: 'Pitcher',
        grade: '10th Grade'
      },
      {
        schoolId: 'test-school-b',
        name: 'Lisa Garcia',
        email: 'lisa.garcia@testacademyb.edu',
        phone: '(555) 111-3333',
        sport: 'Track & Field',
        position: 'Sprinter',
        grade: '12th Grade'
      }
    ];

    const createdStudents: TestStudent[] = [];

    for (const studentData of testStudentsData) {
      // Check if student already exists
      const existingUser = await db.select().from(users).where(eq(users.email, studentData.email));
      
      if (existingUser.length === 0) {
        // Create user account
        const passwordHash = await bcrypt.hash('student123', 12);
        const tempStudentId = 'temp-' + Date.now();
        
        const [user] = await db.insert(users).values({
          email: studentData.email,
          name: studentData.name,
          schoolId: studentData.schoolId,
          passwordHash,
          role: 'student',
          linkedId: tempStudentId,
          emailVerified: true,
          isOneTimePassword: true
        }).returning();

        // Create student profile
        const [student] = await db.insert(students).values({
          userId: user.id,
          schoolId: studentData.schoolId,
          name: studentData.name,
          phone: studentData.phone,
          sport: studentData.sport,
          position: studentData.position,
          grade: studentData.grade
        }).returning();

        // Update user's linkedId
        await db.update(users)
          .set({ linkedId: student.id })
          .where(eq(users.id, user.id));

        createdStudents.push({
          id: student.id,
          userId: user.id,
          schoolId: studentData.schoolId,
          name: studentData.name,
          email: studentData.email,
          phone: studentData.phone,
          sport: studentData.sport,
          position: studentData.position,
          grade: studentData.grade
        });

        console.log(`✅ Created student: ${studentData.name} for ${studentData.schoolId}`);
      } else {
        console.log(`⚠️ Student already exists: ${studentData.email}`);
      }
    }

    // Step 4: Verification and Integrity Checks
    console.log('\n🔍 Step 4: Running integrity verification...');
    
    // Verify school-student linkages
    const verificationResults = await db.execute(sql`
      SELECT 
        s.name as school_name,
        s.id as school_id,
        COUNT(st.id) as student_count,
        COUNT(sa.id) as admin_count
      FROM schools s
      LEFT JOIN students st ON s.id = st.school_id
      LEFT JOIN school_admins sa ON s.id = sa.school_id
      WHERE s.id IN ('test-school-a', 'test-school-b')
      GROUP BY s.id, s.name
      ORDER BY s.name
    `);

    console.log('\n📊 Verification Results:');
    console.log('School Name | School ID | Students | Admins');
    console.log('------------|-----------|----------|-------');
    
    for (const row of verificationResults.rows) {
      const school = row as any;
      console.log(`${school.school_name.padEnd(12)} | ${school.school_id.padEnd(10)} | ${school.student_count.toString().padEnd(8)} | ${school.admin_count}`);
    }

    // Verify no cross-linking (students from School A should never appear under School B)
    const crossLinkCheck = await db.execute(sql`
      SELECT 
        st.name as student_name,
        st.school_id as student_school_id,
        u.school_id as user_school_id,
        CASE 
          WHEN st.school_id = u.school_id THEN 'CORRECT'
          ELSE 'ERROR: MISMATCH'
        END as linkage_status
      FROM students st
      INNER JOIN users u ON st.user_id = u.id
      WHERE st.school_id IN ('test-school-a', 'test-school-b')
      ORDER BY st.school_id, st.name
    `);

    console.log('\n🔗 Student-School Linkage Verification:');
    console.log('Student Name | Student School | User School | Status');
    console.log('-------------|---------------|------------|-------');
    
    let hasErrors = false;
    for (const row of crossLinkCheck.rows) {
      const check = row as any;
      console.log(`${check.student_name.padEnd(13)} | ${check.student_school_id.padEnd(14)} | ${check.user_school_id.padEnd(11)} | ${check.linkage_status}`);
      if (check.linkage_status.includes('ERROR')) {
        hasErrors = true;
      }
    }

    // Log the seeding completion
    await db.insert(analyticsLogs).values({
      eventType: 'test_data_seeding_complete',
      entityType: 'system',
      metadata: JSON.stringify({
        schoolsCreated: testSchools.length,
        adminsCreated: createdAdmins.length,
        studentsCreated: createdStudents.length,
        verificationPassed: !hasErrors,
        timestamp: new Date().toISOString()
      })
    });

    console.log('\n✅ Test data seeding completed successfully!');
    
    if (hasErrors) {
      console.log('⚠️ WARNING: Some linkage errors were detected. Please review the verification results above.');
    } else {
      console.log('🎉 All integrity checks passed! Student-school linkages are correct.');
    }

    console.log('\n📋 Summary:');
    console.log(`   - Schools created: ${testSchools.length}`);
    console.log(`   - School admins created: ${createdAdmins.length}`);
    console.log(`   - Students created: ${createdStudents.length}`);
    console.log(`   - Integrity verification: ${hasErrors ? 'FAILED' : 'PASSED'}`);

    console.log('\n🔑 Test Credentials:');
    console.log('School Admins:');
    createdAdmins.forEach(admin => {
      console.log(`   - ${admin.name} (${admin.email}): password = admin123`);
    });
    console.log('Students:');
    createdStudents.forEach(student => {
      console.log(`   - ${student.name} (${student.email}): password = student123`);
    });

  } catch (error) {
    console.error('❌ Error during test data seeding:', error);
    
    // Log the error
    await db.insert(analyticsLogs).values({
      eventType: 'test_data_seeding_error',
      entityType: 'system',
      metadata: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    });
    
    process.exit(1);
  }
}

// ESM-safe entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestData()
    .then(() => {
      console.log('\n🏁 Test data seeding script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test data seeding script failed:', error);
      process.exit(1);
    });
}

export { seedTestData };
