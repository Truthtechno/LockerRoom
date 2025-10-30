#!/usr/bin/env node

/**
 * Test script to verify that scouts can see other scouts' reviews
 * This script will:
 * 1. Login as scout1 and create a review
 * 2. Login as scout2 and create a review  
 * 3. Login as scout1 again and verify they can see scout2's review
 */

const API_BASE = 'http://localhost:5174';

async function makeRequest(method, endpoint, body = null, token = null) {
  const https = require('http');
  
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(jsonData);
          } else {
            reject(new Error(`API call failed: ${endpoint} - ${res.statusCode} ${data}`));
          }
        } catch (error) {
          reject(new Error(`API call failed: ${endpoint} - ${res.statusCode} ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function login(email, password) {
  console.log(`🔐 Logging in as ${email}...`);
  const response = await makeRequest('POST', '/api/auth/login', { email, password });
  console.log(`✅ Login successful for ${email}`);
  return response.token;
}

async function getReviewQueue(token) {
  console.log('📋 Getting review queue...');
  const response = await makeRequest('GET', '/api/xen-watch/scout/review-queue', null, token);
  console.log(`✅ Found ${response.submissions.length} submissions in queue`);
  return response.submissions;
}

async function createReview(token, submissionId, rating, notes, isSubmitted = true) {
  console.log(`📝 Creating review for submission ${submissionId}...`);
  const response = await makeRequest('POST', `/api/xen-watch/reviews/${submissionId}`, {
    rating,
    notes,
    isSubmitted
  }, token);
  console.log(`✅ Review created successfully`);
  return response;
}

async function testScoutReviews() {
  try {
    console.log('🚀 Starting scout reviews visibility test...\n');

    // Step 1: Login as scout1
    const scout1Token = await login('scout@xen.com', 'scout123');
    
    // Step 2: Get review queue for scout1
    const submissions = await getReviewQueue(scout1Token);
    
    if (submissions.length === 0) {
      console.log('❌ No submissions found in scout queue. Please ensure test data exists.');
      return;
    }
    
    const testSubmission = submissions[0];
    console.log(`📋 Testing with submission: ${testSubmission.id}`);
    
    // Step 3: Scout1 creates a review
    await createReview(scout1Token, testSubmission.id, 4, 'Great technique and form!', true);
    
    // Step 4: Login as scout2 (scoutadmin@xen.com)
    const scout2Token = await login('scoutadmin@xen.com', 'scoutadmin123');
    
    // Step 5: Scout2 creates a review for the same submission
    await createReview(scout2Token, testSubmission.id, 5, 'Excellent performance, very impressive!', true);
    
    // Step 6: Login back as scout1 and check if they can see scout2's review
    console.log('\n🔄 Switching back to scout1 to check visibility...');
    const scout1Token2 = await login('scout@xen.com', 'scout123');
    const updatedSubmissions = await getReviewQueue(scout1Token2);
    
    const updatedSubmission = updatedSubmissions.find(s => s.id === testSubmission.id);
    
    if (!updatedSubmission) {
      console.log('❌ Could not find the test submission in updated queue');
      return;
    }
    
    console.log('\n📊 Review Visibility Results:');
    console.log(`Submission ID: ${updatedSubmission.id}`);
    console.log(`Total Reviews: ${updatedSubmission.allReviews?.length || 0}`);
    
    if (updatedSubmission.allReviews && updatedSubmission.allReviews.length > 0) {
      console.log('\n👥 All Reviews:');
      updatedSubmission.allReviews.forEach((review, index) => {
        console.log(`  ${index + 1}. Scout: ${review.scout.name} (${review.scout.xenId})`);
        console.log(`     Rating: ${review.rating}/5`);
        console.log(`     Notes: ${review.notes}`);
        console.log(`     Status: ${review.isSubmitted ? 'Submitted' : 'Draft'}`);
        console.log(`     Date: ${new Date(review.createdAt).toLocaleString()}`);
        console.log('');
      });
      
      // Check if scout1 can see scout2's review
      const scout2Review = updatedSubmission.allReviews.find(r => r.scout.xenId === 'XSA-25101');
      if (scout2Review) {
        console.log('✅ SUCCESS: Scout1 can see Scout2\'s review!');
        console.log(`   Scout2's rating: ${scout2Review.rating}/5`);
        console.log(`   Scout2's notes: ${scout2Review.notes}`);
      } else {
        console.log('❌ FAILURE: Scout1 cannot see Scout2\'s review');
      }
    } else {
      console.log('❌ No reviews found in allReviews array');
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testScoutReviews();