import { test, expect, Page } from '@playwright/test';

test.describe('User Signup', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/signup');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('TC-SUP-001: Access Signup Page', async () => {
    // Verify signup page loads
    await expect(page).toHaveURL('/signup');
    await expect(page.locator('h1, h2')).toContainText(/signup|create|register/i);
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/signup-page.png' });
    
    // Verify signup form fields exist
    await expect(page.locator('[data-testid="input-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-confirm-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-signup"]')).toBeVisible();
  });

  test('TC-SUP-002: Navigate to Signup from Login', async () => {
    // Go to login page first
    await page.goto('/login');
    
    // Click create account link
    await page.click('[data-testid="link-create-account"]');
    
    // Should navigate to signup
    await expect(page).toHaveURL('/signup');
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/login-to-signup-navigation.png' });
  });

  test('TC-SUP-003: Successful Viewer Account Creation', async () => {
    // Generate unique email for test
    const timestamp = Date.now();
    const testEmail = `testviewer+${timestamp}@lockerroom.test`;
    
    // Fill signup form
    await page.fill('[data-testid="input-name"]', 'Test Viewer User');
    await page.fill('[data-testid="input-email"]', testEmail);
    await page.fill('[data-testid="input-password"]', 'Viewer123!');
    await page.fill('[data-testid="input-confirm-password"]', 'Viewer123!');
    
    // Take screenshot of filled form
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/signup-form-filled.png' });
    
    // Submit form
    await page.click('[data-testid="button-signup"]');
    
    // Wait for success or redirect
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of result
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/signup-success.png' });
    
    // Verify success (either redirect to feed or success message)
    const currentUrl = page.url();
    if (currentUrl.includes('/feed')) {
      // Successfully signed up and logged in
      await expect(page.locator('main, .feed')).toBeVisible();
    } else if (currentUrl.includes('/login')) {
      // Redirected to login after signup
      await expect(page.locator('.success, .toast:has-text("success")')).toBeVisible();
    } else {
      // Still on signup page with success message
      await expect(page.locator('.success, .toast, .alert-success')).toBeVisible();
    }
  });

  test('TC-SUP-004: Form Validation - Empty Fields', async () => {
    // Try to submit empty form
    await page.click('[data-testid="button-signup"]');
    
    // Wait for validation messages
    await page.waitForTimeout(1000);
    
    // Take screenshot of validation errors
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/signup-validation-empty.png' });
    
    // Verify validation messages appear
    const validationMessages = page.locator('.error, .invalid, [role="alert"], .field-error');
    await expect(validationMessages).toHaveCount(4); // All 4 fields should show validation
  });

  test('TC-SUP-005: Form Validation - Invalid Email', async () => {
    // Fill form with invalid email
    await page.fill('[data-testid="input-name"]', 'Test User');
    await page.fill('[data-testid="input-email"]', 'invalid-email');
    await page.fill('[data-testid="input-password"]', 'Password123!');
    await page.fill('[data-testid="input-confirm-password"]', 'Password123!');
    
    // Submit form
    await page.click('[data-testid="button-signup"]');
    
    // Wait for validation
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/signup-invalid-email.png' });
    
    // Verify email validation error
    await expect(page.locator(':has-text("valid email")')).toBeVisible();
  });

  test('TC-SUP-006: Form Validation - Password Mismatch', async () => {
    // Fill form with mismatched passwords
    await page.fill('[data-testid="input-name"]', 'Test User');
    await page.fill('[data-testid="input-email"]', 'test@example.com');
    await page.fill('[data-testid="input-password"]', 'Password123!');
    await page.fill('[data-testid="input-confirm-password"]', 'DifferentPassword123!');
    
    // Submit form
    await page.click('[data-testid="button-signup"]');
    
    // Wait for validation
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/signup-password-mismatch.png' });
    
    // Verify password mismatch error
    await expect(page.locator(':has-text("match"), :has-text("same")')).toBeVisible();
  });

  test('TC-SUP-007: Form Validation - Weak Password', async () => {
    // Fill form with weak password
    await page.fill('[data-testid="input-name"]', 'Test User');
    await page.fill('[data-testid="input-email"]', 'test@example.com');
    await page.fill('[data-testid="input-password"]', '123');
    await page.fill('[data-testid="input-confirm-password"]', '123');
    
    // Submit form
    await page.click('[data-testid="button-signup"]');
    
    // Wait for validation
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/signup-weak-password.png' });
    
    // Verify password strength error
    await expect(page.locator(':has-text("8 characters"), :has-text("characters")')).toBeVisible();
  });

  test('TC-SUP-008: Password Visibility Toggle', async () => {
    // Fill password field
    await page.fill('[data-testid="input-password"]', 'TestPassword123!');
    
    // Verify password is hidden by default
    const passwordInput = page.locator('[data-testid="input-password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle to show password
    const toggleButton = page.locator('[data-testid="toggle-password"]');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      
      // Verify password is now visible
      await expect(passwordInput).toHaveAttribute('type', 'text');
      
      // Take screenshot
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/password-visibility-toggle.png' });
      
      // Toggle back to hidden
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
    }
  });

  test('TC-SUP-009: Confirm Password Visibility Toggle', async () => {
    // Fill confirm password field
    await page.fill('[data-testid="input-confirm-password"]', 'TestPassword123!');
    
    // Verify confirm password is hidden by default
    const confirmPasswordInput = page.locator('[data-testid="input-confirm-password"]');
    await expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    
    // Click toggle to show confirm password
    const toggleButton = page.locator('[data-testid="toggle-confirm-password"]');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      
      // Verify password is now visible
      await expect(confirmPasswordInput).toHaveAttribute('type', 'text');
      
      // Take screenshot
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/confirm-password-visibility-toggle.png' });
    }
  });

  test('TC-SUP-010: Test New Account Login', async () => {
    // Create account first
    const timestamp = Date.now();
    const testEmail = `testlogin+${timestamp}@lockerroom.test`;
    
    await page.fill('[data-testid="input-name"]', 'Login Test User');
    await page.fill('[data-testid="input-email"]', testEmail);
    await page.fill('[data-testid="input-password"]', 'LoginTest123!');
    await page.fill('[data-testid="input-confirm-password"]', 'LoginTest123!');
    
    await page.click('[data-testid="button-signup"]');
    await page.waitForLoadState('networkidle');
    
    // Navigate to login page
    await page.goto('/login');
    
    // Login with new account
    await page.fill('[data-testid="input-email"]', testEmail);
    await page.fill('[data-testid="input-password"]', 'LoginTest123!');
    await page.click('[data-testid="button-login"]');
    
    // Wait for login success
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/new-account-login-success.png' });
    
    // Verify successful login (should be on feed page)
    await expect(page).toHaveURL('/feed');
    await expect(page.locator('main, .feed')).toBeVisible();
  });

  test('TC-SUP-011: Duplicate Email Registration', async () => {
    // Try to register with an existing email
    await page.fill('[data-testid="input-name"]', 'Duplicate User');
    await page.fill('[data-testid="input-email"]', 'viewer@lockerroom.com'); // Existing email
    await page.fill('[data-testid="input-password"]', 'NewPassword123!');
    await page.fill('[data-testid="input-confirm-password"]', 'NewPassword123!');
    
    await page.click('[data-testid="button-signup"]');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/duplicate-email-error.png' });
    
    // Verify error message for duplicate email
    await expect(page.locator(':has-text("already exists"), :has-text("taken"), .error, .alert-error')).toBeVisible();
  });
});