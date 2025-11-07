#!/usr/bin/env ts-node

/**
 * Direct Resend Test
 * Tests email sending directly with Resend API to diagnose issues
 */

import { config } from 'dotenv';
import { Resend } from 'resend';

config();

async function testDirectResend() {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const testEmail = 'brayamooti@gmail.com';
  
  console.log('🧪 Testing direct Resend API call...\n');
  console.log(`📋 API Key: ${process.env.RESEND_API_KEY ? 'Set' : 'NOT SET'}`);
  console.log(`📋 Email From (current): ${process.env.EMAIL_FROM || 'onboarding@resend.dev'}\n`);
  
  // Try with default Resend domain first
  console.log('📧 Attempt 1: Using default Resend domain (onboarding@resend.dev)...');
  try {
    const result1 = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: testEmail,
      subject: 'Test Email - Direct Resend (Default Domain)',
      html: '<h1>Test Email</h1><p>This is a test email sent directly via Resend API using the default domain.</p>',
    });
    
    console.log('✅ Result 1:', JSON.stringify(result1, null, 2));
    console.log(`📧 Email ID: ${result1.data?.id || 'No ID'}\n`);
  } catch (error: any) {
    console.error('❌ Error 1:', error);
    console.error('Details:', JSON.stringify(error, null, 2));
  }
  
  // Try with custom domain if set
  if (process.env.EMAIL_FROM && process.env.EMAIL_FROM !== 'onboarding@resend.dev') {
    console.log(`📧 Attempt 2: Using custom domain (${process.env.EMAIL_FROM})...`);
    try {
      const result2 = await resend.emails.send({
        from: `LockerRoom <${process.env.EMAIL_FROM}>`,
        to: testEmail,
        subject: 'Test Email - Direct Resend (Custom Domain)',
        html: '<h1>Test Email</h1><p>This is a test email sent directly via Resend API using the custom domain.</p>',
      });
      
      console.log('✅ Result 2:', JSON.stringify(result2, null, 2));
      console.log(`📧 Email ID: ${result2.data?.id || 'No ID'}\n`);
    } catch (error: any) {
      console.error('❌ Error 2:', error);
      console.error('Details:', JSON.stringify(error, null, 2));
      console.log('\n💡 This might indicate a domain verification issue.');
    }
  }
  
  console.log('\n📊 Next steps:');
  console.log('1. Check Resend dashboard for these email IDs');
  console.log('2. Verify domain status in Resend dashboard');
  console.log('3. Check for any rate limiting or account issues');
  
  process.exit(0);
}

testDirectResend();

