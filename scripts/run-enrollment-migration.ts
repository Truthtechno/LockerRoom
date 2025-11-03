import { db } from '../server/db';
import { schools } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function runMigration() {
  try {
    console.log('🔄 Setting all schools to maxStudents = 10...');
    
    // Update all schools to have maxStudents = 10
    const result = await db.execute(sql`
      UPDATE schools 
      SET max_students = 10 
      WHERE max_students IS NULL OR max_students <= 0 OR max_students != 10;
    `);
    
    console.log(`✅ Migration completed. Updated schools.`);
    console.log(`   Note: Run the SQL migration file manually for payment records table.`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

