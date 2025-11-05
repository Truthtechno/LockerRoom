import { db } from '../server/db';
import { users, evaluationSubmissions, notifications, systemAdmins } from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * Verification script to check if form submission notifications exist
 * Checks recent submissions and their associated notifications
 */

async function verifyFormSubmissionNotifications() {
  console.log('🔍 Verifying Form Submission Notifications\n');
  console.log('='.repeat(70));

  try {
    // Get recent submissions (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    console.log('\n📋 Step 1: Finding recent form submissions...');
    const recentSubmissions = await db
      .select({
        submission: evaluationSubmissions,
        submitter: {
          id: users.id,
          name: users.name,
          role: users.role,
        },
      })
      .from(evaluationSubmissions)
      .innerJoin(users, eq(evaluationSubmissions.submittedBy, users.id))
      .where(
        and(
          eq(evaluationSubmissions.status, 'submitted'),
          gte(evaluationSubmissions.submittedAt || evaluationSubmissions.createdAt, oneDayAgo)
        )
      )
      .orderBy(desc(evaluationSubmissions.createdAt))
      .limit(10);

    console.log(`✅ Found ${recentSubmissions.length} recent submission(s)\n`);

    if (recentSubmissions.length === 0) {
      console.log('ℹ️ No recent submissions found. Please submit a form first.');
      return;
    }

    // Check notifications for each submission
    let totalNotifications = 0;
    let missingNotifications = 0;

    for (const { submission, submitter } of recentSubmissions) {
      console.log(`\n📋 Checking submission: ${submission.id}`);
      console.log(`   Submitted by: ${submitter.name} (${submitter.role})`);
      console.log(`   Student: ${submission.studentName || 'N/A'}`);
      console.log(`   Submitted at: ${submission.submittedAt || submission.createdAt}`);

      // Get notifications for this submission
      const submissionNotifications = await db
        .select({
          notification: notifications,
          recipient: {
            id: users.id,
            name: users.name,
            role: users.role,
          },
        })
        .from(notifications)
        .innerJoin(users, eq(notifications.userId, users.id))
        .where(
          and(
            eq(notifications.entityType, 'evaluation_form_submission'),
            eq(notifications.entityId, submission.id),
            eq(notifications.type, 'form_submitted')
          )
        )
        .orderBy(desc(notifications.createdAt));

      console.log(`   Notifications found: ${submissionNotifications.length}`);

      if (submissionNotifications.length > 0) {
        submissionNotifications.forEach((notif, index) => {
          console.log(`     ${index + 1}. ${notif.recipient.name} (${notif.recipient.role})`);
          console.log(`        Title: ${notif.notification.title}`);
          console.log(`        Created: ${notif.notification.createdAt}`);
          console.log(`        Read: ${notif.notification.isRead ? 'Yes' : 'No'}`);
        });
        totalNotifications += submissionNotifications.length;
      } else {
        console.log(`   ❌ No notifications found for this submission!`);
        missingNotifications++;

        // Check what recipients should have been notified
        console.log(`   🔍 Checking expected recipients...`);
        
        // Get system admins
        const systemAdminUsers = await db
          .select({ id: users.id, name: users.name, role: users.role })
          .from(users)
          .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
          .where(eq(users.role, 'system_admin'));
        
        // Get scout admins
        const scoutAdminUsers = await db
          .select()
          .from(users)
          .where(eq(users.role, 'scout_admin'));

        console.log(`      System admins: ${systemAdminUsers.length}`);
        console.log(`      Scout admins: ${scoutAdminUsers.length}`);
        
        if (systemAdminUsers.length === 0 && scoutAdminUsers.length === 0) {
          console.log(`      ⚠️ No system admins or scout admins found in system!`);
        } else {
          console.log(`      ❌ Expected ${systemAdminUsers.length + scoutAdminUsers.length} notification(s), but found 0`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n📊 Summary:');
    console.log(`   Total submissions checked: ${recentSubmissions.length}`);
    console.log(`   Total notifications found: ${totalNotifications}`);
    console.log(`   Submissions missing notifications: ${missingNotifications}`);

    if (missingNotifications > 0) {
      console.log('\n❌ ISSUE DETECTED: Some submissions are missing notifications!');
      console.log('   This indicates the notification system is not working correctly.');
      console.log('   Check server logs for errors when submissions were created.');
    } else if (totalNotifications === 0 && recentSubmissions.length > 0) {
      console.log('\n❌ ISSUE DETECTED: No notifications found for any submissions!');
      console.log('   The notification system may not be triggering at all.');
    } else {
      console.log('\n✅ All submissions have notifications!');
    }

  } catch (error: any) {
    console.error('\n❌ Error verifying notifications:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

// Run the verification
verifyFormSubmissionNotifications()
  .then(() => {
    console.log('\n✅ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });

