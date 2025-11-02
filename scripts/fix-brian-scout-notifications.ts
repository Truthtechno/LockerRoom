import { db } from '../server/db';
import { users, submissions, submissionReviews, submissionFinalFeedback, notifications } from '@shared/schema';
import { eq, inArray, desc, and, sql } from 'drizzle-orm';
import { storage } from '../server/storage';
import { 
  notifyScoutsOfReviewUpdate
} from '../server/utils/notification-helpers';

/**
 * Fix missing notifications for BRIAN SCOUT 1
 * This scout was created after most submissions, so they won't have submission_created notifications
 * But they should have review_submitted notifications for reviews submitted after they were created
 */
async function fixBrianScoutNotifications() {
  console.log('🔧 Fixing missing notifications for BRIAN SCOUT 1...\n');
  console.log('='.repeat(60));

  try {
    const scoutId = 'd1ee2139-2d90-43b3-b022-57da8ee30bea';
    
    // Find BRIAN SCOUT 1
    const scout = await db
      .select()
      .from(users)
      .where(eq(users.id, scoutId))
      .limit(1);

    if (scout.length === 0) {
      console.log('❌ Scout not found!');
      return;
    }

    const scoutInfo = scout[0];
    console.log(`👤 Scout: ${scoutInfo.name}`);
    console.log(`   Created: ${scoutInfo.createdAt}`);
    console.log('');

    const scoutCreatedAt = new Date(scoutInfo.createdAt);
    let notificationsCreated = 0;

    // Check for reviews submitted after scout creation
    console.log('📋 Checking for reviews submitted after scout creation...');
    const allReviews = await db
      .select()
      .from(submissionReviews)
      .where(eq(submissionReviews.isSubmitted, true))
      .orderBy(desc(submissionReviews.updatedAt));

    const reviewsAfterScout = allReviews.filter(r => new Date(r.updatedAt) >= scoutCreatedAt);
    console.log(`   Found ${reviewsAfterScout.length} review(s) submitted after scout creation`);

    for (const review of reviewsAfterScout) {
      // Check if notification already exists
      const existingNotifs = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, scoutId),
            eq(notifications.entityType, 'submission'),
            eq(notifications.entityId, review.submissionId),
            eq(notifications.type, 'review_submitted'),
            eq(notifications.relatedUserId, review.scoutId)
          )
        )
        .limit(1);

      if (existingNotifs.length === 0) {
        console.log(`   ⚠️ Missing notification for review ${review.id} on submission ${review.submissionId}`);
        console.log(`   Creating notification...`);
        
        // Create the notification
        await notifyScoutsOfReviewUpdate(review.submissionId, review.scoutId, true);
        notificationsCreated++;
      } else {
        console.log(`   ✓ Notification already exists for review ${review.id}`);
      }
    }

    // Since this scout was created after all submissions, they won't have submission_created notifications
    // That's expected behavior - notifications are only created at the time of the event
    // However, let's check if there are any other scouts who might have notifications this scout should also have
    
    // Check what other scouts have and see if there are any patterns
    console.log('\n📊 Checking notification patterns from other scouts...');
    const otherScouts = await db
      .select()
      .from(users)
      .where(
        and(
          inArray(users.role, ['xen_scout', 'scout_admin']),
          sql`${users.id} != ${scoutId}`,
          sql`${users.createdAt} < ${scoutCreatedAt}` // Only scouts who existed before
        )
      )
      .limit(1);

    if (otherScouts.length > 0) {
      const otherScout = otherScouts[0];
      const otherScoutNotifs = await storage.getNotifications(otherScout.id, { limit: 50 });
      
      console.log(`   Comparing with ${otherScout.name} who has ${otherScoutNotifs.length} notifications`);
      
      // Check for review_submitted notifications that this scout should also have
      const reviewNotifs = otherScoutNotifs.filter(n => 
        n.type === 'review_submitted' && 
        new Date(n.createdAt) >= scoutCreatedAt
      );
      
      console.log(`   Found ${reviewNotifs.length} review_submitted notifications created after scout`);
      
      for (const notif of reviewNotifs) {
        // Check if this scout has this notification
        const hasNotif = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, scoutId),
              eq(notifications.entityType, 'submission'),
              eq(notifications.entityId, notif.entityId),
              eq(notifications.type, 'review_submitted'),
              eq(notifications.relatedUserId, notif.relatedUserId)
            )
          )
          .limit(1);

        if (hasNotif.length === 0) {
          console.log(`   ⚠️ Missing notification: ${notif.title} for submission ${notif.entityId}`);
          // Get the review to recreate notification
          const review = await db
            .select()
            .from(submissionReviews)
            .where(
              and(
                eq(submissionReviews.submissionId, notif.entityId!),
                eq(submissionReviews.scoutId, notif.relatedUserId!),
                eq(submissionReviews.isSubmitted, true)
              )
            )
            .limit(1);

          if (review.length > 0) {
            console.log(`   Creating notification...`);
            await notifyScoutsOfReviewUpdate(review[0].submissionId, review[0].scoutId, true);
            notificationsCreated++;
          }
        }
      }
    }

    // Final check
    const finalNotifs = await storage.getNotifications(scoutId, { limit: 50 });
    const finalUnread = await storage.getUnreadNotificationCount(scoutId);

    console.log('\n' + '='.repeat(60));
    console.log('📊 Final Status:');
    console.log(`   Total Notifications: ${finalNotifs.length}`);
    console.log(`   Unread Notifications: ${finalUnread}`);
    console.log(`   New Notifications Created: ${notificationsCreated}`);
    console.log('='.repeat(60));
    
    if (finalNotifs.length === 0) {
      console.log('\n⚠️ NOTE: This scout still has 0 notifications.');
      console.log('   This is expected because:');
      console.log('   - They were created AFTER all submissions (no submission_created notifications)');
      console.log('   - They were created AFTER all finalizations (no submission_finalized notifications)');
      console.log('   - Any review_submitted notifications were already created or are missing');
    }

    console.log('\n✅ Fix completed!\n');

  } catch (error: any) {
    console.error('❌ Error:', error?.message || error);
    throw error;
  }
}

async function main() {
  try {
    await fixBrianScoutNotifications();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('fix-brian-scout-notifications.ts')) {
  main();
}

export { fixBrianScoutNotifications };
