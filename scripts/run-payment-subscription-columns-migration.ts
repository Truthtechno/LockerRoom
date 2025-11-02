import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ No DATABASE_URL found');
  process.exit(1);
}

async function runMigration() {
  console.log('🔗 Connecting to database...');
  const sql = neon(connectionString);
  
  try {
    console.log('🔄 Adding subscription price columns...');
    console.log('🔒 Safe mode: All operations use IF NOT EXISTS to preserve data');
    
    // Add subscription price columns if they don't exist
    try {
      await sql`
        ALTER TABLE system_payment 
        ADD COLUMN IF NOT EXISTS subscription_monthly_price DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS subscription_yearly_price DECIMAL(10, 2)
      `;
      console.log('   ✅ Subscription price columns added');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('   ⚠️  Columns already exist (skipping)');
      } else {
        throw error;
      }
    }
    
    // Set defaults for any null values (optional - only if you want to backfill)
    // We'll skip this since subscriptions aren't enabled yet
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Added subscription_monthly_price column');
    console.log('  - Added subscription_yearly_price column');
    console.log('\n✨ Your data is safe - no data was modified!');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔍 Error details:', error);
    process.exit(1);
  }
}

runMigration();

