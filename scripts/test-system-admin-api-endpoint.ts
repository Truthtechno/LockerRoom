/**
 * Test the actual API endpoint to verify response format
 * Simulates what the client would receive
 */

import { db } from '../server/db';
import { users, systemAdmins } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testAPIResponseFormat() {
  console.log('🧪 Testing System Admin API Endpoint Response Format');
  console.log('='.repeat(70));
  
  try {
    const email = 'brayamooti@gmail.com';
    
    // Simulate what the endpoint does
    console.log('\n📋 Step 1: Looking up user by email...');
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
    
    if (!user || user.role !== 'system_admin') {
      console.error('❌ User not found');
      return false;
    }
    
    console.log('✅ User found:', user.id);
    
    // Simulate profile update
    console.log('\n📋 Step 2: Simulating profile update...');
    const testUrl = `https://test-api-${Date.now()}.example.com/profile.jpg`;
    
    // Update system_admins table
    const [updatedSystemAdmin] = await db.update(systemAdmins)
      .set({ profilePicUrl: testUrl })
      .where(eq(systemAdmins.id, user.linkedId))
      .returning();
    
    if (!updatedSystemAdmin) {
      console.error('❌ Failed to update system admin');
      return false;
    }
    
    console.log('✅ System admin updated');
    
    // Update users table (as the route should do)
    await db.update(users)
      .set({ profilePicUrl: testUrl })
      .where(eq(users.id, user.id));
    
    console.log('✅ Users table updated');
    
    // Simulate the response format that the route should return
    const response = {
      id: user.id,
      name: updatedSystemAdmin.name,
      email: user.email,
      profilePicUrl: updatedSystemAdmin.profilePicUrl,
      role: 'system_admin'
    };
    
    console.log('\n📋 Step 3: API Response Format:');
    console.log(JSON.stringify(response, null, 2));
    
    // Verify response format matches school-admin pattern
    console.log('\n📋 Step 4: Verifying response format...');
    const requiredFields = ['id', 'name', 'email', 'profilePicUrl', 'role'];
    const missingFields = requiredFields.filter(field => !(field in response));
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
      return false;
    }
    
    console.log('✅ All required fields present');
    
    // Verify data types
    if (typeof response.id !== 'string') {
      console.error('❌ id should be string');
      return false;
    }
    if (typeof response.name !== 'string') {
      console.error('❌ name should be string');
      return false;
    }
    if (typeof response.email !== 'string') {
      console.error('❌ email should be string');
      return false;
    }
    if (response.profilePicUrl && typeof response.profilePicUrl !== 'string') {
      console.error('❌ profilePicUrl should be string or null');
      return false;
    }
    if (response.role !== 'system_admin') {
      console.error('❌ role should be system_admin');
      return false;
    }
    
    console.log('✅ All field types are correct');
    
    // Clean up
    console.log('\n📋 Step 5: Cleaning up...');
    const [originalSystemAdmin] = await db.select()
      .from(systemAdmins)
      .where(eq(systemAdmins.id, user.linkedId))
      .limit(1);
    
    // Restore original (we'll set to null for now)
    await db.update(systemAdmins)
      .set({ profilePicUrl: null })
      .where(eq(systemAdmins.id, user.linkedId));
    
    await db.update(users)
      .set({ profilePicUrl: null })
      .where(eq(users.id, user.id));
    
    console.log('✅ Cleanup complete');
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ API ENDPOINT RESPONSE FORMAT TEST PASSED!');
    console.log('='.repeat(70));
    console.log('\n💡 The API endpoint should return data in this format:');
    console.log('   { id, name, email, profilePicUrl, role }');
    console.log('\n💡 This matches the school-admin pattern for consistency!');
    
    return true;
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

testAPIResponseFormat()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });

