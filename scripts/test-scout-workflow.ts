#!/usr/bin/env tsx

/**
 * End-to-End Scout Workflow Test
 * 
 * Tests the complete scout workflow:
 * 1. Student login and submission status check
 * 2. Scout login and review submission
 * 3. Scout Admin login and finalize submission
 */

// Using native fetch (Node.js 18+)

const API_BASE = 'http://localhost:5174';

interface ApiResponse {
  ok: boolean;
  status: number;
  data?: any;
  error?: any;
}

async function apiCall(endpoint: string, method: string = 'GET', body?: any, token?: string): Promise<ApiResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      data: response.ok ? data : undefined,
      error: !response.ok ? data : undefined,
    };
  } catch (error) {
    console.error(`API call failed: ${endpoint}`, error);
    return {
      ok: false,
      status: 500,
      error: { message: 'Network error', details: error.message },
    };
  }
}

async function login(email: string, password: string): Promise<string | null> {
  console.log(`🔐 Logging in as ${email}...`);
  
  const response = await apiCall('/api/auth/login', 'POST', { email, password });
  
  if (!response.ok) {
    console.error(`  ❌ Login failed:`, response.error);
    return null;
  }
  
  console.log(`  ✅ Login successful`);
  return response.data.token;
}

async function testUserMe(token: string, expectedRole: string): Promise<boolean> {
  console.log(`👤 Testing /api/users/me for ${expectedRole}...`);
  
  const response = await apiCall('/api/users/me', 'GET', undefined, token);
  
  if (!response.ok) {
    console.error(`  ❌ /api/users/me failed:`, response.error);
    return false;
  }
  
  if (response.data.role !== expectedRole) {
    console.error(`  ❌ Expected role ${expectedRole}, got ${response.data.role}`);
    return false;
  }
  
  console.log(`  ✅ User profile loaded successfully`);
  console.log(`     Name: ${response.data.name}`);
  console.log(`     Role: ${response.data.role}`);
  console.log(`     Email: ${response.data.email}`);
  return true;
}

async function testStudentSubmissions(token: string): Promise<boolean> {
  console.log(`📹 Testing student submissions...`);
  
  const response = await apiCall('/api/xen-watch/submissions/me', 'GET', undefined, token);
  
  if (!response.ok) {
    console.error(`  ❌ Failed to get student submissions:`, response.error);
    return false;
  }
  
  console.log(`  ✅ Student has ${response.data.submissions.length} submissions`);
  
  if (response.data.submissions.length > 0) {
    const submission = response.data.submissions[0];
    console.log(`     Submission ID: ${submission.id}`);
    console.log(`     Status: ${submission.status}`);
    console.log(`     Review Progress: ${submission.reviewProgress.submittedCount}/${submission.reviewProgress.totalScouts} scouts reviewed`);
  }
  
  return true;
}

async function testScoutReviewQueue(token: string): Promise<string | null> {
  console.log(`🔍 Testing scout review queue...`);
  
  const response = await apiCall('/api/xen-watch/scout/review-queue', 'GET', undefined, token);
  
  if (!response.ok) {
    console.error(`  ❌ Failed to get scout review queue:`, response.error);
    return null;
  }
  
  console.log(`  ✅ Scout has ${response.data.submissions.length} submissions to review`);
  
  if (response.data.submissions.length > 0) {
    const submission = response.data.submissions[0];
    console.log(`     Submission ID: ${submission.id}`);
    console.log(`     Student: ${submission.student.name}`);
    console.log(`     Status: ${submission.status}`);
    console.log(`     Current Review Status: ${submission.review?.isSubmitted ? 'Submitted' : 'Draft'}`);
    return submission.id;
  }
  
  return null;
}

async function testScoutReview(token: string, submissionId: string): Promise<boolean> {
  console.log(`⭐ Testing scout review submission...`);
  
  const reviewData = {
    rating: 4,
    notes: 'Great technique and form! Keep working on consistency. Shows good potential for improvement.',
    isSubmitted: true
  };
  
  const response = await apiCall(`/api/xen-watch/reviews/${submissionId}`, 'POST', reviewData, token);
  
  if (!response.ok) {
    console.error(`  ❌ Failed to submit scout review:`, response.error);
    return false;
  }
  
  console.log(`  ✅ Scout review submitted successfully`);
  console.log(`     Rating: ${reviewData.rating}/5`);
  console.log(`     Notes: ${reviewData.notes}`);
  return true;
}

async function testScoutAdminDashboard(token: string): Promise<string | null> {
  console.log(`👑 Testing scout admin dashboard...`);
  
  const response = await apiCall('/api/scout-admin/dashboard', 'GET', undefined, token);
  
  if (!response.ok) {
    console.error(`  ❌ Failed to get scout admin dashboard:`, response.error);
    return null;
  }
  
  console.log(`  ✅ Scout admin dashboard loaded`);
  console.log(`     Total Submissions: ${response.data.analytics.totalSubmissions}`);
  console.log(`     In Review: ${response.data.analytics.inReviewSubmissions}`);
  console.log(`     Finalized: ${response.data.analytics.finalizedSubmissions}`);
  console.log(`     Average Rating: ${response.data.analytics.avgRating?.toFixed(1) || 'N/A'}`);
  
  // Find a submission that has reviews and can be finalized
  const submissionWithReviews = response.data.submissions.find(
    (s: any) => s.status === 'in_review' && s.reviewProgress.submittedCount > 0
  );
  
  return submissionWithReviews?.id || null;
}

async function testScoutAdminFinalize(token: string, submissionId: string): Promise<boolean> {
  console.log(`✨ Testing scout admin finalize submission...`);
  
  const finalizeData = {
    finalRating: 4,
    summary: 'Based on scout reviews, this submission shows good technical skills with room for improvement. The student demonstrates solid fundamentals and should continue practicing to reach the next level.'
  };
  
  const response = await apiCall(`/api/scout-admin/finalize/${submissionId}`, 'POST', finalizeData, token);
  
  if (!response.ok) {
    console.error(`  ❌ Failed to finalize submission:`, response.error);
    return false;
  }
  
  console.log(`  ✅ Submission finalized successfully`);
  console.log(`     Final Rating: ${finalizeData.finalRating}/5`);
  console.log(`     Summary: ${finalizeData.summary}`);
  return true;
}

async function main() {
  console.log("🧪 Starting End-to-End Scout Workflow Test\n");
  
  let allTestsPassed = true;
  
  try {
    // Test 1: Student Login and Submissions
    console.log("=".repeat(60));
    console.log("TEST 1: STUDENT WORKFLOW");
    console.log("=".repeat(60));
    
    const studentToken = await login('student@xen.com', 'student123');
    if (!studentToken) {
      allTestsPassed = false;
    } else {
      if (!await testUserMe(studentToken, 'student')) allTestsPassed = false;
      if (!await testStudentSubmissions(studentToken)) allTestsPassed = false;
    }
    
    console.log();
    
    // Test 2: Scout Login and Review
    console.log("=".repeat(60));
    console.log("TEST 2: SCOUT WORKFLOW");
    console.log("=".repeat(60));
    
    const scoutToken = await login('scout@xen.com', 'scout123');
    let submissionId: string | null = null;
    
    if (!scoutToken) {
      allTestsPassed = false;
    } else {
      if (!await testUserMe(scoutToken, 'xen_scout')) allTestsPassed = false;
      submissionId = await testScoutReviewQueue(scoutToken);
      
      if (submissionId) {
        if (!await testScoutReview(scoutToken, submissionId)) allTestsPassed = false;
      } else {
        console.log("  ⚠️  No submissions available for review");
      }
    }
    
    console.log();
    
    // Test 3: Scout Admin Login and Finalize
    console.log("=".repeat(60));
    console.log("TEST 3: SCOUT ADMIN WORKFLOW");
    console.log("=".repeat(60));
    
    const scoutAdminToken = await login('scoutadmin@xen.com', 'scoutadmin123');
    
    if (!scoutAdminToken) {
      allTestsPassed = false;
    } else {
      if (!await testUserMe(scoutAdminToken, 'scout_admin')) allTestsPassed = false;
      const finalizeSubmissionId = await testScoutAdminDashboard(scoutAdminToken);
      
      if (finalizeSubmissionId) {
        if (!await testScoutAdminFinalize(scoutAdminToken, finalizeSubmissionId)) allTestsPassed = false;
      } else {
        console.log("  ⚠️  No submissions ready for finalization");
      }
    }
    
    console.log();
    
    // Test 4: Verify Student Sees Final Feedback
    console.log("=".repeat(60));
    console.log("TEST 4: FINAL VERIFICATION");
    console.log("=".repeat(60));
    
    if (studentToken) {
      console.log("📋 Checking student submissions after scout review...");
      await testStudentSubmissions(studentToken);
    }
    
  } catch (error) {
    console.error("❌ Test execution failed:", error);
    allTestsPassed = false;
  }
  
  console.log();
  console.log("=".repeat(60));
  if (allTestsPassed) {
    console.log("🎉 ALL TESTS PASSED! Scout workflow is working correctly.");
  } else {
    console.log("❌ SOME TESTS FAILED! Please check the issues above.");
  }
  console.log("=".repeat(60));
}

// Run the test
main().catch(console.error);
