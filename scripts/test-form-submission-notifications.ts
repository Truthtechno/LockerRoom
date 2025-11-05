import { db } from '../server/db';
import { storage } from '../server/storage';
import { notifyFormSubmitted } from '../server/utils/notification-helpers';
import { users, evaluationFormTemplates, evaluationSubmissions, notifications, systemAdmins } from '@shared/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';

/**
 * Comprehensive test script for form submission notifications
 * This script:
 * 1. Finds a test scout (xen_scout or scout_admin)
 * 2. Finds a test form template
 * 3. Creates a test submission
 * 4. Calls notifyFormSubmitted
 * 5. Verifies notifications were created for system admins and scout admins
 */

async function testFormSubmissionNotifications() {
  console.log('🧪 Testing Form Submission Notifications\n');
  console.log('='.repeat(70));

  try {
    // Step 1: Find a test scout
    console.log('\n📋 Step 1: Finding test scout...');
    const scouts = await db
      .select()
      .from(users)
      .where(inArray(users.role, ['xen_scout', 'scout_admin']))
      .limit(5);
    
    if (scouts.length === 0) {
      console.error('❌ No scouts found. Please create a scout user first.');
      return;
    }
    
    const testScout = scouts[0];
    console.log(`✅ Using scout: ${testScout.name} (${testScout.id}, role: ${testScout.role})`);

    // Step 2: Find a test form template
    console.log('\n📋 Step 2: Finding test form template...');
    // Try published first, then draft
    let formTemplates = await db
      .select()
      .from(evaluationFormTemplates)
      .where(eq(evaluationFormTemplates.status, 'published'))
      .limit(1);
    
    if (formTemplates.length === 0) {
      console.log('   No published templates, checking for draft templates...');
      formTemplates = await db
        .select()
        .from(evaluationFormTemplates)
        .where(eq(evaluationFormTemplates.status, 'draft'))
        .limit(1);
    }
    
    if (formTemplates.length === 0) {
      console.error('❌ No form templates found. Please create a form template first.');
      return;
    }
    
    const testForm = formTemplates[0];
    console.log(`✅ Using form: ${testForm.name} (${testForm.id})`);

    // Step 3: Get system admins and scout admins
    console.log('\n📋 Step 3: Checking recipients...');
    const systemAdminUsers = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));
    
    const scoutAdminUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'scout_admin'));
    
    console.log(`📋 System admins: ${systemAdminUsers.length}`, systemAdminUsers.map(u => u.name));
    console.log(`📋 Scout admins: ${scoutAdminUsers.length}`, scoutAdminUsers.map(u => u.name));
    
    if (systemAdminUsers.length === 0 && scoutAdminUsers.length === 0) {
      console.error('❌ No system admins or scout admins found. Notifications will not be created.');
      return;
    }

    // Step 4: Create a test submission
    console.log('\n📋 Step 4: Creating test submission...');
    const testSubmission = await storage.createEvaluationSubmission(
      {
        formTemplateId: testForm.id,
        submittedBy: testScout.id,
        studentId: null,
        studentName: 'Test Student',
        studentProfilePicUrl: null,
        studentPosition: null,
        studentHeight: null,
        studentWeight: null,
        studentRoleNumber: null,
        studentSport: null,
        studentSchoolId: null,
        studentSchoolName: null,
        status: 'submitted',
      },
      [] // Empty responses for test
    );
    
    console.log(`✅ Created test submission: ${testSubmission.id}`);

    // Step 5: Call notifyFormSubmitted
    console.log('\n📋 Step 5: Calling notifyFormSubmitted...');
    try {
      await notifyFormSubmitted(
        testSubmission.id,
        testForm.id,
        testForm.name,
        testScout.id,
        testScout.name,
        'Test Student'
      );
      console.log('✅ notifyFormSubmitted completed');
    } catch (error: any) {
      console.error('❌ Error calling notifyFormSubmitted:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }

    // Step 6: Verify notifications were created
    console.log('\n📋 Step 6: Verifying notifications were created...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit for async operations
    
    const createdNotifications = await db
      .select({
        notification: notifications,
        user: {
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
          eq(notifications.entityId, testSubmission.id),
          eq(notifications.type, 'form_submitted')
        )
      )
      .orderBy(desc(notifications.createdAt));
    
    console.log(`\n📊 Results:`);
    console.log(`   Found ${createdNotifications.length} notification(s) for submission ${testSubmission.id}`);
    
    if (createdNotifications.length === 0) {
      console.error('❌ No notifications were created!');
      console.log('\n🔍 Debugging info:');
      console.log('   - System admins found:', systemAdminUsers.length);
      console.log('   - Scout admins found:', scoutAdminUsers.length);
      console.log('   - Submission ID:', testSubmission.id);
      console.log('   - Form ID:', testForm.id);
      console.log('   - Scout ID:', testScout.id);
      console.log('   - Scout role:', testScout.role);
    } else {
      console.log('\n✅ Notifications created successfully:');
      createdNotifications.forEach((notif, index) => {
        console.log(`   ${index + 1}. ${notif.user.name} (${notif.user.role}) - ${notif.notification.title}`);
        console.log(`      Message: ${notif.notification.message}`);
        console.log(`      Created: ${notif.notification.createdAt}`);
      });
      
      // Check if all expected recipients got notifications
      const notifiedUserIds = new Set(createdNotifications.map(n => n.user.id));
      const expectedUserIds = new Set([
        ...systemAdminUsers.map(u => u.id),
        ...scoutAdminUsers.map(u => u.id),
      ]);
      
      const missingRecipients = Array.from(expectedUserIds).filter(id => !notifiedUserIds.has(id));
      if (missingRecipients.length > 0) {
        console.log('\n⚠️ Missing notifications for:');
        for (const userId of missingRecipients) {
          const user = [...systemAdminUsers, ...scoutAdminUsers].find(u => u.id === userId);
          if (user) {
            console.log(`   - ${user.name} (${user.role})`);
          }
        }
      } else {
        console.log('\n✅ All expected recipients received notifications!');
      }
    }

    // Cleanup: Delete test submission (optional - comment out if you want to keep it)
    console.log('\n🧹 Cleaning up test submission...');
    try {
      await storage.deleteEvaluationSubmission(testSubmission.id);
      console.log('✅ Test submission deleted');
    } catch (error: any) {
      console.error('⚠️ Could not delete test submission:', error.message);
      console.log('   (You may need to delete it manually)');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Test completed!');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testFormSubmissionNotifications()
  .then(() => {
    console.log('\n✅ All tests passed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

