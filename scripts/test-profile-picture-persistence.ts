/**
 * Test profile picture persistence after upload
 * Verifies that profile picture is saved correctly and can be retrieved
 */

import { db } from '../server/db';
import { users, systemAdmins } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testProfilePicturePersistence(email: string) {
  console.log('🔍 Testing Profile Picture Persistence');
  console.log('='.repeat(70));
  
  try {
    // Step 1: Get current user state
    console.log('\n📋 Step 1: Getting current user state...');
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      linkedId: users.linkedId,
      profilePicUrl: users.profilePicUrl
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
    
    if (!user) {
      console.error('❌ User not found');
      return false;
    }
    
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      linkedId: user.linkedId,
      usersTableProfilePicUrl: user.profilePicUrl
    });
    
    // Step 2: Get system admin profile
    console.log('\n📋 Step 2: Getting system admin profile...');
    const [systemAdmin] = await db.select()
      .from(systemAdmins)
      .where(eq(systemAdmins.id, user.linkedId))
      .limit(1);
    
    if (!systemAdmin) {
      console.error('❌ System admin profile not found');
      return false;
    }
    
    console.log('✅ System admin profile found:', {
      id: systemAdmin.id,
      name: systemAdmin.name,
      systemAdminsTableProfilePicUrl: systemAdmin.profilePicUrl
    });
    
    // Step 3: Check consistency
    console.log('\n📋 Step 3: Checking consistency...');
    const profilePicUrl = systemAdmin.profilePicUrl || user.profilePicUrl;
    
    if (systemAdmin.profilePicUrl && user.profilePicUrl) {
      if (systemAdmin.profilePicUrl !== user.profilePicUrl) {
        console.warn('⚠️ PROFILE PICTURE MISMATCH:');
        console.warn(`   systemAdmins.profilePicUrl: ${systemAdmin.profilePicUrl}`);
        console.warn(`   users.profilePicUrl: ${user.profilePicUrl}`);
        console.warn('   These should match!');
      } else {
        console.log('✅ Profile pictures match in both tables');
      }
    } else if (systemAdmin.profilePicUrl && !user.profilePicUrl) {
      console.warn('⚠️ Profile picture exists in systemAdmins but not in users table');
      console.warn('   This will cause issues with /api/users/me endpoint');
    } else if (!systemAdmin.profilePicUrl && user.profilePicUrl) {
      console.warn('⚠️ Profile picture exists in users but not in systemAdmins table');
      console.warn('   This is unexpected - systemAdmins should be the source of truth');
    } else {
      console.log('ℹ️ No profile picture set');
    }
    
    // Step 4: Simulate what /api/users/me does
    console.log('\n📋 Step 4: Simulating /api/users/me endpoint...');
    let fetchedProfilePicUrl = null;
    
    if (user.role === 'system_admin') {
      const systemAdminResult = await db.select({
        profilePicUrl: systemAdmins.profilePicUrl
      })
      .from(systemAdmins)
      .where(eq(systemAdmins.id, user.linkedId))
      .limit(1);
      
      if (systemAdminResult[0]) {
        fetchedProfilePicUrl = systemAdminResult[0].profilePicUrl;
      }
      console.log('✅ Fetched from systemAdmins table:', fetchedProfilePicUrl);
    }
    
    // Step 5: Final result
    console.log('\n📋 Step 5: Final result...');
    const finalProfilePicUrl = fetchedProfilePicUrl || user.profilePicUrl || null;
    
    console.log('Profile picture that /api/users/me would return:', finalProfilePicUrl);
    
    if (!finalProfilePicUrl) {
      console.error('❌ NO PROFILE PICTURE FOUND!');
      console.error('   This explains why it disappears after reload');
      return false;
    }
    
    console.log('✅ Profile picture found and would be returned by /api/users/me');
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ PROFILE PICTURE PERSISTENCE TEST COMPLETE');
    console.log('='.repeat(70));
    
    return true;
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

const email = process.argv[2] || 'brayamooti@gmail.com';

testProfilePicturePersistence(email)
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });

