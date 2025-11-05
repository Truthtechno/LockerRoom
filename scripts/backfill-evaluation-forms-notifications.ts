import { db } from '../server/db';
import { evaluationFormTemplates, evaluationSubmissions, users, notifications } from '@shared/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { storage } from '../server/storage';
import { notifyFormCreated, notifyFormSubmitted } from '../server/utils/notification-helpers';

/**
 * Comprehensive backfill script to create notifications for:
 * 1. Past form templates (form_created) - notify system admin, scout admin, and xen scouts
 * 2. Past form submissions (form_submitted) - notify scout admin, system admin, and the xen scout who submitted
 */

async function backfillEvaluationFormsNotifications() {
  console.log('🔄 Starting comprehensive backfill: Evaluation Forms notifications for all past events...\n');
  console.log('='.repeat(60));

  try {
    let stats = {
      formsProcessed: 0,
      formsSkipped: 0,
      submissionsProcessed: 0,
      submissionsSkipped: 0,
    };

    // ==========================================
    // STEP 1: Backfill form_created notifications
    // ==========================================
    console.log('\n📋 Step 1: Backfilling form_created notifications...');
    const allForms = await db
      .select()
      .from(evaluationFormTemplates)
      .orderBy(desc(evaluationFormTemplates.createdAt));

    console.log(`   Found ${allForms.length} form template(s) to process`);

    for (const form of allForms) {
      try {
        // Check if notification already exists for this form
        const existingNotifs = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.entityType, 'evaluation_form_template'),
              eq(notifications.entityId, form.id),
              eq(notifications.type, 'form_created')
            )
          )
          .limit(1);

        if (existingNotifs.length === 0) {
          // Get the creator user info
          const creatorUser = await storage.getUser(form.createdBy);
          if (creatorUser) {
            await notifyFormCreated(form.id, form.name, form.createdBy);
            stats.formsProcessed++;
            console.log(`   ✅ Processed form: ${form.name} (${form.id})`);
          } else {
            console.log(`   ⚠️  Creator ${form.createdBy} not found for form ${form.id}, skipping`);
            stats.formsSkipped++;
          }
        } else {
          stats.formsSkipped++;
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing form ${form.id}:`, error?.message || error);
        stats.formsSkipped++;
      }
    }

    console.log(`   ✅ Processed ${stats.formsProcessed} new form notifications, skipped ${stats.formsSkipped} existing`);

    // ==========================================
    // STEP 2: Backfill form_submitted notifications
    // ==========================================
    console.log('\n📋 Step 2: Backfilling form_submitted notifications...');
    const allSubmissions = await db
      .select()
      .from(evaluationSubmissions)
      .where(eq(evaluationSubmissions.status, 'submitted'))
      .orderBy(desc(evaluationSubmissions.createdAt));

    console.log(`   Found ${allSubmissions.length} submitted form submission(s) to process`);

    for (const submission of allSubmissions) {
      try {
        // Only process submissions by xen_scouts
        const submitterUser = await storage.getUser(submission.submittedBy);
        if (!submitterUser || submitterUser.role !== 'xen_scout') {
          stats.submissionsSkipped++;
          continue;
        }

        // Check if notification already exists for this submission
        const existingNotifs = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.entityType, 'evaluation_form_submission'),
              eq(notifications.entityId, submission.id),
              eq(notifications.type, 'form_submitted')
            )
          )
          .limit(1);

        if (existingNotifs.length === 0) {
          // Get form template info
          const formTemplate = await storage.getEvaluationFormTemplate(submission.formTemplateId);
          if (formTemplate) {
            await notifyFormSubmitted(
              submission.id,
              submission.formTemplateId,
              formTemplate.name,
              submission.submittedBy,
              submitterUser.name,
              submission.studentName || null
            );
            stats.submissionsProcessed++;
            console.log(`   ✅ Processed submission: ${submission.id} for form "${formTemplate.name}"`);
          } else {
            console.log(`   ⚠️  Form template ${submission.formTemplateId} not found for submission ${submission.id}, skipping`);
            stats.submissionsSkipped++;
          }
        } else {
          stats.submissionsSkipped++;
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing submission ${submission.id}:`, error?.message || error);
        stats.submissionsSkipped++;
      }
    }

    console.log(`   ✅ Processed ${stats.submissionsProcessed} new submission notifications, skipped ${stats.submissionsSkipped} existing`);

    // ==========================================
    // FINAL SUMMARY
    // ==========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKFILL SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Form Templates:`);
    console.log(`   - Processed: ${stats.formsProcessed}`);
    console.log(`   - Skipped: ${stats.formsSkipped}`);
    console.log(`✅ Form Submissions:`);
    console.log(`   - Processed: ${stats.submissionsProcessed}`);
    console.log(`   - Skipped: ${stats.submissionsSkipped}`);
    console.log(`\n🎉 Backfill completed successfully!`);
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Fatal error during backfill:', error?.message || error);
    throw error;
  }
}

// Run the backfill if this script is executed directly
async function main() {
  try {
    await backfillEvaluationFormsNotifications();
    console.log('\n✅ Backfill script completed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Backfill script failed:', error);
    process.exit(1);
  }
}

main();

export { backfillEvaluationFormsNotifications };

