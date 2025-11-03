import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

async function checkStudentNumbers() {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ No DATABASE_URL found');
      process.exit(1);
    }

    const sql = neon(connectionString);

    console.log('🔍 Checking student roleNumber data in database...\n');

    // Check students table directly
    const students = await sql`
      SELECT 
        s.id,
        s.name,
        s.role_number,
        s.position,
        s.sport,
        u.email,
        s.school_id
      FROM students s
      LEFT JOIN users u ON u.linked_id = s.id
      WHERE s.role_number IS NOT NULL AND s.role_number != ''
      LIMIT 10;
    `;

    console.log(`📊 Found ${students.length} students with roleNumber data:\n`);
    students.forEach((student: any) => {
      console.log(`   - ${student.name} (${student.email})`);
      console.log(`     Role Number: "${student.role_number}"`);
      console.log(`     Position: ${student.position || 'N/A'}`);
      console.log(`     Sport: ${student.sport || 'N/A'}`);
      console.log(`     School ID: ${student.school_id}`);
      console.log('');
    });

    // Check all students for XEN ACADEMY specifically
    const xenAcademyStudents = await sql`
      SELECT 
        s.id,
        s.name,
        s.role_number,
        s.position,
        s.sport,
        u.email,
        sch.name as school_name
      FROM students s
      LEFT JOIN users u ON u.linked_id = s.id
      LEFT JOIN schools sch ON sch.id = s.school_id
      WHERE sch.name ILIKE '%XEN%'
      ORDER BY s.name;
    `;

    console.log(`\n🎓 XEN ACADEMY Students (${xenAcademyStudents.length} total):\n`);
    xenAcademyStudents.forEach((student: any) => {
      console.log(`   - ${student.name} (${student.email})`);
      console.log(`     Role Number: "${student.role_number || 'NULL'}"`);
      console.log(`     Position: ${student.position || 'N/A'}`);
      console.log('');
    });

    // Check the actual column name in database
    console.log('\n🔍 Checking database schema...\n');
    const columnInfo = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'students' 
      AND (column_name LIKE '%role%' OR column_name LIKE '%number%')
      ORDER BY column_name;
    `;
    
    console.log('Relevant columns in students table:');
    columnInfo.forEach((col: any) => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkStudentNumbers();

