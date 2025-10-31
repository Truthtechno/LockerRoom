import { db } from '../server/db';
import { submissions, notifications, submissionFinalFeedback } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { 
  notifyStudentOfSubmission,
  notifyStudentOfSubmissionFeedback
} from '../server/utils/notification-helpers';

/**
 * Backfill script to create notifications for students' past XEN Watch submissions
 */

async function backfillStudentSubmissionNotifications() {
  console.log('🔄 Starting backfill: Student submission notifications for past submissions...\n');
  console.log('='.repeat(60));

  try {
    let stats = {
      submissionReceivedProcessed: 0,
      submissionReceivedSkipped: 0,
      feedbackReadyProcessed: 0,
      feedbackReadySkipped: 0,
    };

    // ==========================================
    // STEP 1: Backfill submission_received notifications
    // ==========================================
    console.log('\n📋 Step 1: Backfilling submission_received notifications...');
    const allSubmissions = await db
      .select()
      .from(submissions)
      .orderBy(desc(submissions.createdAt));

    console.log(`   Found ${allSubmissions.length} submission(s) to process`);

    for (const submission of allSubmissions) {
      try {
        if (!submission.studentId) {
          stats.submissionReceivedSkipped++;
          continue;
        }

        // Check if notification already exists
        const existingNotifs = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, submission.studentId),
              eq(notifications.entityType, 'submission'),
              eq(notifications.entityId, submission.id),
              eq(notifications.type, 'submission_received')
            )
          )
          .limit(1);

        if (existingNotifs.length === 0) {
          await notifyStudentOfSubmission(submission.id, submission.studentId);
          stats.submissionReceivedProcessed++;
        } else {
          stats.submissionReceivedSkipped++;
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing submission ${submission.id}:`, error?.message || error);
      }
    }

    console.log(`   ✅ Processed ${stats.submissionReceivedProcessed} new notifications, skipped ${stats.submissionReceivedSkipped} existing`);

    // ==========================================
    // STEP 2: Backfill submission_feedback_ready notifications
    // ==========================================
    console.log('\n📋 Step 2: Backfilling submission_feedback_ready notifications...');
    
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
        // Get the submission to find the student
        const [submission] = await db
          .select()
          .from(submissions)
          .where(eq(submissions.id, submissionId))
          .limit(1);

        if (!submission || !submission.studentId) {
          stats.feedbackReadySkipped++;
          continue;
        }

        // Check if notification already exists
        const existingNotifs = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, submission.studentId),
              eq(notifications.entityType, 'submission'),
              eq(notifications.entityId, submissionId),
              eq(notifications.type, 'submission_feedback_ready')
            )
          )
          .limit(1);

        if (existingNotifs.length === 0) {
          await notifyStudentOfSubmissionFeedback(submissionId, submission.studentId);
          stats.feedbackReadyProcessed++;
        } else {
          stats.feedbackReadySkipped++;
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing finalized submission ${submissionId}:`, error?.message || error);
      }
    }

    console.log(`   ✅ Processed ${stats.feedbackReadyProcessed} new notifications, skipped ${stats.feedbackReadySkipped} existing`);

    // ==========================================
    // Summary
    // ==========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary:');
    console.log(`   Submission Received: ${stats.submissionReceivedProcessed} (${stats.submissionReceivedSkipped} skipped)`);
    console.log(`   Feedback Ready: ${stats.feedbackReadyProcessed} (${stats.feedbackReadySkipped} skipped)`);
    console.log(`   Total New Notifications: ${stats.submissionReceivedProcessed + stats.feedbackReadyProcessed}`);
    console.log('='.repeat(60));
    console.log('\n✅ Student submission notification backfill completed!\n');

  } catch (error: any) {
    console.error('❌ Backfill error:', error?.message || error);
    throw error;
  }
}

async function main() {
  try {
    await backfillStudentSubmissionNotifications();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('backfill-student-submission-notifications.ts')) {
  main();
}

export { backfillStudentSubmissionNotifications };

