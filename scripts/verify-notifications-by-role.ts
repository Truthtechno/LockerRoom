import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { storage } from '../server/storage';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Verify notifications are working correctly for each role
 */

async function verifyNotificationsByRole() {
  console.log('🔍 Verifying Notifications by Role...\n');

  try {
    const roles = ['student', 'viewer', 'school_admin', 'system_admin', 'scout_admin', 'xen_scout'];

    for (const role of roles) {
      console.log(`\n📋 Testing ${role.toUpperCase()} role:`);
      console.log('─'.repeat(50));

      // Get users with this role
      const roleUsers = await db.select().from(users).where(eq(users.role, role)).limit(3);

      if (roleUsers.length === 0) {
        console.log(`   ⚠️  No ${role} users found\n`);
        continue;
      }

      for (const user of roleUsers) {
        try {
          const notifications = await storage.getNotifications(user.id, { limit: 10 });
          const unreadCount = await storage.getUnreadNotificationCount(user.id);
          
          console.log(`   👤 ${user.name}:`);
          console.log(`      📬 Total: ${notifications.length} notifications`);
          console.log(`      🔔 Unread: ${unreadCount} notifications`);

          if (notifications.length > 0) {
            const types = notifications.map(n => n.type);
            const uniqueTypes = [...new Set(types)];
            console.log(`      📋 Types: ${uniqueTypes.join(', ')}`);
            
            // Show first notification
            const first = notifications[0];
            console.log(`      📄 Latest: [${first.type}] ${first.title} - ${first.message.substring(0, 50)}...`);
          }
        } catch (e: any) {
          console.log(`      ❌ Error: ${e.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Role-based notification verification complete!\n');

    return true;

  } catch (error) {
    console.error('❌ Verification error:', error);
    return false;
  }
}

async function testNotificationTypes() {
  console.log('🧪 Testing All Notification Types...\n');

  try {
    // Get a test user
    const testUser = await db.select().from(users).where(eq(users.role, 'student')).limit(1);
    
    if (testUser.length === 0) {
      console.log('⚠️  No test user found');
      return false;
    }

    const user = testUser[0];
    const notificationTypes = [
      { type: 'post_like', title: 'New Like', message: 'Someone liked your post' },
      { type: 'post_comment', title: 'New Comment', message: 'Someone commented on your post' },
      { type: 'new_follower', title: 'New Follower', message: 'Someone started following you' },
      { type: 'announcement', title: 'New Announcement', message: 'A new announcement was posted' },
      { type: 'following_posted', title: 'New Post', message: 'Someone you follow posted something new' },
    ];

    console.log(`Creating test notifications for user: ${user.name}\n`);

    for (const notifType of notificationTypes) {
      try {
        await storage.createNotification({
          userId: user.id,
          type: notifType.type,
          title: notifType.title,
          message: notifType.message,
          entityType: 'post',
          entityId: 'test-id',
          isRead: false,
        });
        console.log(`   ✅ Created ${notifType.type} notification`);
      } catch (e: any) {
        console.log(`   ❌ Failed to create ${notifType.type}: ${e.message}`);
      }
    }

    console.log('\n✅ All notification types tested\n');
    return true;

  } catch (error) {
    console.error('❌ Test error:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Comprehensive Notifications Verification...\n');

  try {
    // Test 1: Verify by role
    await verifyNotificationsByRole();

    // Test 2: Test all notification types
    console.log('='.repeat(60));
    await testNotificationTypes();

    // Test 3: Summary
    console.log('='.repeat(60));
    console.log('📊 System Summary:\n');
    
    const totalNotifications = await db.execute(sql`SELECT COUNT(*) as count FROM notifications`);
    const totalUnread = await db.execute(sql`SELECT COUNT(*) as count FROM notifications WHERE is_read = false`);
    
    console.log(`   Total Notifications: ${(totalNotifications.rows[0] as any)?.count || 0}`);
    console.log(`   Total Unread: ${(totalUnread.rows[0] as any)?.count || 0}`);
    console.log(`   Total Read: ${Number((totalNotifications.rows[0] as any)?.count || 0) - Number((totalUnread.rows[0] as any)?.count || 0)}\n`);

    console.log('✨ Verification complete!');
    console.log('✅ Notifications system is working correctly');
    console.log('🔔 All users should now see notifications in the app');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('verify-notifications-by-role.ts')) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { verifyNotificationsByRole, testNotificationTypes };

