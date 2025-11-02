import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ No DATABASE_URL found');
  process.exit(1);
}

async function verifyMigration() {
  console.log('🔍 Verifying payment migration...\n');
  const sql = neon(connectionString);
  
  try {
    // Check if scout_ai_price_cents column exists
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'system_payment' 
      AND column_name = 'scout_ai_price_cents'
    `;
    
    if (columnCheck.length > 0) {
      console.log('✅ scout_ai_price_cents column exists in system_payment');
    } else {
      console.log('❌ scout_ai_price_cents column NOT found');
    }
    
    // Check if payment_transactions table exists
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'payment_transactions'
    `;
    
    if (tableCheck.length > 0) {
      console.log('✅ payment_transactions table exists');
      
      // Check indexes
      const indexes = await sql`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'payment_transactions'
      `;
      console.log(`✅ Found ${indexes.length} indexes on payment_transactions table`);
    } else {
      console.log('❌ payment_transactions table NOT found');
    }
    
    // Check existing payment config
    const paymentConfig = await sql`
      SELECT currency, xen_scout_price_cents, scout_ai_price_cents, mock_mode_enabled
      FROM system_payment
      LIMIT 1
    `;
    
    if (paymentConfig.length > 0) {
      console.log('\n📊 Current Payment Configuration:');
      console.log(`   Currency: ${paymentConfig[0].currency}`);
      console.log(`   XEN Watch Price: ${paymentConfig[0].xen_scout_price_cents} cents`);
      console.log(`   ScoutAI Price: ${paymentConfig[0].scout_ai_price_cents} cents`);
      console.log(`   Mock Mode: ${paymentConfig[0].mock_mode_enabled ? 'Enabled' : 'Disabled'}`);
    }
    
    console.log('\n✨ Migration verification complete!');
    
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyMigration();

