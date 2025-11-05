import { db } from '../server/db';
import { notifications, users, evaluationFormTemplates, evaluationSubmissions } from '@shared/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';

/**
 * Verification script to check that evaluation forms notifications were created
 */

async function verifyEvaluationFormsNotifications() {
  console.log('🔍 Verifying evaluation forms notifications...\n');
  console.log('='.repeat(60));

  try {
    // Check form_created notifications
    console.log('\n📋 Checking form_created notifications...');
    const formCreatedNotifications = await db
      .select({
        notification: notifications,
        user: {
          id: users.id,
          name: users.name,
          role: users.role,
        },
        form: {
          id: evaluationFormTemplates.id,
          name: evaluationFormTemplates.name,
        },
      })
      .from(notifications)
      .innerJoin(users, eq(notifications.userId, users.id))
      .leftJoin(evaluationFormTemplates, eq(notifications.entityId, evaluationFormTemplates.id))
      .where(
        and(
          eq(notifications.entityType, 'evaluation_form_template'),
          eq(notifications.type, 'form_created')
        )
      )
      .orderBy(desc(notifications.createdAt));

    console.log(`   Found ${formCreatedNotifications.length} form_created notification(s)`);
    
    // Group by form
    const formGroups = new Map<string, any[]>();
    formCreatedNotifications.forEach(notif => {
      const formId = notif.form?.id || 'unknown';
      if (!formGroups.has(formId)) {
        formGroups.set(formId, []);
      }
      formGroups.get(formId)!.push(notif);
    });

    formGroups.forEach((notifs, formId) => {
      const formName = notifs[0].form?.name || 'Unknown';
      const roles = new Set(notifs.map(n => n.user.role));
      console.log(`   📝 Form: "${formName}" (${formId})`);
      console.log(`      - Notifications: ${notifs.length}`);
      console.log(`      - Roles notified: ${Array.from(roles).join(', ')}`);
    });

    // Check form_submitted notifications
    console.log('\n📋 Checking form_submitted notifications...');
    const formSubmittedNotifications = await db
      .select({
        notification: notifications,
        user: {
          id: users.id,
          name: users.name,
          role: users.role,
        },
        submission: {
          id: evaluationSubmissions.id,
          submittedBy: evaluationSubmissions.submittedBy,
          studentName: evaluationSubmissions.studentName,
        },
        form: {
          id: evaluationFormTemplates.id,
          name: evaluationFormTemplates.name,
        },
      })
      .from(notifications)
      .innerJoin(users, eq(notifications.userId, users.id))
      .leftJoin(evaluationSubmissions, eq(notifications.entityId, evaluationSubmissions.id))
      .leftJoin(evaluationFormTemplates, eq(evaluationSubmissions.formTemplateId, evaluationFormTemplates.id))
      .where(
        and(
          eq(notifications.entityType, 'evaluation_form_submission'),
          eq(notifications.type, 'form_submitted')
        )
      )
      .orderBy(desc(notifications.createdAt));

    console.log(`   Found ${formSubmittedNotifications.length} form_submitted notification(s)`);
    
    // Group by submission
    const submissionGroups = new Map<string, any[]>();
    formSubmittedNotifications.forEach(notif => {
      const submissionId = notif.submission?.id || 'unknown';
      if (!submissionGroups.has(submissionId)) {
        submissionGroups.set(submissionId, []);
      }
      submissionGroups.get(submissionId)!.push(notif);
    });

    submissionGroups.forEach((notifs, submissionId) => {
      const formName = notifs[0].form?.name || 'Unknown';
      const studentName = notifs[0].submission?.studentName || 'N/A';
      const roles = new Set(notifs.map(n => n.user.role));
      const submitterId = notifs[0].submission?.submittedBy;
      const submitterNotified = notifs.some(n => n.user.id === submitterId);
      
      console.log(`   📝 Submission: ${submissionId}`);
      console.log(`      - Form: "${formName}"`);
      console.log(`      - Student: ${studentName}`);
      console.log(`      - Notifications: ${notifs.length}`);
      console.log(`      - Roles notified: ${Array.from(roles).join(', ')}`);
      console.log(`      - Submitter notified: ${submitterNotified ? '✅ Yes' : '❌ No'}`);
    });

    // Summary statistics
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Form Created Notifications: ${formCreatedNotifications.length}`);
    console.log(`   - Unique forms: ${formGroups.size}`);
    console.log(`✅ Form Submitted Notifications: ${formSubmittedNotifications.length}`);
    console.log(`   - Unique submissions: ${submissionGroups.size}`);
    
    // Check role distribution
    const formCreatedRoles = new Set(formCreatedNotifications.map(n => n.user.role));
    const formSubmittedRoles = new Set(formSubmittedNotifications.map(n => n.user.role));
    
    console.log(`\n📊 Role Distribution:`);
    console.log(`   Form Created - Roles: ${Array.from(formCreatedRoles).join(', ')}`);
    console.log(`   Form Submitted - Roles: ${Array.from(formSubmittedRoles).join(', ')}`);
    
    // Verify expected roles
    const expectedFormCreatedRoles = ['system_admin', 'scout_admin', 'xen_scout'];
    const expectedFormSubmittedRoles = ['system_admin', 'scout_admin', 'xen_scout'];
    
    const formCreatedHasExpected = expectedFormCreatedRoles.some(r => formCreatedRoles.has(r));
    const formSubmittedHasExpected = expectedFormSubmittedRoles.some(r => formSubmittedRoles.has(r));
    
    console.log(`\n✅ Verification Results:`);
    console.log(`   Form Created - Has expected roles: ${formCreatedHasExpected ? '✅' : '❌'}`);
    console.log(`   Form Submitted - Has expected roles: ${formSubmittedHasExpected ? '✅' : '❌'}`);
    
    if (formCreatedHasExpected && formSubmittedHasExpected) {
      console.log(`\n🎉 All notifications verified successfully!`);
    } else {
      console.log(`\n⚠️  Some expected roles may be missing.`);
    }
    
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Verification error:', error?.message || error);
    throw error;
  }
}

// Run verification
async function main() {
  try {
    await verifyEvaluationFormsNotifications();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

main();

