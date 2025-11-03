import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

async function verifyAndFix() {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ No DATABASE_URL found');
      process.exit(1);
    }

    const sql = neon(connectionString);

    console.log('🔍 Checking current school max_students values...');
    const schools = await sql`
      SELECT id, name, max_students FROM schools;
    `;
    
    console.log('\n📊 Current School Limits:');
    schools.forEach((school: any) => {
      console.log(`   - ${school.name}: ${school.max_students || 'NULL'} students`);
    });

    console.log('\n🔄 Setting all schools to maxStudents = 10...');
    await sql`
      UPDATE schools 
      SET max_students = 10 
      WHERE max_students IS NULL OR max_students <= 0 OR max_students != 10;
    `;

    console.log('✅ Update complete! Verifying...');
    
    const updated = await sql`
      SELECT id, name, max_students FROM schools;
    `;
    
    console.log('\n📊 Updated School Limits:');
    updated.forEach((school: any) => {
      console.log(`   - ${school.name}: ${school.max_students} students`);
    });

    const allSetTo10 = updated.every((s: any) => s.max_students === 10);
    if (allSetTo10) {
      console.log('\n✅ All schools now have maxStudents = 10');
    } else {
      console.log('\n⚠️  Some schools may not be set to 10');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyAndFix();

