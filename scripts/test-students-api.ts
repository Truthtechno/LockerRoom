import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, sql } from 'drizzle-orm';
import { students, users } from '../shared/schema';

config();

async function testAPIQuery() {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ No DATABASE_URL found');
      process.exit(1);
    }

    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);

    // Get XEN ACADEMY school ID
    const schoolResult = await sqlClient`
      SELECT id FROM schools WHERE name ILIKE '%XEN%' LIMIT 1;
    `;
    const schoolId = schoolResult[0]?.id;

    if (!schoolId) {
      console.error('❌ XEN ACADEMY not found');
      process.exit(1);
    }

    console.log(`🔍 Testing query for school ID: ${schoolId}\n`);

    // Test the exact query used in the API
    const query = db
      .select({
        studentId: students.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        phone: students.phone,
        sport: students.sport,
        position: students.position,
        roleNumber: students.roleNumber,
        gender: students.gender,
        bio: students.bio,
        profilePicUrl: students.profilePicUrl,
        createdAt: users.createdAt,
      })
      .from(students)
      .innerJoin(users, eq(users.linkedId, students.id))
      .where(eq(students.schoolId, schoolId));

    const studentsList = await query.orderBy(sql`${users.name} ASC`);

    console.log(`📊 Query returned ${studentsList.length} students:\n`);
    studentsList.forEach((student: any, index: number) => {
      console.log(`Student ${index + 1}:`);
      console.log(`  - ID: ${student.studentId}`);
      console.log(`  - Name: ${student.name}`);
      console.log(`  - Email: ${student.email}`);
      console.log(`  - Role Number: "${student.roleNumber}" (type: ${typeof student.roleNumber})`);
      console.log(`  - Position: ${student.position}`);
      console.log(`  - Sport: ${student.sport}`);
      console.log(`  - Profile Pic: ${student.profilePicUrl || 'N/A'}`);
      console.log('');
    });

    // Also test raw SQL to compare
    console.log('\n🔍 Testing raw SQL query for comparison:\n');
    const rawResult = await sqlClient`
      SELECT 
        s.id as student_id,
        u.id as user_id,
        u.name,
        u.email,
        s.phone,
        s.sport,
        s.position,
        s.role_number,
        s.gender,
        s.bio,
        s.profile_pic_url,
        u.created_at
      FROM students s
      INNER JOIN users u ON u.linked_id = s.id
      WHERE s.school_id = ${schoolId}
      ORDER BY u.name ASC;
    `;

    console.log(`📊 Raw SQL returned ${rawResult.length} students:\n`);
    rawResult.forEach((student: any, index: number) => {
      console.log(`Student ${index + 1}:`);
      console.log(`  - Name: ${student.name}`);
      console.log(`  - Role Number (raw): "${student.role_number}" (type: ${typeof student.role_number})`);
      console.log('');
    });

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testAPIQuery();

