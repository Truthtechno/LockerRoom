import { db } from '../server/db';
import { users, submissions, students, notifications } from '@shared/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { storage } from '../server/storage';

/**
 * Test script to verify student notifications are working
 * Specifically checks Diego's notifications
 */

async function testStudentNotifications() {
  console.log('🧪 Testing Student Submission Notifications...\n');
  console.log('='.repeat(60));

  try {
    // Find Diego (student who has submissions)
    console.log('\n📋 Step 1: Finding Diego (student with submissions)...');
    const diegoSubmissions = await db
      .select()
      .from(submissions)
      .where(eq(submissions.studentId, '77554460-06da-48d3-9447-5ce416ff66c8'))
      .orderBy(desc(submissions.createdAt))
      .limit(1);

    if (diegoSubmissions.length === 0) {
      console.log('⚠️  No submissions found for Diego');
      return;
    }

    const diegoUserId = diegoSubmissions[0].studentId;
    console.log(`✅ Found Diego's submissions. User ID: ${diegoUserId}`);

    // Get Diego's user info
    const [diegoUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, diegoUserId))
      .limit(1);

    if (diegoUser) {
      console.log(`   Name: ${diegoUser.name || 'N/A'}`);
      console.log(`   Email: ${diegoUser.email || 'N/A'}`);
    }

    // Get Diego's student profile
    const [diegoStudent] = await db
      .select()
      .from(students)
      .where(eq(students.userId, diegoUserId))
      .limit(1);

    if (diegoStudent) {
      console.log(`   Student Name: ${diegoStudent.name}`);
    }

    // Check Diego's notifications
    console.log('\n📋 Step 2: Checking Diego\'s notifications...');
    const diegoNotifications = await storage.getNotifications(diegoUserId, { limit: 50 });
    
    console.log(`\n   Total notifications: ${diegoNotifications.length}`);
    
    // Filter for submission-related notifications
    const submissionNotifs = diegoNotifications.filter(n => 
      ['submission_received', 'submission_feedback_ready'].includes(n.type)
    );

    console.log(`   Submission-related notifications: ${submissionNotifs.length}`);
    
    if (submissionNotifs.length > 0) {
      console.log('\n   Submission Notifications:');
      submissionNotifs.forEach((notif, idx) => {
        console.log(`   ${idx + 1}. [${notif.type}] ${notif.title}`);
        console.log(`      ${notif.message}`);
        console.log(`      Submission ID: ${notif.entityId}`);
        console.log(`      Read: ${notif.isRead} | Created: ${notif.createdAt}`);
      });
    } else {
      console.log('\n   ⚠️  No submission-related notifications found for Diego');
    }

    // Check submission count vs notification count
    console.log('\n📋 Step 3: Verifying notification coverage...');
    const allDiegoSubmissions = await db
      .select()
      .from(submissions)
      .where(eq(submissions.studentId, diegoUserId));

    console.log(`   Total submissions: ${allDiegoSubmissions.length}`);
    
    const submissionReceivedNotifs = submissionNotifs.filter(n => n.type === 'submission_received');
    const feedbackReadyNotifs = submissionNotifs.filter(n => n.type === 'submission_feedback_ready');

    console.log(`   "Submission Received" notifications: ${submissionReceivedNotifs.length}`);
    console.log(`   "Feedback Ready" notifications: ${feedbackReadyNotifs.length}`);

    // Get finalized submissions count
    const finalizedSubmissions = allDiegoSubmissions.filter(s => s.status === 'finalized');
    console.log(`   Finalized submissions: ${finalizedSubmissions.length}`);

    if (submissionReceivedNotifs.length === allDiegoSubmissions.length) {
      console.log('   ✅ All submissions have "Submission Received" notifications');
    } else {
      console.log(`   ⚠️  Missing ${allDiegoSubmissions.length - submissionReceivedNotifs.length} "Submission Received" notifications`);
    }

    if (feedbackReadyNotifs.length === finalizedSubmissions.length) {
      console.log('   ✅ All finalized submissions have "Feedback Ready" notifications');
    } else {
      console.log(`   ⚠️  Missing ${finalizedSubmissions.length - feedbackReadyNotifs.length} "Feedback Ready" notifications`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Student notification test complete!\n');

  } catch (error: any) {
    console.error('❌ Test error:', error?.message || error);
    console.error(error);
  }
}

async function main() {
  await testStudentNotifications();
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('test-student-notifications.ts')) {
  main();
}

export { testStudentNotifications };

