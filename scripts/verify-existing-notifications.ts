import { db } from '../server/db';
import { storage } from '../server/storage';
import { users, evaluationSubmissions, notifications, scoutProfiles } from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';

/**
 * Verification script to check existing form submission notifications
 * Verifies that:
 * 1. Notification messages don't contain "undefined"
 * 2. Profile pictures are loaded correctly via getNotifications
 */

async function verifyExistingNotifications() {
  console.log('🔍 Verifying Existing Form Submission Notifications\n');
  console.log('='.repeat(70));

  try {
    // Get recent form submission notifications (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    console.log('\n📋 Step 1: Finding recent form submission notifications...');
    const recentNotifications = await db
      .select({
        notification: notifications,
        relatedUser: {
          id: users.id,
          name: users.name,
          role: users.role,
          linkedId: users.linkedId,
        },
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.relatedUserId, users.id))
      .where(
        and(
          eq(notifications.entityType, 'evaluation_form_submission'),
          eq(notifications.type, 'form_submitted'),
          gte(notifications.createdAt, oneDayAgo)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(10);

    console.log(`✅ Found ${recentNotifications.length} recent notification(s)\n`);

    if (recentNotifications.length === 0) {
      console.log('ℹ️ No recent notifications found. Please submit a form first.');
      console.log('   Then run this script again to verify the fixes.');
      return;
    }

    // Check each notification
    let nameIssues = 0;
    let profilePicIssues = 0;
    let totalChecked = 0;

    for (const notif of recentNotifications) {
      totalChecked++;
      console.log(`\n📋 Checking notification ${totalChecked}:`);
      console.log(`   ID: ${notif.notification.id}`);
      console.log(`   Title: ${notif.notification.title}`);
      console.log(`   Message: ${notif.notification.message}`);
      console.log(`   Related User ID: ${notif.relatedUser?.id || 'N/A'}`);
      console.log(`   Related User Name (from join): ${notif.relatedUser?.name || 'N/A'}`);

      // Check 1: Does message contain "undefined"?
      if (notif.notification.message.includes('undefined')) {
        console.log(`   ❌ ISSUE: Message contains "undefined"!`);
        nameIssues++;
      } else {
        console.log(`   ✅ Message does not contain "undefined"`);
      }

      // Check 2: Get notification via storage method (which should fetch profile pictures)
      if (notif.notification.userId) {
        const retrievedNotifications = await storage.getNotifications(notif.notification.userId, {
          limit: 50,
          unreadOnly: false,
        });

        const matchingNotification = retrievedNotifications.find(
          n => n.id === notif.notification.id
        );

        if (matchingNotification) {
          console.log(`\n   Retrieved via getNotifications:`);
          console.log(`   Related User Name: ${matchingNotification.relatedUser?.name || 'N/A'}`);
          console.log(`   Related User Role: ${matchingNotification.relatedUser?.role || 'N/A'}`);
          console.log(`   Profile Picture URL: ${matchingNotification.relatedUser?.profilePicUrl || 'N/A'}`);

          // Check if name is still "undefined" after retrieval
          if (matchingNotification.relatedUser?.name === 'undefined' || 
              matchingNotification.relatedUser?.name?.includes('undefined')) {
            console.log(`   ❌ ISSUE: Related user name contains "undefined" after retrieval!`);
            nameIssues++;
          } else if (matchingNotification.relatedUser?.name) {
            console.log(`   ✅ Related user name is correct: "${matchingNotification.relatedUser.name}"`);
          }

          // Check profile picture
          if (!matchingNotification.relatedUser?.profilePicUrl) {
            console.log(`   ❌ ISSUE: Profile picture is missing!`);
            
            // Try to fetch it directly from database
            if (matchingNotification.relatedUser?.id && 
                (matchingNotification.relatedUser.role === 'xen_scout' || 
                 matchingNotification.relatedUser.role === 'scout_admin')) {
              const directProfile = await db
                .select({ profilePicUrl: scoutProfiles.profilePicUrl })
                .from(scoutProfiles)
                .where(eq(scoutProfiles.userId, matchingNotification.relatedUser.id))
                .limit(1);
              
              if (directProfile[0]?.profilePicUrl && directProfile[0].profilePicUrl !== '') {
                console.log(`   ⚠️ Profile picture exists in database: ${directProfile[0].profilePicUrl}`);
                console.log(`   ⚠️ But it's not being loaded in notification retrieval`);
                profilePicIssues++;
              } else {
                console.log(`   ℹ️ Profile picture does not exist in scoutProfiles table (this is OK if scout has no picture)`);
              }
            } else {
              profilePicIssues++;
            }
          } else {
            console.log(`   ✅ Profile picture is loaded correctly: ${matchingNotification.relatedUser.profilePicUrl}`);
          }
        } else {
          console.log(`   ⚠️ Could not find notification in retrieved list`);
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 VERIFICATION SUMMARY:');
    console.log(`   Total notifications checked: ${totalChecked}`);
    console.log(`   Name issues found: ${nameIssues}`);
    console.log(`   Profile picture issues found: ${profilePicIssues}`);
    
    if (nameIssues === 0 && profilePicIssues === 0) {
      console.log('\n✅ ALL CHECKS PASSED!');
      console.log('   ✅ No "undefined" names found in notifications');
      console.log('   ✅ Profile pictures are correctly loaded');
    } else {
      console.log('\n❌ ISSUES DETECTED:');
      if (nameIssues > 0) {
        console.log(`   ❌ ${nameIssues} notification(s) contain "undefined" in the name`);
        console.log('   💡 Note: Existing notifications created before the fix will still show "undefined"');
        console.log('   💡 New notifications should work correctly');
      }
      if (profilePicIssues > 0) {
        console.log(`   ❌ ${profilePicIssues} notification(s) are missing profile pictures`);
        console.log('   💡 This could be due to missing profile pictures in the database');
      }
    }

    console.log('\n💡 RECOMMENDATION:');
    console.log('   Submit a NEW form to verify the fixes are working for new notifications.');
    console.log('   Existing notifications created before the fix may still show "undefined".');

  } catch (error: any) {
    console.error('\n❌ Verification failed:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

// Run the verification
verifyExistingNotifications()
  .then(() => {
    console.log('\n✅ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });

