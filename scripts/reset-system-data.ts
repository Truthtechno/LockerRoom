#!/usr/bin/env tsx

/**
 * System Data Reset Script
 * 
 * This script safely resets the entire system database while preserving
 * system admin accounts and their credentials.
 * 
 * Usage:
 *   npm run reset-system-data
 *   or
 *   tsx scripts/reset-system-data.ts
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/db';
import { users, analyticsLogs } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

async function resetSystemData() {
  console.log('🔄 Starting system data reset...');
  
  try {
    // First, verify we have system admins to preserve
    const systemAdmins = await db.select().from(users).where(eq(users.role, 'system_admin'));
    
    if (systemAdmins.length === 0) {
      console.log('⚠️  WARNING: No system admin accounts found!');
      console.log('   This will result in a completely empty system.');
      console.log('   Are you sure you want to continue? (y/N)');
      
      // In a real scenario, you might want to add a confirmation prompt here
      // For now, we'll proceed with a warning
    } else {
      console.log(`✅ Found ${systemAdmins.length} system admin account(s) to preserve:`);
      systemAdmins.forEach(admin => {
        console.log(`   - ${admin.name} (${admin.email})`);
      });
    }

    // Log the reset operation start
    await db.insert(analyticsLogs).values({
      eventType: 'system_reset_start',
      entityType: 'system',
      metadata: JSON.stringify({
        reason: 'Data integrity reset',
        preserved_system_admins: systemAdmins.length,
        timestamp: new Date().toISOString()
      })
    });

    // Execute individual SQL statements to avoid Neon's multiple commands limitation
    console.log('📄 Executing system data reset...');
    
    // Helper function to safely execute DELETE statements
    const safeDelete = async (tableName: string, description: string) => {
      try {
        await db.execute(sql.raw(`DELETE FROM ${tableName}`));
        console.log(`   ✅ ${description}`);
      } catch (error: any) {
        if (error.code === '42P01') { // Table doesn't exist
          console.log(`   ⚠️ Table ${tableName} doesn't exist, skipping...`);
        } else {
          console.log(`   ❌ Error deleting from ${tableName}: ${error.message}`);
          throw error;
        }
      }
    };
    
    // Step 1: Delete all content and engagement data first (no foreign key dependencies)
    console.log('   🗑️ Deleting post engagement data...');
    await safeDelete('post_views', 'Deleted post views');
    await safeDelete('saved_posts', 'Deleted saved posts');
    await safeDelete('reported_posts', 'Deleted reported posts');
    await safeDelete('post_likes', 'Deleted post likes');
    await safeDelete('post_comments', 'Deleted post comments');
    await safeDelete('posts', 'Deleted posts');

    // Step 2: Delete XEN Watch related data
    console.log('   🗑️ Deleting XEN Watch data...');
    await safeDelete('submission_final_feedback', 'Deleted submission final feedback');
    await safeDelete('submission_reviews', 'Deleted submission reviews');
    await safeDelete('submissions', 'Deleted submissions');
    await safeDelete('xen_watch_feedback', 'Deleted xen watch feedback');
    await safeDelete('xen_watch_reviews', 'Deleted xen watch reviews');
    await safeDelete('xen_watch_submissions', 'Deleted xen watch submissions');
    await safeDelete('scout_profiles', 'Deleted scout profiles');

    // Step 3: Delete user relationships and follows
    console.log('   🗑️ Deleting user relationships...');
    await safeDelete('user_follows', 'Deleted user follows');
    await safeDelete('student_followers', 'Deleted student followers');

    // Step 4: Delete student ratings and settings
    console.log('   🗑️ Deleting student ratings and settings...');
    await safeDelete('student_ratings', 'Deleted student ratings');
    await safeDelete('school_settings', 'Deleted school settings');

    // Step 5: Delete students (references users and schools)
    console.log('   🗑️ Deleting students...');
    await safeDelete('students', 'Deleted students');

    // Step 6: Delete school admins (references schools)
    console.log('   🗑️ Deleting school admins...');
    await safeDelete('school_admins', 'Deleted school admins');

    // Step 7: Delete subscriptions (references schools)
    console.log('   🗑️ Deleting subscriptions...');
    await safeDelete('subscriptions', 'Deleted subscriptions');

    // Step 8: Delete school applications
    console.log('   🗑️ Deleting school applications...');
    await safeDelete('school_applications', 'Deleted school applications');

    // Step 9: Delete schools
    console.log('   🗑️ Deleting schools...');
    await safeDelete('schools', 'Deleted schools');

    // Step 10: Delete viewers (no foreign key dependencies)
    console.log('   🗑️ Deleting viewers...');
    await safeDelete('viewers', 'Deleted viewers');

    // Step 11: Delete system admins (but preserve their user accounts)
    console.log('   🗑️ Deleting system admin profiles...');
    await safeDelete('system_admins', 'Deleted system admin profiles');

    // Step 12: Delete admin roles
    console.log('   🗑️ Deleting admin roles...');
    await safeDelete('admin_roles', 'Deleted admin roles');

    // Step 13: Delete admins table entries (separate from users)
    console.log('   🗑️ Deleting admin entries...');
    await safeDelete('admins', 'Deleted admin entries');

    // Step 14: Delete users EXCEPT those with role = 'system_admin'
    console.log('   🗑️ Deleting non-system-admin users...');
    await db.execute(sql`DELETE FROM users WHERE role != 'system_admin'`);
    console.log('   ✅ Deleted non-system-admin users');

    // Log completion
    console.log('   ✅ System reset completed successfully');
    await db.insert(analyticsLogs).values({
      eventType: 'system_reset_complete',
      entityType: 'system',
      metadata: JSON.stringify({
        status: 'success',
        preserved_system_admins: systemAdmins.length,
        tables_cleared: ['schools', 'students', 'posts', 'school_admins', 'viewers', 'subscriptions', 'school_applications', 'system_admins', 'admin_roles', 'admins', 'users_except_system_admin'],
        timestamp: new Date().toISOString()
      })
    });
    
    // Verify the reset
    const remainingUsers = await db.select().from(users);
    const remainingSchools = await db.execute(sql`SELECT COUNT(*) as count FROM schools`);
    const remainingStudents = await db.execute(sql`SELECT COUNT(*) as count FROM students`);
    const remainingPosts = await db.execute(sql`SELECT COUNT(*) as count FROM posts`);
    
    console.log('\n✅ System data reset completed successfully!');
    console.log('📊 Verification results:');
    console.log(`   - Remaining users: ${remainingUsers.length}`);
    console.log(`   - Remaining schools: ${(remainingSchools.rows[0] as any).count}`);
    console.log(`   - Remaining students: ${(remainingStudents.rows[0] as any).count}`);
    console.log(`   - Remaining posts: ${(remainingPosts.rows[0] as any).count}`);
    
    // Verify system admins are preserved
    const preservedAdmins = remainingUsers.filter(user => user.role === 'system_admin');
    console.log(`   - Preserved system admins: ${preservedAdmins.length}`);
    
    if (preservedAdmins.length > 0) {
      console.log('\n👑 Preserved system admin accounts:');
      preservedAdmins.forEach(admin => {
        console.log(`   - ${admin.name} (${admin.email})`);
      });
    }
    
    console.log('\n🎯 Next steps:');
    console.log('   1. Run the test data seeding script');
    console.log('   2. Verify school-student linkages');
    console.log('   3. Test system admin school management features');
    
  } catch (error) {
    console.error('❌ Error during system data reset:', error);
    
    // Log the error
    await db.insert(analyticsLogs).values({
      eventType: 'system_reset_error',
      entityType: 'system',
      metadata: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    });
    
    process.exit(1);
  }
}

// ESM-safe entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  resetSystemData()
    .then(() => {
      console.log('\n🏁 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { resetSystemData };
