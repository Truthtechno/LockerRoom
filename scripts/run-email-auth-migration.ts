#!/usr/bin/env ts-node

/**
 * Email Authentication System Migration Runner
 * Runs the database migration for email authentication fields
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

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

async function runEmailAuthMigration() {
  console.log('📧 Running Email Authentication System Migration...');
  
  try {
    // Read the SQL migration file
    const sqlPath = join(process.cwd(), 'migrations', '2025-02-10_email_auth_system.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    // Remove comments and empty lines first
    const cleanedContent = sqlContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('--'))
      .join('\n');
    
    const statements = cleanedContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
        const preview = statement.replace(/\s+/g, ' ').substring(0, 100);
        console.log(`   ${preview}${statement.length > 100 ? '...' : ''}`);
        
        try {
          // Execute with timeout
          await withTimeout(
            db.execute(sql.raw(statement + ';')),
            30000, // 30 seconds per statement
            `SQL statement ${i + 1}`
          );
          console.log(`   ✅ Statement ${i + 1} completed`);
        } catch (error: any) {
          // If column already exists or index already exists, that's okay
          if (error.message?.includes('already exists') || 
              error.message?.includes('duplicate') ||
              error.code === '42703' && error.message?.includes('does not exist') ||
              error.message?.includes('IF NOT EXISTS')) {
            console.log(`   ⚠️  Statement ${i + 1}: ${error.message?.substring(0, 60)}... (continuing)`);
            continue;
          }
          throw error;
        }
      }
    }
    
    console.log('✅ Email Authentication System migration completed successfully');
    console.log('📧 Email verification, password reset, and OTP fields have been added');
    console.log('📊 Indexes have been created for optimal performance');
    
  } catch (error: any) {
    console.error('❌ Email Authentication System migration failed:', error);
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      console.log('⚠️  Some columns may already exist. This is okay if you\'re re-running the migration.');
      console.log('✅ Migration may have partially completed. Please verify the database schema.');
    } else {
      throw error;
    }
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('run-email-auth-migration.ts')) {
  runEmailAuthMigration()
    .then(() => {
      console.log('✅ Email Authentication migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Email Authentication migration script failed:', error);
      process.exit(1);
    });
}

export { runEmailAuthMigration };

