import { db } from '../server/db';
import { users, students, studentFollowers, notifications, posts } from '../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { storage } from '../server/storage';
import { notifyFollowersOfNewPost } from '../server/utils/notification-helpers';

/**
 * Comprehensive test script to debug notification flow
 * This will test the entire notification creation and retrieval process
 */

async function testNotificationFlow() {
  console.log('🧪 Testing Notification Flow...\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Find Thiago (student)
    console.log('\n📋 Step 1: Finding Thiago (student)...');
    const thiagoStudents = await db
      .select()
      .from(students)
      .where(sql`LOWER(${students.name}) LIKE '%thiago%'`)
      .limit(5);
    
    if (thiagoStudents.length === 0) {
      console.log('❌ No student named Thiago found');
      return;
    }

    const thiago = thiagoStudents[0];
    console.log(`✅ Found student: ${thiago.name} (ID: ${thiago.id}, User ID: ${thiago.userId})`);

    // Step 2: Check Thiago's followers
    console.log('\n📋 Step 2: Checking Thiago\'s followers...');
    const followers = await storage.getStudentFollowers(thiago.id);
    console.log(`✅ Found ${followers.length} follower(s):`);
    followers.forEach((follower, idx) => {
      console.log(`   ${idx + 1}. ${follower.name} (${follower.id}) - Role: ${(follower as any).role}`);
    });

    if (followers.length === 0) {
      console.log('\n⚠️  WARNING: Thiago has no followers! Notifications cannot be created.');
      console.log('   Checking if scout admin follows Thiago...');
      
      // Check if scout admin exists and follow relationship
      const scoutAdmins = await db
        .select()
        .from(users)
        .where(eq(users.role, 'scout_admin'))
        .limit(5);
      
      console.log(`\n   Found ${scoutAdmins.length} scout admin(s):`);
      scoutAdmins.forEach(admin => {
        console.log(`   - ${admin.name} (${admin.id})`);
      });

      // Check if any scout admin follows Thiago
      if (scoutAdmins.length > 0) {
        const scoutAdmin = scoutAdmins[0];
        const followCheck = await db
          .select()
          .from(studentFollowers)
          .where(
            sql`${studentFollowers.followerUserId} = ${scoutAdmin.id} AND ${studentFollowers.studentId} = ${thiago.id}`
          )
          .limit(1);
        
        if (followCheck.length === 0) {
          console.log(`\n   ❌ Scout admin ${scoutAdmin.name} does NOT follow Thiago!`);
          console.log(`   Creating follow relationship...`);
          try {
            await storage.followStudent({
              followerUserId: scoutAdmin.id,
              studentId: thiago.id,
            });
            console.log(`   ✅ Follow relationship created!`);
          } catch (e: any) {
            console.log(`   ❌ Failed to create follow: ${e.message}`);
          }
        } else {
          console.log(`\n   ✅ Scout admin ${scoutAdmin.name} follows Thiago`);
        }
      }
    }

    // Step 3: Get Thiago's recent posts
    console.log('\n📋 Step 3: Checking Thiago\'s recent posts...');
    const thiagoPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.studentId, thiago.id))
      .orderBy(desc(posts.createdAt))
      .limit(5);
    
    console.log(`✅ Found ${thiagoPosts.length} recent post(s):`);
    thiagoPosts.forEach((post, idx) => {
      console.log(`   ${idx + 1}. Post ${post.id} - Created: ${post.createdAt} - Status: ${post.status}`);
    });

    // Step 4: Check notifications for Thiago's most recent post
    if (thiagoPosts.length > 0) {
      const recentPost = thiagoPosts[0];
      console.log(`\n📋 Step 4: Checking notifications for post ${recentPost.id}...`);
      
      const postNotifications = await db
        .select()
        .from(notifications)
        .where(
          sql`${notifications.entityType} = 'post' AND ${notifications.entityId} = ${recentPost.id} AND ${notifications.type} = 'following_posted'`
        );
      
      console.log(`✅ Found ${postNotifications.length} notification(s) for this post:`);
      postNotifications.forEach((notif, idx) => {
        console.log(`   ${idx + 1}. User: ${notif.userId} - ${notif.title}`);
        console.log(`      Read: ${notif.isRead} - Created: ${notif.createdAt}`);
      });

      // Check if followers have notifications
      console.log(`\n📋 Step 5: Checking if followers have notifications...`);
      for (const follower of followers) {
        const followerNotifications = await db
          .select()
          .from(notifications)
          .where(
            sql`${notifications.userId} = ${follower.id} AND ${notifications.type} = 'following_posted'`
          )
          .orderBy(desc(notifications.createdAt))
          .limit(5);
        
        console.log(`\n   ${follower.name} (${follower.id}):`);
        console.log(`      Total notifications: ${followerNotifications.length}`);
        if (followerNotifications.length > 0) {
          followerNotifications.forEach((notif, idx) => {
            console.log(`      ${idx + 1}. ${notif.title} - Post: ${notif.entityId} - Read: ${notif.isRead}`);
          });
        } else {
          console.log(`      ⚠️  No notifications found!`);
        }
      }
    }

    // Step 5: Test creating a notification manually
    console.log(`\n📋 Step 6: Testing notification creation manually...`);
    if (thiagoPosts.length > 0 && followers.length > 0) {
      const testPost = thiagoPosts[0];
      const testFollower = followers[0];
      
      console.log(`   Creating notification for ${testFollower.name} about post ${testPost.id}...`);
      try {
        await notifyFollowersOfNewPost(testPost.id, thiago.id);
        console.log(`   ✅ Notification creation function executed successfully`);
      } catch (e: any) {
        console.error(`   ❌ Error: ${e.message}`);
        console.error(e);
      }
    }

    // Step 6: Verify notifications were created
    console.log(`\n📋 Step 7: Verifying notifications after manual creation...`);
    if (thiagoPosts.length > 0 && followers.length > 0) {
      const testPost = thiagoPosts[0];
      const updatedNotifications = await db
        .select()
        .from(notifications)
        .where(
          sql`${notifications.entityType} = 'post' AND ${notifications.entityId} = ${testPost.id} AND ${notifications.type} = 'following_posted'`
        );
      
      console.log(`✅ Found ${updatedNotifications.length} notification(s) for post ${testPost.id}`);
      updatedNotifications.forEach((notif, idx) => {
        const follower = followers.find(f => f.id === notif.userId);
        console.log(`   ${idx + 1}. ${follower?.name || notif.userId}: ${notif.title}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test complete!\n');

  } catch (error: any) {
    console.error('❌ Test error:', error?.message || error);
    console.error(error);
  }
}

async function main() {
  await testNotificationFlow();
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('test-notification-flow.ts')) {
  main();
}

export { testNotificationFlow };

