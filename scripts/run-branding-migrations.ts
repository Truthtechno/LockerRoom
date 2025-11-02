import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

// Polyfill fetch for Node 16 compatibility
if (typeof globalThis.fetch === 'undefined') {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const nodeFetch = require('node-fetch');
  globalThis.fetch = nodeFetch.default || nodeFetch;
  globalThis.Headers = nodeFetch.Headers;
  globalThis.Request = nodeFetch.Request;
  globalThis.Response = nodeFetch.Response;
}

async function runBrandingMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🚀 Running Branding Configuration migrations...');
  console.log('🔗 Database URL:', databaseUrl.replace(/:[^:@]+@/, ':***@'));
  
  const sql = neon(databaseUrl);
  
  try {
    // Migration 1: Add company_description
    console.log('\n📝 Migration 1: Adding company_description column...');
    const migration1Path = path.join(process.cwd(), 'migrations', '2025-02-03_add_company_description.sql');
    if (fs.existsSync(migration1Path)) {
      const migration1SQL = fs.readFileSync(migration1Path, 'utf-8');
      const statements = migration1SQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`  Executing: ${statement.substring(0, 60)}...`);
          await sql(statement);
        }
      }
      console.log('✅ Migration 1 completed: company_description column added');
    } else {
      console.log('⚠️ Migration 1 file not found, skipping...');
    }

    // Migration 2: Replace LinkedIn with TikTok
    console.log('\n📝 Migration 2: Replacing LinkedIn with TikTok...');
    const migration2Path = path.join(process.cwd(), 'migrations', '2025-02-03_replace_linkedin_with_tiktok.sql');
    if (fs.existsSync(migration2Path)) {
      const migration2SQL = fs.readFileSync(migration2Path, 'utf-8');
      const statements = migration2SQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`  Executing: ${statement.substring(0, 60)}...`);
          await sql(statement);
        }
      }
      console.log('✅ Migration 2 completed: LinkedIn replaced with TikTok');
    } else {
      console.log('⚠️ Migration 2 file not found, skipping...');
    }

    console.log('\n🎉 All branding migrations completed successfully!');
    console.log('✅ company_description column added');
    console.log('✅ social_tiktok column added (LinkedIn column removed)');
    console.log('\n💡 You can now save company descriptions and TikTok links in System Config.');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42703') {
      console.error('💡 Hint: Column might already exist. This is usually safe to ignore.');
    }
    throw error;
  }
}

// Run the migration if this script is executed directly
runBrandingMigrations()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });

export { runBrandingMigrations };

