/**
 * Find system admin by email to get the correct userId
 */

import { db } from '../server/db';
import { users, systemAdmins, admins } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function findSystemAdminByEmail(email: string) {
  console.log('🔍 Searching for system admin with email:', email);
  
  try {
    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      console.error('❌ User not found with email:', email);
      return;
    }
    
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      linkedId: user.linkedId,
      name: user.name
    });
    
    if (user.role !== 'system_admin') {
      console.error('❌ User is not a system_admin. Role:', user.role);
      return;
    }
    
    // Check system_admins table
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
      
      // Check if it's in admins table (wrong table)
      const [adminRecord] = await db.select()
        .from(admins)
        .where(eq(admins.id, user.linkedId))
        .limit(1);
      
      if (adminRecord) {
        console.warn('⚠️ Found in admins table (wrong table):', {
          id: adminRecord.id,
          name: adminRecord.name,
          role: adminRecord.role
        });
      }
      
      // Check if linkedId is self-referential
      if (user.linkedId === user.id) {
        console.warn('⚠️ linkedId is self-referential (points to user.id)');
      }
      
      console.log('\n🔧 Fixing the issue...');
      
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
      console.log('\n✅ Fix complete! Try uploading profile picture again.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

const email = process.argv[2] || 'brayamooti@gmail.com';

findSystemAdminByEmail(email)
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });

