import { db } from '../server/db';
import { users, students, schoolAdmins, studentFollowers } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { storage } from '../server/storage';

/**
 * Backfill script to auto-follow students for existing school admins
 * This ensures all existing school admins follow all students in their school
 */

async function backfillSchoolAdminFollows() {
  console.log('🔄 Starting backfill: School admins auto-following students...\n');

  try {
    // Get all school admins
    const schoolAdminUsers = await db.select()
      .from(users)
      .where(eq(users.role, 'school_admin'));

    console.log(`📋 Found ${schoolAdminUsers.length} school admin(s)\n`);

    if (schoolAdminUsers.length === 0) {
      console.log('✅ No school admins found. Nothing to backfill.\n');
      return;
    }

    let totalFollowsCreated = 0;
    let totalAlreadyFollowing = 0;

    for (const adminUser of schoolAdminUsers) {
      if (!adminUser.schoolId) {
        console.log(`⚠️  School admin ${adminUser.name} (${adminUser.email}) has no schoolId. Skipping...`);
        continue;
      }

      console.log(`\n👨‍💼 Processing school admin: ${adminUser.name} (School ID: ${adminUser.schoolId})`);

      // Get all students in this school
      const schoolStudents = await db.select()
        .from(students)
        .where(eq(students.schoolId, adminUser.schoolId));

      console.log(`   Found ${schoolStudents.length} student(s) in school`);

      let followsCreated = 0;
      let alreadyFollowing = 0;

      for (const student of schoolStudents) {
        try {
          // Check if already following
          const existingFollow = await db.select()
            .from(studentFollowers)
            .where(
              sql`${studentFollowers.followerUserId} = ${adminUser.id} AND ${studentFollowers.studentId} = ${student.id}`
            )
            .limit(1);

          if (existingFollow.length > 0) {
            alreadyFollowing++;
            continue;
          }

          // Create follow relationship
          await storage.followStudent({
            followerUserId: adminUser.id,
            studentId: student.id,
          });

          followsCreated++;
          totalFollowsCreated++;
        } catch (error: any) {
          console.error(`   ❌ Error following student ${student.id}: ${error.message}`);
          // Continue with next student
        }
      }

      totalAlreadyFollowing += alreadyFollowing;
      console.log(`   ✅ Created ${followsCreated} new follow(s), ${alreadyFollowing} already following`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary:');
    console.log(`   School Admins Processed: ${schoolAdminUsers.length}`);
    console.log(`   New Follows Created: ${totalFollowsCreated}`);
    console.log(`   Already Following: ${totalAlreadyFollowing}`);
    console.log('='.repeat(60));
    console.log('\n✅ Backfill completed successfully!\n');

  } catch (error) {
    console.error('❌ Backfill error:', error);
    throw error;
  }
}

async function main() {
  try {
    await backfillSchoolAdminFollows();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('backfill-school-admin-follows.ts')) {
  main();
}

export { backfillSchoolAdminFollows };

