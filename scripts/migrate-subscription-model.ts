/**
 * Migration Script: Convert schools to new subscription model
 * This script:
 * 1. Runs the database migration
 * 2. Converts existing schools to the new subscription model
 * 3. Sets most schools to $900 annual, at least one to $75 monthly
 */

import "dotenv/config";
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function runMigration() {
  try {
    console.log('🔄 Starting subscription model migration...');

    // Execute the migration statements one by one
    console.log('📝 Adding new subscription columns...');
    
    // Add new columns
    await sql`ALTER TABLE schools ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00`;
    await sql`ALTER TABLE schools ADD COLUMN IF NOT EXISTS payment_frequency TEXT NOT NULL DEFAULT 'monthly'`;
    await sql`ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ`;
    await sql`ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`;
    await sql`ALTER TABLE schools ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ`;
    await sql`ALTER TABLE schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

    console.log('📝 Converting existing schools...');
    
    // Get all schools
    const schoolsData = await sql`
      SELECT id, subscription_plan, created_at 
      FROM schools 
      ORDER BY created_at
    `;
    
    const totalSchools = schoolsData.length;
    let annualCount = 0;
    
    // Convert each school
    for (const school of schoolsData) {
      if (annualCount < totalSchools - 1) {
        // Set to annual $900
        const expirationDate = new Date(school.created_at);
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        
        await sql`
          UPDATE schools 
          SET 
            payment_amount = 900.00,
            payment_frequency = 'annual',
            subscription_expires_at = ${expirationDate.toISOString()},
            last_payment_date = ${school.created_at},
            is_active = TRUE,
            updated_at = NOW()
          WHERE id = ${school.id}
        `;
        annualCount++;
      } else {
        // Last school gets monthly $75
        const expirationDate = new Date(school.created_at);
        expirationDate.setMonth(expirationDate.getMonth() + 1);
        
        await sql`
          UPDATE schools 
          SET 
            payment_amount = 75.00,
            payment_frequency = 'monthly',
            subscription_expires_at = ${expirationDate.toISOString()},
            last_payment_date = ${school.created_at},
            is_active = TRUE,
            updated_at = NOW()
          WHERE id = ${school.id}
        `;
      }
    }

    console.log('📝 Creating indexes...');
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_schools_is_active ON schools(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_schools_subscription_expires_at ON schools(subscription_expires_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_schools_payment_frequency ON schools(payment_frequency)`;

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log('  - All schools converted to new subscription model');
    console.log('  - Most schools set to $900/year');
    console.log('  - At least one school set to $75/month');
    console.log('  - Subscription expiration dates calculated');
    console.log('');
    console.log('🔍 Verifying migration...');

    // Verify the migration
    const schools = await sql`
      SELECT 
        id, 
        name, 
        payment_amount, 
        payment_frequency, 
        subscription_expires_at,
        is_active
      FROM schools
      ORDER BY created_at
    `;

    console.log(`✅ Found ${schools.length} school(s):`);
    schools.forEach((school: any, index: number) => {
      console.log(`  ${index + 1}. ${school.name}`);
      console.log(`     Payment: $${school.payment_amount} ${school.payment_frequency}`);
      console.log(`     Expires: ${school.subscription_expires_at ? new Date(school.subscription_expires_at).toLocaleDateString() : 'N/A'}`);
      console.log(`     Active: ${school.is_active ? 'Yes' : 'No'}`);
    });

    // Count by frequency
    const monthlyCount = schools.filter((s: any) => s.payment_frequency === 'monthly').length;
    const annualCountFinal = schools.filter((s: any) => s.payment_frequency === 'annual').length;

    console.log('');
    console.log('📈 Statistics:');
    console.log(`  Monthly subscriptions: ${monthlyCount}`);
    console.log(`  Annual subscriptions: ${annualCountFinal}`);
    console.log('');
    console.log('🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

