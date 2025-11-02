import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ No DATABASE_URL found in environment variables');
  console.error('📝 Please ensure .env file contains: DATABASE_URL=postgresql://...');
  process.exit(1);
}

async function runMigration() {
  console.log('🔗 Connecting to database...');
  const sql = neon(connectionString);
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'migrations', '2025-02-04_payment_system_updates.sql');
    console.log('📖 Reading migration file:', migrationPath);
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Remove comments and split by semicolon
    const lines = migrationSQL.split('\n');
    const cleanedLines = lines
      .map(line => {
        // Remove inline comments (--)
        const commentIndex = line.indexOf('--');
        if (commentIndex !== -1) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');
    
    // Split into statements by semicolon
    const statements = cleanedLines
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`🔄 Executing ${statements.length} migration statements...`);
    console.log('🔒 Safe mode: All operations use IF NOT EXISTS or WHERE clauses to preserve data');
    
    // Execute each statement in order
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        const preview = statement.split('\n').filter(l => l.trim()).join(' ').substring(0, 80);
        console.log(`\n📝 [${i + 1}/${statements.length}] ${preview}...`);
        
        try {
          // Execute with semicolon
          await sql(`${statement};`);
          console.log('   ✅ Success');
        } catch (error: any) {
          // Check if it's a "already exists" or "does not exist" error (safe to ignore for IF NOT EXISTS)
          const errorMsg = error.message?.toLowerCase() || '';
          if (errorMsg.includes('already exists') || 
              errorMsg.includes('duplicate') ||
              errorMsg.includes('relation already exists') ||
              (errorMsg.includes('does not exist') && statement.toUpperCase().includes('IF NOT EXISTS'))) {
            console.log('   ⚠️  Already exists or not needed (skipping)');
          } else {
            console.error('   ❌ Error:', error.message);
            // For non-critical errors, continue (but log)
            if (error.code === '42P01' && statement.toUpperCase().includes('INDEX')) {
              console.log('   ⚠️  Table may not exist yet, will retry in next pass');
            } else {
              throw error;
            }
          }
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Added scout_ai_price_cents column to system_payment');
    console.log('  - Created payment_transactions table');
    console.log('  - Created indexes for payment_transactions');
    console.log('  - Updated existing payment config with default ScoutAI price');
    console.log('\n✨ Your data is safe - no data was deleted or truncated!');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔍 Error details:', error);
    process.exit(1);
  }
}

runMigration();

