import { test, expect } from '@playwright/test';

test.describe('Viewer Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Login as viewer
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    await expect(page).toHaveURL('/feed');
  });

  test('Feed should load and display posts', async ({ page }) => {
    // Should be on feed page
    await expect(page).toHaveURL('/feed');
    
    // Should see posts
    await expect(page.locator('[data-testid="post-card"]')).toHaveCount.greaterThan(0);
  });

  test('Should be able to open post and view comments', async ({ page }) => {
    // Click on first post
    await page.click('[data-testid="post-card"]:first-child');
    
    // Should open post modal or navigate to post detail
    await expect(page.locator('[data-testid="post-detail"]')).toBeVisible();
    
    // Click "View all comments" if available
    const viewCommentsBtn = page.locator('text=View all comments');
    if (await viewCommentsBtn.isVisible()) {
      await viewCommentsBtn.click();
      await expect(page.locator('[data-testid="comments-modal"]')).toBeVisible();
    }
  });

  test('Should be able to follow/unfollow students', async ({ page }) => {
    // Navigate to search page
    await page.goto('/search');
    
    // Search for a student
    await page.fill('[data-testid="search-input"]', 'marcus');
    await page.click('[data-testid="search-button"]');
    
    // Should see search results
    await expect(page.locator('[data-testid="student-card"]')).toHaveCount.greaterThan(0);
    
    // Click follow button on first student
    const followBtn = page.locator('[data-testid="follow-button"]:first-child');
    await followBtn.click();
    
    // Button should change to "Following"
    await expect(followBtn).toHaveText('Following');
    
    // Click again to unfollow
    await followBtn.click();
    await expect(followBtn).toHaveText('Follow');
  });

  test('Following tab should show followed students', async ({ page }) => {
    // First follow a student
    await page.goto('/search');
    await page.fill('[data-testid="search-input"]', 'marcus');
    await page.click('[data-testid="search-button"]');
    await page.click('[data-testid="follow-button"]:first-child');
    
    // Navigate to following page
    await page.goto('/following');
    
    // Should see followed students
    await expect(page.locator('[data-testid="following-card"]')).toHaveCount.greaterThan(0);
    
    // Click on student name/avatar should navigate to profile
    await page.click('[data-testid="following-card"]:first-child [data-testid="student-name"]');
    await expect(page).toHaveURL(/\/profile\/\w+/);
  });

  test('Should be able to save/unsave posts', async ({ page }) => {
    // Go to feed
    await page.goto('/feed');
    
    // Click save button on first post
    const saveBtn = page.locator('[data-testid="save-button"]:first-child');
    await saveBtn.click();
    
    // Button should change to "Saved"
    await expect(saveBtn).toHaveText('Saved');
    
    // Navigate to saved posts
    await page.goto('/saved');
    
    // Should see saved posts
    await expect(page.locator('[data-testid="saved-post"]')).toHaveCount.greaterThan(0);
    
    // Click unsave
    await page.click('[data-testid="unsave-button"]:first-child');
    await expect(page.locator('[data-testid="saved-post"]')).toHaveCount(0);
  });

  test('Settings should allow profile updates', async ({ page }) => {
    await page.goto('/settings');
    
    // Update name
    await page.fill('[data-testid="input-name"]', 'Updated Name');
    await page.fill('[data-testid="input-bio"]', 'Updated bio text');
    
    // Save changes
    await page.click('[data-testid="button-save-profile"]');
    
    // Should show success message
    await expect(page.locator('text=Profile updated successfully')).toBeVisible();
  });

  test('Should be able to change password', async ({ page }) => {
    await page.goto('/settings');
    
    // Navigate to password change section
    await page.click('[data-testid="password-tab"]');
    
    // Fill password change form
    await page.fill('[data-testid="input-current-password"]', 'viewer123');
    await page.fill('[data-testid="input-new-password"]', 'newpassword123');
    await page.fill('[data-testid="input-confirm-password"]', 'newpassword123');
    
    // Submit
    await page.click('[data-testid="button-change-password"]');
    
    // Should show success message
    await expect(page.locator('text=Password updated successfully')).toBeVisible();
  });
});