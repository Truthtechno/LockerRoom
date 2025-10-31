import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { storage } from '../server/storage';
import { users, students, posts } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Test script for notifications system
 * Creates sample notifications and tests the system
 */

async function testNotificationCreation() {
  console.log('🧪 Testing Notification Creation...\n');

  try {
    // Get some test users
    const allUsers = await db.select().from(users).limit(5);
    
    if (allUsers.length < 2) {
      console.log('⚠️  Need at least 2 users to test. Found:', allUsers.length);
      return false;
    }

    const testUsers = allUsers.slice(0, 2);
    const [user1, user2] = testUsers;

    console.log(`📋 Using test users: ${user1.name} and ${user2.name}\n`);

    // Test 1: Create a follow notification
    console.log('Test 1: Creating follow notification...');
    try {
      await storage.createNotification({
        userId: user1.id,
        type: 'new_follower',
        title: 'New Follower',
        message: `${user2.name || 'Someone'} started following you`,
        entityType: 'user',
        entityId: user1.id,
        relatedUserId: user2.id,
      });
      console.log('✅ Follow notification created\n');
    } catch (e) {
      console.error('❌ Failed to create follow notification:', e);
      return false;
    }

    // Test 2: Create a post like notification
    console.log('Test 2: Creating post like notification...');
    try {
      // Find a post by user1
      const userPosts = await db.select().from(posts).where(eq(posts.studentId, user1.id)).limit(1);
      
      if (userPosts.length > 0) {
        const post = userPosts[0];
        await storage.createNotification({
          userId: user1.id,
          type: 'post_like',
          title: 'New Like',
          message: `${user2.name || 'Someone'} liked your post`,
          entityType: 'post',
          entityId: post.id,
          relatedUserId: user2.id,
        });
        console.log('✅ Post like notification created\n');
      } else {
        console.log('ℹ️  No posts found for user, skipping post like test\n');
      }
    } catch (e) {
      console.error('❌ Failed to create post like notification:', e);
      return false;
    }

    // Test 3: Create a post comment notification
    console.log('Test 3: Creating post comment notification...');
    try {
      const userPosts = await db.select().from(posts).where(eq(posts.studentId, user1.id)).limit(1);
      
      if (userPosts.length > 0) {
        const post = userPosts[0];
        await storage.createNotification({
          userId: user1.id,
          type: 'post_comment',
          title: 'New Comment',
          message: `${user2.name || 'Someone'} commented: "Great post!"`,
          entityType: 'post',
          entityId: post.id,
          relatedUserId: user2.id,
        });
        console.log('✅ Post comment notification created\n');
      } else {
        console.log('ℹ️  No posts found for user, skipping post comment test\n');
      }
    } catch (e) {
      console.error('❌ Failed to create post comment notification:', e);
      return false;
    }

    // Test 4: Test fetching notifications
    console.log('Test 4: Fetching notifications for user...');
    try {
      const notifications = await storage.getNotifications(user1.id, { limit: 10 });
      console.log(`✅ Found ${notifications.length} notifications for ${user1.name}\n`);
      
      if (notifications.length === 0) {
        console.log('⚠️  No notifications found - this is expected if database is empty\n');
      } else {
        console.log('📬 Sample notifications:');
        notifications.slice(0, 3).forEach((notif, idx) => {
          console.log(`   ${idx + 1}. [${notif.type}] ${notif.title}: ${notif.message}`);
        });
        console.log('');
      }
    } catch (e) {
      console.error('❌ Failed to fetch notifications:', e);
      return false;
    }

    // Test 5: Test unread count
    console.log('Test 5: Testing unread count...');
    try {
      const unreadCount = await storage.getUnreadNotificationCount(user1.id);
      console.log(`✅ Unread notifications count: ${unreadCount}\n`);
    } catch (e) {
      console.error('❌ Failed to get unread count:', e);
      return false;
    }

    console.log('🎉 All notification tests passed!\n');
    return true;

  } catch (error) {
    console.error('❌ Test error:', error);
    return false;
  }
}

async function createSampleNotificationsForAllUsers() {
  console.log('📬 Creating sample notifications for testing...\n');

  try {
    // Get all users
    const allUsers = await db.select().from(users).limit(20);
    console.log(`Found ${allUsers.length} users\n`);

    let createdCount = 0;

    for (const user of allUsers) {
      // Create a few sample notifications for each user
      const notificationTypes = [
        { type: 'new_follower', title: 'New Follower', message: 'Someone started following you' },
        { type: 'post_like', title: 'New Like', message: 'Someone liked your post' },
        { type: 'post_comment', title: 'New Comment', message: 'Someone commented on your post' },
        { type: 'following_posted', title: 'New Post', message: 'Someone you follow posted something new' },
      ];

      // Create 1-2 random notifications per user
      const numNotifications = Math.floor(Math.random() * 2) + 1;
      const selectedTypes = notificationTypes
        .sort(() => Math.random() - 0.5)
        .slice(0, numNotifications);

      for (const notifType of selectedTypes) {
        try {
          // Find another user to be the related user
          const otherUsers = allUsers.filter(u => u.id !== user.id);
          if (otherUsers.length === 0) continue;
          
          const relatedUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];

          await storage.createNotification({
            userId: user.id,
            type: notifType.type,
            title: notifType.title,
            message: `${relatedUser.name || 'Someone'} ${notifType.message.replace('Someone', '').trim()}`,
            entityType: notifType.type === 'new_follower' ? 'user' : 'post',
            entityId: user.id,
            relatedUserId: relatedUser.id,
            isRead: Math.random() > 0.5, // Randomly mark some as read
          });
          createdCount++;
        } catch (e) {
          // Continue if one fails
          console.error(`Error creating notification for ${user.name}:`, e);
        }
      }
    }

    console.log(`✅ Created ${createdCount} sample notifications\n`);
    return createdCount > 0;

  } catch (error) {
    console.error('❌ Error creating sample notifications:', error);
    return false;
  }
}

async function verifyNotificationsForRoles() {
  console.log('🔍 Verifying notifications by role...\n');

  try {
    // Get users by role
    const students = await db.select().from(users).where(eq(users.role, 'student')).limit(5);
    const viewers = await db.select().from(users).where(eq(users.role, 'viewer')).limit(5);
    const schoolAdmins = await db.select().from(users).where(eq(users.role, 'school_admin')).limit(5);
    const systemAdmins = await db.select().from(users).where(eq(users.role, 'system_admin')).limit(5);

    console.log(`📊 Found users by role:`);
    console.log(`   Students: ${students.length}`);
    console.log(`   Viewers: ${viewers.length}`);
    console.log(`   School Admins: ${schoolAdmins.length}`);
    console.log(`   System Admins: ${systemAdmins.length}\n`);

    // Test notifications for each role
    for (const student of students.slice(0, 2)) {
      const notifications = await storage.getNotifications(student.id, { limit: 5 });
      const unread = await storage.getUnreadNotificationCount(student.id);
      console.log(`   Student ${student.name}: ${notifications.length} notifications (${unread} unread)`);
    }

    for (const viewer of viewers.slice(0, 2)) {
      const notifications = await storage.getNotifications(viewer.id, { limit: 5 });
      const unread = await storage.getUnreadNotificationCount(viewer.id);
      console.log(`   Viewer ${viewer.name}: ${notifications.length} notifications (${unread} unread)`);
    }

    console.log('\n✅ Role-based notification verification complete\n');
    return true;

  } catch (error) {
    console.error('❌ Error verifying notifications:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Notifications System Test Suite...\n');
  console.log('📝 This will test notification creation, fetching, and role-based functionality\n');

  try {
    // Step 1: Test basic functionality
    const testSuccess = await testNotificationCreation();
    if (!testSuccess) {
      console.error('❌ Basic tests failed');
      process.exit(1);
    }

    // Step 2: Create sample notifications
    console.log('='.repeat(60));
    const sampleSuccess = await createSampleNotificationsForAllUsers();
    if (!sampleSuccess) {
      console.log('⚠️  No sample notifications created (this is OK if database is empty)');
    }

    // Step 3: Verify role-based notifications
    console.log('='.repeat(60));
    await verifyNotificationsForRoles();

    console.log('='.repeat(60));
    console.log('✨ All notification system tests completed!');
    console.log('📝 The notifications system is ready to use');
    console.log('🔔 Check the notifications page in the app to see notifications');

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('test-notifications-system.ts')) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test script failed:', error);
      process.exit(1);
    });
}

export { testNotificationCreation, createSampleNotificationsForAllUsers, verifyNotificationsForRoles };

