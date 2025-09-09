import { test, expect, Page } from '@playwright/test';

test.describe('System Admin Portal', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as system admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'admin@lockerroom.com');
    await page.fill('[data-testid="input-password"]', 'Admin123!');
    await page.click('[data-testid="button-login"]');
    
    // Wait for redirect to system admin dashboard
    await page.waitForURL('/system-admin');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('TC-SA-001: System Admin Login and Dashboard Access', async () => {
    // Verify system admin dashboard loads
    await expect(page).toHaveURL('/system-admin');
    await expect(page.locator('h1')).toContainText('System Administration');
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/system-admin-dashboard.png' });
    
    // Verify admin navigation exists
    await expect(page.locator('[data-testid="button-review-applications"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-platform-analytics"]')).toBeVisible();
  });

  test('TC-SA-002: Review School Applications Portal', async () => {
    // Navigate to school applications
    await page.click('[data-testid="button-review-applications"]');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of applications page
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/school-applications.png' });
    
    // Verify applications table is visible
    await expect(page.locator('table, .applications-list')).toBeVisible();
  });

  test('TC-SA-003: Platform Analytics Access', async () => {
    // Navigate to platform analytics
    await page.click('[data-testid="button-platform-analytics"]');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of analytics page
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/platform-analytics.png' });
    
    // Verify analytics charts/data is visible
    await expect(page.locator('.chart, .analytics')).toBeVisible();
  });

  test('TC-SA-004: Create New School Application', async () => {
    // Navigate to school applications
    await page.click('[data-testid="button-review-applications"]');
    await page.waitForLoadState('networkidle');
    
    // Look for "Add New School" or similar button
    const addButton = page.locator('[data-testid="button-add-school"], button:has-text("Add"), button:has-text("New")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Fill out school application form if modal/form appears
      await page.waitForSelector('form, [role="dialog"]', { timeout: 5000 });
      
      // Take screenshot of form
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/add-school-form.png' });
      
      // Fill basic fields if they exist
      const nameField = page.locator('input[name="schoolName"], input[placeholder*="school"], input[placeholder*="name"]').first();
      if (await nameField.isVisible()) {
        await nameField.fill('Test Academy');
      }
      
      const emailField = page.locator('input[type="email"], input[name="email"]').first();
      if (await emailField.isVisible()) {
        await emailField.fill('test@academy.com');
      }
    }
  });

  test('TC-SA-005: System Configuration Access', async () => {
    // Look for system settings/configuration
    const settingsButton = page.locator('[data-testid*="settings"], [data-testid*="config"], button:has-text("Settings"), button:has-text("Configuration")').first();
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForLoadState('networkidle');
      
      // Take screenshot
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/system-configuration.png' });
      
      // Verify configuration form/options are visible
      await expect(page.locator('form, .settings, .configuration')).toBeVisible();
    } else {
      // If no direct settings access, navigate through menu
      await page.goto('/system-admin/settings');
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/system-configuration-alt.png' });
    }
  });

  test('TC-SA-006: Unauthorized Access Prevention', async () => {
    // Logout and try to access system admin page directly
    await page.goto('/logout');
    await page.goto('/system-admin');
    
    // Should redirect to login or show access denied
    await expect(page).toHaveURL(/\/login|\/unauthorized|\/403/);
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/unauthorized-access.png' });
  });
});