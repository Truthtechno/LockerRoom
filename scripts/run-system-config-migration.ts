// Polyfill fetch for Node 16 compatibility
if (typeof globalThis.fetch === 'undefined') {
  await (async () => {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const nodeFetch = require('node-fetch');
    globalThis.fetch = nodeFetch.default || nodeFetch;
    globalThis.Headers = nodeFetch.Headers;
    globalThis.Request = nodeFetch.Request;
    globalThis.Response = nodeFetch.Response;
  })();
}

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

async function runSystemConfigMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🚀 Running System Configuration migration...');
  console.log('🔗 Database URL:', databaseUrl.replace(/:[^:@]+@/, ':***@'));
  
  const sql = neon(databaseUrl);
  
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '2025-01-30_system_configuration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📝 Executing migration SQL...');
    console.log('📄 Migration file:', migrationPath);
    
    // Remove comments and split into statements
    const cleanSQL = migrationSQL
      .split('\n')
      .map(line => {
        // Remove inline comments (-- comment)
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');
    
    // Split by semicolon and filter empty statements
    const statements = cleanSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.match(/^\s*$/));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        await sql(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        // Ignore "already exists" errors for CREATE TABLE IF NOT EXISTS
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate') ||
            error.message?.includes('relation') && error.message?.includes('already exists')) {
          console.log(`ℹ️  Statement ${i + 1} skipped (already exists): ${error.message.substring(0, 100)}`);
        } else {
          console.error(`❌ Statement ${i + 1} failed:`, error.message);
          console.error(`Statement: ${statement.substring(0, 200)}...`);
          throw error;
        }
      }
    }
    
    console.log('✅ System Configuration migration completed successfully!');
    console.log('✅ Created tables: system_branding, system_appearance, system_payment');
    console.log('✅ Default records inserted');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    throw error;
  }
}

// Run the migration
runSystemConfigMigration()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

