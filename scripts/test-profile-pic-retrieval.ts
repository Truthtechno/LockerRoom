import { db } from '../server/db';
import { storage } from '../server/storage';
import { users, notifications, scoutProfiles } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Test script to debug profile picture retrieval for notifications
 */

async function testProfilePicRetrieval() {
  console.log('🔍 Testing Profile Picture Retrieval for Notifications\n');
  console.log('='.repeat(70));

  try {
    // Get a recent form_submitted notification
    const recentNotifications = await db
      .select({
        notification: notifications,
        relatedUser: {
          id: users.id,
          name: users.name,
          role: users.role,
          linkedId: users.linkedId,
          profilePicUrl: users.profilePicUrl,
        },
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.relatedUserId, users.id))
      .where(
        and(
          eq(notifications.entityType, 'evaluation_form_submission'),
          eq(notifications.type, 'form_submitted')
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(1);

    if (recentNotifications.length === 0) {
      console.log('❌ No form_submitted notifications found');
      return;
    }

    const notif = recentNotifications[0];
    console.log(`\n📋 Testing notification: ${notif.notification.id}`);
    console.log(`   Related User ID: ${notif.relatedUser?.id || 'N/A'}`);
    console.log(`   Related User Role: ${notif.relatedUser?.role || 'N/A'}`);
    console.log(`   Related User Name: ${notif.relatedUser?.name || 'N/A'}`);
    console.log(`   Users table profilePicUrl: ${notif.relatedUser?.profilePicUrl || 'N/A'}`);

    if (!notif.relatedUser?.id) {
      console.log('❌ No related user found');
      return;
    }

    const userId = notif.relatedUser.id;
    const userRole = notif.relatedUser.role;

    // Check scoutProfiles directly
    if (userRole === 'xen_scout' || userRole === 'scout_admin') {
      console.log(`\n🔍 Checking scoutProfiles for userId: ${userId}`);
      const scoutProfile = await db
        .select()
        .from(scoutProfiles)
        .where(eq(scoutProfiles.userId, userId))
        .limit(1);

      if (scoutProfile.length > 0) {
        console.log(`✅ Found scout profile:`);
        console.log(`   Profile ID: ${scoutProfile[0].id}`);
        console.log(`   Profile Name: ${scoutProfile[0].name}`);
        console.log(`   Profile Picture URL: ${scoutProfile[0].profilePicUrl || 'N/A'}`);
      } else {
        console.log(`❌ No scout profile found for userId: ${userId}`);
      }

      // Also check via linkedId
      if (notif.relatedUser.linkedId) {
        console.log(`\n🔍 Checking scoutProfiles for linkedId: ${notif.relatedUser.linkedId}`);
        const scoutProfileByLinkedId = await db
          .select()
          .from(scoutProfiles)
          .where(eq(scoutProfiles.id, notif.relatedUser.linkedId))
          .limit(1);

        if (scoutProfileByLinkedId.length > 0) {
          console.log(`✅ Found scout profile via linkedId:`);
          console.log(`   Profile ID: ${scoutProfileByLinkedId[0].id}`);
          console.log(`   Profile Name: ${scoutProfileByLinkedId[0].name}`);
          console.log(`   Profile Picture URL: ${scoutProfileByLinkedId[0].profilePicUrl || 'N/A'}`);
        } else {
          console.log(`❌ No scout profile found for linkedId: ${notif.relatedUser.linkedId}`);
        }
      }
    }

    // Now test getNotifications to see what it returns
    console.log(`\n🔍 Testing getNotifications for user: ${notif.notification.userId}`);
    const retrievedNotifications = await storage.getNotifications(notif.notification.userId, {
      limit: 10,
      unreadOnly: false,
    });

    const matchingNotification = retrievedNotifications.find(
      n => n.id === notif.notification.id
    );

    if (matchingNotification) {
      console.log(`\n✅ Retrieved notification via getNotifications:`);
      console.log(`   ID: ${matchingNotification.id}`);
      console.log(`   Type: ${matchingNotification.type}`);
      console.log(`   Related User ID: ${matchingNotification.relatedUserId}`);
      
      if (matchingNotification.relatedUser) {
        console.log(`   Related User Name: ${matchingNotification.relatedUser.name || 'N/A'}`);
        console.log(`   Related User Role: ${matchingNotification.relatedUser.role || 'N/A'}`);
        console.log(`   Profile Picture URL: ${matchingNotification.relatedUser.profilePicUrl || 'N/A (NULL)'}`);
        console.log(`   Profile Picture Type: ${typeof matchingNotification.relatedUser.profilePicUrl}`);
        console.log(`   Profile Picture Length: ${matchingNotification.relatedUser.profilePicUrl?.length || 0}`);
      } else {
        console.log(`   ❌ Related User is null!`);
      }
    } else {
      console.log(`❌ Could not find notification in retrieved list`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Test completed');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

testProfilePicRetrieval()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });

