#!/usr/bin/env node

/**
 * Test script for Xen Watch video upload and submission system
 * This script tests the complete flow:
 * 1. Upload a video file to /api/upload/video
 * 2. Submit the video to /api/xen-watch/submissions
 * 3. Verify the submission was created
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5174';
const TEST_VIDEO_PATH = path.join(process.cwd(), 'tests/fixtures/test-video.mp4');

// Mock authentication token (you'll need to replace this with a real token)
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'mock-token';

async function testVideoUpload() {
  console.log('🧪 Testing Xen Watch video upload and submission...\n');

  try {
    // Check if test video exists
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      console.log('❌ Test video not found. Creating a mock video file...');
      // Create a small mock video file for testing
      const mockVideoContent = Buffer.from('mock video content');
      fs.writeFileSync(TEST_VIDEO_PATH, mockVideoContent);
    }

    // Step 1: Test video upload
    console.log('📤 Step 1: Testing video upload...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(TEST_VIDEO_PATH), {
      filename: 'test-video.mp4',
      contentType: 'video/mp4'
    });

    const uploadResponse = await fetch(`${BASE_URL}/api/upload/video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    console.log(`Upload response status: ${uploadResponse.status}`);
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.log(`❌ Upload failed: ${errorText}`);
      return false;
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload successful!');
    console.log(`Video URL: ${uploadResult.videoUrl}`);
    console.log(`Thumbnail URL: ${uploadResult.thumbUrl}`);

    // Step 2: Test submission creation
    console.log('\n📝 Step 2: Testing submission creation...');
    const submissionData = {
      videoUrl: uploadResult.videoUrl,
      thumbUrl: uploadResult.thumbUrl,
      notes: 'Test submission from automated test',
      promoCode: 'TEST2024'
    };

    const submissionResponse = await fetch(`${BASE_URL}/api/xen-watch/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify(submissionData)
    });

    console.log(`Submission response status: ${submissionResponse.status}`);
    
    if (!submissionResponse.ok) {
      const errorText = await submissionResponse.text();
      console.log(`❌ Submission failed: ${errorText}`);
      return false;
    }

    const submissionResult = await submissionResponse.json();
    console.log('✅ Submission successful!');
    console.log(`Submission ID: ${submissionResult.submission.id}`);

    // Step 3: Test retrieval
    console.log('\n📋 Step 3: Testing submission retrieval...');
    const mySubmissionsResponse = await fetch(`${BASE_URL}/api/xen-watch/submissions/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    console.log(`My submissions response status: ${mySubmissionsResponse.status}`);
    
    if (!mySubmissionsResponse.ok) {
      const errorText = await mySubmissionsResponse.text();
      console.log(`❌ Retrieval failed: ${errorText}`);
      return false;
    }

    const mySubmissionsResult = await mySubmissionsResponse.json();
    console.log('✅ Retrieval successful!');
    console.log(`Found ${mySubmissionsResult.submissions.length} submissions`);

    // Verify our submission is in the list
    const ourSubmission = mySubmissionsResult.submissions.find(
      sub => sub.id === submissionResult.submission.id
    );
    
    if (ourSubmission) {
      console.log('✅ Our submission found in the list!');
      console.log(`Status: ${ourSubmission.status}`);
      console.log(`Video URL: ${ourSubmission.videoUrl}`);
    } else {
      console.log('❌ Our submission not found in the list');
      return false;
    }

    console.log('\n🎉 All tests passed! Xen Watch upload and submission system is working correctly.');
    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

// Error handling tests
async function testErrorCases() {
  console.log('\n🔍 Testing error cases...\n');

  try {
    // Test 1: Upload without file
    console.log('Test 1: Upload without file...');
    const emptyFormData = new FormData();
    
    const response1 = await fetch(`${BASE_URL}/api/upload/video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        ...emptyFormData.getHeaders()
      },
      body: emptyFormData
    });

    if (response1.status === 400) {
      const error = await response1.json();
      if (error.error === 'No file provided') {
        console.log('✅ Correctly returns "No file provided" error');
      } else {
        console.log(`❌ Unexpected error message: ${error.error}`);
      }
    } else {
      console.log(`❌ Expected 400 status, got ${response1.status}`);
    }

    // Test 2: Upload with wrong file type
    console.log('\nTest 2: Upload with wrong file type...');
    const wrongFormData = new FormData();
    wrongFormData.append('file', Buffer.from('not a video'), {
      filename: 'test.txt',
      contentType: 'text/plain'
    });

    const response2 = await fetch(`${BASE_URL}/api/upload/video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        ...wrongFormData.getHeaders()
      },
      body: wrongFormData
    });

    if (response2.status === 400) {
      const error = await response2.json();
      if (error.error === 'Only video files are allowed') {
        console.log('✅ Correctly returns "Only video files are allowed" error');
      } else {
        console.log(`❌ Unexpected error message: ${error.error}`);
      }
    } else {
      console.log(`❌ Expected 400 status, got ${response2.status}`);
    }

    // Test 3: Submission without video URL
    console.log('\nTest 3: Submission without video URL...');
    const response3 = await fetch(`${BASE_URL}/api/xen-watch/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        notes: 'Test without video URL'
      })
    });

    if (response3.status === 400) {
      const error = await response3.json();
      if (error.error?.message === 'Video URL is required') {
        console.log('✅ Correctly returns "Video URL is required" error');
      } else {
        console.log(`❌ Unexpected error message: ${JSON.stringify(error)}`);
      }
    } else {
      console.log(`❌ Expected 400 status, got ${response3.status}`);
    }

    console.log('\n✅ All error case tests completed!');

  } catch (error) {
    console.error('❌ Error case tests failed:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Xen Watch Upload & Submission Tests\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Auth Token: ${AUTH_TOKEN.substring(0, 10)}...\n`);

  const success = await testVideoUpload();
  await testErrorCases();

  if (success) {
    console.log('\n🎯 All tests completed successfully!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed!');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { testVideoUpload, testErrorCases };
