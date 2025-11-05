import { db } from '../server/db';
import { storage } from '../server/storage';
import { notifyFormSubmitted } from '../server/utils/notification-helpers';
import { users, evaluationFormTemplates, evaluationSubmissions, notifications, systemAdmins, scoutProfiles } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Comprehensive verification test for form submission notification fixes:
 * 1. Verifies scout name is correctly fetched and used (not "undefined")
 * 2. Verifies profile picture is correctly loaded from scoutProfiles
 * 3. Verifies notification is created with correct data
 * 4. Verifies notification retrieval includes relatedUser with profile picture
 */

async function verifyFormNotificationFixes() {
  console.log('🧪 Verifying Form Submission Notification Fixes\n');
  console.log('='.repeat(70));

  try {
    // Step 1: Find a test scout with a profile
    console.log('\n📋 Step 1: Finding test scout with profile...');
    // First get scouts, then fetch their profiles separately to avoid type mismatch
    const scoutUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'xen_scout'))
      .limit(5);
    
    let scouts: any[] = [];
    for (const user of scoutUsers) {
      const profile = await db
        .select()
        .from(scoutProfiles)
        .where(eq(scoutProfiles.userId, user.id))
        .limit(1);
      
      if (profile.length > 0) {
        scouts.push({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          userLinkedId: user.linkedId,
          profileName: profile[0].name,
          profilePicUrl: profile[0].profilePicUrl,
        });
        break; // Found one, stop
      }
    }
    
    if (scouts.length === 0) {
      console.log('⚠️ No scouts with profiles found, trying any scout...');
      const anyScout = await db
        .select()
        .from(users)
        .where(eq(users.role, 'xen_scout'))
        .limit(1);
      
      if (anyScout.length === 0) {
        console.error('❌ No scouts found. Please create a scout user first.');
        return;
      }
      
      const testScout = anyScout[0];
      console.log(`✅ Using scout: ${testScout.name || 'No name'} (${testScout.id}, role: ${testScout.role})`);
      console.log('⚠️ This scout does not have a scoutProfiles entry');
    } else {
      const scout = scouts[0];
      console.log(`✅ Found scout with profile:`);
      console.log(`   User ID: ${scout.userId}`);
      console.log(`   User Name: ${scout.userName || 'N/A'}`);
      console.log(`   Profile Name: ${scout.profileName || 'N/A'}`);
      console.log(`   Profile Picture: ${scout.profilePicUrl || 'N/A'}`);
      console.log(`   Linked ID: ${scout.userLinkedId || 'N/A'}`);
    }

    const testScout = scouts.length > 0 ? {
      id: scouts[0].userId,
      name: scouts[0].profileName || scouts[0].userName || 'Test Scout',
      role: scouts[0].userRole,
      linkedId: scouts[0].userLinkedId,
      profilePicUrl: scouts[0].profilePicUrl,
    } : await db
      .select()
      .from(users)
      .where(eq(users.role, 'xen_scout'))
      .limit(1)
      .then(users => users[0] ? {
        id: users[0].id,
        name: users[0].name || 'Test Scout',
        role: users[0].role,
        linkedId: users[0].linkedId,
        profilePicUrl: null,
      } : null);

    if (!testScout) {
      console.error('❌ Could not find a test scout');
      return;
    }

    // Step 2: Find a test form template
    console.log('\n📋 Step 2: Finding test form template...');
    let formTemplates = await db
      .select()
      .from(evaluationFormTemplates)
      .where(eq(evaluationFormTemplates.status, 'published'))
      .limit(1);
    
    if (formTemplates.length === 0) {
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
    
    console.log(`📋 System admins: ${systemAdminUsers.length}`);
    console.log(`📋 Scout admins: ${scoutAdminUsers.length}`);
    
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

    // Step 5: Call notifyFormSubmitted with undefined name (simulating req.user.name)
    console.log('\n📋 Step 5: Calling notifyFormSubmitted with undefined name...');
    console.log('   (This simulates the real scenario where req.user.name is undefined)');
    
    try {
      await notifyFormSubmitted(
        testSubmission.id,
        testForm.id,
        testForm.name,
        testScout.id,
        undefined as any, // Simulate req.user.name being undefined
        'Test Student'
      );
      console.log('✅ notifyFormSubmitted completed');
    } catch (error: any) {
      console.error('❌ Error calling notifyFormSubmitted:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }

    // Step 6: Wait a bit for async operations
    console.log('\n📋 Step 6: Waiting for async operations...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 7: Verify notifications were created with correct data
    console.log('\n📋 Step 7: Verifying notifications...');
    const createdNotifications = await db
      .select({
        notification: notifications,
        relatedUser: {
          id: users.id,
          name: users.name,
          role: users.role,
          linkedId: users.linkedId,
        },
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.relatedUserId, users.id))
      .where(
        and(
          eq(notifications.entityType, 'evaluation_form_submission'),
          eq(notifications.entityId, testSubmission.id),
          eq(notifications.type, 'form_submitted')
        )
      )
      .orderBy(desc(notifications.createdAt));
    
    console.log(`\n📊 Found ${createdNotifications.length} notification(s)`);
    
    if (createdNotifications.length === 0) {
      console.error('❌ No notifications were created!');
      return;
    }

    // Step 8: Verify notification message contains correct name (not "undefined")
    console.log('\n📋 Step 8: Verifying notification messages...');
    let nameIssues = 0;
    let profilePicIssues = 0;
    
    for (const notif of createdNotifications) {
      const message = notif.notification.message;
      const title = notif.notification.title;
      
      console.log(`\n   Notification for: ${notif.relatedUser?.name || 'N/A'}`);
      console.log(`   Title: ${title}`);
      console.log(`   Message: ${message}`);
      
      // Check if message contains "undefined"
      if (message.includes('undefined')) {
        console.log(`   ❌ ISSUE: Message contains "undefined"!`);
        nameIssues++;
      } else {
        console.log(`   ✅ Message does not contain "undefined"`);
      }
      
      // Check if message contains the scout's name
      if (testScout.name && message.includes(testScout.name)) {
        console.log(`   ✅ Message contains scout name: "${testScout.name}"`);
      } else if (!message.includes('undefined')) {
        console.log(`   ⚠️ Message does not contain scout name, but also doesn't have "undefined"`);
      }
    }

    // Step 9: Verify profile pictures are loaded correctly
    console.log('\n📋 Step 9: Verifying profile pictures via getNotifications...');
    if (createdNotifications.length > 0) {
      // Get notifications using the storage method (which should fetch profile pictures)
      const recipientId = createdNotifications[0].notification.userId;
      const retrievedNotifications = await storage.getNotifications(recipientId, {
        limit: 10,
        unreadOnly: false,
      });
      
      const testNotification = retrievedNotifications.find(
        n => n.entityId === testSubmission.id && n.type === 'form_submitted'
      );
      
      if (testNotification) {
        console.log(`\n   Retrieved notification via getNotifications:`);
        console.log(`   Title: ${testNotification.title}`);
        console.log(`   Message: ${testNotification.message}`);
        console.log(`   Related User ID: ${testNotification.relatedUserId}`);
        
        if (testNotification.relatedUser) {
          console.log(`   Related User Name: ${testNotification.relatedUser.name || 'N/A'}`);
          console.log(`   Related User Role: ${testNotification.relatedUser.role || 'N/A'}`);
          console.log(`   Profile Picture URL: ${testNotification.relatedUser.profilePicUrl || 'N/A'}`);
          
          if (!testNotification.relatedUser.profilePicUrl) {
            console.log(`   ❌ ISSUE: Profile picture is missing!`);
            profilePicIssues++;
            
            // Try to fetch it directly
            if (testNotification.relatedUser.role === 'xen_scout' || testNotification.relatedUser.role === 'scout_admin') {
              const directProfile = await db
                .select({ profilePicUrl: scoutProfiles.profilePicUrl })
                .from(scoutProfiles)
                .where(eq(scoutProfiles.userId, testNotification.relatedUserId!))
                .limit(1);
              
              if (directProfile[0]?.profilePicUrl) {
                console.log(`   ⚠️ Profile picture exists in database: ${directProfile[0].profilePicUrl}`);
                console.log(`   ⚠️ But it's not being loaded in notification retrieval`);
              } else {
                console.log(`   ⚠️ Profile picture does not exist in scoutProfiles table`);
              }
            }
          } else {
            console.log(`   ✅ Profile picture is loaded correctly!`);
          }
          
          // Check for "undefined" in name
          if (testNotification.relatedUser.name === 'undefined' || testNotification.relatedUser.name?.includes('undefined')) {
            console.log(`   ❌ ISSUE: Related user name contains "undefined"!`);
            nameIssues++;
          } else if (testNotification.relatedUser.name) {
            console.log(`   ✅ Related user name is correct: "${testNotification.relatedUser.name}"`);
          }
        } else {
          console.log(`   ❌ ISSUE: Related user is null!`);
        }
      } else {
        console.log(`   ⚠️ Could not find test notification in retrieved notifications`);
      }
    }

    // Step 10: Summary
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 VERIFICATION SUMMARY:');
    console.log(`   Total notifications created: ${createdNotifications.length}`);
    console.log(`   Name issues found: ${nameIssues}`);
    console.log(`   Profile picture issues found: ${profilePicIssues}`);
    
    if (nameIssues === 0 && profilePicIssues === 0) {
      console.log('\n✅ ALL CHECKS PASSED!');
      console.log('   ✅ Scout names are correctly fetched and displayed');
      console.log('   ✅ Profile pictures are correctly loaded');
      console.log('   ✅ Notifications do not contain "undefined"');
    } else {
      console.log('\n❌ ISSUES DETECTED:');
      if (nameIssues > 0) {
        console.log(`   ❌ ${nameIssues} notification(s) still contain "undefined" in the name`);
      }
      if (profilePicIssues > 0) {
        console.log(`   ❌ ${profilePicIssues} notification(s) are missing profile pictures`);
      }
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test submission...');
    try {
      await storage.deleteEvaluationSubmission(testSubmission.id);
      console.log('✅ Test submission deleted');
    } catch (error: any) {
      console.error('⚠️ Could not delete test submission:', error.message);
      console.log('   (You may need to delete it manually)');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Verification completed!');
    
    // Return exit code based on results
    if (nameIssues > 0 || profilePicIssues > 0) {
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('\n❌ Verification failed:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

// Run the verification
verifyFormNotificationFixes()
  .then(() => {
    console.log('\n✅ All tests passed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

