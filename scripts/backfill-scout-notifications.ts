import { db } from '../server/db';
import { submissions, users, students, notifications, submissionReviews, submissionFinalFeedback } from '@shared/schema';
import { eq, desc, inArray, sql, and } from 'drizzle-orm';
import { storage } from '../server/storage';
import { 
  notifyScoutsOfNewSubmission, 
  notifyScoutsOfSubmissionFinalized,
  notifyScoutsOfReviewUpdate 
} from '../server/utils/notification-helpers';

/**
 * Comprehensive backfill script to create notifications for:
 * 1. Past submissions (submission_created)
 * 2. Past submitted reviews (review_submitted)
 * 3. Past finalized submissions (submission_finalized)
 */

async function backfillScoutNotifications() {
  console.log('🔄 Starting comprehensive backfill: Scout notifications for all past events...\n');
  console.log('='.repeat(60));

  try {
    let stats = {
      submissionsProcessed: 0,
      submissionsSkipped: 0,
      reviewsProcessed: 0,
      reviewsSkipped: 0,
      finalizationsProcessed: 0,
      finalizationsSkipped: 0,
    };

    // ==========================================
    // STEP 1: Backfill submission_created notifications
    // ==========================================
    console.log('\n📋 Step 1: Backfilling submission_created notifications...');
    const allSubmissions = await db
      .select()
      .from(submissions)
      .orderBy(desc(submissions.createdAt));

    console.log(`   Found ${allSubmissions.length} submission(s) to process`);

    for (const submission of allSubmissions) {
      try {
        if (!submission.studentId) {
          stats.submissionsSkipped++;
          continue;
        }

        // Check if notification already exists
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
          await notifyScoutsOfNewSubmission(submission.id, submission.studentId);
          stats.submissionsProcessed++;
        } else {
          stats.submissionsSkipped++;
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing submission ${submission.id}:`, error?.message || error);
      }
    }

    console.log(`   ✅ Processed ${stats.submissionsProcessed} new notifications, skipped ${stats.submissionsSkipped} existing`);

    // ==========================================
    // STEP 2: Backfill review_submitted notifications
    // ==========================================
    console.log('\n📋 Step 2: Backfilling review_submitted notifications...');
    const allSubmittedReviews = await db
      .select()
      .from(submissionReviews)
      .where(eq(submissionReviews.isSubmitted, true))
      .orderBy(desc(submissionReviews.updatedAt));

    console.log(`   Found ${allSubmittedReviews.length} submitted review(s) to process`);

    for (const review of allSubmittedReviews) {
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
          await notifyScoutsOfReviewUpdate(review.submissionId, review.scoutId, true);
          stats.reviewsProcessed++;
        } else {
          stats.reviewsSkipped++;
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing review ${review.id}:`, error?.message || error);
      }
    }

    console.log(`   ✅ Processed ${stats.reviewsProcessed} new notifications, skipped ${stats.reviewsSkipped} existing`);

    // ==========================================
    // STEP 3: Backfill submission_finalized notifications
    // ==========================================
    console.log('\n📋 Step 3: Backfilling submission_finalized notifications...');
    
    // Get all finalized submissions (those with final feedback)
    const finalizedSubmissions = await db
      .select({
        submissionId: submissionFinalFeedback.submissionId,
      })
      .from(submissionFinalFeedback)
      .groupBy(submissionFinalFeedback.submissionId);

    console.log(`   Found ${finalizedSubmissions.length} finalized submission(s) to process`);

    for (const { submissionId } of finalizedSubmissions) {
      try {
        // Check if notification already exists
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
          await notifyScoutsOfSubmissionFinalized(submissionId);
          stats.finalizationsProcessed++;
        } else {
          stats.finalizationsSkipped++;
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing finalized submission ${submissionId}:`, error?.message || error);
      }
    }

    console.log(`   ✅ Processed ${stats.finalizationsProcessed} new notifications, skipped ${stats.finalizationsSkipped} existing`);

    // ==========================================
    // Summary
    // ==========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary:');
    console.log(`   Submissions Created: ${stats.submissionsProcessed} (${stats.submissionsSkipped} skipped)`);
    console.log(`   Reviews Created: ${stats.reviewsProcessed} (${stats.reviewsSkipped} skipped)`);
    console.log(`   Finalizations Created: ${stats.finalizationsProcessed} (${stats.finalizationsSkipped} skipped)`);
    console.log(`   Total New Notifications: ${stats.submissionsProcessed + stats.reviewsProcessed + stats.finalizationsProcessed}`);
    console.log('='.repeat(60));
    console.log('\n✅ Comprehensive backfill completed!\n');

  } catch (error: any) {
    console.error('❌ Backfill error:', error?.message || error);
    throw error;
  }
}

async function main() {
  try {
    await backfillScoutNotifications();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('backfill-scout-notifications.ts')) {
  main();
}

export { backfillScoutNotifications };

