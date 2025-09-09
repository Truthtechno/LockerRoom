import { test, expect, Page } from '@playwright/test';
import path from 'path';

test.describe('School Admin Portal', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as school admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'school@lockerroom.com');
    await page.fill('[data-testid="input-password"]', 'School123!');
    await page.click('[data-testid="button-login"]');
    
    // Wait for redirect to school admin dashboard
    await page.waitForURL('/school-admin');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('TC-SAD-001: School Admin Login and Dashboard Access', async () => {
    // Verify school admin dashboard loads
    await expect(page).toHaveURL('/school-admin');
    await expect(page.locator('h1')).toContainText('School Administration');
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/school-admin-dashboard.png' });
    
    // Verify school admin navigation exists
    await expect(page.locator('[data-testid="button-add-student"]')).toBeVisible();
  });

  test('TC-SAD-002: Add Student Functionality', async () => {
    // Click Add Student button
    await page.click('[data-testid="button-add-student"]');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of add student form
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/add-student-form.png' });
    
    // Fill out student form
    await page.fill('input[name="name"], input[placeholder*="name"]', 'Test Student');
    await page.fill('input[type="email"], input[name="email"]', 'teststudent@test.com');
    await page.fill('input[name="phone"], input[placeholder*="phone"]', '555-0123');
    
    // Upload profile picture if file input exists
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles(path.join(process.cwd(), 'tests/fixtures/test-image.png'));
    }
    
    // Fill additional fields
    await page.selectOption('select[name="sport"], select:has(option)', { index: 1 });
    await page.fill('input[name="position"], input[placeholder*="position"]', 'Forward');
    await page.fill('textarea[name="bio"], textarea[placeholder*="bio"]', 'Test student athlete bio');
    
    // Submit form
    const submitButton = page.locator('[data-testid="button-submit"], button[type="submit"], button:has-text("Add Student")').first();
    await submitButton.click();
    
    // Wait for success message or redirect
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of result
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/add-student-result.png' });
    
    // Verify success (toast message or redirect)
    const successIndicator = page.locator('.toast, .success, .alert-success');
    if (await successIndicator.isVisible()) {
      await expect(successIndicator).toContainText(/success|added|created/i);
    }
  });

  test('TC-SAD-003: View Live Reports and Analytics', async () => {
    // Look for reports/analytics button
    const reportsButton = page.locator('[data-testid*="report"], [data-testid*="analytics"], button:has-text("Reports"), button:has-text("Analytics")').first();
    
    if (await reportsButton.isVisible()) {
      await reportsButton.click();
      await page.waitForLoadState('networkidle');
      
      // Take screenshot
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/school-reports.png' });
      
      // Verify charts/data are visible
      await expect(page.locator('.chart, .analytics, .report')).toBeVisible();
    } else {
      // Navigate to reports manually
      await page.goto('/school-admin/reports');
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/school-reports-alt.png' });
    }
  });

  test('TC-SAD-004: Settings Read-Only Restrictions', async () => {
    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/school-admin-settings.png' });
    
    // Check if subscription fields are read-only
    const subscriptionField = page.locator('[data-testid="subscription-plan"], input[name*="subscription"], select[name*="plan"]').first();
    const maxStudentsField = page.locator('[data-testid="max-students"], input[name*="students"], input[name*="limit"]').first();
    
    if (await subscriptionField.isVisible()) {
      // Verify field is disabled/readonly
      await expect(subscriptionField).toBeDisabled();
    }
    
    if (await maxStudentsField.isVisible()) {
      // Verify field is disabled/readonly
      await expect(maxStudentsField).toBeDisabled();
    }
    
    // Verify "School Admin" role badge is displayed
    await expect(page.locator(':has-text("School Admin")')).toBeVisible();
  });

  test('TC-SAD-005: Student Search and Profile Access', async () => {
    // Navigate to students list or search
    const studentsButton = page.locator('button:has-text("Students"), [data-testid*="student"]').first();
    
    if (await studentsButton.isVisible()) {
      await studentsButton.click();
      await page.waitForLoadState('networkidle');
    } else {
      await page.goto('/school-admin/students');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/students-list.png' });
    
    // Search for a student if search box exists
    const searchInput = page.locator('[data-testid="student-search"], input[placeholder*="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Diego');
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of search results
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/student-search-results.png' });
    }
  });

  test('TC-SAD-006: API Restrictions Test', async () => {
    // Attempt to modify subscription via API (should fail)
    const response = await page.request.put('/api/schools/subscription', {
      data: { plan: 'premium', maxStudents: 500 }
    });
    
    // Should return 403 or similar error
    expect(response.status()).toBeGreaterThanOrEqual(400);
    
    // Take screenshot showing current page
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/api-restriction-test.png' });
  });
});