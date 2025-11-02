import { db } from '../server/db';
import { submissionReviews, users, submissions } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function checkReview() {
  const scoutId = 'd1ee2139-2d90-43b3-b022-57da8ee30bea';
  const submissionId = '93dc40e9-79d7-4dd5-90d1-1ad2e61d3aa9';
  
  // Get the review
  const review = await db
    .select()
    .from(submissionReviews)
    .where(eq(submissionReviews.id, '5d7a51ea-70b0-45e5-b61f-05847d6b9afe'))
    .limit(1);

  if (review.length === 0) {
    console.log('Review not found');
    return;
  }

  const reviewData = review[0];
  console.log('Review Details:');
  console.log(`  ID: ${reviewData.id}`);
  console.log(`  Submission ID: ${reviewData.submissionId}`);
  console.log(`  Scout ID: ${reviewData.scoutId}`);
  console.log(`  Is Submitted: ${reviewData.isSubmitted}`);
  console.log(`  Updated At: ${reviewData.updatedAt}`);
  console.log('');

  // Check who submitted it
  const reviewer = await db
    .select()
    .from(users)
    .where(eq(users.id, reviewData.scoutId))
    .limit(1);

  if (reviewer.length > 0) {
    console.log(`Reviewer: ${reviewer[0].name} (${reviewer[0].id})`);
    console.log(`Is this BRIAN SCOUT 1? ${reviewer[0].id === scoutId ? 'YES' : 'NO'}`);
  }

  // Check what other scouts have notifications for this review
  console.log('\nChecking notifications for other scouts...');
  const { notifications } = await import('@shared/schema');
  const { and } = await import('drizzle-orm');

  const allNotifs = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.entityType, 'submission'),
        eq(notifications.entityId, submissionId),
        eq(notifications.type, 'review_submitted')
      )
    );

  console.log(`Found ${allNotifs.length} total notifications for this review`);
  
  for (const notif of allNotifs) {
    const notifUser = await db
      .select()
      .from(users)
      .where(eq(users.id, notif.userId))
      .limit(1);
    
    if (notifUser.length > 0) {
      console.log(`  ${notifUser[0].name}: Has notification (relatedUserId: ${notif.relatedUserId})`);
    }
  }

  // Check if BRIAN SCOUT 1 should have this notification
  const brianNotif = allNotifs.find(n => n.userId === scoutId);
  if (brianNotif) {
    console.log(`\n✅ BRIAN SCOUT 1 HAS a notification for this review`);
  } else {
    console.log(`\n❌ BRIAN SCOUT 1 does NOT have a notification for this review`);
    console.log(`Reason: ${reviewData.scoutId === scoutId ? 'They submitted the review themselves (expected - no self-notifications)' : 'Unknown'}`);
  }
}

checkReview().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
