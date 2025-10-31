import { db } from '../server/db';
import { users, notifications } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../server/storage';

/**
 * Quick verification script to check if notifications are working
 */

async function verifyNotifications() {
  console.log('🔍 Verifying Notifications...\n');

  try {
    // Find scout admin
    const scoutAdmins = await db
      .select()
      .from(users)
      .where(eq(users.role, 'scout_admin'))
      .limit(1);

    if (scoutAdmins.length === 0) {
      console.log('❌ No scout admin found');
      return;
    }

    const scoutAdmin = scoutAdmins[0];
    console.log(`👤 Scout Admin: ${scoutAdmin.name} (${scoutAdmin.id})`);

    // Get notifications via API method
    const notificationsViaStorage = await storage.getNotifications(scoutAdmin.id, { limit: 10 });
    console.log(`\n📬 Notifications via storage.getNotifications: ${notificationsViaStorage.length}`);

    if (notificationsViaStorage.length > 0) {
      console.log('\n✅ Notifications found:');
      notificationsViaStorage.forEach((notif, idx) => {
        console.log(`   ${idx + 1}. [${notif.type}] ${notif.title}`);
        console.log(`      ${notif.message}`);
        console.log(`      Post ID: ${notif.entityId || 'N/A'}`);
        console.log(`      Read: ${notif.isRead}`);
        console.log(`      Created: ${notif.createdAt}`);
      });
    } else {
      console.log('⚠️  No notifications found via storage method');
      
      // Check database directly
      const directNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, scoutAdmin.id))
        .limit(10);
      
      console.log(`\n📬 Notifications in database directly: ${directNotifications.length}`);
      if (directNotifications.length > 0) {
        console.log('⚠️  DISCREPANCY: Notifications exist in DB but not via storage method!');
        directNotifications.forEach((notif, idx) => {
          console.log(`   ${idx + 1}. [${notif.type}] ${notif.title} - UserId: ${notif.userId}`);
        });
      }
    }

    // Check unread count
    const unreadCount = await storage.getUnreadNotificationCount(scoutAdmin.id);
    console.log(`\n🔔 Unread notifications: ${unreadCount}`);

    console.log('\n✅ Verification complete!\n');
  } catch (error: any) {
    console.error('❌ Verification error:', error?.message || error);
  }
}

verifyNotifications().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});

