/**
 * Comprehensive verification script for system admin database structure
 * Verifies that all system admins are in the correct tables
 */

import { db } from '../server/db';
import { users, systemAdmins, admins } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function verifySystemAdminDatabase() {
  console.log('🔍 Comprehensive System Admin Database Verification');
  console.log('='.repeat(70));
  
  try {
    // Step 1: Find all system_admin users
    console.log('\n📋 Step 1: Finding all system_admin users...');
    const systemAdminUsers = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      linkedId: users.linkedId,
      name: users.name,
      profilePicUrl: users.profilePicUrl
    })
    .from(users)
    .where(eq(users.role, 'system_admin'));
    
    console.log(`✅ Found ${systemAdminUsers.length} system admin user(s)`);
    
    if (systemAdminUsers.length === 0) {
      console.log('⚠️ No system admin users found in database');
      return true;
    }
    
    // Step 2: Verify each system admin has a corresponding systemAdmins record
    console.log('\n📋 Step 2: Verifying system_admins table records...');
    let issuesFound = 0;
    
    for (const user of systemAdminUsers) {
      console.log(`\n🔍 Checking user: ${user.email} (${user.id})`);
      console.log(`   linkedId: ${user.linkedId}`);
      
      // Check if linkedId points to systemAdmins table
      const [systemAdmin] = await db.select()
        .from(systemAdmins)
        .where(eq(systemAdmins.id, user.linkedId))
        .limit(1);
      
      if (systemAdmin) {
        console.log(`   ✅ systemAdmins record found: ${systemAdmin.id}`);
        console.log(`      Name: ${systemAdmin.name}`);
        console.log(`      ProfilePicUrl: ${systemAdmin.profilePicUrl || 'null'}`);
      } else {
        console.log(`   ❌ systemAdmins record NOT found for linkedId: ${user.linkedId}`);
        
        // Check if linkedId points to admins table (wrong table)
        const [adminRecord] = await db.select()
          .from(admins)
          .where(eq(admins.id, user.linkedId))
          .limit(1);
        
        if (adminRecord) {
          console.log(`   ⚠️ linkedId points to admins table (WRONG TABLE!)`);
          console.log(`      Admin ID: ${adminRecord.id}, Role: ${adminRecord.role}`);
          issuesFound++;
        } else if (user.linkedId === user.id) {
          console.log(`   ⚠️ linkedId is self-referential (points to user.id - WRONG!)`);
          issuesFound++;
        } else {
          console.log(`   ⚠️ linkedId doesn't point to any known record`);
          issuesFound++;
        }
      }
    }
    
    // Step 3: Check for orphaned systemAdmins records
    console.log('\n📋 Step 3: Checking for orphaned systemAdmins records...');
    const allSystemAdmins = await db.select().from(systemAdmins);
    console.log(`✅ Found ${allSystemAdmins.length} systemAdmins record(s)`);
    
    for (const systemAdmin of allSystemAdmins) {
      const [user] = await db.select()
        .from(users)
        .where(eq(users.linkedId, systemAdmin.id))
        .limit(1);
      
      if (!user) {
        console.log(`   ⚠️ Orphaned systemAdmins record: ${systemAdmin.id} (no user references it)`);
      } else if (user.role !== 'system_admin') {
        console.log(`   ⚠️ systemAdmins record ${systemAdmin.id} is linked to user with wrong role: ${user.role}`);
      } else {
        console.log(`   ✅ systemAdmins record ${systemAdmin.id} properly linked to user ${user.email}`);
      }
    }
    
    // Step 4: Summary
    console.log('\n' + '='.repeat(70));
    if (issuesFound === 0) {
      console.log('✅ ALL VERIFICATIONS PASSED!');
      console.log('   All system admins are properly configured in the correct tables.');
    } else {
      console.log(`⚠️ FOUND ${issuesFound} ISSUE(S)!`);
      console.log('   Some system admins may need their linkedId fixed.');
    }
    console.log('='.repeat(70));
    
    return issuesFound === 0;
    
  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

verifySystemAdminDatabase()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Verification execution failed:', error);
    process.exit(1);
  });

