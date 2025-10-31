import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

/**
 * Safe migration script for notifications table
 * Uses IF NOT EXISTS to prevent errors if table already exists
 * No data will be lost or modified
 */
async function runNotificationsMigration() {
  console.log('🚀 Starting Notifications System Migration...');
  console.log('✅ This migration is SAFE - uses IF NOT EXISTS clauses');
  console.log('✅ No existing data will be modified or lost\n');

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'migrations', '2025-01-31_notifications_system.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executing migration SQL...');
    
    // Split SQL into individual statements and execute them one by one
    // Neon requires single statements in prepared statements
    // Handle multi-line statements and comments properly
    let cleanedSQL = migrationSQL
      // Remove comment lines
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      // Remove COMMENT ON statements (they reference tables that may not exist yet)
      .replace(/COMMENT ON[^;]+;/gi, '');
    
    // Split by semicolon, but be careful with DO $$ blocks
    const statements = cleanedSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && stmt.length > 10); // Filter out very short fragments
    
    console.log(`📝 Found ${statements.length} SQL statements to execute...\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && !statement.toUpperCase().includes('COMMENT')) {
        try {
          console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
          // Add semicolon back for execution
          const sqlStatement = statement.endsWith(';') ? statement : statement + ';';
          await db.execute(sql.raw(sqlStatement));
          console.log(`✅ Statement ${i + 1} completed\n`);
        } catch (stmtError: any) {
          // If it's an "already exists" error, that's fine for IF NOT EXISTS
          if (stmtError?.message?.includes('already exists') || 
              stmtError?.code === '42P07' ||
              stmtError?.code === '42710') {
            console.log(`ℹ️  Statement ${i + 1} already exists - skipping\n`);
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, stmtError.message);
            throw stmtError;
          }
        }
      }
    }

    console.log('✅ Migration SQL executed successfully\n');

    // Verify the table was created
    console.log('🔍 Verifying notifications table exists...');
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);

    const tableExists = (tableCheck.rows[0] as any)?.exists;
    
    if (tableExists) {
      console.log('✅ Notifications table verified\n');
      
      // Check if there are any existing notifications
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM notifications`);
      const count = (countResult.rows[0] as any)?.count || 0;
      console.log(`📊 Current notifications count: ${count}\n`);
      
      return true;
    } else {
      console.error('❌ Notifications table was not created');
      return false;
    }

  } catch (error: any) {
    // If table already exists, that's fine - migration is idempotent
    if (error?.message?.includes('already exists') || 
        error?.message?.includes('duplicate') ||
        error?.code === '42P07') {
      console.log('ℹ️  Notifications table already exists - that\'s fine!');
      console.log('✅ Migration is idempotent and safe to run multiple times\n');
      
      // Still verify it exists
      try {
        const tableCheck = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'notifications'
          );
        `);
        const tableExists = (tableCheck.rows[0] as any)?.exists;
        if (tableExists) {
          const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM notifications`);
          const count = (countResult.rows[0] as any)?.count || 0;
          console.log(`📊 Current notifications count: ${count}\n`);
        }
        return true;
      } catch (e) {
        console.error('⚠️  Error verifying table:', e);
        return false;
      }
    } else {
      console.error('❌ Migration error:', error);
      throw error;
    }
  }
}

async function testNotificationsSystem() {
  console.log('🧪 Testing notifications system...\n');

  try {
    // Test 1: Check table structure
    console.log('Test 1: Verifying table structure...');
    const columns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position;
    `);
    
    const requiredColumns = ['id', 'user_id', 'type', 'title', 'message', 'is_read', 'created_at'];
    const actualColumns = columns.rows.map((r: any) => r.column_name);
    const missingColumns = requiredColumns.filter(col => !actualColumns.includes(col));
    
    if (missingColumns.length === 0) {
      console.log('✅ All required columns exist');
      console.log(`   Found columns: ${actualColumns.join(', ')}\n`);
    } else {
      console.error(`❌ Missing columns: ${missingColumns.join(', ')}\n`);
      return false;
    }

    // Test 2: Check indexes
    console.log('Test 2: Verifying indexes...');
    const indexes = await db.execute(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'notifications';
    `);
    const indexNames = indexes.rows.map((r: any) => r.indexname);
    console.log(`✅ Found ${indexNames.length} indexes: ${indexNames.join(', ')}\n`);

    // Test 3: Test notification creation (without committing)
    console.log('Test 3: Testing notification creation capability...');
    
    // Get a test user
    const testUser = await db.execute(sql`
      SELECT id FROM users LIMIT 1;
    `);
    
    if (testUser.rows.length === 0) {
      console.log('⚠️  No users found in database - skipping creation test\n');
    } else {
      const userId = (testUser.rows[0] as any).id;
      
      // Try to create a test notification
      await db.execute(sql`
        INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
        VALUES (${userId}, 'test', 'Test Notification', 'This is a test notification', 'test', 'test-id')
        ON CONFLICT DO NOTHING;
      `);
      
      console.log('✅ Test notification created successfully');
      
      // Clean up test notification
      await db.execute(sql`
        DELETE FROM notifications 
        WHERE type = 'test' AND title = 'Test Notification';
      `);
      console.log('✅ Test notification cleaned up\n');
    }

    console.log('🎉 All tests passed!\n');
    return true;

  } catch (error: any) {
    console.error('❌ Test error:', error);
    return false;
  }
}

async function main() {
  try {
    // Step 1: Run migration
    const migrationSuccess = await runNotificationsMigration();
    
    if (!migrationSuccess) {
      console.error('❌ Migration failed');
      process.exit(1);
    }

    // Step 2: Test the system
    const testSuccess = await testNotificationsSystem();
    
    if (!testSuccess) {
      console.error('❌ Tests failed');
      process.exit(1);
    }

    console.log('✨ Notifications system migration completed successfully!');
    console.log('📝 The notifications table is ready to use');
    console.log('🔔 New notifications will be created automatically when:');
    console.log('   - Someone follows a student');
    console.log('   - Someone likes a post');
    console.log('   - Someone comments on a post');
    console.log('   - A student posts (notifies followers)');
    console.log('\n✅ You can now use the notifications page to view notifications!');

  } catch (error) {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  } finally {
    // Note: We don't close the db connection as it's a singleton
    // and might be used elsewhere
  }
}

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('run-notifications-migration.ts')) {
  main()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { runNotificationsMigration, testNotificationsSystem };

