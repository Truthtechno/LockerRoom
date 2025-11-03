import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

async function updateConstraint() {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ No DATABASE_URL found');
      process.exit(1);
    }

    const sql = neon(connectionString);

    console.log('🔄 Updating payment frequency constraint to include "one-time"...\n');

    // Drop existing constraint
    try {
      await sql`
        ALTER TABLE school_payment_records 
        DROP CONSTRAINT IF EXISTS school_payment_records_payment_frequency_check;
      `;
      console.log('✅ Dropped old constraint');
    } catch (error: any) {
      console.log(`⚠️  Error dropping constraint (may not exist): ${error.message}`);
    }

    // Add new constraint with 'one-time'
    await sql`
      ALTER TABLE school_payment_records
      ADD CONSTRAINT school_payment_records_payment_frequency_check 
      CHECK (payment_frequency IN ('monthly', 'annual', 'one-time'));
    `;
    console.log('✅ Added new constraint with one-time option');

    // Verify
    const constraintCheck = await sql`
      SELECT 
        conname,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'school_payment_records'::regclass
      AND conname = 'school_payment_records_payment_frequency_check';
    `;
    
    if (constraintCheck.length > 0) {
      console.log('\n✅ Verification:');
      console.log(`   Constraint: ${constraintCheck[0].conname}`);
      console.log(`   Definition: ${constraintCheck[0].definition}`);
    }

    console.log('\n🎉 Constraint update completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Update failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updateConstraint();

