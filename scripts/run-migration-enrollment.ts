import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
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
    const migrationPath = path.join(process.cwd(), 'migrations', '2025-02-06_school_payment_records.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Remove comments and split into statements more intelligently
    let cleanSQL = migrationSQL
      .replace(/--.*$/gm, '') // Remove single-line comments
      .trim();
    
    // Split by semicolon, but preserve DO $$ blocks
    const statements: string[] = [];
    let currentStatement = '';
    let inDoBlock = false;
    let dollarTag = '';
    
    for (let i = 0; i < cleanSQL.length; i++) {
      const char = cleanSQL[i];
      const nextChars = cleanSQL.slice(i, i + 10);
      
      // Check for DO $$ start
      if (nextChars.match(/^DO\s+\$\$/i)) {
        inDoBlock = true;
        dollarTag = '$$';
        currentStatement += cleanSQL.slice(i, cleanSQL.indexOf('$$;', i + 3) + 3);
        i = cleanSQL.indexOf('$$;', i + 3) + 2;
        continue;
      }
      
      currentStatement += char;
      
      // End of statement (semicolon outside DO block, or $$; inside DO block)
      if (!inDoBlock && char === ';') {
        const trimmed = currentStatement.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        currentStatement = '';
      } else if (inDoBlock && currentStatement.endsWith('$$;')) {
        const trimmed = currentStatement.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        currentStatement = '';
        inDoBlock = false;
        dollarTag = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    console.log(`🔄 Executing ${statements.length} SQL statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && !statement.trim().startsWith('--')) {
        try {
          console.log(`   [${i + 1}/${statements.length}] Executing statement...`);
          await sql(statement);
        } catch (error: any) {
          // Ignore "already exists" errors
          if (error.message?.includes('already exists') || 
              error.message?.includes('duplicate') ||
              error.message?.includes('relation') && error.message?.includes('already exists')) {
            console.log(`   ⚠️  Statement ${i + 1} skipped (already exists): ${error.message}`);
          } else {
            console.error(`   ❌ Error in statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }

    // Verify migration
    console.log('\n✅ Migration completed! Verifying...');
    
    // Check table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'school_payment_records'
      );
    `;
    
    if (tableCheck[0]?.exists) {
      console.log('✅ school_payment_records table exists');
    } else {
      console.error('❌ school_payment_records table not found');
    }

    // Check schools updated
    const schoolsCheck = await sql`
      SELECT COUNT(*) as total, 
             COUNT(*) FILTER (WHERE max_students = 10) as set_to_10,
             COUNT(*) FILTER (WHERE max_students IS NULL OR max_students <= 0) as invalid
      FROM schools;
    `;
    
    const stats = schoolsCheck[0];
    console.log(`📊 Schools: ${stats.total} total, ${stats.set_to_10} set to 10, ${stats.invalid} invalid`);
    
    // Check payment records
    const paymentRecordsCheck = await sql`
      SELECT COUNT(*) as count FROM school_payment_records;
    `;
    console.log(`💰 Payment records: ${paymentRecordsCheck[0]?.count || 0} records created`);

    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

