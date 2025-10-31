import { test, expect } from '@playwright/test';

test.describe('System Admin Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Login as system admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'admin@lockerroom.com');
    await page.fill('[data-testid="input-password"]', 'admin123');
    await page.click('[data-testid="button-login"]');
    await expect(page).toHaveURL('/system-admin');
  });

  test('Should be able to create new school', async ({ page }) => {
    // Navigate to school management
    await page.goto('/system-admin');
    
    // Click create school button
    await page.click('[data-testid="create-school-button"]');
    
    // Fill school form
    await page.fill('[data-testid="input-school-name"]', 'Test High School');
    await page.fill('[data-testid="input-school-address"]', '123 Test St, Test City, TC 12345');
    await page.fill('[data-testid="input-school-phone"]', '555-0123');
    await page.fill('[data-testid="input-school-email"]', 'admin@testhigh.edu');
    await page.selectOption('[data-testid="select-subscription-plan"]', 'premium');
    await page.fill('[data-testid="input-max-students"]', '300');
    
    // Submit form
    await page.click('[data-testid="button-create-school"]');
    
    // Should show success message
    await expect(page.locator('text=School created successfully')).toBeVisible();
    
    // Should appear in schools list
    await expect(page.locator('text=Test High School')).toBeVisible();
  });

  test('Should be able to review school applications', async ({ page }) => {
    // Navigate to school applications
    await page.goto('/system-admin/school-applications');
    
    // Should see applications list
    await expect(page.locator('[data-testid="application-card"]')).toHaveCount.greaterThan(0);
    
    // Click on first application
    await page.click('[data-testid="application-card"]:first-child');
    
    // Should see application details
    await expect(page.locator('[data-testid="application-details"]')).toBeVisible();
    
    // Approve application
    await page.click('[data-testid="approve-application"]');
    await page.fill('[data-testid="reviewer-notes"]', 'Approved for testing');
    await page.click('[data-testid="confirm-approve"]');
    
    // Should show success
    await expect(page.locator('text=Application approved successfully')).toBeVisible();
  });

  test('Platform Analytics should show non-zero totals', async ({ page }) => {
    // Navigate to platform analytics
    await page.goto('/system-admin/platform-analytics');
    
    // Should see analytics data
    await expect(page.locator('[data-testid="total-schools"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-students"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-posts"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-views"]')).toBeVisible();
    
    // Values should be non-zero (seeded data)
    const schoolsCount = await page.textContent('[data-testid="total-schools"]');
    expect(parseInt(schoolsCount || '0')).toBeGreaterThan(0);
    
    const studentsCount = await page.textContent('[data-testid="total-students"]');
    expect(parseInt(studentsCount || '0')).toBeGreaterThan(0);
  });

  test('Should be able to manage admin roles', async ({ page }) => {
    // Navigate to admin management
    await page.goto('/system-admin/admin-management');
    
    // Should see admin roles list
    await expect(page.locator('[data-testid="admin-role-card"]')).toHaveCount.greaterThan(0);
    
    // Create new admin role
    await page.click('[data-testid="create-admin-button"]');
    await page.fill('[data-testid="input-admin-email"]', 'newadmin@example.com');
    await page.selectOption('[data-testid="select-admin-role"]', 'school_admin');
    await page.fill('[data-testid="input-admin-school"]', 'Lincoln High School');
    await page.click('[data-testid="button-create-admin"]');
    
    // Should show success
    await expect(page.locator('text=Admin role created successfully')).toBeVisible();
  });

  test('Should be able to configure system settings', async ({ page }) => {
    // Navigate to system config
    await page.goto('/system-admin/system-config');
    
    // Should see settings form
    await expect(page.locator('[data-testid="system-settings-form"]')).toBeVisible();
    
    // Update a setting
    await page.fill('[data-testid="input-max-file-size"]', '100');
    await page.fill('[data-testid="input-session-timeout"]', '3600');
    await page.click('[data-testid="button-save-settings"]');
    
    // Should show success
    await expect(page.locator('text=System settings updated successfully')).toBeVisible();
  });

  test('Should be able to view detailed analytics', async ({ page }) => {
    await page.goto('/system-admin/platform-analytics');
    
    // Should see various analytics charts
    await expect(page.locator('[data-testid="schools-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="students-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="engagement-chart"]')).toBeVisible();
    
    // Should be able to filter by date range
    await page.fill('[data-testid="date-from"]', '2024-01-01');
    await page.fill('[data-testid="date-to"]', '2024-12-31');
    await page.click('[data-testid="apply-filter"]');
    
    // Charts should update
    await expect(page.locator('[data-testid="schools-chart"]')).toBeVisible();
  });
});