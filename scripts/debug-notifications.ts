import { db } from '../server/db';
import { users, students, studentFollowers, notifications } from '../shared/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { storage } from '../server/storage';

/**
 * Debug script to check why notifications aren't appearing
 * Usage: npx tsx scripts/debug-notifications.ts [userId] [studentId]
 */

async function debugNotifications(userId?: string, studentId?: string) {
  console.log('🔍 Debugging Notification Issues...\n');
  console.log('='.repeat(60));

  try {
    // If userId provided, check their notifications
    if (userId) {
      console.log(`\n📬 Checking notifications for user: ${userId}`);
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) {
        console.log(`❌ User ${userId} not found`);
        return;
      }
      console.log(`👤 User: ${user[0].name} (${user[0].email}) - Role: ${user[0].role}`);

      // Get all notifications for this user
      const userNotifications = await storage.getNotifications(user[0].id, { limit: 20 });
      console.log(`\n📋 Total notifications: ${userNotifications.length}`);
      
      if (userNotifications.length > 0) {
        console.log('\n📄 Recent notifications:');
        userNotifications.slice(0, 5).forEach((notif, idx) => {
          console.log(`   ${idx + 1}. [${notif.type}] ${notif.title}`);
          console.log(`      Message: ${notif.message}`);
          console.log(`      Read: ${notif.isRead} | Created: ${notif.createdAt}`);
          console.log(`      Entity: ${notif.entityType} - ${notif.entityId}`);
        });
      } else {
        console.log('⚠️  No notifications found for this user');
      }

      // Check who this user is following
      const following = await storage.getUserFollowing(user[0].id);
      console.log(`\n👥 Following ${following.length} student(s):`);
      following.slice(0, 10).forEach((student, idx) => {
        console.log(`   ${idx + 1}. ${student.name} (${student.id})`);
      });
    }

    // If studentId provided, check their followers
    if (studentId) {
      console.log(`\n\n📋 Checking followers for student: ${studentId}`);
      const student = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
      if (student.length === 0) {
        console.log(`❌ Student ${studentId} not found`);
        return;
      }
      console.log(`🎓 Student: ${student[0].name} (ID: ${student[0].id})`);

      // Get followers from database directly
      const followersInDb = await db
        .select({
          followerId: studentFollowers.followerUserId,
          studentId: studentFollowers.studentId,
          createdAt: studentFollowers.createdAt,
          userName: users.name,
          userEmail: users.email,
          userRole: users.role,
        })
        .from(studentFollowers)
        .innerJoin(users, eq(studentFollowers.followerUserId, users.id))
        .where(eq(studentFollowers.studentId, studentId));

      console.log(`\n👥 Found ${followersInDb.length} follower(s) in database:`);
      followersInDb.forEach((follower, idx) => {
        console.log(`   ${idx + 1}. ${follower.userName} (${follower.userEmail})`);
        console.log(`      Role: ${follower.userRole} | User ID: ${follower.followerId}`);
        console.log(`      Following since: ${follower.createdAt}`);
      });

      // Get followers using storage method
      const followersViaStorage = await storage.getStudentFollowers(studentId);
      console.log(`\n📡 Via storage.getStudentFollowers: ${followersViaStorage.length} follower(s)`);
      followersViaStorage.forEach((follower, idx) => {
        console.log(`   ${idx + 1}. ${follower.name} (ID: ${(follower as any).id})`);
      });

      // Check if there are recent posts by this student
      const recentPosts = await db
        .select()
        .from(require('@shared/schema').posts)
        .where(eq(require('@shared/schema').posts.studentId, studentId))
        .orderBy(desc(require('@shared/schema').posts.createdAt))
        .limit(5);
      
      console.log(`\n📝 Recent posts by this student: ${recentPosts.length}`);
      recentPosts.forEach((post, idx) => {
        console.log(`   ${idx + 1}. Post ${post.id} - Created: ${post.createdAt}`);
        
        // Check if notifications were created for this post
        db.select()
          .from(notifications)
          .where(eq(notifications.entityId, post.id))
          .then(postNotifications => {
            console.log(`      Notifications for this post: ${postNotifications.length}`);
            postNotifications.forEach(notif => {
              console.log(`         → ${notif.type} for user ${notif.userId} (read: ${notif.isRead})`);
            });
          });
      });
    }

    // Check all recent notifications
    console.log(`\n\n📬 Recent notifications across all users (last 20):`);
    const recentNotifications = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(20);
    
    if (recentNotifications.length === 0) {
      console.log('⚠️  No notifications in database at all');
    } else {
      recentNotifications.forEach((notif, idx) => {
        console.log(`   ${idx + 1}. [${notif.type}] User: ${notif.userId} - ${notif.title}`);
        console.log(`      ${notif.message}`);
        console.log(`      Entity: ${notif.entityType} - ${notif.entityId}`);
        console.log(`      Created: ${notif.createdAt} | Read: ${notif.isRead}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Debug complete\n');

  } catch (error: any) {
    console.error('❌ Debug error:', error?.message || error);
    console.error(error);
  }
}

async function main() {
  const userId = process.argv[2];
  const studentId = process.argv[3];

  if (!userId && !studentId) {
    console.log('Usage: npx tsx scripts/debug-notifications.ts [userId] [studentId]');
    console.log('Example: npx tsx scripts/debug-notifications.ts user123 student456');
    process.exit(1);
  }

  await debugNotifications(userId, studentId);
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('debug-notifications.ts')) {
  main();
}

export { debugNotifications };

