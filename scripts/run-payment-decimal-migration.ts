import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

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
    console.log('🔄 Running payment decimal migration...');
    console.log('🔒 Safe mode: All operations preserve existing data');
    
    // Step 1: Add new decimal columns
    console.log('\n📝 Step 1: Adding decimal price columns...');
    try {
      await sql`
        ALTER TABLE system_payment 
        ADD COLUMN IF NOT EXISTS xen_scout_price DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS scout_ai_price DECIMAL(10, 2)
      `;
      console.log('   ✅ Decimal columns added');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('   ⚠️  Columns already exist (skipping)');
      } else {
        throw error;
      }
    }
    
    // Step 2: Convert existing cent values to decimal amounts
    console.log('\n📝 Step 2: Converting existing prices from cents to decimal...');
    await sql`
      UPDATE system_payment 
      SET 
        xen_scout_price = COALESCE(xen_scout_price_cents, 1000) / 100.0,
        scout_ai_price = COALESCE(scout_ai_price_cents, 1000) / 100.0
      WHERE xen_scout_price IS NULL OR scout_ai_price IS NULL
    `;
    console.log('   ✅ Prices converted');
    
    // Step 3: Set defaults for any remaining null values
    console.log('\n📝 Step 3: Setting default values...');
    await sql`
      UPDATE system_payment 
      SET 
        xen_scout_price = COALESCE(xen_scout_price, 10.00),
        scout_ai_price = COALESCE(scout_ai_price, 10.00)
      WHERE xen_scout_price IS NULL OR scout_ai_price IS NULL
    `;
    console.log('   ✅ Defaults set');
    
    // Step 4: Set column defaults
    console.log('\n📝 Step 4: Setting column defaults...');
    try {
      await sql`
        ALTER TABLE system_payment 
        ALTER COLUMN xen_scout_price SET DEFAULT 10.00,
        ALTER COLUMN scout_ai_price SET DEFAULT 10.00
      `;
      console.log('   ✅ Column defaults set');
    } catch (error: any) {
      console.log('   ⚠️  Could not set defaults (may already be set)');
    }
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const result = await sql`
      SELECT 
        currency,
        xen_scout_price,
        scout_ai_price,
        xen_scout_price_cents,
        scout_ai_price_cents
      FROM system_payment
      LIMIT 1
    `;
    
    if (result.length > 0) {
      console.log('\n📊 Current Payment Configuration:');
      console.log(`   Currency: ${result[0].currency}`);
      console.log(`   XEN Watch Price: ${result[0].xen_scout_price} ${result[0].currency}`);
      console.log(`   ScoutAI Price: ${result[0].scout_ai_price} ${result[0].currency}`);
      if (result[0].xen_scout_price_cents) {
        console.log(`   Legacy XEN Price (cents): ${result[0].xen_scout_price_cents}`);
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Added xen_scout_price and scout_ai_price decimal columns');
    console.log('  - Converted existing cent values to decimal amounts');
    console.log('  - Legacy cent columns kept for backward compatibility');
    console.log('\n✨ Your data is safe - all prices converted successfully!');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔍 Error details:', error);
    process.exit(1);
  }
}

runMigration();

