import { test, expect } from '@playwright/test';

test.describe('Auth & Signup', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to signup page
    await page.goto('/signup');
  });

  test('Viewer signup with new email should succeed', async ({ page }) => {
    // Fill out signup form
    await page.fill('[data-testid="input-name"]', 'Test User');
    await page.fill('[data-testid="input-email"]', `test-${Date.now()}@example.com`);
    await page.fill('[data-testid="input-password"]', 'testpassword123');
    await page.fill('[data-testid="input-confirm-password"]', 'testpassword123');
    
    // Submit form
    await page.click('[data-testid="button-signup"]');
    
    // Wait for success toast
    await expect(page.locator('text=Welcome to LockerRoom!')).toBeVisible();
    
    // Should redirect to feed
    await expect(page).toHaveURL('/feed');
  });

  test('Duplicate email should show error', async ({ page }) => {
    // Use existing email from seeded data
    await page.fill('[data-testid="input-name"]', 'Test User');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'testpassword123');
    await page.fill('[data-testid="input-confirm-password"]', 'testpassword123');
    
    // Submit form
    await page.click('[data-testid="button-signup"]');
    
    // Should show error message
    await expect(page.locator('text=Email already registered')).toBeVisible();
  });

  test('Password mismatch should show validation error', async ({ page }) => {
    await page.fill('[data-testid="input-name"]', 'Test User');
    await page.fill('[data-testid="input-email"]', `test-${Date.now()}@example.com`);
    await page.fill('[data-testid="input-password"]', 'testpassword123');
    await page.fill('[data-testid="input-confirm-password"]', 'differentpassword');
    
    // Submit form
    await page.click('[data-testid="button-signup"]');
    
    // Should show validation error
    await expect(page.locator('text=Passwords don\'t match')).toBeVisible();
  });

  test('Login with valid credentials should succeed', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Fill login form with seeded data
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    
    // Submit form
    await page.click('[data-testid="button-login"]');
    
    // Should redirect to feed
    await expect(page).toHaveURL('/feed');
  });

  test('Login with invalid credentials should show error', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'wrongpassword');
    
    await page.click('[data-testid="button-login"]');
    
    // Should show error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('Password visibility toggle should work', async ({ page }) => {
    await page.fill('[data-testid="input-password"]', 'testpassword123');
    
    // Password should be hidden by default
    await expect(page.locator('[data-testid="input-password"]')).toHaveAttribute('type', 'password');
    
    // Click toggle
    await page.click('[data-testid="toggle-password"]');
    
    // Password should be visible
    await expect(page.locator('[data-testid="input-password"]')).toHaveAttribute('type', 'text');
  });
});