import { db } from '../server/db';
import { submissions, users, students, notifications, submissionReviews, submissionFinalFeedback } from '@shared/schema';
import { eq, desc, inArray, sql, and, gt } from 'drizzle-orm';
import { storage } from '../server/storage';
import { 
  notifyScoutsOfNewSubmission, 
  notifyScoutsOfSubmissionFinalized,
  notifyScoutsOfReviewUpdate 
} from '../server/utils/notification-helpers';

/**
 * Ensure all recent xen scout notifications are created
 * This script will check for any recent activity (last 7 days) and create notifications if missing
 */
async function ensureRecentScoutNotifications() {
  console.log('🔄 Ensuring all recent scout notifications are created...\n');
  console.log('='.repeat(60));

  try {
    // Get date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    let stats = {
      submissionsProcessed: 0,
      submissionsCreated: 0,
      reviewsProcessed: 0,
      reviewsCreated: 0,
      finalizationsProcessed: 0,
      finalizationsCreated: 0,
    };

    // ==========================================
    // STEP 1: Check recent submission_created notifications
    // ==========================================
    console.log('\n📋 Step 1: Checking recent submissions (last 7 days)...');
    const recentSubmissions = await db
      .select()
      .from(submissions)
      .where(sql`${submissions.createdAt} >= ${sevenDaysAgo}`)
      .orderBy(desc(submissions.createdAt));

    console.log(`   Found ${recentSubmissions.length} recent submission(s) to check`);

    for (const submission of recentSubmissions) {
      try {
        if (!submission.studentId) {
          stats.submissionsProcessed++;
          continue;
        }

        // Check if notification already exists for at least one scout
        const existingNotifs = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.entityType, 'submission'),
              eq(notifications.entityId, submission.id),
              eq(notifications.type, 'submission_created')
            )
          )
          .limit(1);

        if (existingNotifs.length === 0) {
          console.log(`   ⚠️ Missing notifications for submission ${submission.id}, creating...`);
          await notifyScoutsOfNewSubmission(submission.id, submission.studentId);
          stats.submissionsCreated++;
        }
        stats.submissionsProcessed++;
      } catch (error: any) {
        console.error(`   ❌ Error processing submission ${submission.id}:`, error?.message || error);
      }
    }

    console.log(`   ✅ Processed ${stats.submissionsProcessed} submissions, created ${stats.submissionsCreated} notification sets`);

    // ==========================================
    // STEP 2: Check recent review_submitted notifications
    // ==========================================
    console.log('\n📋 Step 2: Checking recent submitted reviews (last 7 days)...');
    const recentSubmittedReviews = await db
      .select()
      .from(submissionReviews)
      .where(
        and(
          eq(submissionReviews.isSubmitted, true),
          sql`${submissionReviews.updatedAt} >= ${sevenDaysAgo}`
        )
      )
      .orderBy(desc(submissionReviews.updatedAt));

    console.log(`   Found ${recentSubmittedReviews.length} recent submitted review(s) to check`);

    for (const review of recentSubmittedReviews) {
      try {
        // Check if notification already exists for this review
        const existingNotifs = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.entityType, 'submission'),
              eq(notifications.entityId, review.submissionId),
              eq(notifications.type, 'review_submitted'),
              eq(notifications.relatedUserId, review.scoutId)
            )
          )
          .limit(1);

        if (existingNotifs.length === 0) {
          console.log(`   ⚠️ Missing notification for review ${review.id}, creating...`);
          await notifyScoutsOfReviewUpdate(review.submissionId, review.scoutId, true);
          stats.reviewsCreated++;
        }
        stats.reviewsProcessed++;
      } catch (error: any) {
        console.error(`   ❌ Error processing review ${review.id}:`, error?.message || error);
      }
    }

    console.log(`   ✅ Processed ${stats.reviewsProcessed} reviews, created ${stats.reviewsCreated} notification sets`);

    // ==========================================
    // STEP 3: Check recent submission_finalized notifications
    // ==========================================
    console.log('\n📋 Step 3: Checking recent finalized submissions (last 7 days)...');
    
    // Get all finalized submissions with recent final feedback
    const recentFinalizedSubmissions = await db
      .select({
        submissionId: submissionFinalFeedback.submissionId,
        publishedAt: submissionFinalFeedback.publishedAt,
      })
      .from(submissionFinalFeedback)
      .where(sql`${submissionFinalFeedback.publishedAt} >= ${sevenDaysAgo}`)
      .orderBy(desc(submissionFinalFeedback.publishedAt));

    console.log(`   Found ${recentFinalizedSubmissions.length} recent finalized submission(s) to check`);

    for (const { submissionId } of recentFinalizedSubmissions) {
      try {
        // Check if notification already exists for at least one scout
        const existingNotifs = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.entityType, 'submission'),
              eq(notifications.entityId, submissionId),
              eq(notifications.type, 'submission_finalized')
            )
          )
          .limit(1);

        if (existingNotifs.length === 0) {
          console.log(`   ⚠️ Missing notifications for finalized submission ${submissionId}, creating...`);
          await notifyScoutsOfSubmissionFinalized(submissionId);
          stats.finalizationsCreated++;
        }
        stats.finalizationsProcessed++;
      } catch (error: any) {
        console.error(`   ❌ Error processing finalized submission ${submissionId}:`, error?.message || error);
      }
    }

    console.log(`   ✅ Processed ${stats.finalizationsProcessed} finalizations, created ${stats.finalizationsCreated} notification sets`);

    // ==========================================
    // Summary
    // ==========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Submissions Checked: ${stats.submissionsProcessed} (${stats.submissionsCreated} new notification sets created)`);
    console.log(`   Reviews Checked: ${stats.reviewsProcessed} (${stats.reviewsCreated} new notification sets created)`);
    console.log(`   Finalizations Checked: ${stats.finalizationsProcessed} (${stats.finalizationsCreated} new notification sets created)`);
    const totalCreated = stats.submissionsCreated + stats.reviewsCreated + stats.finalizationsCreated;
    console.log(`   Total New Notification Sets: ${totalCreated}`);
    
    if (totalCreated > 0) {
      // Estimate total notifications created (each set creates notifications for all scouts)
      const scouts = await db
        .select()
        .from(users)
        .where(inArray(users.role, ['xen_scout', 'scout_admin']));
      const estimatedTotal = totalCreated * scouts.length;
      console.log(`   Estimated Total Notifications: ~${estimatedTotal} (${scouts.length} scouts × ${totalCreated} sets)`);
    }
    
    console.log('='.repeat(60));
    console.log('\n✅ Recent notifications check completed!\n');

  } catch (error: any) {
    console.error('❌ Error:', error?.message || error);
    throw error;
  }
}

async function main() {
  try {
    await ensureRecentScoutNotifications();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('ensure-recent-scout-notifications.ts')) {
  main();
}

export { ensureRecentScoutNotifications };
