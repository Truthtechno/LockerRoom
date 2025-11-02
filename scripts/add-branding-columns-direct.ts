import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

async function addBrandingColumns() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🚀 Adding branding columns directly to database...');
  
  const sql = neon(databaseUrl);
  
  try {
    // Add company_description column
    console.log('📝 Adding company_description column...');
    try {
      await sql`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS company_description TEXT;`;
      console.log('✅ company_description column added');
    } catch (error: any) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log('ℹ️  company_description column already exists');
      } else {
        throw error;
      }
    }

    // Add social_tiktok column
    console.log('📝 Adding social_tiktok column...');
    try {
      await sql`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS social_tiktok TEXT;`;
      console.log('✅ social_tiktok column added');
    } catch (error: any) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log('ℹ️  social_tiktok column already exists');
      } else {
        throw error;
      }
    }

    // Add company_logo_url column
    console.log('📝 Adding company_logo_url column...');
    try {
      await sql`ALTER TABLE system_branding ADD COLUMN IF NOT EXISTS company_logo_url TEXT;`;
      console.log('✅ company_logo_url column added');
    } catch (error: any) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log('ℹ️  company_logo_url column already exists');
      } else {
        throw error;
      }
    }

    // Remove social_linkedin column if it exists
    console.log('📝 Checking for social_linkedin column...');
    try {
      await sql`ALTER TABLE system_branding DROP COLUMN IF EXISTS social_linkedin;`;
      console.log('✅ social_linkedin column removed (if it existed)');
    } catch (error: any) {
      console.log('ℹ️  social_linkedin column does not exist or could not be removed');
    }

    console.log('\n🎉 All columns updated successfully!');
    console.log('✅ company_description column');
    console.log('✅ company_logo_url column (separate from platform logo)');
    console.log('✅ social_tiktok column (LinkedIn removed)');
    console.log('\n💡 Please restart your server for changes to take effect.');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

addBrandingColumns()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

