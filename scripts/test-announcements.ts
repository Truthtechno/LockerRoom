#!/usr/bin/env node

/**
 * Test script to validate announcement functionality
 * Run with: npx ts-node scripts/test-announcements.ts
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.API_URL || 'http://localhost:5174';

// Test credentials (update with actual demo credentials)
const SYSTEM_ADMIN_TOKEN = process.env.SYSTEM_ADMIN_TOKEN || 'your-system-admin-token';
const SCHOOL_ADMIN_TOKEN = process.env.SCHOOL_ADMIN_TOKEN || 'your-school-admin-token';
const STUDENT_TOKEN = process.env.STUDENT_TOKEN || 'your-student-token';
const SCHOOL_ID = process.env.TEST_SCHOOL_ID || 'your-test-school-id';

// Helper function to make authenticated requests
async function apiRequest(method: string, endpoint: string, token: string, body?: any) {
  const headers: any = {
    'Authorization': `Bearer ${token}`,
  };

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body,
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Unexpected response: ${response.status} ${text.slice(0, 200)}`);
  }

  return response.json();
}

// Test 1: Upload announcement media
async function testAnnouncementUpload() {
  console.log('🧪 Testing announcement media upload...');
  
  try {
    // Create a small test image file
    const testImagePath = path.join(__dirname, 'test-image.png');
    if (!fs.existsSync(testImagePath)) {
      // Create a minimal PNG file for testing
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x35, 0x5C, 0xC8, 0x5C, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      fs.writeFileSync(testImagePath, pngBuffer);
    }

    const formData = new FormData();
    const fileBuffer = fs.readFileSync(testImagePath);
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'image/png' });
    formData.append('file', blob, 'test-image.png');

    const uploadResponse = await fetch(`${API_BASE}/api/upload/announcement`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SYSTEM_ADMIN_TOKEN}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status} ${await uploadResponse.text()}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload successful:', uploadResult.file?.url);
    
    // Clean up
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }

    return uploadResult.file;
  } catch (error) {
    console.error('❌ Upload test failed:', error);
    return null;
  }
}

// Test 2: Create system announcement
async function testSystemAnnouncement(media?: any) {
  console.log('🧪 Testing system announcement creation...');
  
  try {
    const announcement = await apiRequest('POST', '/api/system/announcements', SYSTEM_ADMIN_TOKEN, {
      title: 'Test System Announcement',
      content: 'This is a test announcement from the system admin.',
      media: media ? {
        type: 'image',
        url: media.url,
        publicId: media.publicId
      } : null,
      scope: 'global'
    });

    console.log('✅ System announcement created:', announcement.announcement?.id);
    return announcement.announcement;
  } catch (error) {
    console.error('❌ System announcement test failed:', error);
    return null;
  }
}

// Test 3: Create school announcement
async function testSchoolAnnouncement(media?: any) {
  console.log('🧪 Testing school announcement creation...');
  
  try {
    const announcement = await apiRequest('POST', `/api/schools/${SCHOOL_ID}/announcements`, SCHOOL_ADMIN_TOKEN, {
      title: 'Test School Announcement',
      content: 'This is a test announcement from the school admin.',
      media: media ? {
        type: 'image',
        url: media.url,
        publicId: media.publicId
      } : null
    });

    console.log('✅ School announcement created:', announcement.announcement?.id);
    return announcement.announcement;
  } catch (error) {
    console.error('❌ School announcement test failed:', error);
    return null;
  }
}

// Test 4: Check announcements in feeds
async function testAnnouncementFeeds() {
  console.log('🧪 Testing announcement feeds...');
  
  try {
    // Test system admin feed
    const systemAdminFeed = await apiRequest('GET', '/api/posts?includeAnnouncements=true&global=true', SYSTEM_ADMIN_TOKEN);
    const systemAnnouncements = systemAdminFeed.filter((post: any) => post.type === 'announcement');
    console.log(`✅ System admin feed has ${systemAnnouncements.length} announcements`);

    // Test school admin feed
    const schoolAdminFeed = await apiRequest('GET', `/api/posts?includeAnnouncements=true&schoolId=${SCHOOL_ID}`, SCHOOL_ADMIN_TOKEN);
    const schoolAnnouncements = schoolAdminFeed.filter((post: any) => post.type === 'announcement');
    console.log(`✅ School admin feed has ${schoolAnnouncements.length} announcements`);

    // Test student feed
    const studentFeed = await apiRequest('GET', '/api/posts?includeAnnouncements=true', STUDENT_TOKEN);
    const studentAnnouncements = studentFeed.filter((post: any) => post.type === 'announcement');
    console.log(`✅ Student feed has ${studentAnnouncements.length} announcements`);

    return {
      systemAnnouncements: systemAnnouncements.length,
      schoolAnnouncements: schoolAnnouncements.length,
      studentAnnouncements: studentAnnouncements.length
    };
  } catch (error) {
    console.error('❌ Feed test failed:', error);
    return null;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting announcement functionality tests...\n');

  // Check if required tokens are available
  if (!SYSTEM_ADMIN_TOKEN || SYSTEM_ADMIN_TOKEN === 'your-system-admin-token') {
    console.log('⚠️  Please set SYSTEM_ADMIN_TOKEN environment variable');
    console.log('   You can get tokens by logging in and checking localStorage.getItem("token")');
  }

  try {
    // Test 1: Upload media
    const uploadedMedia = await testAnnouncementUpload();
    console.log('');

    // Test 2: Create system announcement
    const systemAnnouncement = await testSystemAnnouncement(uploadedMedia);
    console.log('');

    // Test 3: Create school announcement
    const schoolAnnouncement = await testSchoolAnnouncement(uploadedMedia);
    console.log('');

    // Test 4: Check feeds
    const feedResults = await testAnnouncementFeeds();
    console.log('');

    // Summary
    console.log('📊 Test Summary:');
    console.log(`   Media upload: ${uploadedMedia ? '✅ Pass' : '❌ Fail'}`);
    console.log(`   System announcement: ${systemAnnouncement ? '✅ Pass' : '❌ Fail'}`);
    console.log(`   School announcement: ${schoolAnnouncement ? '✅ Pass' : '❌ Fail'}`);
    console.log(`   Feed integration: ${feedResults ? '✅ Pass' : '❌ Fail'}`);

    if (feedResults) {
      console.log(`   - System admin sees: ${feedResults.systemAnnouncements} announcements`);
      console.log(`   - School admin sees: ${feedResults.schoolAnnouncements} announcements`);
      console.log(`   - Student sees: ${feedResults.studentAnnouncements} announcements`);
    }

  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Manual testing instructions
function printManualTestInstructions() {
  console.log('\n📋 Manual Testing Instructions:');
  console.log('');
  console.log('1. 🔐 Login as System Admin:');
  console.log('   - Go to System Admin dashboard');
  console.log('   - Click "Create Announcement" button');
  console.log('   - Upload a small PNG image');
  console.log('   - Fill in title and content');
  console.log('   - Select scope (Global/School/Staff)');
  console.log('   - Submit and verify success toast');
  console.log('');
  console.log('2. 🏫 Login as School Admin:');
  console.log('   - Go to School Admin dashboard');
  console.log('   - Click "Create Announcement" button');
  console.log('   - Upload media and create announcement');
  console.log('   - Verify it appears in school feed');
  console.log('');
  console.log('3. 👨‍🎓 Login as Student:');
  console.log('   - Go to student feed');
  console.log('   - Verify announcements appear with yellow banner');
  console.log('   - Check that global and school announcements are visible');
  console.log('');
  console.log('4. 🌐 Network Tab Verification:');
  console.log('   - Open browser dev tools');
  console.log('   - Watch for "Unexpected token \'<\'" errors');
  console.log('   - Verify all responses are JSON with proper Content-Type');
  console.log('');
  console.log('5. 📱 Mobile Testing:');
  console.log('   - Test on mobile viewport');
  console.log('   - Verify announcement modal is responsive');
  console.log('   - Check that announcement cards don\'t overflow');
}

if (require.main === module) {
  if (process.argv.includes('--manual')) {
    printManualTestInstructions();
  } else {
    runTests().catch(console.error);
  }
}

export { runTests, printManualTestInstructions };
