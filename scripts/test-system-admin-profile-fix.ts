/**
 * Test script to verify system admin profile update fix
 * This script tests:
 * 1. User lookup in database
 * 2. System admin record existence
 * 3. Profile update functionality
 */

import { db } from '../server/db';
import { users, systemAdmins, admins } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testSystemAdminProfile(userId: string) {
  console.log('🔍 Testing system admin profile for userId:', userId);
  
  try {
    // 1. Check if user exists
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      console.error('❌ User not found in database');
      return;
    }
    
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      linkedId: user.linkedId,
      name: user.name
    });
    
    // 2. Check if user is system_admin
    if (user.role !== 'system_admin') {
      console.error('❌ User is not a system_admin. Role:', user.role);
      return;
    }
    
    // 3. Check if linkedId points to system_admins table
    const [systemAdmin] = await db.select()
      .from(systemAdmins)
      .where(eq(systemAdmins.id, user.linkedId))
      .limit(1);
    
    if (systemAdmin) {
      console.log('✅ System admin record found:', {
        id: systemAdmin.id,
        name: systemAdmin.name,
        profilePicUrl: systemAdmin.profilePicUrl
      });
    } else {
      console.warn('⚠️ System admin record NOT found with linkedId:', user.linkedId);
      
      // Check if linkedId points to admins table (wrong table)
      const [adminRecord] = await db.select()
        .from(admins)
        .where(eq(admins.id, user.linkedId))
        .limit(1);
      
      if (adminRecord) {
        console.warn('⚠️ linkedId points to admins table (wrong table):', {
          adminId: adminRecord.id,
          name: adminRecord.name,
          role: adminRecord.role
        });
        console.log('💡 This user was incorrectly created in admins table instead of system_admins table');
      } else if (user.linkedId === user.id) {
        console.warn('⚠️ linkedId is self-referential (points to user.id)');
      } else {
        console.warn('⚠️ linkedId does not point to any known record:', user.linkedId);
      }
      
      // Try to fix it
      console.log('🔧 Attempting to fix...');
      
      // Create system_admin record
      const [newSystemAdmin] = await db.insert(systemAdmins).values({
        name: user.name || 'System Admin',
        profilePicUrl: user.profilePicUrl || undefined,
      }).returning();
      
      console.log('✅ Created system_admin record:', {
        id: newSystemAdmin.id,
        name: newSystemAdmin.name
      });
      
      // Update user's linkedId
      await db.update(users)
        .set({ linkedId: newSystemAdmin.id })
        .where(eq(users.id, user.id));
      
      console.log('✅ Updated user linkedId from', user.linkedId, 'to', newSystemAdmin.id);
      console.log('✅ Fix complete! Profile update should now work.');
    }
    
    // 4. Test profile update
    console.log('\n🧪 Testing profile update...');
    const testProfilePicUrl = 'https://test.example.com/profile.jpg';
    
    const [updated] = await db.update(systemAdmins)
      .set({ profilePicUrl: testProfilePicUrl })
      .where(eq(systemAdmins.id, user.linkedId))
      .returning();
    
    if (updated) {
      console.log('✅ Profile update successful!');
    } else {
      console.error('❌ Profile update failed - no rows updated');
    }
    
  } catch (error) {
    console.error('❌ Error testing system admin profile:', error);
  }
}

// Get userId from command line args or use the one from logs
const userId = process.argv[2] || '07a184fc-7db2-451c-98cd-c30db341f970';

testSystemAdminProfile(userId)
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

