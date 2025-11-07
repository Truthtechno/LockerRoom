/**
 * Comprehensive end-to-end test for system admin profile update
 * This simulates the actual API call flow
 */

import { db } from '../server/db';
import { authStorage } from '../server/auth-storage';
import { users, systemAdmins } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testEndToEnd(email: string) {
  console.log('🧪 End-to-End Test for System Admin Profile Update');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Find user by email (simulating JWT lookup by email fallback)
    console.log('\n📋 Step 1: Finding user by email...');
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      linkedId: users.linkedId,
      name: users.name
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
    
    if (!user) {
      console.error('❌ User not found');
      return false;
    }
    
    if (user.role !== 'system_admin') {
      console.error('❌ User is not a system_admin');
      return false;
    }
    
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      linkedId: user.linkedId
    });
    
    // Step 2: Verify system_admins record exists
    console.log('\n📋 Step 2: Verifying system_admins record...');
    const [systemAdmin] = await db.select()
      .from(systemAdmins)
      .where(eq(systemAdmins.id, user.linkedId))
      .limit(1);
    
    if (!systemAdmin) {
      console.error('❌ System admin record not found');
      console.log('💡 This would trigger the recovery logic in updateUserProfile');
      return false;
    }
    
    console.log('✅ System admin record exists:', {
      id: systemAdmin.id,
      name: systemAdmin.name,
      profilePicUrl: systemAdmin.profilePicUrl
    });
    
    // Step 3: Test profile update
    console.log('\n📋 Step 3: Testing profile update...');
    const testUrl = `https://test-${Date.now()}.example.com/profile.jpg`;
    
    const result = await authStorage.updateUserProfile(user.id, 'system_admin', {
      profilePicUrl: testUrl
    });
    
    if (!result) {
      console.error('❌ Profile update returned null/undefined');
      return false;
    }
    
    console.log('✅ Profile update successful:', {
      id: result.id,
      name: result.name,
      profilePicUrl: result.profilePicUrl,
      role: result.role
    });
    
    // Step 4: Verify in database
    console.log('\n📋 Step 4: Verifying update in database...');
    const [updated] = await db.select()
      .from(systemAdmins)
      .where(eq(systemAdmins.id, user.linkedId))
      .limit(1);
    
    if (!updated) {
      console.error('❌ Could not verify update in database');
      return false;
    }
    
    if (updated.profilePicUrl !== testUrl) {
      console.error('❌ Profile picture URL mismatch:', {
        expected: testUrl,
        actual: updated.profilePicUrl
      });
      return false;
    }
    
    console.log('✅ Database verified - profile picture updated correctly');
    
    // Step 5: Clean up test data
    console.log('\n📋 Step 5: Cleaning up test data...');
    await db.update(systemAdmins)
      .set({ profilePicUrl: null })
      .where(eq(systemAdmins.id, user.linkedId));
    console.log('✅ Test data cleaned up');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    return true;
    
  } catch (error: any) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

const email = process.argv[2] || 'brayamooti@gmail.com';

testEndToEnd(email)
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });

