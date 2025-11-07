/**
 * Test profile update for the correct system admin user
 */

import { db } from '../server/db';
import { authStorage } from '../server/auth-storage';
import { users, systemAdmins } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testProfileUpdate(email: string) {
  console.log('🔍 Testing profile update for:', email);
  
  try {
    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      console.error('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      linkedId: user.linkedId
    });
    
    // Test profile update
    const testUrl = 'https://test.example.com/profile.jpg';
    console.log('\n🧪 Testing profile update with URL:', testUrl);
    
    const result = await authStorage.updateUserProfile(user.id, 'system_admin', {
      profilePicUrl: testUrl
    });
    
    if (result) {
      console.log('✅ Profile update successful!', {
        id: result.id,
        name: result.name,
        profilePicUrl: result.profilePicUrl,
        role: result.role
      });
      
      // Verify in database
      const [updated] = await db.select()
        .from(systemAdmins)
        .where(eq(systemAdmins.id, user.linkedId))
        .limit(1);
      
      if (updated && updated.profilePicUrl === testUrl) {
        console.log('✅ Database verified - profile picture updated correctly');
      } else {
        console.warn('⚠️ Database check failed');
      }
    } else {
      console.error('❌ Profile update failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

const email = process.argv[2] || 'brayamooti@gmail.com';

testProfileUpdate(email)
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

