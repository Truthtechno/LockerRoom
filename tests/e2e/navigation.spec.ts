import { test, expect } from '@playwright/test';

test.describe('Role-Aware Navigation', () => {
  test('Student Profile navigation should work correctly', async ({ page }) => {
    // Login as student
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'student@lockerroom.com');
    await page.fill('[data-testid="input-password"]', 'Student123!');
    await page.click('[data-testid="button-login"]');
    
    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');
    
    // Check that Profile tab exists and links to student's profile
    const profileLink = page.locator('[data-testid="mobile-nav-profile"]');
    await expect(profileLink).toBeVisible();
    
    // Click Profile tab
    await profileLink.click();
    
    // Should navigate to student's profile page
    await expect(page).toHaveURL(/\/profile\/[a-zA-Z0-9-]+/);
  });

  test('School Admin Dashboard navigation should work correctly', async ({ page }) => {
    // Login as school admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'schooladmin@lockerroom.com');
    await page.fill('[data-testid="input-password"]', 'SchoolAdmin123!');
    await page.click('[data-testid="button-login"]');
    
    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');
    
    // Check that Dashboard tab exists and shows correct label
    const dashboardLink = page.locator('[data-testid="mobile-nav-profile"]');
    await expect(dashboardLink).toBeVisible();
    
    // Should show "Dashboard" label for school admin
    await expect(dashboardLink.locator('text=Dashboard')).toBeVisible();
    
    // Click Dashboard tab
    await dashboardLink.click();
    
    // Should navigate to school admin dashboard
    await expect(page).toHaveURL('/school-admin');
  });

  test('System Admin Dashboard navigation should work correctly', async ({ page }) => {
    // Login as system admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'admin@lockerroom.com');
    await page.fill('[data-testid="input-password"]', 'admin123');
    await page.click('[data-testid="button-login"]');
    
    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');
    
    // Check that Dashboard tab exists and shows correct label
    const dashboardLink = page.locator('[data-testid="mobile-nav-profile"]');
    await expect(dashboardLink).toBeVisible();
    
    // Should show "Dashboard" label for system admin
    await expect(dashboardLink.locator('text=Dashboard')).toBeVisible();
    
    // Click Dashboard tab
    await dashboardLink.click();
    
    // Should navigate to system admin dashboard
    await expect(page).toHaveURL('/system-admin');
  });

  test('Admin should be able to navigate back to dashboard from student profile', async ({ page }) => {
    // Login as school admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'schooladmin@lockerroom.com');
    await page.fill('[data-testid="input-password"]', 'SchoolAdmin123!');
    await page.click('[data-testid="button-login"]');
    
    // Navigate to a student profile page
    await page.goto('/profile/some-student-id');
    
    // Click Dashboard tab to go back to admin dashboard
    const dashboardLink = page.locator('[data-testid="mobile-nav-profile"]');
    await dashboardLink.click();
    
    // Should navigate back to school admin dashboard
    await expect(page).toHaveURL('/school-admin');
  });
});
