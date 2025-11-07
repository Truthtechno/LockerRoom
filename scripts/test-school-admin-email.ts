#!/usr/bin/env ts-node

/**
 * Test School Admin Email Function
 */

import { config } from 'dotenv';
import { sendSchoolAdminAccountEmail } from '../server/email';

config();

async function testSchoolAdminEmail() {
  console.log('📧 Testing School Admin Account Email\n');
  
  const testEmail = process.env.TEST_EMAIL || 'brayamooti@gmail.com';
  console.log(`Sending test email to: ${testEmail}\n`);
  
  try {
    const result = await sendSchoolAdminAccountEmail(
      testEmail,
      'Test Academy Admin',
      '123456',
      'Test Academy'
    );
    
    if (result.success) {
      console.log('✅ School admin account email sent successfully!');
      console.log('📬 Check your inbox for the email.');
    } else {
      console.error('❌ Failed to send email:', result.error);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testSchoolAdminEmail()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

