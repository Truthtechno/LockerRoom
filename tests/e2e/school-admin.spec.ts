import { test, expect } from '@playwright/test';

test.describe('School Admin Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Login as school admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'principal@lincoln.edu');
    await page.fill('[data-testid="input-password"]', 'principal123');
    await page.click('[data-testid="button-login"]');
    await expect(page).toHaveURL('/school-admin');
  });

  test('Should be able to add new student', async ({ page }) => {
    // Navigate to add student page
    await page.goto('/school-admin/add-student');
    
    // Fill student form
    await page.fill('[data-testid="input-name"]', 'John Doe');
    await page.fill('[data-testid="input-email"]', `john.doe.${Date.now()}@student.com`);
    await page.fill('[data-testid="input-phone"]', '555-0123');
    await page.selectOption('[data-testid="select-gender"]', 'Male');
    await page.fill('[data-testid="input-date-of-birth"]', '2005-01-01');
    await page.selectOption('[data-testid="select-grade"]', '12');
    await page.fill('[data-testid="input-guardian-contact"]', 'guardian@example.com');
    await page.selectOption('[data-testid="select-sport"]', 'Basketball');
    await page.fill('[data-testid="input-position"]', 'Forward');
    await page.fill('[data-testid="input-bio"]', 'New student athlete');
    
    // Upload profile photo
    const fileInput = page.locator('[data-testid="profile-photo-upload"]');
    await fileInput.setInputFiles('tests/fixtures/test-image.png');
    
    // Submit form
    await page.click('[data-testid="button-add-student"]');
    
    // Should show success with OTP
    await expect(page.locator('text=Student added successfully')).toBeVisible();
    await expect(page.locator('text=One-time password:')).toBeVisible();
    
    // Should show OTP in response
    const otpText = await page.textContent('[data-testid="otp-display"]');
    expect(otpText).toMatch(/\d{6}/);
  });

  test('New student should be able to login with OTP', async ({ page }) => {
    // First add a student (simplified version)
    await page.goto('/school-admin/add-student');
    await page.fill('[data-testid="input-name"]', 'Jane Smith');
    await page.fill('[data-testid="input-email"]', `jane.smith.${Date.now()}@student.com`);
    await page.selectOption('[data-testid="select-sport"]', 'Soccer');
    await page.click('[data-testid="button-add-student"]');
    
    // Get the OTP from the response
    const otpText = await page.textContent('[data-testid="otp-display"]');
    const otp = otpText?.match(/\d{6}/)?.[0];
    
    // Open new tab for student login
    const studentPage = await page.context().newPage();
    await studentPage.goto('/login');
    
    // Login with OTP
    await studentPage.fill('[data-testid="input-email"]', `jane.smith.${Date.now()}@student.com`);
    await studentPage.fill('[data-testid="input-password"]', otp || '123456');
    await studentPage.click('[data-testid="button-login"]');
    
    // Should be redirected to change password
    await expect(studentPage).toHaveURL(/\/change-password/);
    
    // Change password
    await studentPage.fill('[data-testid="input-new-password"]', 'newpassword123');
    await studentPage.fill('[data-testid="input-confirm-password"]', 'newpassword123');
    await studentPage.click('[data-testid="button-change-password"]');
    
    // Should redirect to feed
    await expect(studentPage).toHaveURL('/feed');
    
    await studentPage.close();
  });

  test('Live Analytics should show correct counts', async ({ page }) => {
    // Navigate to live reports
    await page.goto('/school-admin/live-reports');
    
    // Should see analytics data
    await expect(page.locator('[data-testid="total-students"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-posts"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-likes"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-comments"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-saves"]')).toBeVisible();
    
    // Values should match database (non-zero for seeded data)
    const studentsCount = await page.textContent('[data-testid="total-students"]');
    expect(parseInt(studentsCount || '0')).toBeGreaterThan(0);
  });

  test('Student Search should return results', async ({ page }) => {
    // Navigate to student search
    await page.goto('/school-admin/student-search');
    
    // Search for existing student
    await page.fill('[data-testid="search-input"]', 'marcus');
    await page.click('[data-testid="search-button"]');
    
    // Should see search results
    await expect(page.locator('[data-testid="student-result"]')).toHaveCount.greaterThan(0);
    
    // Click on student should open profile
    await page.click('[data-testid="student-result"]:first-child');
    await expect(page.locator('[data-testid="student-profile"]')).toBeVisible();
  });

  test('Should be able to rate students', async ({ page }) => {
    await page.goto('/school-admin/student-search');
    
    // Search and select a student
    await page.fill('[data-testid="search-input"]', 'marcus');
    await page.click('[data-testid="search-button"]');
    await page.click('[data-testid="student-result"]:first-child');
    
    // Add rating
    await page.click('[data-testid="add-rating-button"]');
    await page.fill('[data-testid="rating-score"]', '8');
    await page.fill('[data-testid="rating-comment"]', 'Excellent performance');
    await page.click('[data-testid="submit-rating"]');
    
    // Should show success
    await expect(page.locator('text=Rating added successfully')).toBeVisible();
  });

  test('Settings should allow school profile updates', async ({ page }) => {
    await page.goto('/school-admin/manage-settings');
    
    // Update school settings
    await page.fill('[data-testid="input-school-name"]', 'Lincoln High School Updated');
    await page.fill('[data-testid="input-school-description"]', 'Updated school description');
    
    // Upload school logo if supported
    const logoInput = page.locator('[data-testid="logo-upload"]');
    if (await logoInput.isVisible()) {
      await logoInput.setInputFiles('tests/fixtures/test-image.png');
    }
    
    // Save changes
    await page.click('[data-testid="button-save-settings"]');
    
    // Should show success
    await expect(page.locator('text=Settings updated successfully')).toBeVisible();
  });
});