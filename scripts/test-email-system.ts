#!/usr/bin/env ts-node

/**
 * Comprehensive Email System Test
 * Tests all email sending functionality to ensure Resend integration is working
 */

import { config } from 'dotenv';
import { db } from '../server/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  sendVerificationEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendStudentAccountEmail
} from '../server/email';

// Load environment variables
config();

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@lockerroom.com';

async function testEmailSystem() {
  console.log('📧 Starting Comprehensive Email System Test\n');
  console.log('=' .repeat(60));
  
  // Test 1: Check Environment Variables
  console.log('\n📋 Test 1: Environment Variables Check');
  console.log('-'.repeat(60));
  console.log(`RESEND_API_KEY: ${RESEND_API_KEY ? '✅ Set' : '❌ NOT SET'}`);
  console.log(`EMAIL_FROM: ${EMAIL_FROM}`);
  console.log(`FRONTEND_URL: ${FRONTEND_URL}`);
  
  if (!RESEND_API_KEY) {
    console.error('\n❌ CRITICAL: RESEND_API_KEY is not set in .env file!');
    console.error('Please add: RESEND_API_KEY=re_your_api_key_here');
    process.exit(1);
  }
  
  if (!RESEND_API_KEY.startsWith('re_')) {
    console.warn('\n⚠️  WARNING: RESEND_API_KEY does not start with "re_" - may be invalid');
  }
  
  // Test 2: Test Email Sending Functions
  console.log('\n📧 Test 2: Email Sending Functions');
  console.log('-'.repeat(60));
  
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  console.log(`Using test email: ${testEmail}`);
  console.log('(Set TEST_EMAIL in .env to use your actual email)\n');
  
  // Test verification email
  console.log('1. Testing Verification Email...');
  try {
    const verificationToken = 'test-verification-token-12345';
    const result = await sendVerificationEmail(testEmail, verificationToken, 'Test User');
    if (result.success) {
      console.log('   ✅ Verification email sent successfully');
    } else {
      console.error(`   ❌ Failed to send verification email: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error sending verification email: ${error.message}`);
  }
  
  // Test OTP email
  console.log('\n2. Testing OTP Email...');
  try {
    const otp = '123456';
    const result = await sendOTPEmail(testEmail, otp, 'Test Player', 'registration');
    if (result.success) {
      console.log('   ✅ OTP email sent successfully');
    } else {
      console.error(`   ❌ Failed to send OTP email: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error sending OTP email: ${error.message}`);
  }
  
  // Test password reset email
  console.log('\n3. Testing Password Reset Email...');
  try {
    const resetToken = 'test-reset-token-12345';
    const result = await sendPasswordResetEmail(testEmail, resetToken, 'Test User');
    if (result.success) {
      console.log('   ✅ Password reset email sent successfully');
    } else {
      console.error(`   ❌ Failed to send password reset email: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error sending password reset email: ${error.message}`);
  }
  
  // Test welcome email
  console.log('\n4. Testing Welcome Email...');
  try {
    const result = await sendWelcomeEmail(testEmail, 'Test User', 'student');
    if (result.success) {
      console.log('   ✅ Welcome email sent successfully');
    } else {
      console.error(`   ❌ Failed to send welcome email: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error sending welcome email: ${error.message}`);
  }
  
  // Test student account email
  console.log('\n5. Testing Student Account Email...');
  try {
    const otp = '654321';
    const result = await sendStudentAccountEmail(testEmail, 'Test Student', otp, 'Test Academy');
    if (result.success) {
      console.log('   ✅ Student account email sent successfully');
    } else {
      console.error(`   ❌ Failed to send student account email: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error sending student account email: ${error.message}`);
  }
  
  // Test 3: Check Recent Registrations
  console.log('\n📊 Test 3: Recent User Registrations Check');
  console.log('-'.repeat(60));
  try {
    const recentUsers = await db.select({
      email: users.email,
      emailVerified: users.emailVerified,
      emailVerificationToken: users.emailVerificationToken,
      createdAt: users.createdAt
    })
    .from(users)
    .orderBy(users.createdAt)
    .limit(5);
    
    console.log(`Found ${recentUsers.length} recent user(s):`);
    recentUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.email}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Email Verified: ${user.emailVerified ? '✅ Yes' : '❌ No'}`);
      console.log(`   Has Verification Token: ${user.emailVerificationToken ? '✅ Yes' : '❌ No'}`);
    });
  } catch (error: any) {
    console.error(`❌ Error checking recent users: ${error.message}`);
  }
  
  // Test 4: Check Resend API Connection
  console.log('\n🔌 Test 4: Resend API Connection');
  console.log('-'.repeat(60));
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_API_KEY);
    
    // Try to get API key info (this will fail if key is invalid)
    console.log('Testing Resend API connection...');
    const testResult = await resend.emails.send({
      from: EMAIL_FROM,
      to: testEmail,
      subject: 'Test Email from LockerRoom',
      html: '<p>This is a test email to verify Resend integration.</p>'
    });
    
    if (testResult.data) {
      console.log('   ✅ Resend API connection successful');
      console.log(`   Email ID: ${testResult.data.id}`);
    } else if (testResult.error) {
      console.error(`   ❌ Resend API error: ${testResult.error.message}`);
      if (testResult.error.message?.includes('Invalid API key')) {
        console.error('   ⚠️  Your Resend API key may be invalid. Please check it in .env');
      }
      if (testResult.error.message?.includes('domain')) {
        console.error('   ⚠️  Email domain may not be verified in Resend dashboard');
      }
    }
  } catch (error: any) {
    console.error(`   ❌ Error testing Resend API: ${error.message}`);
    if (error.message?.includes('API key')) {
      console.error('   ⚠️  Check your RESEND_API_KEY in .env file');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📧 Email System Test Complete');
  console.log('='.repeat(60));
  
  console.log('\n📝 Next Steps:');
  console.log('1. Check your email inbox (and spam folder) for test emails');
  console.log('2. Check Resend dashboard for email delivery status');
  console.log('3. If emails are not received, check:');
  console.log('   - Resend API key is valid');
  console.log('   - Email domain is verified in Resend');
  console.log('   - Email is not blocked by spam filters');
  console.log('   - Server logs for detailed error messages');
}

// Run the test
testEmailSystem()
  .then(() => {
    console.log('\n✅ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });

