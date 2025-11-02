import { db } from '../server/db';
import { users, submissions, submissionReviews, submissionFinalFeedback, notifications } from '@shared/schema';
import { eq, inArray, desc, and } from 'drizzle-orm';
import { storage } from '../server/storage';

/**
 * Investigate why a specific scout has no notifications
 */
async function investigateMissingScoutNotifications() {
  console.log('🔍 Investigating missing notifications for BRIAN SCOUT 1...\n');
  console.log('='.repeat(60));

  try {
    // Find BRIAN SCOUT 1
    const scout = await db
      .select()
      .from(users)
      .where(eq(users.id, 'd1ee2139-2d90-43b3-b022-57da8ee30bea'))
      .limit(1);

    if (scout.length === 0) {
      console.log('❌ Scout not found!');
      return;
    }

    const scoutInfo = scout[0];
    console.log(`👤 Scout: ${scoutInfo.name}`);
    console.log(`   ID: ${scoutInfo.id}`);
    console.log(`   Role: ${scoutInfo.role}`);
    console.log(`   Created: ${scoutInfo.createdAt}`);
    console.log(`   Email: ${scoutInfo.email}`);
    console.log('');

    // Check when scout was created vs when submissions/reviews happened
    const scoutCreatedAt = new Date(scoutInfo.createdAt);
    console.log(`📅 Scout created at: ${scoutCreatedAt.toISOString()}`);
    console.log('');

    // Get all submissions
    const allSubmissions = await db
      .select()
      .from(submissions)
      .orderBy(desc(submissions.createdAt));

    console.log(`📋 Total submissions in system: ${allSubmissions.length}`);
    
    const submissionsAfterScout = allSubmissions.filter(s => new Date(s.createdAt) >= scoutCreatedAt);
    const submissionsBeforeScout = allSubmissions.filter(s => new Date(s.createdAt) < scoutCreatedAt);
    
    console.log(`   Submissions before scout creation: ${submissionsBeforeScout.length}`);
    console.log(`   Submissions after scout creation: ${submissionsAfterScout.length}`);
    console.log('');

    // Get all submitted reviews
    const allReviews = await db
      .select()
      .from(submissionReviews)
      .where(eq(submissionReviews.isSubmitted, true))
      .orderBy(desc(submissionReviews.updatedAt));

    console.log(`📋 Total submitted reviews in system: ${allReviews.length}`);
    
    const reviewsAfterScout = allReviews.filter(r => new Date(r.updatedAt) >= scoutCreatedAt);
    const reviewsBeforeScout = allReviews.filter(r => new Date(r.updatedAt) < scoutCreatedAt);
    
    console.log(`   Reviews submitted before scout creation: ${reviewsBeforeScout.length}`);
    console.log(`   Reviews submitted after scout creation: ${reviewsAfterScout.length}`);
    console.log('');

    // Get all finalized submissions
    const allFinalized = await db
      .select({
        submissionId: submissionFinalFeedback.submissionId,
        publishedAt: submissionFinalFeedback.publishedAt,
      })
      .from(submissionFinalFeedback);

    console.log(`📋 Total finalized submissions in system: ${allFinalized.length}`);
    
    const finalizedAfterScout = allFinalized.filter(f => new Date(f.publishedAt) >= scoutCreatedAt);
    const finalizedBeforeScout = allFinalized.filter(f => new Date(f.publishedAt) < scoutCreatedAt);
    
    console.log(`   Finalized before scout creation: ${finalizedBeforeScout.length}`);
    console.log(`   Finalized after scout creation: ${finalizedAfterScout.length}`);
    console.log('');

    // Check if there should be notifications for submissions after scout creation
    if (submissionsAfterScout.length > 0) {
      console.log('🔍 Checking if notifications exist for submissions created AFTER scout:');
      for (const submission of submissionsAfterScout.slice(0, 5)) {
        const existingNotifs = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, scoutInfo.id),
              eq(notifications.entityType, 'submission'),
              eq(notifications.entityId, submission.id),
              eq(notifications.type, 'submission_created')
            )
          );

        const status = existingNotifs.length > 0 ? '✓' : '✗';
        console.log(`   ${status} Submission ${submission.id} (${submission.createdAt}) - ${existingNotifs.length} notifications`);
      }
      console.log('');
    }

    // Check what other scouts have for comparison
    console.log('📊 Comparison with other scouts:');
    const allScouts = await db
      .select()
      .from(users)
      .where(inArray(users.role, ['xen_scout', 'scout_admin']));

    const otherScouts = allScouts.filter(s => s.id !== scoutInfo.id).slice(0, 3);
    
    for (const otherScout of otherScouts) {
      const otherNotifs = await storage.getNotifications(otherScout.id, { limit: 5 });
      console.log(`   ${otherScout.name}: ${otherNotifs.length} notifications (showing first 5)`);
      
      // Check if they have notifications for recent submissions
      if (submissionsAfterScout.length > 0) {
        const testSubmission = submissionsAfterScout[0];
        const otherHasNotif = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, otherScout.id),
              eq(notifications.entityType, 'submission'),
              eq(notifications.entityId, testSubmission.id),
              eq(notifications.type, 'submission_created')
            )
          )
          .limit(1);
        
        console.log(`      Has notification for submission ${testSubmission.id}?: ${otherHasNotif.length > 0 ? 'YES' : 'NO'}`);
      }
    }
    console.log('');

    // Check if scout was active when notifications should have been created
    console.log('🕐 Timeline analysis:');
    if (submissionsAfterScout.length > 0) {
      console.log(`   ⚠️ There are ${submissionsAfterScout.length} submission(s) created AFTER this scout was created.`);
      console.log(`   These should have notifications for this scout.`);
      console.log(`   Checking why notifications are missing...`);
    } else {
      console.log(`   ℹ️ This scout was created after all submissions.`);
      console.log(`   That's why there are no submission_created notifications.`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Investigation completed!\n');

  } catch (error: any) {
    console.error('❌ Error:', error?.message || error);
    throw error;
  }
}

async function main() {
  try {
    await investigateMissingScoutNotifications();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('investigate-missing-scout-notifications.ts')) {
  main();
}

export { investigateMissingScoutNotifications };
