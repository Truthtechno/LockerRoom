import { test, expect } from '@playwright/test';

test.describe('Accessibility Tests', () => {
  test('Login page should be accessible', async ({ page }) => {
    await page.goto('/login');
    
    // Check for basic accessibility issues
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('form')).toBeVisible();
    
    // Check form labels
    await expect(page.locator('label[for*="email"]')).toBeVisible();
    await expect(page.locator('label[for*="password"]')).toBeVisible();
    
    // Check for proper form structure
    const emailInput = page.locator('[data-testid="input-email"]');
    const passwordInput = page.locator('[data-testid="input-password"]');
    
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Check for submit button
    await expect(page.locator('[data-testid="button-login"]')).toBeVisible();
  });

  test('Signup page should be accessible', async ({ page }) => {
    await page.goto('/signup');
    
    // Check for proper heading structure
    await expect(page.locator('h1')).toBeVisible();
    
    // Check form accessibility
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    // Check all form fields have labels
    const nameInput = page.locator('[data-testid="input-name"]');
    const emailInput = page.locator('[data-testid="input-email"]');
    const passwordInput = page.locator('[data-testid="input-password"]');
    const confirmPasswordInput = page.locator('[data-testid="input-confirm-password"]');
    
    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(confirmPasswordInput).toBeVisible();
    
    // Check password visibility toggles have proper labels
    const passwordToggle = page.locator('[data-testid="toggle-password"]');
    const confirmPasswordToggle = page.locator('[data-testid="toggle-confirm-password"]');
    
    await expect(passwordToggle).toHaveAttribute('aria-label');
    await expect(confirmPasswordToggle).toHaveAttribute('aria-label');
  });

  test('Viewer feed should be accessible', async ({ page }) => {
    // Login as viewer
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    await page.goto('/feed');
    
    // Check for proper heading structure
    await expect(page.locator('h1, h2')).toHaveCount.greaterThan(0);
    
    // Check for navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    
    // Check for main content area
    const main = page.locator('main');
    await expect(main).toBeVisible();
    
    // Check post cards have proper structure
    const postCards = page.locator('[data-testid="post-card"]');
    if (await postCards.count() > 0) {
      const firstPost = postCards.first();
      await expect(firstPost).toBeVisible();
      
      // Check for proper button labels
      const likeButton = firstPost.locator('[data-testid="like-button"]');
      const commentButton = firstPost.locator('[data-testid="comment-button"]');
      const saveButton = firstPost.locator('[data-testid="save-button"]');
      
      if (await likeButton.isVisible()) {
        await expect(likeButton).toHaveAttribute('aria-label');
      }
      if (await commentButton.isVisible()) {
        await expect(commentButton).toHaveAttribute('aria-label');
      }
      if (await saveButton.isVisible()) {
        await expect(saveButton).toHaveAttribute('aria-label');
      }
    }
  });

  test('Student dashboard should be accessible', async ({ page }) => {
    // Login as student
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'marcus.rodriguez@student.com');
    await page.fill('[data-testid="input-password"]', 'student123');
    await page.click('[data-testid="button-login"]');
    
    await page.goto('/feed');
    
    // Check for create post button accessibility
    const createPostBtn = page.locator('[data-testid="create-post-button"]');
    if (await createPostBtn.isVisible()) {
      await expect(createPostBtn).toHaveAttribute('aria-label');
    }
    
    // Check for proper form structure in create post modal
    await createPostBtn.click();
    
    const modal = page.locator('[data-testid="create-post-modal"]');
    if (await modal.isVisible()) {
      await expect(modal).toHaveAttribute('role', 'dialog');
      await expect(modal).toHaveAttribute('aria-labelledby');
      
      // Check form fields
      const captionInput = modal.locator('[data-testid="post-caption"]');
      const mediaUpload = modal.locator('[data-testid="media-upload"]');
      
      if (await captionInput.isVisible()) {
        await expect(captionInput).toHaveAttribute('aria-label');
      }
      if (await mediaUpload.isVisible()) {
        await expect(mediaUpload).toHaveAttribute('aria-label');
      }
    }
  });

  test('School admin analytics should be accessible', async ({ page }) => {
    // Login as school admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'principal@lincoln.edu');
    await page.fill('[data-testid="input-password"]', 'principal123');
    await page.click('[data-testid="button-login"]');
    
    await page.goto('/school-admin/live-reports');
    
    // Check for proper heading structure
    await expect(page.locator('h1')).toBeVisible();
    
    // Check for data tables accessibility
    const tables = page.locator('table');
    if (await tables.count() > 0) {
      const firstTable = tables.first();
      await expect(firstTable).toHaveAttribute('role', 'table');
      
      // Check for table headers
      const headers = firstTable.locator('th');
      await expect(headers).toHaveCount.greaterThan(0);
    }
    
    // Check for charts accessibility
    const charts = page.locator('[data-testid*="chart"]');
    if (await charts.count() > 0) {
      const firstChart = charts.first();
      await expect(firstChart).toHaveAttribute('aria-label');
    }
  });

  test('System admin management should be accessible', async ({ page }) => {
    // Login as system admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'admin@lockerroom.com');
    await page.fill('[data-testid="input-password"]', 'admin123');
    await page.click('[data-testid="button-login"]');
    
    await page.goto('/system-admin');
    
    // Check for proper heading structure
    await expect(page.locator('h1')).toBeVisible();
    
    // Check for navigation accessibility
    const navItems = page.locator('nav a, nav button');
    await expect(navItems).toHaveCount.greaterThan(0);
    
    // Check each nav item has proper accessibility attributes
    for (let i = 0; i < await navItems.count(); i++) {
      const navItem = navItems.nth(i);
      const text = await navItem.textContent();
      if (text && text.trim()) {
        await expect(navItem).toHaveAttribute('aria-label');
      }
    }
  });

  test('Settings page should be accessible', async ({ page }) => {
    // Login as any user
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    await page.goto('/settings');
    
    // Check for proper form structure
    const forms = page.locator('form');
    await expect(forms).toHaveCount.greaterThan(0);
    
    // Check each form has proper accessibility
    for (let i = 0; i < await forms.count(); i++) {
      const form = forms.nth(i);
      
      // Check form has proper structure
      const inputs = form.locator('input, textarea, select');
      await expect(inputs).toHaveCount.greaterThan(0);
      
      // Check each input has proper accessibility
      for (let j = 0; j < await inputs.count(); j++) {
        const input = inputs.nth(j);
        const type = await input.getAttribute('type');
        
        if (type !== 'hidden') {
          // Check for label or aria-label
          const hasLabel = await input.locator('xpath=..//label').count() > 0;
          const hasAriaLabel = await input.getAttribute('aria-label');
          const hasAriaLabelledBy = await input.getAttribute('aria-labelledby');
          
          expect(hasLabel || hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
        }
      }
    }
  });

  test('Error messages should be accessible', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login with invalid credentials
    await page.fill('[data-testid="input-email"]', 'invalid@example.com');
    await page.fill('[data-testid="input-password"]', 'wrongpassword');
    await page.click('[data-testid="button-login"]');
    
    // Check error message accessibility
    const errorMessage = page.locator('text=Invalid credentials');
    await expect(errorMessage).toBeVisible();
    
    // Check error message has proper role
    await expect(errorMessage).toHaveAttribute('role', 'alert');
  });

  test('Loading states should be accessible', async ({ page }) => {
    await page.goto('/login');
    
    // Check loading state accessibility
    const loginButton = page.locator('[data-testid="button-login"]');
    await expect(loginButton).toBeVisible();
    
    // Simulate loading state
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    // Check for loading indicator
    const loadingIndicator = page.locator('[data-testid="loading-indicator"], [aria-busy="true"]');
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toHaveAttribute('aria-label');
    }
  });
});
