import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000');
  });

  test('should allow viewer registration and login', async ({ page }) => {
    // Navigate to signup/register page
    await page.click('[data-testid="link-signup"]');
    
    // Fill registration form
    await page.fill('[data-testid="input-email"]', 'e2e.viewer@example.com');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.fill('[data-testid="input-name"]', 'E2E Test Viewer');
    await page.fill('[data-testid="input-bio"]', 'E2E test account for viewer');
    
    // Submit registration
    await page.click('[data-testid="button-register"]');
    
    // Should redirect to feed after successful registration
    await expect(page).toHaveURL(/.*feed/);
    await expect(page.locator('[data-testid="text-username"]')).toContainText('E2E Test Viewer');
  });

  test('should allow login with demo accounts', async ({ page }) => {
    // Navigate to login page
    await page.click('[data-testid="link-login"]');
    
    // Login as viewer
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    // Should redirect to feed
    await expect(page).toHaveURL(/.*feed/);
    await expect(page.locator('[data-testid="text-username"]')).toContainText('Sarah Johnson');
  });

  test('should handle login errors gracefully', async ({ page }) => {
    await page.click('[data-testid="link-login"]');
    
    // Try invalid credentials
    await page.fill('[data-testid="input-email"]', 'invalid@example.com');
    await page.fill('[data-testid="input-password"]', 'wrongpassword');
    await page.click('[data-testid="button-login"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
  });

  test('should allow password change', async ({ page }) => {
    // Login first
    await page.click('[data-testid="link-login"]');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    // Navigate to settings
    await page.click('[data-testid="link-settings"]');
    
    // Change password section
    await page.fill('[data-testid="input-current-password"]', 'viewer123');
    await page.fill('[data-testid="input-new-password"]', 'newpassword123');
    await page.fill('[data-testid="input-confirm-password"]', 'newpassword123');
    await page.click('[data-testid="button-change-password"]');
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Password updated successfully');
  });
});