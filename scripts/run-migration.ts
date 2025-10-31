#!/usr/bin/env ts-node

/**
 * Migration runner script
 * This script runs the database migration and backfill for legacy posts
 * Updated to prevent hanging and run end-to-end automatically
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../server/db';
import { backfillLegacyPosts } from './backfill-legacy-posts';
import { testMigration } from './test-migration';

// Timeout wrapper function to prevent hanging
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`⏰ Timeout: ${operation} took longer than ${timeoutMs / 1000} seconds`));
      }, timeoutMs);
    })
  ]);
}

async function runSQLMigration() {
  console.log('📊 Running SQL migration...');
  
  try {
    // Read the SQL migration file
    const sqlPath = join(process.cwd(), 'migrations', '0006_add_post_upload_fields.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
        
        // Execute with timeout
        await withTimeout(
          db.execute(statement),
          30000, // 30 seconds per statement
          `SQL statement ${i + 1}`
        );
      }
    }
    
    console.log('✅ SQL migration completed successfully');
  } catch (error) {
    console.error('❌ SQL migration failed:', error);
    throw error;
  }
}

async function runMigration() {
  console.log('🚀 Starting LockerRoom migration process...');
  console.log('📝 This will add new upload fields and backfill legacy posts');
  console.log('⏰ Each step has a 60-second timeout to prevent hanging');
  
  try {
    // Step 1: Run the SQL migration directly (skip drizzle-kit push)
    console.log('\n📊 Step 1: Running SQL migration...');
    await withTimeout(
      runSQLMigration(),
      60000, // 60 seconds
      'SQL migration'
    );

    // Step 2: Backfill legacy posts
    console.log('\n🔄 Step 2: Backfilling legacy posts...');
    await withTimeout(
      backfillLegacyPosts(),
      60000, // 60 seconds
      'Legacy posts backfill'
    );

    // Step 3: Test the migration
    console.log('\n🧪 Step 3: Testing migration...');
    await withTimeout(
      testMigration(),
      60000, // 60 seconds
      'Migration testing'
    );

    console.log('\n🎉 Migration completed successfully!');
    console.log('✅ All legacy posts should now appear in the feed and profile');
    console.log('✅ Cover photos and profile images have been restored');
    console.log('📝 New posts will use the enhanced upload system');
    console.log('✅ Migration finished. Legacy posts restored.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (error.message.includes('Timeout')) {
      console.error('⏰ The migration timed out. Please check your database connection and try again.');
    }
    throw error;
  }
}

// Run the migration if this script is executed directly
if (process.argv[1] && process.argv[1].endsWith('run-migration.ts')) {
  runMigration()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { runMigration };
