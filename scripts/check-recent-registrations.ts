#!/usr/bin/env ts-node

/**
 * Check recent user registrations and their email verification status
 */

import { config } from 'dotenv';
import { db } from '../server/db';
import { users } from '@shared/schema';
import { desc } from 'drizzle-orm';

config();

async function checkRecentRegistrations() {
  console.log('📊 Checking Recent User Registrations\n');
  console.log('='.repeat(60));
  
  try {
    // Get the 10 most recent users
    const recentUsers = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      emailVerified: users.emailVerified,
      emailVerificationToken: users.emailVerificationToken,
      emailVerificationTokenExpiresAt: users.emailVerificationTokenExpiresAt,
      createdAt: users.createdAt
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(10);
    
    console.log(`Found ${recentUsers.length} recent user(s):\n`);
    
    recentUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'No name'} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Email Verified: ${user.emailVerified ? '✅ Yes' : '❌ No'}`);
      console.log(`   Has Verification Token: ${user.emailVerificationToken ? '✅ Yes' : '❌ No'}`);
      if (user.emailVerificationToken) {
        console.log(`   Token Expires: ${user.emailVerificationTokenExpiresAt}`);
      }
      console.log('');
    });
    
    // Check for users with verification tokens but not verified
    const unverifiedWithToken = recentUsers.filter(
      u => u.emailVerificationToken && !u.emailVerified
    );
    
    if (unverifiedWithToken.length > 0) {
      console.log(`\n⚠️  Found ${unverifiedWithToken.length} user(s) with unverified emails:`);
      unverifiedWithToken.forEach(user => {
        console.log(`   - ${user.email} (created ${user.createdAt})`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error checking registrations:', error.message);
  }
}

checkRecentRegistrations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

