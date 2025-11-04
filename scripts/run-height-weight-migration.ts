/**
 * Migration Script: Add height and weight columns to students table
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
config();

async function runHeightWeightMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🚀 Running Height/Weight migration...');
  console.log('🔗 Database URL:', databaseUrl.replace(/:[^:@]+@/, ':***@'));
  
  const sql = neon(databaseUrl);
  
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '2025-02-07_add_student_height_weight.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
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
      console.log(`\n📝 Executing statement ${i + 1}/${statements.length}...`);
      console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
      
      try {
        await sql(statement);
        console.log(`   ✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        // Check if it's a "column already exists" error (which is fine)
        if (error?.message?.includes('already exists') || error?.code === '42701') {
          console.log(`   ⚠️  Column already exists (safe to ignore)`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('✅ Height and weight columns have been added to the students table');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
runHeightWeightMigration()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

export { runHeightWeightMigration };

