#!/usr/bin/env tsx

/**
 * Comprehensive test script for admin account disable/enable/delete functionality
 * Tests:
 * 1. Disable admin account - verify login is blocked
 * 2. Enable admin account - verify login works again
 * 3. Delete admin account - verify account is permanently removed
 * 4. Error message verification
 */

import 'dotenv/config';
import { db } from '../server/db';
import { users, admins } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const BASE_URL = process.env.API_BASE_URL || process.env.BASE_URL || 'http://localhost:5174';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function logResult(test: string, passed: boolean, error?: string, details?: string) {
  results.push({ test, passed, error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${test}`);
  if (details) console.log(`   ${details}`);
  if (error) console.log(`   Error: ${error}`);
}

async function loginAsSystemAdmin(): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sysadmin@lockerroom.com',
        password: 'SuperSecure123!'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Login failed');
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Failed to login as system admin:', error);
    return null;
  }
}

async function testLogin(email: string, password: string): Promise<{ success: boolean; error?: string; code?: string }> {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Login failed',
        code: data.error?.code
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function findOrCreateTestAdmin(token: string): Promise<{ adminId: string; userId: string; email: string; password: string } | null> {
  try {
    const testEmail = `test-admin-disable-${Date.now()}@test.com`;
    const testPassword = 'TestPassword123!';
    
    // Create a new test admin via API
    const createResponse = await fetch(`${BASE_URL}/api/admin/create-admin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Admin for Disable',
        email: testEmail,
        role: 'moderator'
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(error.error?.message || 'Failed to create test admin');
    }

    const createData = await createResponse.json();
    const adminId = createData.admin?.id || createData.scout?.id;
    
    // Find the user record
    const [user] = await db.select().from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    if (!user) {
      throw new Error('User record not found after creation');
    }

    // Set a password for the user so we can test login
    const passwordHash = await bcrypt.hash(testPassword, 12);
    await db.update(users)
      .set({ passwordHash })
      .where(eq(users.id, user.id));

    return {
      adminId: adminId || user.id,
      userId: user.id,
      email: testEmail,
      password: testPassword
    };
  } catch (error) {
    console.error('Failed to find/create test admin:', error);
    return null;
  }
}

async function disableAdmin(token: string, adminId: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/admin/${adminId}/disable`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

async function enableAdmin(token: string, adminId: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/admin/${adminId}/enable`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

async function deleteAdmin(token: string, adminId: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/admin/${adminId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

async function verifyAccountFrozen(userId: string): Promise<boolean> {
  try {
    const [user] = await db.select({ isFrozen: users.isFrozen })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    return user?.isFrozen === true;
  } catch (error) {
    return false;
  }
}

async function verifyAccountDeleted(adminId: string, userId: string): Promise<boolean> {
  try {
    const [admin] = await db.select().from(admins)
      .where(eq(admins.id, adminId))
      .limit(1);
    
    const [user] = await db.select().from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    return !admin && !user;
  } catch (error) {
    return false;
  }
}

async function runTests() {
  console.log('🧪 Starting comprehensive admin disable/enable/delete tests...\n');

  // Test 1: Login as system admin
  console.log('📋 Test 1: Login as system admin');
  const systemAdminToken = await loginAsSystemAdmin();
  if (!systemAdminToken) {
    await logResult('Login as system admin', false, 'Failed to login as system admin');
    console.log('\n❌ Cannot proceed without system admin access');
    return;
  }
  await logResult('Login as system admin', true);

  // Test 2: Find or create test admin
  console.log('\n📋 Test 2: Find or create test admin');
  const testAdmin = await findOrCreateTestAdmin(systemAdminToken);
  if (!testAdmin) {
    await logResult('Find or create test admin', false, 'Failed to create test admin');
    console.log('\n❌ Cannot proceed without test admin');
    return;
  }
  await logResult('Find or create test admin', true, undefined, `Admin ID: ${testAdmin.adminId}, Email: ${testAdmin.email}`);

  // Test 3: Verify test admin can login before disabling
  console.log('\n📋 Test 3: Verify test admin can login (before disable)');
  const loginBeforeDisable = await testLogin(testAdmin.email, testAdmin.password);
  if (loginBeforeDisable.success) {
    await logResult('Login before disable', true, undefined, 'Test admin can login successfully');
  } else {
    await logResult('Login before disable', false, loginBeforeDisable.error || 'Login failed');
  }

  // Test 4: Disable admin account
  console.log('\n📋 Test 4: Disable admin account');
  const disableSuccess = await disableAdmin(systemAdminToken, testAdmin.adminId);
  if (!disableSuccess) {
    await logResult('Disable admin account', false, 'Failed to disable admin');
  } else {
    await logResult('Disable admin account', true);
    
    // Test 4a: Verify account is frozen in database
    console.log('\n📋 Test 4a: Verify account is frozen in database');
    const isFrozen = await verifyAccountFrozen(testAdmin.userId);
    if (isFrozen) {
      await logResult('Account marked as frozen in database', true);
    } else {
      await logResult('Account marked as frozen in database', false, 'Account is not frozen after disable');
    }

    // Test 4b: Verify login is blocked with correct error message
    console.log('\n📋 Test 4b: Verify login is blocked with correct error');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay to ensure DB update
    
    // Double-check frozen status before testing login
    const doubleCheckFrozen = await verifyAccountFrozen(testAdmin.userId);
    console.log(`   Double-check: Account frozen status = ${doubleCheckFrozen}`);
    
    const loginAfterDisable = await testLogin(testAdmin.email, testAdmin.password);
    console.log(`   Login result: success=${loginAfterDisable.success}, code=${loginAfterDisable.code}, error=${loginAfterDisable.error}`);
    
    if (!loginAfterDisable.success && loginAfterDisable.code === 'account_deactivated') {
      await logResult('Login blocked with correct error code', true, undefined, `Error: ${loginAfterDisable.error}`);
    } else if (!loginAfterDisable.success) {
      await logResult('Login blocked with correct error code', false, `Expected account_deactivated, got ${loginAfterDisable.code || 'none'}`, `Error: ${loginAfterDisable.error}`);
    } else {
      await logResult('Login blocked with correct error code', false, 'Login succeeded when it should be blocked');
    }

    // Test 4c: Verify error message contains correct text
    console.log('\n📋 Test 4c: Verify error message content');
    if (loginAfterDisable.error?.includes('deactivated') && loginAfterDisable.error?.includes('Customer Support')) {
      await logResult('Error message contains correct text', true, undefined, `Message: ${loginAfterDisable.error}`);
    } else {
      await logResult('Error message contains correct text', false, 'Error message does not contain expected text', `Got: ${loginAfterDisable.error}`);
    }
  }

  // Test 5: Enable admin account
  console.log('\n📋 Test 5: Enable admin account');
  const enableSuccess = await enableAdmin(systemAdminToken, testAdmin.adminId);
  if (!enableSuccess) {
    await logResult('Enable admin account', false, 'Failed to enable admin');
  } else {
    await logResult('Enable admin account', true);
    
    // Test 5a: Verify account is not frozen in database
    console.log('\n📋 Test 5a: Verify account is not frozen after enable');
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    const isStillFrozen = await verifyAccountFrozen(testAdmin.userId);
    if (!isStillFrozen) {
      await logResult('Account unfrozen after enable', true);
    } else {
      await logResult('Account unfrozen after enable', false, 'Account is still frozen after enable');
    }

    // Test 5b: Verify login works after enable
    console.log('\n📋 Test 5b: Verify login works after enable');
    const loginAfterEnable = await testLogin(testAdmin.email, testAdmin.password);
    if (loginAfterEnable.success) {
      await logResult('Login works after enable', true, undefined, 'Test admin can login again');
    } else {
      await logResult('Login works after enable', false, loginAfterEnable.error || 'Login still blocked');
    }
  }

  // Test 6: Disable again for delete test
  console.log('\n📋 Test 6: Disable admin again (preparation for delete test)');
  await disableAdmin(systemAdminToken, testAdmin.adminId);
  await logResult('Disable admin before delete', true);

  // Test 7: Delete admin account
  console.log('\n📋 Test 7: Delete admin account');
  const deleteSuccess = await deleteAdmin(systemAdminToken, testAdmin.adminId);
  if (!deleteSuccess) {
    await logResult('Delete admin account', false, 'Failed to delete admin');
  } else {
    await logResult('Delete admin account', true);
    
    // Test 7a: Verify account is deleted from database
    console.log('\n📋 Test 7a: Verify account is deleted from database');
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    const isDeleted = await verifyAccountDeleted(testAdmin.adminId, testAdmin.userId);
    if (isDeleted) {
      await logResult('Account deleted from database', true);
    } else {
      await logResult('Account deleted from database', false, 'Account still exists after delete');
    }

    // Test 7b: Verify login fails (account doesn't exist)
    console.log('\n📋 Test 7b: Verify login fails for deleted account');
    const loginAfterDelete = await testLogin(testAdmin.email, testAdmin.password);
    if (!loginAfterDelete.success) {
      await logResult('Login fails for deleted account', true, undefined, `Error: ${loginAfterDelete.error || 'Login failed'}`);
    } else {
      await logResult('Login fails for deleted account', false, 'Login succeeded for deleted account');
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.test}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (failed === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});

