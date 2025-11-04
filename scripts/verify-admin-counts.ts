/**
 * Verification script to check admin counts in database
 * This helps verify that the admin management page shows accurate numbers
 */

import { db } from '../server/db';
import { admins, users } from '../shared/schema';
import { inArray, eq } from 'drizzle-orm';

async function verifyAdminCounts() {
  try {
    console.log('🔍 Verifying admin counts in database...\n');

    // Get all admins from admins table
    const adminsFromTable = await db.select({
      id: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
      xenId: admins.xenId,
    }).from(admins);

    // Get all admin/scout roles from users table
    const adminRoles = ['system_admin', 'scout_admin', 'xen_scout', 'moderator', 'finance', 'support', 'coach', 'analyst'];
    const usersWithAdminRoles = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      xenId: users.xenId,
    })
    .from(users)
    .where(inArray(users.role, adminRoles));

    // Create a map to deduplicate by email
    const adminsMap = new Map<string, any>();
    adminsFromTable.forEach(admin => {
      adminsMap.set(admin.email.toLowerCase(), admin);
    });

    usersWithAdminRoles.forEach(user => {
      const emailKey = user.email.toLowerCase();
      if (!adminsMap.has(emailKey)) {
        adminsMap.set(emailKey, user);
      }
    });

    const allAdmins = Array.from(adminsMap.values());

    // Count by role
    const counts = {
      total: allAdmins.length,
      system_admin: allAdmins.filter(a => a.role === 'system_admin').length,
      scout_admin: allAdmins.filter(a => a.role === 'scout_admin').length,
      xen_scout: allAdmins.filter(a => a.role === 'xen_scout').length,
      other: allAdmins.filter(a => 
        !['system_admin', 'scout_admin'].includes(a.role)
      ).length,
    };

    console.log('📊 Admin Counts:');
    console.log(`   Total Admins: ${counts.total}`);
    console.log(`   System Admins: ${counts.system_admin}`);
    console.log(`   Scout Admins: ${counts.scout_admin}`);
    console.log(`   XEN Scouts: ${counts.xen_scout}`);
    console.log(`   Other Roles: ${counts.other}`);
    console.log('\n📋 Breakdown by source:');
    console.log(`   From admins table: ${adminsFromTable.length}`);
    console.log(`   From users table: ${usersWithAdminRoles.length}`);
    console.log(`   Unique after merge: ${allAdmins.length}`);
    console.log(`   Duplicates removed: ${adminsFromTable.length + usersWithAdminRoles.length - allAdmins.length}`);

    console.log('\n📝 Detailed Role Breakdown:');
    const roleBreakdown: Record<string, number> = {};
    allAdmins.forEach(admin => {
      roleBreakdown[admin.role] = (roleBreakdown[admin.role] || 0) + 1;
    });
    Object.entries(roleBreakdown).sort().forEach(([role, count]) => {
      console.log(`   ${role}: ${count}`);
    });

    console.log('\n✅ Verification complete!');
    console.log('\n💡 These numbers should match what you see in the Admin Management page.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error verifying admin counts:', error);
    process.exit(1);
  }
}

verifyAdminCounts();

