#!/usr/bin/env ts-node

/**
 * Test Email Layout
 * Sends a test email to verify the new professional email design
 */

import { config } from 'dotenv';
import { Resend } from 'resend';

config();

async function sendTestEmail() {
  const testEmail = 'brayamooti@gmail.com';
  const testName = 'Test User';
  const testOTP = '123456'; // Test OTP
  
  console.log(`📧 Sending test email to ${testEmail}...\n`);
  console.log(`📋 Resend API Key: ${process.env.RESEND_API_KEY ? 'Set' : 'NOT SET'}`);
  console.log(`📋 Email From: ${process.env.EMAIL_FROM || 'onboarding@resend.dev'}\n`);
  
  const resend = new Resend(process.env.RESEND_API_KEY);
  const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'LockerRoom';
  const FRONTEND_URL = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
  
  try {
    // Import the email function
    const { sendSystemAdminAccountEmail } = await import('../server/email');
    
    console.log('📤 Calling sendSystemAdminAccountEmail...');
    const result = await sendSystemAdminAccountEmail(testEmail, testName, testOTP);
    
    if (result.success) {
      console.log('\n✅ Test email sent successfully!');
      console.log(`📬 Check your inbox at ${testEmail}`);
      console.log(`📬 Also check your spam/junk folder`);
      console.log('\nThe email should show:');
      console.log('- Professional white/light gray header (not gold)');
      console.log('- Logo or "LR" badge with white border');
      console.log('- Orange/dark gold button with black border');
      console.log('- Improved contrast and readability');
      console.log('\n💡 Note: Email delivery can take a few minutes. If you don\'t see it:');
      console.log('   1. Check spam/junk folder');
      console.log('   2. Wait 2-3 minutes');
      console.log('   3. Check Resend dashboard for delivery status');
    } else {
      console.error('\n❌ Failed to send test email:', result.error);
      console.error('Please check:');
      console.error('1. RESEND_API_KEY is set in .env');
      console.error('2. Domain is verified in Resend dashboard');
      console.error('3. Email address is valid');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Error sending test email:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

sendTestEmail();

