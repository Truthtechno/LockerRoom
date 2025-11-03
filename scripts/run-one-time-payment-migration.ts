import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config();

async function runMigration() {
  try {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      console.error('❌ No DATABASE_URL found in environment variables');
      process.exit(1);
    }

    console.log('🔗 Connecting to database...');
    const sql = neon(connectionString);

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '2025-02-06_add_one_time_payment_frequency.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolons
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`🔄 Executing ${statements.length} SQL statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`   [${i + 1}/${statements.length}] Executing statement...`);
          await sql(statement);
        } catch (error: any) {
          // Ignore "does not exist" errors for DROP CONSTRAINT
          if (error.message?.includes('does not exist') || 
              error.message?.includes('already exists') || 
              error.message?.includes('duplicate')) {
            console.log(`   ⚠️  Statement ${i + 1} skipped: ${error.message}`);
          } else {
            console.error(`   ❌ Error in statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }

    // Verify migration
    console.log('\n✅ Migration completed! Verifying...');
    
    // Check constraint exists
    const constraintCheck = await sql`
      SELECT 
        conname,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'school_payment_records'::regclass
      AND conname = 'school_payment_records_payment_frequency_check';
    `;
    
    if (constraintCheck.length > 0) {
      console.log('✅ Constraint updated successfully');
      console.log(`   Definition: ${constraintCheck[0].definition}`);
    } else {
      console.log('⚠️  Could not verify constraint (may not exist yet)');
    }

    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

