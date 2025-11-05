import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

async function runEvaluationFormsMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🚀 Running Evaluation Forms migration...');
  console.log('🔗 Database URL:', databaseUrl.replace(/:[^:@]+@/, ':***@'));
  
  const sql = neon(databaseUrl);
  
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '2025-02-08_evaluation_forms_system.sql');
    
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
      try {
        await sql(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        // If table already exists, that's okay
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message}`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('✅ Evaluation forms tables created');
    
    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'evaluation%'
      ORDER BY table_name;
    `;
    
    console.log('📋 Found tables:');
    tables.forEach((table: any) => {
      console.log(`   ✓ ${table.table_name}`);
    });
    
    if (tables.length === 0) {
      throw new Error('No evaluation form tables found after migration');
    }
    
    console.log('\n🎉 Evaluation Forms migration completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
runEvaluationFormsMigration()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });

export { runEvaluationFormsMigration };

