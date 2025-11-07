#!/usr/bin/env ts-node

/**
 * Resend School Admin Welcome Email
 * Use this to resend the welcome email to a school admin who didn't receive it
 */

import { config } from 'dotenv';
import { db } from '../server/db';
import { users, schoolAdmins, schools } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sendSchoolAdminAccountEmail } from '../server/email';
import bcrypt from 'bcrypt';

config();

async function resendSchoolAdminEmail(email: string) {
  console.log(`📧 Resending school admin welcome email to: ${email}\n`);
  
  try {
    // Find the user
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      schoolId: users.schoolId,
      linkedId: users.linkedId,
      otpHash: users.otpHash,
      otpExpiresAt: users.otpExpiresAt
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
    
    if (!user) {
      console.error(`❌ User not found with email: ${email}`);
      return;
    }
    
    if (user.role !== 'school_admin') {
      console.error(`❌ User is not a school admin. Role: ${user.role}`);
      return;
    }
    
    // Get school admin profile
    const [schoolAdmin] = await db.select()
      .from(schoolAdmins)
      .where(eq(schoolAdmins.id, user.linkedId))
      .limit(1);
    
    if (!schoolAdmin) {
      console.error(`❌ School admin profile not found for user: ${user.id}`);
      return;
    }
    
    // Get school name
    const [school] = await db.select()
      .from(schools)
      .where(eq(schools.id, user.schoolId))
      .limit(1);
    
    if (!school) {
      console.error(`❌ School not found for school admin`);
      return;
    }
    
    // Check if OTP exists and is valid
    if (!user.otpHash) {
      console.log('⚠️  No OTP found. Generating new OTP...');
      
      // Generate new OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const otpExpiresAt = new Date();
      otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 30);
      
      // Update user with new OTP
      await db.update(users)
        .set({ otpHash, otpExpiresAt })
        .where(eq(users.id, user.id));
      
      console.log(`✅ Generated new OTP: ${otp}`);
      
      // Send email with new OTP
      const result = await sendSchoolAdminAccountEmail(
        user.email,
        user.name || schoolAdmin.name,
        otp,
        school.name
      );
      
      if (result.success) {
        console.log('✅ Email sent successfully with new OTP!');
      } else {
        console.error('❌ Failed to send email:', result.error);
      }
    } else {
      // OTP exists - we can't retrieve it, so generate a new one
      console.log('⚠️  OTP exists but cannot be retrieved. Generating new OTP...');
      
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const otpExpiresAt = new Date();
      otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 30);
      
      await db.update(users)
        .set({ otpHash, otpExpiresAt })
        .where(eq(users.id, user.id));
      
      const result = await sendSchoolAdminAccountEmail(
        user.email,
        user.name || schoolAdmin.name,
        otp,
        school.name
      );
      
      if (result.success) {
        console.log('✅ Email sent successfully with new OTP!');
        console.log(`📧 New OTP: ${otp} (also sent via email)`);
      } else {
        console.error('❌ Failed to send email:', result.error);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: npx tsx scripts/resend-school-admin-email.ts <email>');
  process.exit(1);
}

resendSchoolAdminEmail(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

