import { db } from '../server/db';
import { users, notifications } from '@shared/schema';
import { eq, inArray, desc, and } from 'drizzle-orm';
import { storage } from '../server/storage';

/**
 * Check all scout notifications to verify they are working
 */
async function checkScoutNotifications() {
  console.log('🔍 Checking all scout notifications...\n');
  console.log('='.repeat(60));

  try {
    // Get all scouts and scout admins
    const scouts = await db
      .select()
      .from(users)
      .where(inArray(users.role, ['xen_scout', 'scout_admin']));

    console.log(`📋 Found ${scouts.length} scout(s) and scout admin(s)\n`);

    if (scouts.length === 0) {
      console.log('⚠️ No scouts found in the system');
      return;
    }

    let totalNotifications = 0;
    let totalUnread = 0;

    for (const scout of scouts) {
      const notifications = await storage.getNotifications(scout.id, { limit: 50 });
      const unreadCount = await storage.getUnreadNotificationCount(scout.id);
      
      totalNotifications += notifications.length;
      totalUnread += unreadCount;

      console.log(`👤 ${scout.name} (${scout.role}) - ID: ${scout.id}`);
      console.log(`   📬 Total notifications: ${notifications.length}`);
      console.log(`   🔔 Unread notifications: ${unreadCount}`);
      
      // Show recent notifications
      if (notifications.length > 0) {
        console.log(`   Recent notifications:`);
        const recent = notifications.slice(0, 5);
        for (const notif of recent) {
          const status = notif.isRead ? '✓' : '●';
          const date = new Date(notif.createdAt).toLocaleDateString();
          console.log(`      ${status} [${notif.type}] ${notif.title} - ${date}`);
        }
        if (notifications.length > 5) {
          console.log(`      ... and ${notifications.length - 5} more`);
        }
      } else {
        console.log(`   ⚠️ No notifications found`);
      }
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Total Scouts: ${scouts.length}`);
    console.log(`   Total Notifications: ${totalNotifications}`);
    console.log(`   Total Unread: ${totalUnread}`);
    console.log('='.repeat(60));
    console.log('\n✅ Check completed!\n');

  } catch (error: any) {
    console.error('❌ Error checking notifications:', error?.message || error);
    throw error;
  }
}

async function main() {
  try {
    await checkScoutNotifications();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('check-scout-notifications.ts')) {
  main();
}

export { checkScoutNotifications };
