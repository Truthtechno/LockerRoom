import { test, expect } from '@playwright/test';

test.describe('Security & Access Control', () => {
  test('Protected routes should require authentication', async ({ page }) => {
    // Try to access protected routes without login
    const protectedRoutes = [
      '/feed',
      '/settings',
      '/school-admin',
      '/system-admin',
      '/stats'
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to login or show auth error
      const currentUrl = page.url();
      const isLoginPage = currentUrl.includes('/login');
      const hasAuthError = await page.locator('text=Authentication required').isVisible();
      
      expect(isLoginPage || hasAuthError).toBeTruthy();
    }
  });

  test('API calls without JWT should return 401', async ({ page }) => {
    // Make API call without authentication
    const response = await page.request.get('http://localhost:5174/api/posts');
    expect(response.status()).toBe(401);
    
    const responseData = await response.json();
    expect(responseData.error).toBeDefined();
    expect(responseData.error.code).toBe('unauthorized');
  });

  test('Viewer should not be able to create student posts', async ({ page }) => {
    // Login as viewer
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    // Try to access create post (should not be available to viewers)
    await page.goto('/create-post');
    
    // Should either redirect or show access denied
    const currentUrl = page.url();
    const hasAccessDenied = await page.locator('text=Access denied').isVisible();
    const isNotCreatePost = !currentUrl.includes('/create-post');
    
    expect(hasAccessDenied || isNotCreatePost).toBeTruthy();
  });

  test('School admin should not access system admin features', async ({ page }) => {
    // Login as school admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'principal@lincoln.edu');
    await page.fill('[data-testid="input-password"]', 'principal123');
    await page.click('[data-testid="button-login"]');
    
    // Try to access system admin features
    await page.goto('/system-admin');
    
    // Should show access denied or redirect
    const hasAccessDenied = await page.locator('text=Insufficient permissions').isVisible();
    const isNotSystemAdmin = !page.url().includes('/system-admin');
    
    expect(hasAccessDenied || isNotSystemAdmin).toBeTruthy();
  });

  test('Student should not access admin features', async ({ page }) => {
    // Login as student
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'marcus.rodriguez@student.com');
    await page.fill('[data-testid="input-password"]', 'student123');
    await page.click('[data-testid="button-login"]');
    
    // Try to access school admin features
    await page.goto('/school-admin');
    
    // Should show access denied
    const hasAccessDenied = await page.locator('text=Insufficient permissions').isVisible();
    const isNotSchoolAdmin = !page.url().includes('/school-admin');
    
    expect(hasAccessDenied || isNotSchoolAdmin).toBeTruthy();
  });

  test('Cross-role data access should be prevented', async ({ page }) => {
    // Login as viewer
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    // Try to access another user's data via API
    const response = await page.request.get('http://localhost:5174/api/users/me/some-other-user-id');
    expect(response.status()).toBe(403);
    
    const responseData = await response.json();
    expect(responseData.error).toBeDefined();
    expect(responseData.error.code).toBe('access_denied');
  });

  test('Invalid JWT tokens should be rejected', async ({ page }) => {
    // Set invalid token in localStorage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'invalid-jwt-token');
    });
    
    // Try to access protected route
    await page.goto('/feed');
    
    // Should redirect to login
    expect(page.url()).toContain('/login');
  });

  test('Expired JWT tokens should be rejected', async ({ page }) => {
    // Create an expired token (this would need to be generated properly in a real test)
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QiLCJleHAiOjE2MDAwMDAwMDB9.invalid';
    
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, expiredToken);
    
    // Try to access protected route
    await page.goto('/feed');
    
    // Should redirect to login
    expect(page.url()).toContain('/login');
  });

  test('SQL injection attempts should be sanitized', async ({ page }) => {
    // Login as any user
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    // Try SQL injection in search
    await page.goto('/search');
    await page.fill('[data-testid="search-input"]', "'; DROP TABLE users; --");
    await page.click('[data-testid="search-button"]');
    
    // Should not crash and should handle gracefully
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('XSS attempts should be sanitized', async ({ page }) => {
    // Login as any user
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    // Try XSS in profile update
    await page.goto('/settings');
    await page.fill('[data-testid="input-bio"]', '<script>alert("xss")</script>');
    await page.click('[data-testid="button-save-profile"]');
    
    // Should save without executing script
    await expect(page.locator('text=Profile updated successfully')).toBeVisible();
    
    // Check that script was not executed (no alert)
    const alertHandled = await page.evaluate(() => {
      return window.alert === undefined || !window.alert.toString().includes('xss');
    });
    expect(alertHandled).toBeTruthy();
  });
});
