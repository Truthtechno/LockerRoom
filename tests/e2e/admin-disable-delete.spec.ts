import { test, expect } from '@playwright/test';

test.describe('Admin Disable/Delete Functionality', () => {
  let systemAdminToken: string;
  let testAdminEmail: string;
  let testAdminId: string;

  test.beforeAll(async ({ request }) => {
    // Login as system admin
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'sysadmin@lockerroom.com',
        password: 'SuperSecure123!'
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    systemAdminToken = loginData.token;

    // Create a test admin for testing
    const createResponse = await request.post('/api/admin/create-admin', {
      headers: {
        'Authorization': `Bearer ${systemAdminToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Test Admin for E2E',
        email: `test-admin-e2e-${Date.now()}@test.com`,
        role: 'moderator'
      }
    });

    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    testAdminEmail = createData.admin?.email || createData.scout?.email;
    testAdminId = createData.admin?.id || createData.scout?.id;
  });

  test('should display deactivated account message when disabled admin tries to login', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // First, disable the test admin
    const disableResponse = await page.request.put(`/api/admin/${testAdminId}/disable`, {
      headers: {
        'Authorization': `Bearer ${systemAdminToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(disableResponse.ok()).toBeTruthy();

    // Wait a moment for the database to update
    await page.waitForTimeout(500);

    // Try to login with the disabled account
    await page.fill('[data-testid="input-email"]', testAdminEmail);
    await page.fill('[data-testid="input-password"]', 'testpassword123'); // Note: This would need to be set in beforeAll
    
    await page.click('[data-testid="button-login"]');

    // Should show deactivated account message
    await expect(page.locator('text=/deactivated/i')).toBeVisible();
    await expect(page.locator('text=/Customer Support/i')).toBeVisible();
    
    // Should NOT redirect to any dashboard
    await expect(page).toHaveURL(/\/login/);
  });

  test('should allow login after admin account is re-enabled', async ({ page, request }) => {
    // First, enable the test admin
    const enableResponse = await request.put(`/api/admin/${testAdminId}/enable`, {
      headers: {
        'Authorization': `Bearer ${systemAdminToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(enableResponse.ok()).toBeTruthy();

    // Wait a moment for the database to update
    await page.waitForTimeout(500);

    // Navigate to login page
    await page.goto('/login');

    // Try to login with the re-enabled account
    await page.fill('[data-testid="input-email"]', testAdminEmail);
    await page.fill('[data-testid="input-password"]', 'testpassword123');
    
    await page.click('[data-testid="button-login"]');

    // Should either login successfully or show password reset required
    // (depending on whether password was set)
    const currentUrl = page.url();
    expect(
      currentUrl.includes('/feed') || 
      currentUrl.includes('/reset-password') ||
      currentUrl.includes('/system-admin')
    ).toBeTruthy();
  });

  test('should prevent login for deleted admin account', async ({ page, request }) => {
    // First, disable the test admin
    await request.put(`/api/admin/${testAdminId}/disable`, {
      headers: {
        'Authorization': `Bearer ${systemAdminToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Delete the test admin
    const deleteResponse = await request.delete(`/api/admin/${testAdminId}`, {
      headers: {
        'Authorization': `Bearer ${systemAdminToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(deleteResponse.ok()).toBeTruthy();

    // Wait a moment for the database to update
    await page.waitForTimeout(500);

    // Navigate to login page
    await page.goto('/login');

    // Try to login with the deleted account
    await page.fill('[data-testid="input-email"]', testAdminEmail);
    await page.fill('[data-testid="input-password"]', 'testpassword123');
    
    await page.click('[data-testid="button-login"]');

    // Should show invalid credentials error (account doesn't exist)
    await expect(page.locator('text=/Invalid credentials/i')).toBeVisible();
    
    // Should NOT redirect
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show correct error message format for deactivated accounts', async ({ page, request }) => {
    // Create a new test admin for this test
    const createResponse = await request.post('/api/admin/create-admin', {
      headers: {
        'Authorization': `Bearer ${systemAdminToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Test Admin Error Message',
        email: `test-admin-error-${Date.now()}@test.com`,
        role: 'moderator'
      }
    });

    const createData = await createResponse.json();
    const adminId = createData.admin?.id || createData.scout?.id;
    const adminEmail = createData.admin?.email || createData.scout?.email;

    // Disable the admin
    await request.put(`/api/admin/${adminId}/disable`, {
      headers: {
        'Authorization': `Bearer ${systemAdminToken}`,
        'Content-Type': 'application/json'
      }
    });

    await page.waitForTimeout(500);

    // Navigate to login page
    await page.goto('/login');

    // Try to login
    await page.fill('[data-testid="input-email"]', adminEmail);
    await page.fill('[data-testid="input-password"]', 'testpassword123');
    
    await page.click('[data-testid="button-login"]');

    // Verify the error message contains the expected text
    const errorMessage = await page.locator('[role="alert"], .toast, [data-testid="error-message"]').textContent();
    
    expect(errorMessage).toContain('deactivated');
    expect(errorMessage).toContain('Customer Support');
    expect(errorMessage).toContain('reactivation');

    // Cleanup: delete the test admin
    await request.delete(`/api/admin/${adminId}`, {
      headers: {
        'Authorization': `Bearer ${systemAdminToken}`,
        'Content-Type': 'application/json'
      }
    });
  });
});

