#!/usr/bin/env node

/**
 * Test script for school profile picture upload
 * This script tests the new POST /api/system-admin/schools/:schoolId/profile-pic route
 */

const fs = require('fs');
const path = require('path');

async function testSchoolProfileUpload() {
  console.log('🧪 Testing school profile picture upload...');
  
  try {
    // First, get a list of schools to test with
    const schoolsResponse = await fetch('http://localhost:5174/api/system-admin/schools', {
      headers: {
        'Authorization': `Bearer ${process.env.TEST_SYSTEM_ADMIN_TOKEN || 'test-token'}`
      }
    });
    
    if (!schoolsResponse.ok) {
      console.log('❌ Could not fetch schools list. Make sure the server is running and you have a valid token.');
      return;
    }
    
    const schoolsData = await schoolsResponse.json();
    const schools = schoolsData.schools || [];
    
    if (schools.length === 0) {
      console.log('❌ No schools found to test with. Create a school first.');
      return;
    }
    
    const testSchool = schools[0];
    console.log(`🏫 Testing with school: ${testSchool.name} (ID: ${testSchool.id})`);
    
    // Create a simple test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    // Create FormData for the upload
    const formData = new FormData();
    const blob = new Blob([testImageBuffer], { type: 'image/png' });
    formData.append('profilePic', blob, 'test-school-profile.png');
    
    // Test the upload endpoint
    const uploadResponse = await fetch(`http://localhost:5174/api/system-admin/schools/${testSchool.id}/profile-pic`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TEST_SYSTEM_ADMIN_TOKEN || 'test-token'}`
      },
      body: formData
    });
    
    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      console.log('✅ School profile picture upload successful!');
      console.log('📸 Profile picture URL:', uploadData.profilePicUrl);
      
      // Verify the school was updated by fetching it again
      const updatedSchoolsResponse = await fetch('http://localhost:5174/api/system-admin/schools', {
        headers: {
          'Authorization': `Bearer ${process.env.TEST_SYSTEM_ADMIN_TOKEN || 'test-token'}`
        }
      });
      
      if (updatedSchoolsResponse.ok) {
        const updatedSchoolsData = await updatedSchoolsResponse.json();
        const updatedSchool = updatedSchoolsData.schools.find(s => s.id === testSchool.id);
        
        if (updatedSchool && updatedSchool.profilePicUrl) {
          console.log('✅ School profile picture URL updated in database:', updatedSchool.profilePicUrl);
        } else {
          console.log('❌ School profile picture URL not found in database');
        }
      }
    } else {
      const errorData = await uploadResponse.json();
      console.log('❌ School profile picture upload failed:', errorData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testSchoolProfileUpload();
}

module.exports = { testSchoolProfileUpload };
