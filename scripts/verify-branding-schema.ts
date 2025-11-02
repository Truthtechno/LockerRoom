import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

async function verifyBrandingSchema() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🔍 Verifying system_branding table schema...');
  
  const sql = neon(databaseUrl);
  
  try {
    // Check if columns exist
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'system_branding'
      ORDER BY column_name;
    `;
    
    console.log('\n📊 Current columns in system_branding table:');
    const columnNames = columns.map((c: any) => c.column_name);
    columns.forEach((c: any) => {
      console.log(`  - ${c.column_name} (${c.data_type})`);
    });
    
    const hasCompanyDescription = columnNames.includes('company_description');
    const hasSocialTiktok = columnNames.includes('social_tiktok');
    const hasSocialLinkedin = columnNames.includes('social_linkedin');
    
    console.log('\n✅ Status:');
    console.log(`  company_description: ${hasCompanyDescription ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  social_tiktok: ${hasSocialTiktok ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  social_linkedin: ${hasSocialLinkedin ? '⚠️  STILL EXISTS (should be removed)' : '✅ REMOVED'}`);
    
    if (!hasCompanyDescription || !hasSocialTiktok) {
      console.log('\n❌ Missing columns detected!');
      console.log('💡 Run: npm run migrate:branding');
      process.exit(1);
    } else {
      console.log('\n✅ All required columns exist!');
      process.exit(0);
    }
    
  } catch (error: any) {
    console.error('❌ Error checking schema:', error.message);
    process.exit(1);
  }
}

verifyBrandingSchema();

