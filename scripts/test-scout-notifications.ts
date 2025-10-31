import { db } from '../server/db';
import { users, submissions, students, submissionReviews, notifications } from '@shared/schema';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import { storage } from '../server/storage';
import { 
  notifyScoutsOfNewSubmission, 
  notifyScoutsOfReviewUpdate, 
  notifyScoutsOfSubmissionFinalized,
  notifyScoutAdminsOfNewScout 
} from '../server/utils/notification-helpers';

/**
 * Comprehensive test script for scout and scout admin notifications
 */

async function testScoutNotifications() {
  console.log('🧪 Testing Scout & Scout Admin Notifications...\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Find scouts and scout admins
    console.log('\n📋 Step 1: Finding scouts and scout admins...');
    const scouts = await db
      .select()
      .from(users)
      .where(inArray(users.role, ['xen_scout', 'scout_admin']));

    console.log(`✅ Found ${scouts.length} scout(s) and scout admin(s):`);
    scouts.forEach((scout, idx) => {
      console.log(`   ${idx + 1}. ${scout.name} (${scout.role}) - ${scout.id}`);
    });

    if (scouts.length === 0) {
      console.log('\n⚠️  No scouts found. Cannot test notifications.');
      return;
    }

    const scoutAdmins = scouts.filter(s => s.role === 'scout_admin');
    const xenScouts = scouts.filter(s => s.role === 'xen_scout');

    console.log(`\n   Scout Admins: ${scoutAdmins.length}`);
    console.log(`   XEN Scouts: ${xenScouts.length}`);

    // Step 2: Find a student with a submission
    console.log('\n📋 Step 2: Finding student submissions...');
    const recentSubmissions = await db
      .select()
      .from(submissions)
      .orderBy(desc(submissions.createdAt))
      .limit(5);

    console.log(`✅ Found ${recentSubmissions.length} recent submission(s):`);
    recentSubmissions.forEach((sub, idx) => {
      console.log(`   ${idx + 1}. Submission ${sub.id} - Status: ${sub.status} - Student: ${sub.studentId}`);
    });

    // Step 3: Test notification types
    console.log('\n📋 Step 3: Testing Notification Creation...\n');

    // Test 1: New submission notification
    if (recentSubmissions.length > 0) {
      const testSubmission = recentSubmissions[0];
      console.log('Test 1: Notifying scouts of new submission...');
      try {
        await notifyScoutsOfNewSubmission(testSubmission.id, testSubmission.studentId);
        console.log('   ✅ Test 1 passed\n');
      } catch (e: any) {
        console.error(`   ❌ Test 1 failed: ${e.message}\n`);
      }
    }

    // Test 2: Review submitted notification
    if (recentSubmissions.length > 0 && scouts.length > 0) {
      const testSubmission = recentSubmissions[0];
      const testScout = scouts[0];
      console.log('Test 2: Notifying scouts of review submission...');
      try {
        await notifyScoutsOfReviewUpdate(testSubmission.id, testScout.id, true);
        console.log('   ✅ Test 2 passed\n');
      } catch (e: any) {
        console.error(`   ❌ Test 2 failed: ${e.message}\n`);
      }
    }

    // Test 3: Submission finalized notification
    if (recentSubmissions.length > 0) {
      const testSubmission = recentSubmissions[0];
      console.log('Test 3: Notifying scouts of submission finalization...');
      try {
        await notifyScoutsOfSubmissionFinalized(testSubmission.id);
        console.log('   ✅ Test 3 passed\n');
      } catch (e: any) {
        console.error(`   ❌ Test 3 failed: ${e.message}\n`);
      }
    }

    // Test 4: New scout created notification
    if (scoutAdmins.length > 0 && xenScouts.length > 0) {
      const testScout = xenScouts[0];
      console.log('Test 4: Notifying scout admins of new scout...');
      try {
        await notifyScoutAdminsOfNewScout(testScout.id, testScout.name || 'Test Scout');
        console.log('   ✅ Test 4 passed\n');
      } catch (e: any) {
        console.error(`   ❌ Test 4 failed: ${e.message}\n`);
      }
    }

    // Step 4: Check notifications for each scout
    console.log('\n📋 Step 4: Checking notifications for scouts...');
    for (const scout of scouts.slice(0, 5)) {
      const scoutNotifications = await storage.getNotifications(scout.id, { limit: 20 });
      
      // Filter for scout-related notifications
      const scoutRelatedNotifs = scoutNotifications.filter(n => 
        ['submission_created', 'review_submitted', 'submission_finalized', 'scout_created'].includes(n.type)
      );

      console.log(`\n   ${scout.name} (${scout.role}):`);
      console.log(`      Total notifications: ${scoutNotifications.length}`);
      console.log(`      Scout-related: ${scoutRelatedNotifs.length}`);
      
      if (scoutRelatedNotifs.length > 0) {
        scoutRelatedNotifs.slice(0, 5).forEach((notif, idx) => {
          console.log(`      ${idx + 1}. [${notif.type}] ${notif.title}`);
          console.log(`         ${notif.message}`);
          console.log(`         Read: ${notif.isRead} | Created: ${notif.createdAt}`);
        });
      }
    }

    // Step 5: Verify notification types exist
    console.log('\n📋 Step 5: Verifying notification types in database...');
    const allScoutNotifications = await db
      .select()
      .from(notifications)
      .where(
        inArray(notifications.type, ['submission_created', 'review_submitted', 'submission_finalized', 'scout_created'])
      )
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    console.log(`✅ Found ${allScoutNotifications.length} scout-related notifications:`);
    const typeCounts: Record<string, number> = {};
    allScoutNotifications.forEach(notif => {
      typeCounts[notif.type] = (typeCounts[notif.type] || 0) + 1;
    });
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Scout notification tests complete!\n');

  } catch (error: any) {
    console.error('❌ Test error:', error?.message || error);
    console.error(error);
  }
}

async function main() {
  await testScoutNotifications();
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('test-scout-notifications.ts')) {
  main();
}

export { testScoutNotifications };

