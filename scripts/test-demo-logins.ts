#!/usr/bin/env tsx

/**
 * Comprehensive Demo Account Login Test Script for LockerRoom
 * 
 * This script tests login functionality for all demo accounts to ensure
 * they can authenticate successfully and access their profiles.
 */

import 'dotenv/config';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5174';

interface DemoAccount {
  email: string;
  password: string;
  role: string;
  description: string;
  expectedProfileType: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'sysadmin@lockerroom.com',
    password: 'SuperSecure123!',
    role: 'system_admin',
    description: 'System Administrator',
    expectedProfileType: 'system_admins'
  },
  {
    email: 'godwin@xen-hub.com',
    password: 'Admin123$',
    role: 'school_admin',
    description: 'School Administrator',
    expectedProfileType: 'school_admins'
  },
  {
    email: 'thiago@gmail.com',
    password: 'Test123456',
    role: 'student',
    description: 'Student Athlete',
    expectedProfileType: 'students'
  },
  {
    email: 'brayamooti@gmail.com',
    password: 'Pkw0epLSFG',
    role: 'public_viewer',
    description: 'Public Viewer',
    expectedProfileType: 'viewers'
  },
  {
    email: 'scout123@xen.com',
    password: '908734',
    role: 'xen_scout',
    description: 'XEN Scout',
    expectedProfileType: 'admins'
  }
];

async function testLogin(account: DemoAccount): Promise<{ success: boolean; error?: string; token?: string; user?: any; profile?: any; tokenPayload?: any }> {
  try {
    console.log(`🔐 Testing login for ${account.email} (${account.description})...`);
    
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: account.email,
        password: account.password
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.log(`  ❌ Login failed: ${data.error?.message || 'Unknown error'}`);
      return { success: false, error: data.error?.message || 'Unknown error' };
    }

    if (!data.token) {
      console.log(`  ❌ Login failed: No token returned`);
      return { success: false, error: 'No token returned' };
    }

    // Verify the token contains expected data
    const tokenPayload = JSON.parse(atob(data.token.split('.')[1]));
    
    if (tokenPayload.role !== account.role) {
      console.log(`  ❌ Role mismatch: expected ${account.role}, got ${tokenPayload.role}`);
      return { success: false, error: `Role mismatch: expected ${account.role}, got ${tokenPayload.role}` };
    }

    if (tokenPayload.email !== account.email) {
      console.log(`  ❌ Email mismatch: expected ${account.email}, got ${tokenPayload.email}`);
      return { success: false, error: `Email mismatch: expected ${account.email}, got ${tokenPayload.email}` };
    }

    // Check linkedId requirement
    const rolesRequiringLinkedId = ['student', 'school_admin', 'system_admin', 'viewer', 'public_viewer'];
    if (rolesRequiringLinkedId.includes(account.role) && !tokenPayload.linkedId) {
      console.log(`  ❌ Missing linkedId for role that requires it: ${account.role}`);
      return { success: false, error: `Missing linkedId for role: ${account.role}` };
    }

    console.log(`  ✅ Login successful!`);
    console.log(`    - Token: ${data.token.substring(0, 20)}...`);
    console.log(`    - Role: ${tokenPayload.role}`);
    console.log(`    - LinkedId: ${tokenPayload.linkedId || 'N/A'}`);
    console.log(`    - SchoolId: ${tokenPayload.schoolId || 'N/A'}`);

    return { 
      success: true, 
      token: data.token, 
      user: data.user,
      profile: data.profile,
      tokenPayload 
    };

  } catch (error) {
    console.log(`  ❌ Login failed with error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testProtectedEndpoint(token: string, account: DemoAccount): Promise<boolean> {
  try {
    console.log(`  🔒 Testing protected endpoint access...`);
    
    const response = await fetch(`${BASE_URL}/api/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.log(`    ❌ Protected endpoint failed: ${response.status}`);
      return false;
    }

    const data = await response.json();
    console.log(`    ✅ Protected endpoint access successful`);
    console.log(`    - User ID: ${data.id}`);
    console.log(`    - Role: ${data.role}`);
    return true;

  } catch (error) {
    console.log(`    ❌ Protected endpoint failed: ${error.message}`);
    return false;
  }
}

async function testRoleSpecificEndpoints(token: string, account: DemoAccount): Promise<boolean> {
  try {
    console.log(`  🎯 Testing role-specific endpoints...`);
    
    let endpoint = '';
    let expectedStatus = 200;
    
    switch (account.role) {
      case 'student':
        endpoint = '/api/posts/student/me';
        break;
      case 'school_admin':
        endpoint = '/api/school-admin/students';
        break;
      case 'system_admin':
        endpoint = '/api/system-admin/schools';
        break;
      case 'public_viewer':
      case 'viewer':
        endpoint = '/api/posts/feed';
        break;
      case 'xen_scout':
        endpoint = '/api/xen-watch/scout/review-queue';
        break;
      default:
        console.log(`    ⚠️  No specific endpoint test for role: ${account.role}`);
        return true;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.log(`    ❌ Role-specific endpoint failed: ${response.status}`);
      return false;
    }

    console.log(`    ✅ Role-specific endpoint access successful`);
    return true;

  } catch (error) {
    console.log(`    ❌ Role-specific endpoint failed: ${error.message}`);
    return false;
  }
}

async function verifyProfileData(account: DemoAccount, profile: any): Promise<boolean> {
  try {
    console.log(`  👤 Verifying profile data...`);
    
    if (!profile) {
      console.log(`    ❌ No profile data returned`);
      return false;
    }

    // Check that profile has expected fields based on role
    switch (account.role) {
      case 'system_admin':
        if (!profile.name || !profile.permissions) {
          console.log(`    ❌ System admin profile missing required fields`);
          return false;
        }
        break;
      case 'school_admin':
        if (!profile.name || !profile.schoolId) {
          console.log(`    ❌ School admin profile missing required fields`);
          return false;
        }
        break;
      case 'student':
        if (!profile.name || !profile.schoolId || !profile.sport) {
          console.log(`    ❌ Student profile missing required fields`);
          return false;
        }
        break;
      case 'public_viewer':
        if (!profile.name) {
          console.log(`    ❌ Public viewer profile missing required fields`);
          return false;
        }
        break;
      case 'xen_scout':
        if (!profile.name || !profile.xenId) {
          console.log(`    ❌ Scout profile missing required fields`);
          return false;
        }
        break;
    }

    console.log(`    ✅ Profile data verification successful`);
    console.log(`    - Name: ${profile.name}`);
    console.log(`    - Profile Type: ${account.expectedProfileType}`);
    return true;

  } catch (error) {
    console.log(`    ❌ Profile verification failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting comprehensive demo account login tests...\n");
  console.log(`Base URL: ${BASE_URL}\n`);

  const results: Array<{ account: DemoAccount; status: 'SUCCESS' | 'PARTIAL' | 'FAILED'; error?: string }> = [];
  let successCount = 0;
  let totalCount = DEMO_ACCOUNTS.length;

  for (const account of DEMO_ACCOUNTS) {
    console.log(`\n📋 Testing ${account.description} (${account.email})`);
    console.log("=" .repeat(60));
    
    const loginResult = await testLogin(account);
    
    if (loginResult.success) {
      // Test protected endpoint access
      const protectedAccess = await testProtectedEndpoint(loginResult.token!, account);
      
      // Test role-specific endpoints
      const roleAccess = await testRoleSpecificEndpoints(loginResult.token!, account);
      
      // Verify profile data
      const profileValid = await verifyProfileData(account, loginResult.profile);
      
      if (protectedAccess && roleAccess && profileValid) {
        successCount++;
        results.push({ account, status: 'SUCCESS' });
      } else {
        results.push({ account, status: 'PARTIAL', error: 'Some tests failed' });
      }
    } else {
      results.push({ account, status: 'FAILED', error: loginResult.error });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(80));
  
  results.forEach(result => {
    const status = result.status === 'SUCCESS' ? '✅' : result.status === 'PARTIAL' ? '⚠️' : '❌';
    console.log(`${status} ${result.account.email} (${result.account.role}) - ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n🎯 Results: ${successCount}/${totalCount} accounts fully successful`);
  
  if (successCount === totalCount) {
    console.log("🎉 All demo accounts are working correctly!");
    console.log("\n📋 Demo Account Summary:");
    DEMO_ACCOUNTS.forEach(account => {
      console.log(`  • ${account.email} (${account.role}) - ${account.description}`);
    });
    process.exit(0);
  } else {
    console.log("💥 Some demo accounts have issues that need to be fixed.");
    process.exit(1);
  }
}

// Run the tests
main().catch(console.error);