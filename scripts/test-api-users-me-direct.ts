/**
 * Test /api/users/me endpoint directly to see what it returns
 */

import { db } from '../server/db';
import { users, systemAdmins } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testAPIUsersMe() {
  console.log('🧪 Testing /api/users/me Endpoint Logic');
  console.log('='.repeat(70));
  
  try {
    const email = 'brayamooti@gmail.com';
    
    // Step 1: Get user
    console.log('\n📋 Step 1: Getting user from database...');
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      schoolId: users.schoolId,
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
    
    // Step 2: Get profile picture from systemAdmins table (as /api/users/me does)
    console.log('\n📋 Step 2: Getting profile picture from systemAdmins table...');
    let profilePicUrl = null;
    
    if (user.role === 'system_admin') {
      const systemAdminResult = await db.select({
        profilePicUrl: systemAdmins.profilePicUrl
      })
      .from(systemAdmins)
      .where(eq(systemAdmins.id, user.linkedId))
      .limit(1);
      
      if (systemAdminResult[0]) {
        profilePicUrl = systemAdminResult[0].profilePicUrl;
      }
      console.log('✅ Fetched from systemAdmins:', profilePicUrl);
    }
    
    // Step 3: Construct response (as /api/users/me does)
    console.log('\n📋 Step 3: Constructing response...');
    const finalProfilePicUrl = profilePicUrl || user.profilePicUrl || null;
    
    const responseData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      linkedId: user.linkedId,
      profilePicUrl: finalProfilePicUrl,
      coverPhoto: null
    };
    
    console.log('✅ Response data:', JSON.stringify(responseData, null, 2));
    
    // Step 4: Verify profilePicUrl is present
    console.log('\n📋 Step 4: Verifying profilePicUrl...');
    if (!responseData.profilePicUrl) {
      console.error('❌ profilePicUrl is null/undefined in response!');
      console.error('   This would cause the image to disappear');
      return false;
    }
    
    console.log('✅ profilePicUrl is present in response:', responseData.profilePicUrl);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ API USERS/ME TEST COMPLETE');
    console.log('='.repeat(70));
    console.log('\n💡 The /api/users/me endpoint SHOULD return profilePicUrl:', responseData.profilePicUrl);
    
    return true;
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

testAPIUsersMe()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });

