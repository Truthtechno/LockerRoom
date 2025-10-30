#!/usr/bin/env node

/**
 * Test script to verify the linkedId fix for profile picture uploads
 * This script tests the complete flow:
 * 1. Login as viewer@lockerroom.com
 * 2. Check JWT payload includes linkedId
 * 3. Upload profile picture
 * 4. Verify viewers.profile_pic_url is updated
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5000';
const TEST_EMAIL = 'viewer@lockerroom.com';
const TEST_PASSWORD = 'Viewer123!';

async function testLinkedIdFix() {
  console.log('🧪 Testing linkedId fix for profile picture uploads...\n');

  try {
    // Step 1: Login as viewer@lockerroom.com
    console.log('1️⃣ Logging in as viewer@lockerroom.com...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(`Login failed: ${JSON.stringify(error)}`);
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login successful');
    console.log('📋 Login response:', {
      hasToken: !!loginData.token,
      user: loginData.user,
      hasProfile: !!loginData.profile
    });

    // Step 2: Decode JWT to check payload
    console.log('\n2️⃣ Checking JWT payload...');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(loginData.token);
    console.log('🔍 JWT payload:', {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      schoolId: decoded.schoolId,
      linkedId: decoded.linkedId,
      hasLinkedId: !!decoded.linkedId
    });

    if (!decoded.linkedId) {
      throw new Error('❌ JWT payload missing linkedId!');
    }
    console.log('✅ JWT payload includes linkedId:', decoded.linkedId);

    // Step 3: Test profile picture upload
    console.log('\n3️⃣ Testing profile picture upload...');
    
    // Create a simple test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );

    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('profilePic', testImageBuffer, {
      filename: 'test.png',
      contentType: 'image/png',
    });

    const uploadResponse = await fetch(`${API_BASE}/api/profile/picture`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(`Profile picture upload failed: ${JSON.stringify(error)}`);
    }

    const uploadData = await uploadResponse.json();
    console.log('✅ Profile picture upload successful');
    console.log('📋 Upload response:', uploadData);

    // Step 4: Verify the profile was updated in database
    console.log('\n4️⃣ Verifying database update...');
    
    // We can't directly query the database from this test script,
    // but we can check if the upload returned a valid Cloudinary URL
    if (uploadData.profilePicUrl && uploadData.profilePicUrl.includes('cloudinary.com')) {
      console.log('✅ Profile picture URL looks valid:', uploadData.profilePicUrl);
      console.log('🎉 Test completed successfully!');
      console.log('\n📊 Summary:');
      console.log('- ✅ Login successful');
      console.log('- ✅ JWT payload includes linkedId');
      console.log('- ✅ Profile picture upload successful');
      console.log('- ✅ Cloudinary URL generated');
    } else {
      throw new Error('❌ Invalid profile picture URL returned');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testLinkedIdFix().catch(console.error);